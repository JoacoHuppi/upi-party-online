import test from 'node:test';
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {startOnlineServer} from '../online-server.mjs';

async function post(url,path,data){
 const response=await fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
 const body=await response.json();
 assert.equal(response.ok,true,body.error);
 return body;
}

function roomSocket(url,token){
 const ws=new WebSocket(url.replace(/^http/,'ws')+'/ws'),messages=[],waiters=[];
 const deliver=message=>{
  messages.push(message);
  const index=waiters.findIndex(waiter=>waiter.predicate(message));
  if(index>=0){const [waiter]=waiters.splice(index,1);clearTimeout(waiter.timer);waiter.resolve(message);}
 };
 ws.on('message',raw=>{
  const message=JSON.parse(raw.toString());
  if(message.type==='ping')ws.send(JSON.stringify({type:'pong',id:message.id}));
  deliver(message);
 });
 const opened=new Promise((resolve,reject)=>{ws.once('open',()=>{ws.send(JSON.stringify({type:'auth',token}));resolve();});ws.once('error',reject);});
 const waitFor=(predicate,timeout=3000)=>new Promise((resolve,reject)=>{
  const found=messages.find(predicate);if(found)return resolve(found);
  const waiter={predicate,resolve,reject,timer:setTimeout(()=>{const index=waiters.indexOf(waiter);if(index>=0)waiters.splice(index,1);reject(new Error('Timed out waiting for WebSocket message'));},timeout)};waiters.push(waiter);
 });
 return {ws,messages,opened,waitFor,close:()=>new Promise(resolve=>{if(ws.readyState===WebSocket.CLOSED)return resolve();ws.once('close',resolve);ws.close();})};
}

test('WebSocket transport authenticates, isolates rooms, pings and reconnects',async t=>{
 const server=await startOnlineServer({port:0,host:'127.0.0.1',serviceOptions:{graceMs:1000,countdownMs:20}});
 t.after(()=>server.close());
 const host=await post(server.url,'/api/create',{name:'Host',mode:'party',character:'male-a'});
 const guest=await post(server.url,'/api/join',{code:host.code,name:'Guest',character:'female-a'});
 const outsider=await post(server.url,'/api/create',{name:'Outsider',mode:'party',character:'male-a'});
 const a=roomSocket(server.url,host.token),b=roomSocket(server.url,guest.token),c=roomSocket(server.url,outsider.token);
 await Promise.all([a.opened,b.opened,c.opened]);
 const [aState,bState,cState]=await Promise.all([
  a.waitFor(message=>message.type==='state'),
  b.waitFor(message=>message.type==='state'),
  c.waitFor(message=>message.type==='state')
 ]);
 assert.equal(aState.state.code,host.code);
 assert.equal(bState.state.code,host.code);
 assert.equal(cState.state.code,outsider.code);
 assert.equal(cState.state.players.length,1);
 await a.waitFor(message=>message.type==='latency');

 a.ws.send(JSON.stringify({type:'action',action:{type:'move',matchId:aState.state.matchId,cell:{x:2,y:0,z:2.1,yaw:.1},actionId:crypto.randomUUID(),seq:1,epoch:'test'}}));
 const moved=await b.waitFor(message=>message.type==='state'&&message.state.players.some(player=>player.id===host.state.selfId&&player.pose?.x===2));
 assert.equal(moved.state.code,host.code);
 assert.equal(c.messages.some(message=>message.type==='state'&&message.state.code===host.code),false);

 await a.close();
 const reconnected=roomSocket(server.url,host.token);await reconnected.opened;
 const restored=await reconnected.waitFor(message=>message.type==='state'&&message.state.players.find(player=>player.id===host.state.selfId)?.connected);
 assert.equal(restored.state.code,host.code);
 await Promise.all([reconnected.close(),b.close(),c.close()]);
});
