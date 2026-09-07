import {createAimRound} from './aim-rules.js';
import {createOddRound} from './odd-rules.js';
// A shared board, owned by the server. Local practice scoring remains untouched.
export function createSharedDuel(mode,seed,players,{duration=30000}={}){
 if(!['aim','odd'].includes(mode)||players.length!==2||players[0]===players[1])throw new Error('Invalid shared duel');
 const engine=mode==='aim'?createAimRound(seed):createOddRound(seed),scores=new Map(players.map(id=>[id,{id,points:0,misses:0,blockedUntil:0}]));
 let elapsed=0,phase='active',winner=null,opensAt=250,lastHit=null;
 const board=()=>mode==='aim'?engine.snapshot().target:engine.snapshot().board;
 function snapshot(){return {rules:mode+'-shared-v1',phase,winner,reason:phase==='over'?'score':null,remaining:Math.max(0,duration-elapsed),opensIn:Math.max(0,opensAt-elapsed),...(mode==='aim'?{target:board()}:{board:board()}),scores:[...scores.values()].map(p=>({id:p.id,points:p.points,misses:p.misses,blocked:Math.max(0,p.blockedUntil-elapsed)})),lastHit};}
 function advance(now){if(!Number.isFinite(now)||now<elapsed)return snapshot();elapsed=now;if(phase==='active'&&elapsed>=duration){phase='over';const [a,b]=[...scores.values()];winner=a.points===b.points?null:a.points>b.points?a.id:b.id;}return snapshot();}
 function choose(player,input,now){
  if(!Number.isFinite(now)||now<elapsed)return {accepted:false};
  advance(now);const p=scores.get(player),current=board();
  if(phase!=='active'||!p||!input||input.index!==current.index||elapsed<opensAt||elapsed<p.blockedUntil)return {accepted:false};
  let hit;if(mode==='aim'){if(![input.x,input.y].every(Number.isFinite)||input.x<0||input.x>1||input.y<0||input.y>1)return {accepted:false};hit=Math.hypot(input.x-current.x,input.y-current.y)<=current.radius;}
  else{if(!Number.isInteger(input.cell)||input.cell<0||input.cell>=20)return {accepted:false};hit=input.cell===current.odd;}
  if(hit){
   p.points++;lastHit=mode==='aim'
    ?{player,index:current.index,x:current.x,y:current.y}
    :{player,index:current.index,cell:current.odd};
   const s=engine.snapshot();
   if(mode==='aim')engine.shoot({seq:s.sequence+1,targetIndex:current.index,x:current.x,y:current.y,elapsed});
   else engine.choose({seq:s.sequence+1,boardIndex:current.index,cell:current.odd,elapsed});
   opensAt=elapsed+250;
  }else{p.misses++;p.blockedUntil=elapsed+500;}
  return {accepted:true,hit,...snapshot()};
 }
 return {advance,snapshot,choose};
}
