// Pure, versioned rules. A future server owns seed, start time and event validation.
// This local engine is reproducible, not an anti-cheat or a networking layer.
export const AIM_RULES = Object.freeze({version:'aim-v1',duration:30000,radius:.065,hitPoints:100,missPenalty:25});

export function seededRandom(seed){
 let state=seed>>>0;
 return ()=>{state=(state+0x6D2B79F5)>>>0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}

export function createAimRound(seed){
 const random=seededRandom(seed),events=[];
 let hits=0,misses=0,index=0,lastElapsed=0,shownAt=0,reactionTotal=0,score=0,sequence=0,previous=null;
 function nextTarget(){
  let target;
  for(let attempt=0;attempt<32;attempt++){
   target={index,x:.12+random()*.76,y:.12+random()*.76,radius:AIM_RULES.radius};
   if(!previous||Math.hypot(target.x-previous.x,target.y-previous.y)>.32)break;
  }
  previous=target;return target;
 }
 let target=nextTarget();
 function snapshot(){return {rules:AIM_RULES.version,seed:seed>>>0,target:{...target},hits,misses,score,accuracy:hits+misses?hits/(hits+misses):0,meanReaction:hits?reactionTotal/hits:0,sequence};}
 function shoot({seq,targetIndex,x,y,elapsed}){
  if(seq!==sequence+1||targetIndex!==index||![x,y,elapsed].every(Number.isFinite)||elapsed<lastElapsed||elapsed<0||elapsed>=AIM_RULES.duration||sequence>=10000)return {accepted:false};
  const hit=Math.hypot(x-target.x,y-target.y)<=target.radius;
  lastElapsed=elapsed;sequence=seq;events.push({seq,targetIndex,x,y,elapsed,hit});
  if(hit){hits++;score+=AIM_RULES.hitPoints;reactionTotal+=elapsed-shownAt;shownAt=elapsed;index++;target=nextTarget();}
  else{misses++;score=Math.max(0,score-AIM_RULES.missPenalty);}
  return {accepted:true,hit,...snapshot()};
 }
 return Object.freeze({snapshot,shoot,transcript:()=>events.map(e=>({...e}))});
}
