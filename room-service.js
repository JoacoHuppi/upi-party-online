import {randomBytes,randomUUID} from 'node:crypto';
import {createSequenceDuel,createFakeoutDuel} from './duel-rules.js';
import {ONLINE_PORTALS,onlinePortalAt,validPose} from './party-rules.js';
import {createSharedDuel} from './shared-duel.js';
import {findItem} from './cosmetics-data.js';

// Modos Pokemon. El adaptador del motor se carga a demanda: un servidor que nunca hospeda un
// combate Pokemon no paga el costo de cargar pokemon-showdown.
export const POKEMON_MODES={pokemon:'collection',pokemonrandom:'random'};
let battleModule=null;
const loadBattles=async()=>battleModule??=await import('./pokemon-battle-service.mjs');

export function createRoomService({now=()=>performance.now(),seed=()=>randomBytes(4).readUInt32LE(),graceMs=10000,countdownMs=3000,battleTimeoutMs=120000,ranking=null}={}){
 const rooms=new Map(),tokens=new Map();
 const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
 const newPlayer=(name,character,bot=false)=>({id:randomUUID(),token:randomBytes(32).toString('hex'),bot,character:findItem(character)?.slot==='character'?character:'male-a',name:typeof name==='string'?(name.trim().slice(0,20)||'Jugador'):'Jugador',ready:false,streams:new Set(),offlineAt:now(),wins:0,actions:new Set(),pose:{x:0,y:0,z:2.1,yaw:0},poseAt:-Infinity,poseSeq:-1,moveEpoch:null});
 function sessionPacket(r){return [...r.session].map(([id,v])=>({id,points:v.points,games:v.games,wins:v.wins}));}
 function packet(r,p){return {protocol:1,transport:'websocket-v1',serverTime:now(),party:r.party,code:r.code,mode:r.mode,phase:r.phase,matchId:r.matchId,revision:r.revision,selfId:p.id,countdown:Math.max(0,r.startsAt-now()),game:POKEMON_MODES[r.mode]?r.engine?.snapshot(p.id)??r.finalSnapshots?.get(p.id)??null:r.engine?.snapshot()??null,result:r.result,timing:r.timing??null,booting:Boolean(r.booting),battleNotice:p.choiceError??r.battleError??null,session:sessionPacket(r),portals:r.party?ONLINE_PORTALS.map(zone=>({...zone,count:r.players.filter(x=>(x.bot||x.streams.size)&&onlinePortalAt(x.pose)===zone.id).length})):null,players:r.players.map(x=>({id:x.id,name:x.name,character:x.character,ready:x.ready,connected:x.bot||x.streams.size>0,wins:x.wins,pose:r.party?{...x.pose,seq:x.poseSeq}:null,grace:x.bot?null:!x.streams.size?Math.max(0,graceMs-(now()-x.offlineAt)):null}))};}
 function publish(r){r.revision++;for(const p of r.players)for(const send of [...p.streams]){try{send(packet(r,p));}catch{p.streams.delete(send);if(!p.streams.size)p.offlineAt=now();}}}
 function credentials(r,p){return {code:r.code,token:p.token,state:packet(r,p)};}
 function resolve(token){const found=tokens.get(token);if(!found||!rooms.has(found.r.code))fail('Sesión vencida. Volvé a entrar.',401);return found;}
 function create({name,mode,character}){
  if(!['party','fakeout','sequence','aim','odd',...Object.keys(POKEMON_MODES)].includes(mode))fail('Modo no habilitado online todavía.');if(rooms.size>=64)fail('Servidor lleno. Intentá más tarde.',503);
  let code;do{code=randomBytes(4).toString('hex').toUpperCase();}while(rooms.has(code));
  const p=newPlayer(name,character),r={code,party:mode==='party',mode:mode==='party'?null:mode,players:[p],phase:mode==='party'?'lobby':'waiting',matchId:randomUUID(),engine:null,startsAt:0,result:null,timing:null,receipts:new Map(),revision:0,updatedAt:now(),first:0,session:new Map([[p.id,{points:0,games:0,wins:0}]])};rooms.set(code,r);tokens.set(p.token,{r,p});return credentials(r,p);
 }
 function join({code,name,character}){const r=rooms.get(String(code).trim().toUpperCase());if(!r)fail('No existe esa sala.',404);if(r.players.length>=2)fail('La sala ya tiene dos jugadores.',409);if(r.phase==='result'){r.phase=r.party?'lobby':'waiting';r.engine=null;r.result=null;r.timing=null;r.receipts.clear();r.matchId=randomUUID();r.players.forEach(x=>{x.ready=false;x.actions.clear();});}if(!['waiting','lobby'].includes(r.phase))fail('La partida ya empezó.',409);const p=newPlayer(name,character);p.pose.x=1.2;r.players.push(p);r.session.set(p.id,{points:0,games:0,wins:0});tokens.set(p.token,{r,p});r.updatedAt=now();publish(r);return credentials(r,p);}
 function connect(token,send){const {r,p}=resolve(token);if(p.streams.size>=2)fail('Ya hay dos conexiones para esta sesión.',409);p.streams.add(send);p.offlineAt=null;r.updatedAt=now();publish(r);let closed=false;return ()=>{if(closed)return;closed=true;p.streams.delete(send);if(!p.streams.size)p.offlineAt=now();publish(r);};}
 // El combate Pokemon vive fuera del bucle sincronico: hay que cerrarlo siempre que la sala lo suelte.
 function disposeBattle(r){
  const battle=r.engine;if(!POKEMON_MODES[r.mode]||!battle?.close)return;
  // Se guarda la ultima vista de cada jugador para que la pantalla de resultado conserve el combate.
  r.finalSnapshots=new Map();
  for(const p of r.players){try{r.finalSnapshots.set(p.id,battle.snapshot(p.id));}catch{}}
  r.engine=null;Promise.resolve().then(()=>battle.close()).catch(()=>{});
 }
 function finish(r,winner,reason){if(r.phase==='result')return;const pokemon=Boolean(POKEMON_MODES[r.mode]);if(pokemon)disposeBattle(r);const snapshot=(pokemon?null:r.engine?.snapshot?.())||{},scores=pokemon?r.players.map(x=>({id:x.id,points:x.id===winner?100:0})):Array.isArray(snapshot.scores)?snapshot.scores:r.players.map(x=>({id:x.id,points:(snapshot.completed||0)*100}));for(const p of r.players){const source=scores.find(x=>x.id===p.id),points=source?.points??(snapshot.completed||0)*100,entry=r.session.get(p.id)||{points:0,games:0,wins:0};entry.points+=Number(points)||0;entry.games++;if(p.id===winner)entry.wins++;r.session.set(p.id,entry);}r.phase='result';r.result={winner,reason,matchId:r.matchId,scores};
  // El ranking global se escribe con el ganador que decidio el servidor y una fila por combate.
  // El cliente solo aporta su identidad de ladder; nunca el ganador ni un contador.
  if(pokemon&&winner&&ranking){const champion=r.players.find(x=>x.id===winner);
   Promise.resolve(ranking.recordWin({battleId:r.matchId,mode:POKEMON_MODES[r.mode],playerId:champion?.ladderId,name:champion?.name}))
    .then(outcome=>{r.rankingStatus=outcome.status;}).catch(error=>{r.rankingStatus='failed';console.error('[room] ranking',error);});}r.players.forEach(p=>{p.ready=false;if(p.id===winner)p.wins++;});r.updatedAt=now();publish(r);}
 function begin(r){r.matchId=randomUUID();r.phase='countdown';r.startsAt=now()+countdownMs;r.result=null;r.timing=null;r.receipts.clear();disposeBattle(r);r.engine=null;r.finalSnapshots=null;r.pokemonResult=null;r.battleError=null;r.booting=false;r.botAt=0;r.botPressId=0;r.players.forEach(p=>{p.ready=false;p.pressId=0;p.pendingChoice=null;p.choiceError=null;p.actions.clear();});publish(r);}
 function addSoloBot(r){if(r.botId)return;const human=r.players.find(p=>!p.bot),bot=newPlayer('Bot','male-a',true);bot.pose={x:human?.pose.x>0?-human.pose.x:1.2,y:0,z:human?.pose.z??2.1,yaw:Math.PI};r.players.push(bot);r.botId=bot.id;r.session.set(bot.id,{points:0,games:0,wins:0});}
 function removeSoloBot(r){if(!r.botId)return;const bot=r.players.find(p=>p.id===r.botId);if(bot){tokens.delete(bot.token);r.players=r.players.filter(p=>p!==bot);r.session.delete(bot.id);}r.botId=null;}
 function gate(r){if(!r.party||!['lobby','countdown'].includes(r.phase))return;const humans=r.players.filter(p=>!p.bot),zone=onlinePortalAt(humans[0]?.pose),together=humans.length===2&&humans.every(p=>p.streams.size&&onlinePortalAt(p.pose)===zone)&&ONLINE_PORTALS.some(p=>p.id===zone&&p.enabled),solo=humans.length===1&&humans[0].streams.size&&ONLINE_PORTALS.some(p=>p.id===zone&&p.enabled);if(r.phase==='countdown'&&(!together&&!solo||zone!==r.mode)){r.phase='lobby';r.mode=null;r.startsAt=0;removeSoloBot(r);publish(r);}else if(r.phase==='lobby'&&(together||solo)){if(solo)addSoloBot(r);r.mode=zone;begin(r);}}
 function leave(r,p){
  if(['countdown','playing'].includes(r.phase))finish(r,r.players.find(x=>x!==p)?.id??null,'left');
  tokens.delete(p.token);for(const send of p.streams){try{send({closed:true,reason:'left'});}catch{}}p.streams.clear();r.players=r.players.filter(x=>x!==p);
  if(!r.players.length)rooms.delete(r.code);else{r.players.forEach(x=>x.ready=false);r.updatedAt=now();publish(r);}
 }
 function recordContestedInput(r,p,msg,receivedAt,rtt){
  if(!r.engine||msg.matchId!==r.matchId)return false;
  const snapshot=r.engine.snapshot?.();let key=null;
  if(r.mode==='fakeout'&&msg.type==='press'){const round=snapshot?.phase==='between'?Math.max(1,snapshot.round-1):snapshot?.round;key=`${r.matchId}:fakeout:${round}`;}
  else if(['aim','odd'].includes(r.mode)&&msg.type==='pick'&&Number.isInteger(msg.cell?.index))key=`${r.matchId}:${r.mode}:${msg.cell.index}`;
  if(!key)return false;
  const receipt={player:p.id,receivedAt,rtt:Number.isFinite(rtt)?Math.max(0,Math.min(2000,rtt)):null,first:r.receipts.get(key)};
  if(!receipt.first){r.receipts.set(key,{player:receipt.player,receivedAt:receipt.receivedAt,rtt:receipt.rtt});if(r.receipts.size>256)r.receipts.delete(r.receipts.keys().next().value);return false;}
  if(receipt.first.player===receipt.player)return false;
  const delta=Math.abs(receipt.receivedAt-receipt.first.receivedAt),rtts=[receipt.first.rtt,receipt.rtt].filter(Number.isFinite),uncertainty=Math.min(100,Math.max(20,rtts.length?rtts.reduce((a,b)=>a+b,0)/(rtts.length*2):20));
  if(delta>uncertainty)return false;
  r.timing={kind:'close-call',mode:r.mode,serverDeltaMs:Math.round(delta),networkUncertaintyMs:Math.round(uncertainty),order:'server-receipt',at:receivedAt};return true;
 }
 function action(token,msg,{receivedAt=now(),rtt=null}={}){
  const {r,p}=resolve(token);if(!msg||typeof msg.actionId!=='string'||msg.actionId.length<8||msg.actionId.length>80)fail('Acción inválida.');
  if(p.actions.has(msg.actionId))return {duplicate:true,state:packet(r,p)};
  if(msg.matchId!==r.matchId)fail('La partida cambió. Esperá la actualización.',409);
  if(!['ready','press','pick','hit','leave','move','lobby','practice','choose'].includes(msg.type))fail('Acción desconocida.');
  p.actions.add(msg.actionId);if(p.actions.size>150)p.actions.delete(p.actions.values().next().value);r.updatedAt=receivedAt;
  if(msg.type==='leave'){leave(r,p);return {left:true};}
  if(msg.type==='practice'){
   if(!r.party||r.phase!=='lobby'||![null,'racket','arrows'].includes(msg.cell))return {accepted:false,state:packet(r,p)};
   p.practice=msg.cell;p.pose={x:msg.cell==='racket'?-10:msg.cell==='arrows'?10:0,y:0,z:msg.cell?-16:2.1,yaw:0};publish(r);return {accepted:true,state:packet(r,p)};
  }
  if(msg.type==='move'&&p.practice)return {accepted:false,state:packet(r,p)};
  if(msg.type==='move'){if(!r.party||!['lobby','countdown'].includes(r.phase)||!validPose(msg.cell))return {accepted:false,state:packet(r,p)};if(typeof msg.epoch==='string'&&msg.epoch.length<=80&&msg.epoch!==p.moveEpoch){p.moveEpoch=msg.epoch;p.poseSeq=-1;}if(Number.isSafeInteger(msg.seq)&&msg.seq<=p.poseSeq)return {accepted:false,stale:true,state:packet(r,p)};if(receivedAt-p.poseAt<33)return {accepted:false,state:packet(r,p)};p.pose={x:msg.cell.x,y:msg.cell.y,z:msg.cell.z,yaw:msg.cell.yaw};p.poseAt=receivedAt;p.poseSeq=Number.isSafeInteger(msg.seq)?msg.seq:p.poseSeq+1;gate(r);publish(r);return {accepted:true,state:packet(r,p)};}
  if(msg.type==='lobby'){if(!r.party||r.phase!=='result')return {accepted:false,state:packet(r,p)};removeSoloBot(r);r.phase='lobby';r.mode=null;r.engine=null;r.result=null;r.timing=null;r.receipts.clear();r.matchId=randomUUID();r.players.forEach((x,i)=>{x.ready=false;x.pose={x:i*1.2,y:0,z:2.1,yaw:0};x.poseSeq++;x.actions.clear();});publish(r);return {accepted:true,state:packet(r,p)};}
  if(msg.type==='ready'){
   if(r.party)fail('Entren ambos al mismo portal.',409);
   if(!['waiting','result'].includes(r.phase))fail('La partida ya está en curso.',409);if(!p.streams.size)fail('Conectando con el servidor.',409);
   // En Coleccion el equipo viaja con el "listo". La legalidad la revisa el servidor al crear el combate.
   // Identidad de ladder ya existente, para poder atribuir la victoria en el ranking global.
   // Es un identificador, no una credencial: no da acceso a nada y nunca viaja un token.
   if(POKEMON_MODES[r.mode]&&typeof msg.ladderId==='string'&&msg.ladderId&&msg.ladderId.length<=80)p.ladderId=msg.ladderId;
   if(POKEMON_MODES[r.mode]==='collection'){
    const team=msg.cell;
    if(!Array.isArray(team)||team.length!==6||team.some(id=>typeof id!=='string'||!id||id.length>40))fail('Elegí seis Pokémon de tu colección.');
    if(new Set(team).size!==6)fail('No repitas Pokémon en el equipo.');
    p.species=[...team];
   }
   p.ready=true;if(r.players.length===2&&r.players.every(x=>x.ready&&x.streams.size))begin(r);else publish(r);
   return {state:packet(r,p)};
  }
  // La decision se encola y la resuelve el tick, que es donde el servicio puede esperar al motor.
  // El motor rechaza turnos vencidos, repetidos e inventados: aca solo se comprueba la forma.
  if(msg.type==='choose'){
   if(!POKEMON_MODES[r.mode])fail('Acción incorrecta para este juego.');
   if(r.phase!=='playing'||!r.engine||r.booting)return {accepted:false,state:packet(r,p)};
   const choice=msg.cell;
   if(!choice||typeof choice.choice!=='string'||choice.choice.length>80||!Number.isSafeInteger(choice.requestId))return {accepted:false,state:packet(r,p)};
   if(p.pendingChoice)return {accepted:false,state:packet(r,p)};
   p.pendingChoice={requestId:choice.requestId,choice:choice.choice};p.choiceError=null;
   return {accepted:true,state:packet(r,p)};
  }
  const closeCall=recordContestedInput(r,p,msg,receivedAt,rtt);
  if(r.phase!=='playing'||!r.engine){if(closeCall)publish(r);return {accepted:false,state:packet(r,p)};}
  const elapsed=receivedAt-r.startsAt,s=r.engine.snapshot();let outcome;
  if(r.mode==='fakeout'&&msg.type==='press'){outcome=r.engine.press({player:p.id,id:(p.pressId||0)+1,receivedAt:elapsed});if(outcome.accepted)p.pressId=(p.pressId||0)+1;}
  else if(r.mode==='sequence'&&msg.type==='pick')outcome=r.engine.pick({player:p.id,cell:msg.cell,elapsed,id:s.eventId+1});
  else if(['aim','odd'].includes(r.mode)&&msg.type==='pick')outcome=r.engine.choose(p.id,msg.cell,elapsed);
  else fail('Acción incorrecta para este juego.');
  const after=r.engine.snapshot();if(after.phase==='over')finish(r,after.winner,after.reason);else publish(r);
  return {accepted:outcome.accepted,state:packet(r,p)};
 }
 // Crear el combate es asincrono (carga del motor + generacion de equipos). La sala queda en
 // "playing" con engine null mientras arranca; el cliente ve booting hasta que llega el primer turno.
 function startPokemonBattle(r){
  r.engine=null;r.booting=true;r.battleError=null;r.pokemonResult=null;
  const mode=POKEMON_MODES[r.mode],matchId=r.matchId;
  const players=r.players.map(p=>({id:p.id,name:p.name,species:p.species}));
  r.boot=loadBattles()
   .then(({createPokemonBattle})=>createPokemonBattle({id:matchId,mode,players,seedKey:matchId,now:()=>now(),
    timeoutMs:battleTimeoutMs,onResult:result=>{if(r.matchId===matchId)r.pokemonResult=result;}}))
   .then(battle=>{if(r.matchId!==matchId||r.phase!=='playing'){battle.close().catch(()=>{});return;}r.engine=battle;r.booting=false;publish(r);})
   // El detalle va al log del servidor; al jugador se le manda un aviso corto que no expone rutas ni internals.
   .catch(error=>{if(r.matchId!==matchId)return;console.error('[room] pokemon-start',error);r.booting=false;
    r.battleError=/Cannot find module|ERR_MODULE_NOT_FOUND/.test(String(error?.message||error))
     ?'Este servidor no tiene instalado el motor Pokémon.'
     :'No se pudo armar el combate. Probá de nuevo.';
    finish(r,null,'battle-error');});
 }
 async function pokemonStep(r){
  if(r.booting||!r.engine)return;
  let changed=false;
  for(const p of r.players){
   const choice=p.pendingChoice;if(!choice)continue;
   p.pendingChoice=null;changed=true;
   try{await r.engine.choose(p.id,choice);p.choiceError=null;}
   catch(error){p.choiceError=String(error?.message||error).slice(0,120);}
   if(!r.engine)break;
  }
  try{await r.engine?.tick();}catch(error){r.battleError=String(error?.message||error).slice(0,200);}
  if(r.pokemonResult){const {winnerId,reason}=r.pokemonResult;r.pokemonResult=null;finish(r,winnerId,reason);return;}
  if(changed)publish(r);
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
 // tick() sigue siendo sincronico: lo unico asincrono es el paso del combate Pokemon, que se
 // dispara aparte con su propio cerrojo por sala. Asi quien ya llamaba a tick() no cambia nada.
 function tick(){
  for(const r of [...rooms.values()]){
   gate(r);
   if(now()-r.updatedAt>30*60*1000){disposeBattle(r);for(const p of r.players){tokens.delete(p.token);for(const send of p.streams){try{send({closed:true,reason:'expired'});}catch{}}}rooms.delete(r.code);continue;}
   if(['countdown','playing'].includes(r.phase)){
    const missing=r.players.filter(p=>!p.bot&&!p.streams.size&&now()-p.offlineAt>=graceMs);
    if(missing.length){const survivor=r.players.find(p=>!missing.includes(p));finish(r,survivor?.id??null,'disconnected');continue;}
   }
   if(r.phase==='countdown'&&now()>=r.startsAt){
    r.startsAt=now();r.phase='playing';const ids=r.players.map(p=>p.id);if(r.first++%2)ids.reverse();
    if(POKEMON_MODES[r.mode]){startPokemonBattle(r);publish(r);continue;}
    r.engine=r.mode==='sequence'?createSequenceDuel(seed(),ids):['aim','odd'].includes(r.mode)?createSharedDuel(r.mode,seed(),ids):createFakeoutDuel(seed(),ids);
    if(r.mode==='fakeout')ids.forEach(id=>r.engine.ready(id,0));publish(r);
   }else if(r.phase==='playing'&&POKEMON_MODES[r.mode]){
    // Un paso a la vez por sala; un fallo aca no puede tumbar el bucle de las demas.
    if(!r.stepping){r.stepping=true;pokemonStep(r).catch(error=>console.error('[room] pokemon',error)).finally(()=>{r.stepping=false;});}
   }else if(r.phase==='playing'){
    const elapsed=now()-r.startsAt,s=r.engine.advance(elapsed);if(s.phase==='over')finish(r,s.winner,s.reason);else{botStep(r,elapsed);const after=r.engine.snapshot();if(after.phase==='over')finish(r,after.winner,after.reason);else publish(r);}
   }else if(r.phase==='countdown')publish(r);
  }
 }
 function close(){for(const r of rooms.values()){disposeBattle(r);for(const p of r.players)for(const send of p.streams){try{send({closed:true,reason:'server-stopped'});}catch{}}}rooms.clear();tokens.clear();}
 return {create,join,connect,action,tick,close,get:token=>{const {r,p}=resolve(token);return packet(r,p);},counts:()=>({rooms:rooms.size,sessions:tokens.size})};
}
