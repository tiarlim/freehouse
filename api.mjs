import F from './core.js';

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function need(condition, message = 'Voce nao pode alterar este item.', status = 403) { if (!condition) throw new ApiError(status, message); }
function str(value, max, field) { need(typeof value === 'string' && value.trim().length > 0 && value.length <= max, `Revise ${field}.`, 400); return value.trim(); }
function date(value) { need(typeof value === 'string' && Number.isFinite(Date.parse(value)), 'Data invalida.', 400); return new Date(value).toISOString(); }
function ownImage(value) { return Object.values(F.photos).includes(value) ? value : F.photos.beach; }
async function rows(db, sql, values = []) { return (await db.query(sql, values)).rows; }
async function owned(db, actor, placeId) { return (await rows(db, 'SELECT id FROM fh_places WHERE id=$1 AND owner_id=$2', [placeId, actor.sub])).length > 0; }
async function profile(db, actor) {
  if (!actor) return null;
  await db.query('INSERT INTO fh_profiles(user_id,data) VALUES($1,$2) ON CONFLICT DO NOTHING', [actor.sub, { id:actor.sub, name:String(actor.name || 'Viajante').slice(0,40), role:'guest', bio:'', interests:[] }]);
  const [{ data }] = await rows(db, 'SELECT data FROM fh_profiles WHERE user_id=$1', [actor.sub]);
  return { ...data, id:actor.sub };
}
export async function getState(db, actor) {
  const me = await profile(db, actor);
  const places = (await rows(db,'SELECT id,owner_id,data FROM fh_places ORDER BY id')).map(p=>({ ...p.data, id:p.id, managedByMe:!!actor && p.owner_id === actor.sub }));
  const experiences = (await rows(db,`SELECT e.data, count(i.user_id)::int AS count FROM fh_experiences e LEFT JOIN fh_interests i ON i.experience_id=e.id GROUP BY e.id`)).map(e=>({...e.data, interestCount:e.count}));
  const points = (await rows(db,'SELECT data FROM fh_points')).map(p=>p.data);
  const postRows = await rows(db,`SELECT p.data, a.data->>'name' AS name, coalesce(array_agg(i.user_id) FILTER(WHERE i.user_id IS NOT NULL),'{}') AS interested FROM fh_posts p JOIN fh_profiles a ON a.user_id=p.author_id LEFT JOIN fh_post_interests i ON i.post_id=p.id WHERE (p.data->>'expiresAt')::timestamptz > now() GROUP BY p.id,a.user_id`);
  const accounts = me ? [me] : [];
  const posts = postRows.map(p => { if (!accounts.some(a=>a.id===p.data.authorId)) accounts.push({id:p.data.authorId,name:p.name,role:'guest',saved:[],joined:[],interests:[]}); return {...p.data,interested:p.interested}; });
  if (me) {
    me.saved = (await rows(db,'SELECT experience_id FROM fh_saved WHERE user_id=$1',[actor.sub])).map(r=>r.experience_id);
    me.joined = (await rows(db,'SELECT experience_id FROM fh_interests WHERE user_id=$1',[actor.sub])).map(r=>r.experience_id);
    const stays = await rows(db,'SELECT place_id,ends_at FROM fh_stays WHERE user_id=$1 AND ends_at>now()',[actor.sub]);
    me.stay = stays[0] ? {placeId:stays[0].place_id,endsAt:stays[0].ends_at.toISOString()} : null;
  }
  const metrics = {};
  for (const p of places.filter(p=>p.managedByMe)) {
    const [m] = await rows(db,`SELECT (SELECT count(*)::int FROM fh_views WHERE place_id=$1) AS views, (SELECT count(*)::int FROM fh_experiences WHERE place_id=$1) AS experiences, (SELECT count(*)::int FROM fh_interests i JOIN fh_experiences e ON e.id=i.experience_id WHERE e.place_id=$1) AS interests, (SELECT count(*)::int FROM fh_posts WHERE place_id=$1 AND (data->>'expiresAt')::timestamptz>now()) AS posts`,[p.id]); metrics[p.id]=m;
  }
  return {version:2, shared:true, sessionId:me?.id || null, accounts, places, experiences, points, posts, views:[], metrics};
}
export async function commit(pool, actor, operations) {
  need(actor, 'Entre na sua conta para continuar.', 401);
  need(Array.isArray(operations) && operations.length <= 30,'Alteracoes invalidas.',400);
  const db = await pool.connect();
  try {
    await db.query('BEGIN'); await profile(db,actor);
    for (const operation of operations) await apply(db,actor,operation);
    await db.query('COMMIT');
  } catch(error) { await db.query('ROLLBACK'); throw error; }
  finally { db.release(); }
  return getState(pool,actor);
}
async function apply(db, actor, op) {
  need(op && typeof op.type==='string','Alteracao invalida.',400);
  const v = op.value || {};
  if (op.type === 'profile') {
    const name=str(v.name,40,'nome'); need(['guest','host'].includes(v.role),'Perfil invalido.',400);
    need(typeof v.bio==='string' && v.bio.length<=200 && Array.isArray(v.interests) && v.interests.every(c=>F.categories.includes(c)),'Perfil invalido.',400);
    await db.query('UPDATE fh_profiles SET data=$2,updated_at=now() WHERE user_id=$1',[actor.sub,{id:actor.sub,name,role:v.role,bio:v.bio,interests:[...new Set(v.interests)]}]); return;
  }
  if (op.type === 'place') {
    const id=str(v.id,80,'identificador'), existing=(await rows(db,'SELECT owner_id FROM fh_places WHERE id=$1 FOR UPDATE',[id]))[0];
    need(!existing || existing.owner_id===actor.sub);
    const me=await profile(db,actor); need(me.role==='host','Entre como anfitriao para cadastrar um lugar.',403);
    need(['Hostel','Workspace','Casa de temporada','Pousada','Coliving'].includes(v.type),'Tipo invalido.',400);
    const data={id,name:str(v.name,80,'nome do lugar'),type:v.type,description:str(v.description,350,'descricao'),image:ownImage(v.image)};
    await db.query('INSERT INTO fh_places(id,owner_id,data) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data',[id,actor.sub,data]); return;
  }
  if (op.type==='experience' || op.type==='point') {
    const table=op.type==='experience'?'fh_experiences':'fh_points';
    need(await owned(db,actor,v.placeId)); const old=(await rows(db,`SELECT place_id FROM ${table} WHERE id=$1 FOR UPDATE`,[v.id]))[0]; need(!old || old.place_id===v.placeId);
    const id=str(v.id,80,'identificador'); let data;
    if (op.type==='experience') {
      data={id,placeId:v.placeId,title:str(v.title,80,'titulo'),description:str(v.description,450,'descricao'),location:str(v.location,100,'local'),startsAt:date(v.startsAt),price:v.price,capacity:v.capacity,category:v.category,status:v.status,image:ownImage(v.image)};
      try { F.validateExperience(data); } catch(e) { throw new ApiError(400,e.message); }
    } else {
      need(['Praia','Trilha','Passeio','Cafe','Bar','Workspace','Servico'].includes(v.category),'Categoria invalida.',400);
      data={id,placeId:v.placeId,name:str(v.name,80,'nome'),description:str(v.description,350,'recomendacao'),query:str(v.query,180,'endereco'),category:v.category};
    }
    await db.query(`INSERT INTO ${table}(id,place_id,data) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data`,[id,v.placeId,data]); return;
  }
  if (op.type==='delete-experience' || op.type==='delete-point') {
    const table=op.type==='delete-experience'?'fh_experiences':'fh_points';
    const existing=(await rows(db,`SELECT place_id FROM ${table} WHERE id=$1 FOR UPDATE`,[op.id]))[0]; need(existing && await owned(db,actor,existing.place_id));
    await db.query(`DELETE FROM ${table} WHERE id=$1`,[op.id]); return;
  }
  if (op.type==='saved' || op.type==='interest') {
    const e=(await rows(db,'SELECT data FROM fh_experiences WHERE id=$1',[op.id]))[0]; need(e,'Experiencia nao encontrada.',404);
    need(typeof op.enabled==='boolean','Alteracao invalida.',400);
    if (op.type==='interest' && op.enabled) need(F.upcoming(e.data),'Esta experiencia nao esta aberta.',400);
    const table=op.type==='saved'?'fh_saved':'fh_interests';
    if(op.enabled) await db.query(`INSERT INTO ${table}(user_id,experience_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,[actor.sub,op.id]);
    else await db.query(`DELETE FROM ${table} WHERE user_id=$1 AND experience_id=$2`,[actor.sub,op.id]); return;
  }
  if (op.type==='stay') {
    if (!op.value) { await db.query('DELETE FROM fh_stays WHERE user_id=$1',[actor.sub]); return; }
    const endsAt=date(v.endsAt); need(Date.parse(endsAt)>Date.now() && Date.parse(endsAt)<Date.now()+366*86400000,'Revise a data de saida.',400);
    need((await rows(db,'SELECT id FROM fh_places WHERE id=$1',[v.placeId])).length,'Lugar nao encontrado.',404);
    await db.query('INSERT INTO fh_stays(user_id,place_id,ends_at) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET place_id=EXCLUDED.place_id,ends_at=EXCLUDED.ends_at',[actor.sub,v.placeId,endsAt]); return;
  }
  if (op.type==='post') {
    need(!(await rows(db,'SELECT id FROM fh_posts WHERE id=$1',[v.id])).length,'Este plano ja existe.',409);
    if(v.placeId) need((await rows(db,'SELECT user_id FROM fh_stays WHERE user_id=$1 AND place_id=$2 AND ends_at>now()',[actor.sub,v.placeId])).length,'Vincule sua estadia antes de publicar no lugar.',403);
    const startsAt=date(v.startsAt); need(Date.parse(startsAt)>Date.now(),'Escolha um horario futuro.',400);
    const data={id:str(v.id,80,'identificador'),authorId:actor.sub,placeId:v.placeId || null,text:str(v.text,350,'plano'),startsAt,createdAt:new Date().toISOString(),expiresAt:new Date(Date.parse(startsAt)+86400000).toISOString()};
    await db.query('INSERT INTO fh_posts(id,author_id,place_id,data) VALUES($1,$2,$3,$4)',[data.id,actor.sub,data.placeId,data]); return;
  }
  if(op.type==='delete-post' || op.type==='post-interest') {
    const p=(await rows(db,'SELECT author_id,place_id,data FROM fh_posts WHERE id=$1 FOR UPDATE',[op.id]))[0]; need(p,'Plano nao encontrado.',404);
    if(op.type==='delete-post') { need(p.author_id===actor.sub || await owned(db,actor,p.place_id)); await db.query('DELETE FROM fh_posts WHERE id=$1',[op.id]); }
    else { need(Date.parse(p.data.expiresAt)>Date.now(),'Este plano expirou.',400); need(typeof op.enabled==='boolean','Alteracao invalida.',400); if(op.enabled) await db.query('INSERT INTO fh_post_interests(user_id,post_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[actor.sub,op.id]); else await db.query('DELETE FROM fh_post_interests WHERE user_id=$1 AND post_id=$2',[actor.sub,op.id]); }
    return;
  }
  throw new ApiError(400,'Alteracao nao reconhecida.');
}
export async function participants(db, actor, id) {
  need(actor,'Entre na sua conta.',401);
  const e=(await rows(db,'SELECT place_id FROM fh_experiences WHERE id=$1',[id]))[0]; need(e && await owned(db,actor,e.place_id));
  return rows(db,`SELECT p.user_id AS id,p.data->>'name' AS name FROM fh_interests i JOIN fh_profiles p ON p.user_id=i.user_id WHERE i.experience_id=$1 ORDER BY name`,[id]);
}
