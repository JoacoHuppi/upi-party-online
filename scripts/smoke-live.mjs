import {WebSocket} from 'ws';

const base=new URL(process.argv[2]||'http://127.0.0.1:8787').origin;
const post=async(path,data,token)=>{
 const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});
 const result=await response.json();if(!response.ok)throw new Error(`${path}: ${result.error||response.status}`);return result;
};
const open=token=>new Promise((resolve,reject)=>{
 const socket=new WebSocket(base.replace(/^http/,'ws')+'/ws');let state=null,rtt=null;
 const timeout=setTimeout(()=>{socket.terminate();reject(new Error('WebSocket smoke timeout'));},10000);
 socket.on('open',()=>socket.send(JSON.stringify({type:'auth',token})));
 socket.on('message',raw=>{const message=JSON.parse(raw.toString());if(message.type==='ping')socket.send(JSON.stringify({type:'pong',id:message.id}));if(message.type==='state')state=message.state;if(message.type==='latency')rtt=message.rtt;if(state&&rtt!==null){clearTimeout(timeout);resolve({socket,state,rtt});}});
 socket.on('error',reject);
});

const health=await (await fetch(base+'/health')).json();
if(!health.ok||!health.transports?.includes('websocket'))throw new Error('Health check did not advertise WebSocket transport');
const host=await post('/api/create',{name:'Fly smoke A',mode:'party',character:'male-a'});
const guest=await post('/api/join',{code:host.code,name:'Fly smoke B',character:'female-a'});
const [one,two]=await Promise.all([open(host.token),open(guest.token)]);
const moved=new Promise((resolve,reject)=>{
 const timeout=setTimeout(()=>reject(new Error('Movement was not broadcast')),5000);
 two.socket.on('message',raw=>{const message=JSON.parse(raw.toString());if(message.type==='state'&&message.state.players.some(player=>player.id===host.state.selfId&&player.pose?.x===2)){clearTimeout(timeout);resolve(message.state);}});
});
one.socket.send(JSON.stringify({type:'action',action:{type:'move',matchId:host.state.matchId,cell:{x:2,y:0,z:2.1,yaw:.1},actionId:crypto.randomUUID(),seq:1,epoch:'live-smoke'}}));
await moved;
one.socket.close();two.socket.close();
console.log(JSON.stringify({ok:true,base,room:host.code,rttMs:[one.rtt,two.rtt],transport:health.transports}));
