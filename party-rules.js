export const PARTY_PORTALS=Object.freeze([
 {id:'racket',x:-6,z:0,label:'Pelotas & cestas',enabled:true},
 {id:'arrows',x:6,z:0,label:'Dance Reflex',enabled:true},
 {id:'aim',x:0,z:6,label:'Aim Trainer',enabled:true},
 {id:'sequence',x:-5,z:-5,label:'Sequence Memory',enabled:true},
 {id:'odd',x:5,z:-5,label:'Odd One Out',enabled:true},
 {id:'fakeout',x:5,z:5,label:'Reaction Fakeout',enabled:true}
]);
export function portalAt(position){if(!position||Math.abs(position.y)>.3)return null;return PARTY_PORTALS.find(p=>Math.hypot(position.x-p.x,position.z-p.z)<1.3)?.id??null;}
export function validPose(p){return p&&['x','y','z','yaw'].every(k=>Number.isFinite(p[k]))&&Math.hypot(p.x,p.z)<=30&&p.y>=-8&&p.y<=12&&Math.abs(p.yaw)<=Math.PI*4;}
