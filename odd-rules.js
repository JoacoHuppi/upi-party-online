import {seededRandom} from './aim-rules.js';
export const ODD_RULES=Object.freeze({version:'odd-v1',duration:30000,cells:20,hitPoints:100,missPenalty:25});
export function createOddRound(seed){
 const random=seededRandom(seed),events=[];let index=0,hits=0,misses=0,score=0,sequence=0,lastAt=0,shownAt=0,reactionTotal=0;
 const next=()=>({index,odd:Math.floor(random()*20),family:Math.floor(random()*3),rotation:Math.floor(random()*4)});let board=next();
 const snapshot=()=>({rules:ODD_RULES.version,seed:seed>>>0,board:{...board},hits,misses,score,sequence,accuracy:hits+misses?hits/(hits+misses):0,meanReaction:hits?reactionTotal/hits:0});
 function choose({seq,boardIndex,cell,elapsed}){
  if(seq!==sequence+1||boardIndex!==index||!Number.isInteger(cell)||cell<0||cell>=20||!Number.isFinite(elapsed)||elapsed<lastAt||elapsed<0||elapsed>=ODD_RULES.duration)return {accepted:false};
  const hit=cell===board.odd;lastAt=elapsed;sequence=seq;events.push({seq,boardIndex,cell,elapsed,hit});
  if(hit){hits++;score+=100;reactionTotal+=elapsed-shownAt;shownAt=elapsed;index++;board=next();}else{misses++;score=Math.max(0,score-25);}
  return {accepted:true,hit,...snapshot()};
 }
 return Object.freeze({snapshot,choose,transcript:()=>events.map(e=>({...e}))});
}
