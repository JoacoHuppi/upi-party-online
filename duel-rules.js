// SERVER-SIDE foundations, not connected to the shipped HTML yet.
// The transport must bind authenticated connections to player ids and supply
// server timestamps. Never trust client-provided ids, clock values or winners.
import {seededRandom} from './aim-rules.js';
import {createSequenceRound} from './sequence-rules.js';
function validatePlayers(players){if(!Array.isArray(players)||players.length!==2||players.some(p=>typeof p!=='string'||!p)||players[0]===players[1])throw new Error('Two distinct player ids required');return [...players];}

export function createSequenceDuel(seed,playerIds){
 const players=validatePlayers(playerIds),engine=createSequenceRound(seed);let turn=0,winner=null,loser=null,lastAt=0;
 function settle(){if(engine.snapshot().phase==='over'&&!winner){loser=players[turn];winner=players[1-turn];}}
 function advance(elapsed){if(!Number.isFinite(elapsed)||elapsed<lastAt)return snapshot();lastAt=elapsed;engine.advance(elapsed);settle();return snapshot();}
 // Only the lit cue is public: do not transmit hidden sequence or the seed.
 function snapshot(){const s=engine.snapshot();return {rules:'sequence-duel-v1',phase:s.phase,turn:players[turn],winner,loser,level:s.sequence.length,lit:s.lit,cursor:s.cursor,completed:s.completed,eventId:s.eventId,remaining:s.remaining,reason:s.reason};}
 function pick({player,cell,elapsed,id}){
  if(winner||player!==players[turn]||!Number.isFinite(elapsed)||elapsed<lastAt)return {accepted:false};
  advance(elapsed);if(winner)return {accepted:false,...snapshot()};
  const r=engine.pick({id,cell,elapsed});if(!r.accepted)return {accepted:false};
  if(r.phase==='cleared')turn=1-turn;settle();return {accepted:true,...snapshot()};
 }
 return Object.freeze({advance,pick,snapshot});
}

export function createFakeoutDuel(seed,playerIds){
 const players=validatePlayers(playerIds),random=seededRandom(seed),readyPlayers=new Set(),lastIds=new Map(players.map(p=>[p,0]));
 let phase='waiting',cue='wait',cueAt=0,lastAt=0,nextAt=Infinity,fakesLeft=0,winner=null,loser=null,reason=null;
 const wait=()=>1000+Math.floor(random()*2000);
 function snapshot(){return {rules:'fakeout-duel-v1',phase,cue,cueAt,winner,loser,reason,ready:players.filter(p=>readyPlayers.has(p))};}
 function finish(win,why){winner=win;loser=win?players.find(p=>p!==win):null;phase='over';reason=why;cue='over';}
 function ready(player,now){
  if(phase!=='waiting'||!players.includes(player)||!Number.isFinite(now)||now<lastAt)return false;
  lastAt=now;readyPlayers.add(player);if(readyPlayers.size===2){phase='active';cueAt=now;fakesLeft=Math.floor(random()*3);nextAt=now+wait();}return true;
 }
 function advance(now){
  if(!Number.isFinite(now)||now<lastAt)return snapshot();lastAt=now;
  if(phase!=='active'||now<nextAt)return snapshot();
  // A slow tick publishes each cue, never skips straight past a false signal.
  if(cue==='wait'){cue=fakesLeft>0?'fake':'go';if(fakesLeft>0)fakesLeft--;cueAt=now;nextAt=now+(cue==='fake'?450:3000);}
  else if(cue==='fake'){cue='wait';cueAt=now;nextAt=now+wait();}
  else if(cue==='go')finish(null,'no-response');
  return snapshot();
 }
 function press({player,id,receivedAt}){
  if(phase!=='active'||!players.includes(player)||!Number.isSafeInteger(id)||id!==lastIds.get(player)+1||!Number.isFinite(receivedAt)||receivedAt<lastAt)return {accepted:false};
  advance(receivedAt);if(phase!=='active')return {accepted:false};lastIds.set(player,id);
  finish(cue==='go'?player:players.find(p=>p!==player),cue==='go'?'reaction':'false-start');
  return {accepted:true,...snapshot()};
 }
 return Object.freeze({ready,advance,press,snapshot});
}
