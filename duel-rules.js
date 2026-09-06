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
 const players=validatePlayers(playerIds),random=seededRandom(seed),readyPlayers=new Set(),lastIds=new Map(players.map(p=>[p,0])),scores=new Map(players.map(p=>[p,0]));
 let phase='waiting',cue='wait',cueAt=0,lastAt=0,nextAt=Infinity,fakesLeft=0,winner=null,loser=null,reason=null,round=1,roundWinner=null;
 const roundsToWin=3,wait=()=>1000+Math.floor(random()*2000);
 function snapshot(){return {rules:'fakeout-duel-v2',phase,cue,cueAt,winner,loser,reason,round,roundsToWin,roundWinner,scores:players.map(id=>({id,points:scores.get(id)||0})),ready:players.filter(p=>readyPlayers.has(p))};}
 function finishRound(win,why){
  roundWinner=win;reason=why;
  if(win)scores.set(win,(scores.get(win)||0)+1);
  const leader=players.find(p=>(scores.get(p)||0)>=roundsToWin);
  if(leader){winner=leader;loser=players.find(p=>p!==leader);phase='over';cue='over';return;}
  round++;phase='between';cue='wait';nextAt=lastAt+1200;
 }
 function ready(player,now){
  if(phase!=='waiting'||!players.includes(player)||!Number.isFinite(now)||now<lastAt)return false;
  lastAt=now;readyPlayers.add(player);if(readyPlayers.size===2){phase='active';cueAt=now;fakesLeft=Math.floor(random()*3);nextAt=now+wait();}return true;
 }
 function advance(now){
  if(!Number.isFinite(now)||now<lastAt)return snapshot();lastAt=now;
  if(phase==='between'&&now>=nextAt){phase='active';cue='wait';cueAt=now;fakesLeft=Math.floor(random()*3);nextAt=now+wait();}
  if(phase!=='active'||now<nextAt)return snapshot();
  if(cue==='wait'){cue=fakesLeft>0?'fake':'go';if(fakesLeft>0)fakesLeft--;cueAt=now;nextAt=now+(cue==='fake'?450:3000);}
  else if(cue==='fake'){cue='wait';cueAt=now;nextAt=now+wait();}
  else if(cue==='go')finishRound(null,'no-response');
  return snapshot();
 }
 function press({player,id,receivedAt}){
  if(phase!=='active'||!players.includes(player)||!Number.isSafeInteger(id)||id!==lastIds.get(player)+1||!Number.isFinite(receivedAt)||receivedAt<lastAt)return {accepted:false};
  advance(receivedAt);if(phase!=='active')return {accepted:false};lastIds.set(player,id);
  finishRound(cue==='go'?player:players.find(p=>p!==player),cue==='go'?'reaction':'false-start');
  return {accepted:true,...snapshot()};
 }
 return Object.freeze({ready,advance,press,snapshot});
}

function createTimedChoiceDuel(version,players,seed,{lanes,duration=30000,label}){
 const random=seededRandom(seed),state=new Map(players.map(id=>[id,{id,points:0,misses:0,blockedUntil:0,index:0,hits:0,mean:0,shownAt:0}]));
 let elapsed=0,phase='active',winner=null,targetIndex=0;
 const nextLane=()=>Math.floor(random()*lanes);
 const targets=new Map(players.map(id=>{const queue=Array.from({length:5},nextLane);return [id,{index:0,lane:queue[0],queue}];}));
 function snapshot(){return {rules:version,phase,winner,reason:phase==='over'?'score':null,remaining:Math.max(0,duration-elapsed),targets:players.map(id=>{const target=targets.get(id);return {...target,id,preview:version==='racket-duel-v1'?[...target.queue]:undefined,blocked:Math.max(0,(state.get(id).blockedUntil||0)-elapsed)};}),scores:players.map(id=>{const p=state.get(id);return {id,points:p.points,misses:p.misses,hits:p.hits,meanReaction:p.hits?Math.round(p.mean/p.hits):0};})};}
 function advance(now){if(!Number.isFinite(now)||now<elapsed)return snapshot();elapsed=now;if(phase==='active'&&elapsed>=duration){phase='over';const a=state.get(players[0]),b=state.get(players[1]);winner=a.points===b.points?null:a.points>b.points?players[0]:players[1];}return snapshot();}
 function choose(player,input,now){
  if(!Number.isFinite(now)||now<elapsed||phase!=='active')return {accepted:false};advance(now);const p=state.get(player),t=targets.get(player);
  if(!p||!t||!input||input.index!==t.index||!Number.isInteger(input.lane)||input.lane<0||input.lane>=lanes||elapsed<p.blockedUntil)return {accepted:false};
  const correct=input.lane===t.queue[0];t.index++;t.queue.shift();t.queue.push(nextLane());t.lane=t.queue[0];targetIndex++;
  if(correct){p.hits++;p.points+=100;p.mean+=Math.max(0,elapsed-p.shownAt);p.shownAt=elapsed;}
  else{p.misses++;p.blockedUntil=elapsed+500;}
  return {accepted:true,correct,...snapshot()};
 }
 function miss(player,input,now){
  if(!Number.isFinite(now)||now<elapsed||phase!=='active')return {accepted:false};advance(now);const p=state.get(player),t=targets.get(player);if(!p||!t||!input||input.index!==t.index||elapsed<p.blockedUntil)return {accepted:false};p.misses++;p.blockedUntil=elapsed+500;t.index++;t.lane=nextLane();return {accepted:true,correct:false,...snapshot()};
 }
 return {advance,snapshot,choose,miss};
}

export function createRacketDuel(seed,players){return createTimedChoiceDuel('racket-duel-v1',players,seed,{lanes:2,label:'racket'});}
export function createArrowDuel(seed,players){return createTimedChoiceDuel('arrows-duel-v1',players,seed,{lanes:4,label:'arrows'});}
