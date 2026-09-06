import {seededRandom} from './aim-rules.js';

// Seeded, render-independent rules. Future online rooms own the seed and clocks.
export const SEQUENCE_RULES=Object.freeze({version:'sequence-circle-v2',cells:6,litMs:600,gapMs:220,betweenMs:900,points:100});
export function createSequenceRound(seed){
 const random=seededRandom(seed),sequence=[Math.floor(random()*SEQUENCE_RULES.cells)],events=[];
 let phase='show',phaseAt=0,lastAt=0,shown=0,cursor=0,completed=0,hits=0,eventId=0,inputMs=0,reason=null;
 const inputLimit=()=>Math.max(6000,sequence.length*1800);
 function snapshot(){return {rules:SEQUENCE_RULES.version,seed:seed>>>0,phase,sequence:[...sequence],lit:phase==='show'?sequence[shown]:-1,shown,cursor,completed,hits,score:completed*SEQUENCE_RULES.points,eventId,inputMs,reason,inputLimit:inputLimit(),remaining:phase==='input'?Math.max(0,inputLimit()-(lastAt-phaseAt)):0};}
 function advance(now){
  if(!Number.isFinite(now)||now<lastAt)return snapshot();lastAt=now;
  // One transition per render acknowledgement: a slow frame cannot skip flashes.
  if(phase==='show'&&now-phaseAt>=SEQUENCE_RULES.litMs){phase='gap';phaseAt=now;}
  else if(phase==='gap'&&now-phaseAt>=SEQUENCE_RULES.gapMs){shown++;phase=shown<sequence.length?'show':'input';phaseAt=now;}
  else if(phase==='cleared'&&now-phaseAt>=SEQUENCE_RULES.betweenMs){sequence.push(Math.floor(random()*SEQUENCE_RULES.cells));shown=cursor=0;phase='show';phaseAt=now;}
  else if(phase==='input'&&now-phaseAt>=inputLimit()){inputMs+=inputLimit();phase='over';reason='timeout';}
  return snapshot();
 }
 function pick({id,cell,elapsed}){
  if(!Number.isFinite(elapsed)||elapsed<lastAt||!Number.isInteger(cell)||cell<0||cell>=SEQUENCE_RULES.cells||id!==eventId+1)return {accepted:false};
  advance(elapsed);if(phase!=='input')return {accepted:false};
  eventId=id;const correct=sequence[cursor]===cell;events.push({id,cell,elapsed,round:sequence.length,cursor,correct});
  if(!correct){inputMs+=elapsed-phaseAt;phase='over';reason='wrong';}
  else{cursor++;hits++;if(cursor===sequence.length){completed++;inputMs+=elapsed-phaseAt;phase='cleared';phaseAt=elapsed;}}
  return {accepted:true,correct,...snapshot()};
 }
 return Object.freeze({advance,pick,snapshot,transcript:()=>events.map(e=>({...e}))});
}
