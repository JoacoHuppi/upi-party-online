export const PARTY_PORTALS=Object.freeze([
 {id:'racket',x:-10,z:-16,label:'Pelotas & cestas',theme:'NIEVE',color:'#b8e5ee',enabled:true,online:false,soloOnline:true},
 {id:'arrows',x:10,z:-16,label:'Dance Reflex',theme:'DESIERTO',color:'#e5bd72',enabled:true,online:false,soloOnline:true},
 {id:'aim',x:18,z:0,label:'Aim Trainer',theme:'BOSQUE',color:'#67b791',enabled:true},
 {id:'sequence',x:10,z:16,label:'Sequence Memory',theme:'VOLCÁN',color:'#d78272',enabled:true},
 {id:'odd',x:-10,z:16,label:'Odd One Out',theme:'OCÉANO',color:'#60bdcf',enabled:true},
 {id:'fakeout',x:-18,z:0,label:'Reaction Fakeout',theme:'COSMOS',color:'#a58bd2',enabled:true,offline:false}
]);
export const ONLINE_PORTALS=Object.freeze(PARTY_PORTALS.filter(portal=>portal.online!==false));
export function portalAt(position){if(!position||Math.abs(position.y)>.3)return null;return PARTY_PORTALS.find(p=>Math.hypot(position.x-p.x,position.z-p.z)<1.3)?.id??null;}
export function onlinePortalAt(position){if(!position||Math.abs(position.y)>.3)return null;return ONLINE_PORTALS.find(p=>Math.hypot(position.x-p.x,position.z-p.z)<1.3)?.id??null;}
export const portalsFor=mode=>PARTY_PORTALS.filter(p=>mode==='online'?p.online!==false||p.soloOnline:p.offline!==false);
export function validPose(p){return p&&['x','y','z','yaw'].every(k=>Number.isFinite(p[k]))&&Math.hypot(p.x,p.z)<=50&&p.y>=-8&&p.y<=12&&Math.abs(p.yaw)<=Math.PI*4;}
function parkourRoute(sign,route){
 const points=[
  [-28.9,3,.45,1.55],[-30.9,4.35,.85,1.22],[-33,2.9,1.2,1.38],[-35.1,4.45,1.55,1.22],
  [-37.3,2.85,1.9,1.85],[-39.5,4.45,2.25,1.32],[-41.6,2.65,2.55,2.25],[-43.7,4.3,2.9,1.22],
  [-45.3,3,3.2,1.55],[-46.7,4.15,3.5,2.05],[-47.7,2.95,3.8,1.50],[-48.6,4.60,4.05,2.1]
 ];
 return {id:route,name:route===0?'Agujas móviles':'Ritmo de lava',color:route===0?'#70d6df':'#ec9f76',pads:points.map(([x,z,y,size],i)=>({x,z:z*sign,y,w:size,d:size,index:i+1,route,checkpoint:i===4||i===9,finish:i===11,...(i===2?{motion:{axis:'z',amplitude:.85,period:3200,phase:route*.5}}:{}),...(i===8?{motion:{axis:'z',amplitude:.8,period:2800,phase:1.3+route*.4}}:{}),...(i===5||i===10?{spin:{period:i===5?3600:2600,direction:route?-1:1}}:{}),...(i===6?{sweeper:{period:3000,direction:route?-1:1,length:2.45}}:{})}))};
}
export const PARKOUR_ROUTES=Object.freeze([-1,1].map((sign,route)=>parkourRoute(sign,route)));
export function onBridge(x,z,ax,az,bx,bz,width=3){const dx=bx-ax,dz=bz-az,len=dx*dx+dz*dz,t=((x-ax)*dx+(z-az)*dz)/len;return t>=0&&t<=1&&Math.hypot(x-ax-t*dx,z-az-t*dz)<=width/2;}
export function lobbyGround(x,z,mode){return Math.hypot(x,z)<=11||portalsFor(mode).some(p=>Math.hypot(x-p.x,z-p.z)<=4.7||onBridge(x,z,0,0,p.x,p.z))||Math.hypot(x,z-23)<=5.5||onBridge(x,z,0,0,0,23)||Math.hypot(x+26,z)<=4.7||onBridge(x,z,0,0,-26,0);}
