import {createAuthClient} from '@neondatabase/auth';
import {BetterAuthVanillaAdapter} from '@neondatabase/auth/vanilla/adapters';

let auth, previous;
function check(result) { if(result.error) throw new Error(result.error.message || 'Nao foi possivel entrar.'); return result.data; }
async function token() {
  const session=check(await auth.getSession()); if(!session?.user) return null;
  // This SDK version shares the session and token cache hooks.
  const jwt=check(await auth.token({fetchOptions:{headers:{'X-Force-Fetch':'true'}}}))?.token;
  if(!jwt) throw new Error('Nao foi possivel validar sua sessao. Entre novamente.');
  return jwt;
}
async function request(path, options={}) {
  const jwt=await token();
  const response=await fetch(path,{...options,headers:{'Content-Type':'application/json',...(jwt?{Authorization:`Bearer ${jwt}`} : {}),...options.headers}});
  const data=await response.json(); if(!response.ok) throw new Error(data.error || 'Nao foi possivel concluir.'); return data;
}
function remembered(state) { previous=structuredClone(state); return state; }
function changed(a,b){return JSON.stringify(a)!==JSON.stringify(b);}
function changes(next) {
  const operations=[];
  const before=previous.accounts.find(a=>a.id===previous.sessionId), me=next.accounts.find(a=>a.id===next.sessionId);
  if(me){
    const fields=a=>({name:a.name,role:a.role,bio:a.bio || '',interests:a.interests || []});
    if(!before || changed(fields(before),fields(me))) operations.push({type:'profile',value:fields(me)});
    for(const [field,type] of [['joined','interest'],['saved','saved']]){
      for(const id of new Set([...(before?.[field] || []),...me[field]])) if((before?.[field] || []).includes(id)!==me[field].includes(id)) operations.push({type,id,enabled:me[field].includes(id)});
    }
    if(changed(before?.stay || null,me.stay || null)) operations.push({type:'stay',value:me.stay || null});
  }
  for(const [collection,type] of [['places','place'],['experiences','experience'],['points','point'],['posts','post']]){
    const old=new Map(previous[collection].map(item=>[item.id,item]));
    for(const item of next[collection]){
      const existing=old.get(item.id);
      if(type==='post') {
        if(!existing) operations.push({type,value:item});
        else if(me && existing.interested.includes(me.id)!==item.interested.includes(me.id)) operations.push({type:'post-interest',id:item.id,enabled:item.interested.includes(me.id)});
      } else if(changed(existing,item)) operations.push({type,value:item});
      old.delete(item.id);
    }
    if(type!=='place') for(const id of old.keys()) operations.push({type:`delete-${type}`,id});
  }
  return operations;
}
window.FreehouseRemote={
  async boot(){const config=await (await fetch('/api/config')).json();auth=createAuthClient(config.authUrl,{adapter:BetterAuthVanillaAdapter({fetchOptions:{credentials:'include'}})});return this.refresh();},
  async refresh(){return remembered(await request('/api/state'));},
  async commit(next){const operations=changes(next);return remembered(operations.length?await request('/api/commit',{method:'POST',body:JSON.stringify({operations})}):await request('/api/state'));},
  rollback(){return structuredClone(previous);},
  async signIn(email,password){check(await auth.signIn.email({email,password}));return this.refresh();},
  async signUp(email,password,name,role){check(await auth.signUp.email({email,password,name}));const state=await this.refresh();const me=state.accounts.find(a=>a.id===state.sessionId);if(!me)throw new Error('Confirme o cadastro e entre na sua conta.');me.role=role;return this.commit(state);},
  async signOut(){check(await auth.signOut());return this.refresh();},
  async recover(email){check(await auth.requestPasswordReset({email,redirectTo:location.origin+'/#reset-password'}));},
  async reset(password,resetToken){check(await auth.resetPassword({newPassword:password,token:resetToken}));},
  participants(id){return request('/api/participants/'+encodeURIComponent(id));}
  ,view(placeId){return request('/api/view',{method:'POST',body:JSON.stringify({placeId})});}
};
