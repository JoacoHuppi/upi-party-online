import {randomBytes,randomUUID} from 'node:crypto';
import {createSequenceDuel,createFakeoutDuel} from './duel-rules.js';
import {ONLINE_PORTALS,onlinePortalAt,validPose} from './party-rules.js';
import {createSharedDuel} from './shared-duel.js';

export function createRoomService({now=()=>performance.now(),seed=()=>randomBytes(4).readUInt32LE(),graceMs=10000,countdownMs=3000}={}){
 const rooms=new Map(),tokens=new Map();
 const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
 const newPlayer=(name,character,bot=false)=>({id:randomUUID(),token:randomBytes(32).toString('hex'),bot,character:['male-a','female-a','male-e','female-e'].includes(character)?character:'male-a',name:typeof name==='string'?(name.trim().slice(0,20)||'Jugador'):'Jugador',ready:false,streams:new Set(),offlineAt:now(),wins:0,actions:new Set(),pose:{x:0,y:0,z:2.1,yaw:0},poseAt:-Infinity});
 function sessionPacket(r){return [...r.session].map(([id,v])=>({id,points:v.points,games:v.games,wins:v.wins}));}
 function packet(r,p){return {protocol:1,party:r.party,code:r.code,mode:r.mode,phase:r.phase,matchId:r.matchId,revision:r.revision,selfId:p.id,countdown:Math.max(0,r.startsAt-now()),game:r.engine?.snapshot()??null,result:r.result,session:sessionPacket(r),portals:r.party?ONLINE_PORTALS.map(zone=>({...zone,count:r.players.filter(x=>(x.bot||x.streams.size)&&onlinePortalAt(x.pose)===zone.id).length})):null,players:r.players.map(x=>({id:x.id,name:x.name,character:x.character,ready:x.ready,connected:x.bot||x.streams.size>0,wins:x.wins,pose:r.party?{...x.pose}:null,grace:x.bot?null:!x.streams.size?Math.max(0,graceMs-(now()-x.offlineAt)):null}))};}
 function publish(r){r.revision++;for(const p of r.players)for(const send of [...p.streams]){try{send(packet(r,p));}catch{p.streams.delete(send);if(!p.streams.size)p.offlineAt=now();}}}
 function credentials(r,p){return {code:r.code,token:p.token,state:packet(r,p)};}
 function resolve(token){const found=tokens.get(token);if(!found||!rooms.has(found.r.code))fail('Sesión vencida. Volvé a entrar.',401);return found;}
 function create({name,mode,character}){
  if(!['party','fakeout','sequence','aim','odd'].includes(mode))fail('Modo no habilitado online todavía.');if(rooms.size>=64)fail('Servidor lleno. Intentá más tarde.',503);
  let code;do{code=randomBytes(4).toString('hex').toUpperCase();}while(rooms.has(code));
  const p=newPlayer(name,character),r={code,party:mode==='party',mode:mode==='party'?null:mode,players:[p],phase:mode==='party'?'lobby':'waiting',matchId:randomUUID(),engine:null,startsAt:0,result:null,revision:0,updatedAt:now(),first:0,session:new Map([[p.id,{points:0,games:0,wins:0}]])};rooms.set(code,r);tokens.set(p.token,{r,p});return credentials(r,p);
 }
 function join({code,name,character}){const r=rooms.get(String(code).trim().toUpperCase());if(!r)fail('No existe esa sala.',404);if(r.players.length>=2)fail('La sala ya tiene dos jugadores.',409);if(r.phase==='result'){r.phase=r.party?'lobby':'waiting';r.engine=null;r.result=null;r.matchId=randomUUID();r.players.forEach(x=>{x.ready=false;x.actions.clear();});}if(!['waiting','lobby'].includes(r.phase))fail('La partida ya empezó.',409);const p=newPlayer(name,character);p.pose.x=1.2;r.players.push(p);r.session.set(p.id,{points:0,games:0,wins:0});tokens.set(p.token,{r,p});r.updatedAt=now();publish(r);return credentials(r,p);}
 function connect(token,send){const {r,p}=resolve(token);if(p.streams.size>=2)fail('Ya hay dos conexiones para esta sesión.',409);p.streams.add(send);p.offlineAt=null;r.updatedAt=now();publish(r);let closed=false;return ()=>{if(closed)return;closed=true;p.streams.delete(send);if(!p.streams.size)p.offlineAt=now();publish(r);};}
 function finish(r,winner,reason){if(r.phase==='result')return;const snapshot=r.engine?.snapshot?.()||{},scores=Array.isArray(snapshot.scores)?snapshot.scores:[];for(const p of r.players){const source=scores.find(x=>x.id===p.id),points=source?.points??(snapshot.completed||0)*100,entry=r.session.get(p.id)||{points:0,games:0,wins:0};entry.points+=Number(points)||0;entry.games++;if(p.id===winner)entry.wins++;r.session.set(p.id,entry);}r.phase='result';r.result={winner,reason,matchId:r.matchId,scores};r.players.forEach(p=>{p.ready=false;if(p.id===winner)p.wins++;});r.updatedAt=now();publish(r);}
 function begin(r){r.matchId=randomUUID();r.phase='countdown';r.startsAt=now()+countdownMs;r.result=null;r.engine=null;r.botAt=0;r.botPressId=0;r.players.forEach(p=>{p.ready=false;p.actions.clear();});publish(r);}
 function addSoloBot(r){if(r.botId)return;const human=r.players.find(p=>!p.bot),bot=newPlayer('Bot','male-a',true);bot.pose={x:human?.pose.x>0?-human.pose.x:1.2,y:0,z:human?.pose.z??2.1,yaw:Math.PI};r.players.push(bot);r.botId=bot.id;r.session.set(bot.id,{points:0,games:0,wins:0});}
 function removeSoloBot(r){if(!r.botId)return;const bot=r.players.find(p=>p.id===r.botId);if(bot){tokens.delete(bot.token);r.players=r.players.filter(p=>p!==bot);r.session.delete(bot.id);}r.botId=null;}
 function gate(r){if(!r.party||!['lobby','countdown'].includes(r.phase))return;const humans=r.players.filter(p=>!p.bot),zone=onlinePortalAt(humans[0]?.pose),together=humans.length===2&&humans.every(p=>p.streams.size&&onlinePortalAt(p.pose)===zone)&&ONLINE_PORTALS.some(p=>p.id===zone&&p.enabled),solo=humans.length===1&&humans[0].streams.size&&ONLINE_PORTALS.some(p=>p.id===zone&&p.enabled);if(r.phase==='countdown'&&(!together&&!solo||zone!==r.mode)){r.phase='lobby';r.mode=null;r.startsAt=0;removeSoloBot(r);publish(r);}else if(r.phase==='lobby'&&(together||solo)){if(solo)addSoloBot(r);r.mode=zone;begin(r);}}
 function leave(r,p){
  if(['countdown','playing'].includes(r.phase))finish(r,r.players.find(x=>x!==p)?.id??null,'left');
  tokens.delete(p.token);for(const send of p.streams){try{send({closed:true,reason:'left'});}catch{}}p.streams.clear();r.players=r.players.filter(x=>x!==p);
  if(!r.players.length)rooms.delete(r.code);else{r.players.forEach(x=>x.ready=false);r.updatedAt=now();publish(r);}
 }
 function action(token,msg){
  const {r,p}=resolve(token);if(!msg||typeof msg.actionId!=='string'||msg.actionId.length<8||msg.actionId.length>80)fail('Acción inválida.');
  if(p.actions.has(msg.actionId))return {duplicate:true,state:packet(r,p)};
  if(msg.matchId!==r.matchId)fail('La partida cambió. Esperá la actualización.',409);
  if(!['ready','press','pick','hit','leave','move','lobby'].includes(msg.type))fail('Acción desconocida.');
  p.actions.add(msg.actionId);if(p.actions.size>150)p.actions.delete(p.actions.values().next().value);r.updatedAt=now();
  if(msg.type==='leave'){leave(r,p);return {left:true};}
  if(msg.type==='move'){if(!r.party||!['lobby','countdown'].includes(r.phase)||!validPose(msg.cell))return {accepted:false,state:packet(r,p)};if(now()-p.poseAt<50)return {accepted:false,state:packet(r,p)};p.pose={x:msg.cell.x,y:msg.cell.y,z:msg.cell.z,yaw:msg.cell.yaw};p.poseAt=now();gate(r);publish(r);return {accepted:true,state:packet(r,p)};}
  if(msg.type==='lobby'){if(!r.party||r.phase!=='result')return {accepted:false,state:packet(r,p)};removeSoloBot(r);r.phase='lobby';r.mode=null;r.engine=null;r.result=null;r.matchId=randomUUID();r.players.forEach((x,i)=>{x.ready=false;x.pose={x:i*1.2,y:0,z:2.1,yaw:0};x.actions.clear();});publish(r);return {accepted:true,state:packet(r,p)};}
  if(msg.type==='ready'){
   if(r.party)fail('Entren ambos al mismo portal.',409);
   if(!['waiting','result'].includes(r.phase))fail('La partida ya está en curso.',409);if(!p.streams.size)fail('Conectando con el servidor.',409);
   p.ready=true;if(r.players.length===2&&r.players.every(x=>x.ready&&x.streams.size))begin(r);else publish(r);
   return {state:packet(r,p)};
  }
  if(r.phase!=='playing'||!r.engine)return {accepted:false,state:packet(r,p)};
  const elapsed=now()-r.startsAt,s=r.engine.snapshot();let outcome;
  if(r.mode==='fakeout'&&msg.type==='press')outcome=r.engine.press({player:p.id,id:1,receivedAt:elapsed});
  else if(r.mode==='sequence'&&msg.type==='pick')outcome=r.engine.pick({player:p.id,cell:msg.cell,elapsed,id:s.eventId+1});
  else if(['aim','odd'].includes(r.mode)&&msg.type==='pick')outcome=r.engine.choose(p.id,msg.cell,elapsed);
  else fail('Acción incorrecta para este juego.');
  const after=r.engine.snapshot();if(after.phase==='over')finish(r,after.winner,after.reason);else publish(r);
  return {accepted:outcome.accepted,state:packet(r,p)};
 }
 function botStep(r,elapsed){
  const bot=r.players.find(p=>p.bot);if(!bot||!r.engine||elapsed<r.botAt)return;
  const s=r.engine.snapshot();let outcome=null;
  if(r.mode==='fakeout'){
   if(s.phase==='active'&&s.cue==='go'){r.botPressId=(r.botPressId||0)+1;outcome=r.engine.press({player:bot.id,id:r.botPressId,receivedAt:elapsed});r.botAt=elapsed+180;}
   else if(s.phase==='active'&&s.cue==='fake'&&Math.random()<.08){r.botPressId=(r.botPressId||0)+1;outcome=r.engine.press({player:bot.id,id:r.botPressId,receivedAt:elapsed});r.botAt=elapsed+180;}
  }else if(r.mode==='sequence'&&s.phase==='input'&&s.turn===bot.id){outcome=r.engine.pick({player:bot.id,cell:Math.floor(Math.random()*6),elapsed,id:s.eventId+1});r.botAt=elapsed+260;}
  else if(r.mode==='aim'&&s.target){outcome=r.engine.choose(bot.id,{x:s.target.x,y:s.target.y},elapsed);r.botAt=elapsed+90;}
  else if(r.mode==='odd'&&s.board){outcome=r.engine.choose(bot.id,{cell:s.board.odd},elapsed);r.botAt=elapsed+90;}
  return outcome;
 }
 function tick(){
  for(const r of [...rooms.values()]){
   gate(r);
   if(now()-r.updatedAt>30*60*1000){for(const p of r.players){tokens.delete(p.token);for(const send of p.streams){try{send({closed:true,reason:'expired'});}catch{}}}rooms.delete(r.code);continue;}
   if(['countdown','playing'].includes(r.phase)){
    const missing=r.players.filter(p=>!p.streams.size&&now()-p.offlineAt>=graceMs);
    if(missing.length){const survivor=r.players.find(p=>!missing.includes(p));finish(r,survivor?.id??null,'disconnected');continue;}
   }
   if(r.phase==='countdown'&&now()>=r.startsAt){
    r.startsAt=now();r.phase='playing';const ids=r.players.map(p=>p.id);if(r.first++%2)ids.reverse();
    r.engine=r.mode==='sequence'?createSequenceDuel(seed(),ids):['aim','odd'].includes(r.mode)?createSharedDuel(r.mode,seed(),ids):createFakeoutDuel(seed(),ids);
    if(r.mode==='fakeout')ids.forEach(id=>r.engine.ready(id,0));publish(r);
   }else if(r.phase==='playing'){
    const elapsed=now()-r.startsAt,s=r.engine.advance(elapsed);if(s.phase==='over')finish(r,s.winner,s.reason);else{botStep(r,elapsed);const after=r.engine.snapshot();if(after.phase==='over')finish(r,after.winner,after.reason);else publish(r);}
   }else if(r.phase==='countdown')publish(r);
  }
 }
 function close(){for(const r of rooms.values())for(const p of r.players)for(const send of p.streams){try{send({closed:true,reason:'server-stopped'});}catch{}}rooms.clear();tokens.clear();}
 return {create,join,connect,action,tick,close,get:token=>{const {r,p}=resolve(token);return packet(r,p);},counts:()=>({rooms:rooms.size,sessions:tokens.size})};
}
