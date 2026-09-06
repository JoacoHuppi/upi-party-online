export const PARTY_PORTALS=Object.freeze([
 {id:'racket',x:-10,z:-16,label:'Pelotas & cestas',theme:'NIEVE',color:'#b8e5ee',enabled:true,online:false},
 {id:'arrows',x:10,z:-16,label:'Dance Reflex',theme:'DESIERTO',color:'#e5bd72',enabled:true,online:false},
 {id:'aim',x:18,z:0,label:'Aim Trainer',theme:'BOSQUE',color:'#67b791',enabled:true},
 {id:'sequence',x:10,z:16,label:'Sequence Memory',theme:'VOLCÁN',color:'#d78272',enabled:true},
 {id:'odd',x:-10,z:16,label:'Odd One Out',theme:'OCÉANO',color:'#60bdcf',enabled:true},
 {id:'fakeout',x:-18,z:0,label:'Reaction Fakeout',theme:'COSMOS',color:'#a58bd2',enabled:true,offline:false}
]);
export const ONLINE_PORTALS=Object.freeze(PARTY_PORTALS.filter(portal=>portal.online!==false));
export function portalAt(position){if(!position||Math.abs(position.y)>.3)return null;return PARTY_PORTALS.find(p=>Math.hypot(position.x-p.x,position.z-p.z)<1.3)?.id??null;}
export function onlinePortalAt(position){if(!position||Math.abs(position.y)>.3)return null;return ONLINE_PORTALS.find(p=>Math.hypot(position.x-p.x,position.z-p.z)<1.3)?.id??null;}
export const portalsFor=mode=>PARTY_PORTALS.filter(p=>mode==='online'?p.online!==false:p.offline!==false);
export function validPose(p){return p&&['x','y','z','yaw'].every(k=>Number.isFinite(p[k]))&&Math.hypot(p.x,p.z)<=50&&p.y>=-8&&p.y<=12&&Math.abs(p.yaw)<=Math.PI*4;}
export const PARKOUR_ROUTES=Object.freeze([-1,1].map((sign,route)=>({id:route,name:route===0?'Agujas de hielo':'Pasos de lava',color:route===0?'#70d6df':'#ec9f76',pads:Array.from({length:9},(_,i)=>({x:-29-i*1.7,z:sign*(3+(i%2)*1.15),y:.5+i*.43,w:i===4?1.65:1.05,d:i===4?1.65:1.05,index:i+1,route,checkpoint:i===4,finish:i===8}))})));
export function onBridge(x,z,ax,az,bx,bz,width=3){const dx=bx-ax,dz=bz-az,len=dx*dx+dz*dz,t=((x-ax)*dx+(z-az)*dz)/len;return t>=0&&t<=1&&Math.hypot(x-ax-t*dx,z-az-t*dz)<=width/2;}
export function lobbyGround(x,z,mode){return Math.hypot(x,z)<=8||portalsFor(mode).some(p=>Math.hypot(x-p.x,z-p.z)<=4.7||onBridge(x,z,0,0,p.x,p.z))||Math.hypot(x,z-23)<=4||onBridge(x,z,0,0,0,23)||Math.hypot(x+26,z)<=4.7||onBridge(x,z,0,0,-26,0);}
