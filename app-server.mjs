import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import {jwtVerify,createRemoteJWKSet} from 'jose';
import {getState,commit,participants,ApiError} from './api.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const authUrl=process.env.NEON_AUTH_BASE_URL?.replace(/\/+$/,'');
if(!authUrl || !process.env.DATABASE_URL) throw new Error('Configure DATABASE_URL and NEON_AUTH_BASE_URL.');
const port=Number(process.env.PORT || 4187);
if(!Number.isInteger(port) || port<1 || port>65535) throw new Error('PORT must be a valid TCP port.');
if(process.env.RENDER==='true' && !process.env.APP_ORIGIN && !process.env.RENDER_EXTERNAL_URL) throw new Error('The hosted application requires a public origin.');
const publicUrl=new URL(process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`);
if(!['http:','https:'].includes(publicUrl.protocol) || publicUrl.username || publicUrl.password || publicUrl.pathname!=='/' || publicUrl.search || publicUrl.hash) throw new Error('APP_ORIGIN must contain only the application origin.');
if(process.env.RENDER==='true' && publicUrl.protocol!=='https:') throw new Error('The hosted application requires HTTPS.');
const origin=publicUrl.origin, host=process.env.HOST || (process.env.RENDER==='true'?'0.0.0.0':'127.0.0.1');
const connectionUrl=new URL(process.env.DATABASE_URL);connectionUrl.searchParams.set('sslmode','verify-full');
const pool=new pg.Pool({connectionString:connectionUrl.href,max:5,connectionTimeoutMillis:12000,idleTimeoutMillis:30000,statement_timeout:15000});
pool.on('error',error=>console.error('Database connection failure:',error.code || error.name));
const jwks=createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL || authUrl+'/.well-known/jwks.json'));
const staticFiles=new Set(['index.html','styles.css','core.js','script.js','lucide.min.js','qrcode.js','connected.bundle.js']);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.png':'image/png'};
function json(response,status,data){response.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(JSON.stringify(data));}
async function actor(request){
  if(!request.headers.authorization) return null;
  const match=request.headers.authorization.match(/^Bearer (.+)$/); if(!match) throw new ApiError(401,'Sessao invalida.');
  try {const {payload}=await jwtVerify(match[1],jwks,{issuer:new URL(authUrl).origin,audience:new URL(authUrl).origin,algorithms:['EdDSA'],requiredClaims:['sub','exp']}); if(payload.banned || typeof payload.sub!=='string') throw Error();return payload;} catch {throw new ApiError(401,'Sua sessao expirou. Entre novamente.');}
}
async function body(request){const parts=[];let length=0;for await(const part of request){length+=part.length;if(length>100000)throw new ApiError(413,'Conteudo muito grande.');parts.push(part);}try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw new ApiError(400,'Dados invalidos.');}}
const server=http.createServer(async(request,response)=>{
  response.setHeader('X-Content-Type-Options','nosniff');
  response.setHeader('X-Frame-Options','DENY');
  response.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  if(publicUrl.protocol==='https:') response.setHeader('Strict-Transport-Security','max-age=31536000');
  try{
    const url=new URL(request.url,origin);
    if(request.method==='POST' && request.headers.origin!==origin) throw new ApiError(403,'Origem nao autorizada.');
    if(url.pathname.startsWith('/api/auth/')) {
      if(!['GET','POST'].includes(request.method)) throw new ApiError(405,'Metodo nao permitido.');
      const endpoint=url.pathname.slice('/api/auth'.length);
      const headers={'Content-Type':'application/json',Origin:origin};
      if(request.headers.cookie) headers.Cookie=request.headers.cookie;
      const upstream=await fetch(authUrl+endpoint+url.search,{method:request.method,headers,body:request.method==='POST'?JSON.stringify(await body(request)):undefined,redirect:'manual',signal:AbortSignal.timeout(15000)});
      const reply={'Content-Type':upstream.headers.get('content-type') || 'application/json','Cache-Control':'no-store'};
      const cookies=upstream.headers.getSetCookie().map(value=>value.replace(/;\s*Domain=[^;]+/ig,''));
      if(cookies.length) reply['Set-Cookie']=cookies;
      for(const key of ['set-auth-jwt','location']) if(upstream.headers.has(key)) reply[key]=upstream.headers.get(key);
      response.writeHead(upstream.status,reply);response.end(Buffer.from(await upstream.arrayBuffer()));return;
    }
    if(url.pathname==='/api/config') return json(response,200,{authUrl:origin+'/api/auth',shared:true});
    if(url.pathname==='/api/health') {await pool.query('SELECT 1');return json(response,200,{status:'ok'});}
    if(url.pathname==='/api/state' && request.method==='GET') return json(response,200,await getState(pool,await actor(request)));
    if(url.pathname==='/api/commit' && request.method==='POST') return json(response,200,await commit(pool,await actor(request),(await body(request)).operations));
    if(url.pathname==='/api/view' && request.method==='POST') {const {placeId}=await body(request);if(typeof placeId!=='string')throw new ApiError(400,'Lugar invalido.');await pool.query('INSERT INTO fh_views(place_id) SELECT id FROM fh_places WHERE id=$1',[placeId]);return json(response,200,{ok:true});}
    if(url.pathname.startsWith('/api/participants/') && request.method==='GET') return json(response,200,await participants(pool,await actor(request),decodeURIComponent(url.pathname.split('/').pop())));
    if(url.pathname.startsWith('/api/')) throw new ApiError(404,'Recurso nao encontrado.');
    if(!['GET','HEAD'].includes(request.method)) throw new ApiError(405,'Metodo nao permitido.');
    const filename=url.pathname==='/'?'index.html':url.pathname.slice(1);
    if(!staticFiles.has(filename) && !/^assets\/[a-z-]+\.(jpg|png)$/.test(filename)) throw new ApiError(404,'Arquivo nao encontrado.');
    let content=await fs.readFile(path.join(root,filename));
    if(filename==='index.html') content=Buffer.from(content.toString().replace('<script src="lucide.min.js">','<script src="connected.bundle.js"></script><script src="lucide.min.js">'));
    response.writeHead(200,{'Content-Type':types[path.extname(filename)] || 'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':'no-cache'}); response.end(request.method==='HEAD'?undefined:content);
  }catch(error){const status=error.status || (error.code==='ENOENT'?404:500);if(status===500)console.error('API failure:',error.code || error.name);json(response,status,{error:status===500?'Nao foi possivel concluir. Tente novamente.':error.message});}
});
server.requestTimeout=30000;server.headersTimeout=15000;server.keepAliveTimeout=5000;
server.listen(port,host,()=>console.log(`Freehouse connected at ${origin}`));
let closing=false;
function shutdown(){
  if(closing)return;closing=true;
  const deadline=setTimeout(()=>server.closeAllConnections(),25000);deadline.unref();
  server.close(async error=>{
    clearTimeout(deadline);
    try{await pool.end();if(error)process.exitCode=1;}catch{process.exitCode=1;}
  });
  server.closeIdleConnections();
}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
