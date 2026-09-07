import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {WebSocket,WebSocketServer} from 'ws';
import {createRoomService} from './room-service.js';

export async function startOnlineServer({port=8787,host='127.0.0.1',allowedOrigins=[],serviceOptions={}}={}){
 const gameHTML=await readFile(new URL('./UPI-Party-3D.html',import.meta.url));
 const networkClient=await readFile(new URL('./network-client.js',import.meta.url));
 const service=createRoomService(serviceOptions),limits=new Map(),streams=new Set(),sockets=new Set();
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
 function rate(key,max,windowMs){const t=Date.now(),entry=limits.get(key);if(!entry||t-entry.at>windowMs){limits.set(key,{at:t,n:1});return true;}return ++entry.n<=max;}
 async function body(req){let size=0,parts=[];for await(const part of req){size+=part.length;if(size>4096)throw Object.assign(new Error('Petición demasiado grande.'),{status:413});parts.push(part);}try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw Object.assign(new Error('JSON inválido.'),{status:400});}}
 function originAllowed(origin,server){
  const localOrigins=[`http://127.0.0.1:${server.address()?.port}`,`http://localhost:${server.address()?.port}`],desktopOrigin=origin==='tauri://localhost'||origin==='http://tauri.localhost'||origin==='https://tauri.localhost';
  return !origin||origin==='null'||localOrigins.includes(origin)||allowedOrigins.includes(origin)||desktopOrigin;
 }
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  const origin=req.headers.origin;
  if(!originAllowed(origin,server)){json(res,403,{error:'Origen no permitido.'});return;}
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');}
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  const path=new URL(req.url,'http://localhost').pathname,token=(req.headers.authorization||'').replace(/^Bearer /,'');
  try{
   if(req.method==='GET'&&['/','/UPI-Party-3D.html'].includes(path)){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(gameHTML);return;}
   if(req.method==='GET'&&path==='/network-client.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(networkClient);return;}
   if(req.method==='GET'&&path==='/health'){json(res,200,{ok:true,protocol:2,transports:['http','websocket'],modes:['party','fakeout','sequence','aim','odd']});return;}
   if(!rate('ip:'+req.socket.remoteAddress,300,10000)){json(res,429,{error:'Demasiadas peticiones. Esperá unos segundos.'});return;}
   if(req.method==='POST'&&['/api/create','/api/join'].includes(path)){
    if(!rate('entry:'+req.socket.remoteAddress,25,60000)){json(res,429,{error:'Demasiados intentos de sala.'});return;}
    const data=await body(req);if(!data||typeof data!=='object')throw new Error('Petición inválida.');json(res,200,path==='/api/create'?service.create(data):service.join(data));return;
   }
   if(req.method==='GET'&&path==='/api/state'){json(res,200,service.get(token));return;}
   // Kept temporarily for rollback compatibility. The shipped client uses /ws.
   if(req.method==='GET'&&path==='/api/events'){
    service.get(token);let disconnect;
    const send=data=>{if(res.writableLength>65536){res.destroy();return;}res.write('data: '+JSON.stringify(data)+'\n\n');if(data.closed)res.end();};
    const pending=[];disconnect=service.connect(token,data=>{if(res.headersSent)send(data);else pending.push(data);});
    res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Connection':'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders();pending.forEach(send);streams.add(res);
    const keepAlive=setInterval(()=>res.write(': keep-alive\n\n'),10000);req.on('close',()=>{clearInterval(keepAlive);streams.delete(res);disconnect();});return;
   }
   if(req.method==='POST'&&path==='/api/action'){
    if(!rate('token:'+token,100,1000)){json(res,429,{error:'Entradas demasiado rápidas.'});return;}
    json(res,200,service.action(token,await body(req),{receivedAt:performance.now()}));return;
   }
   json(res,404,{error:'Ruta no encontrada.'});
  }catch(e){if(!res.headersSent)json(res,e.status||400,{error:e.message||'Petición inválida.'});else res.end();}
 });

 const webSockets=new WebSocketServer({noServer:true,clientTracking:false,maxPayload:8192,perMessageDeflate:false});
 function send(ws,message,volatile=false){
  if(ws.readyState!==WebSocket.OPEN)return;
  const encoded=typeof message==='string'?message:JSON.stringify(message);
  if(volatile&&ws.bufferedAmount>32768){ws.latestState=encoded;return;}
  ws.send(encoded,error=>{if(error)console.warn('[ws] send error:',error.message);});
 }
 function flushLatest(ws){if(ws.latestState&&ws.readyState===WebSocket.OPEN&&ws.bufferedAmount<=32768){const latest=ws.latestState;ws.latestState=null;send(ws,latest,true);}}
 function appPing(ws){
  if(ws.readyState!==WebSocket.OPEN)return;
  if(ws.pendingPing&&performance.now()-ws.pendingPing.at>15000){console.warn(`[ws] ping timeout room=${ws.roomCode||'-'} player=${ws.playerId||'-'}`);ws.terminate();return;}
  const id=(ws.pingSequence=(ws.pingSequence||0)+1).toString(36);ws.pendingPing={id,at:performance.now()};ws.isAlive=false;ws.ping();send(ws,{type:'ping',id});flushLatest(ws);
 }
 server.on('upgrade',(req,socket,head)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname!=='/ws'||!originAllowed(req.headers.origin,server)){socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;}
  webSockets.handleUpgrade(req,socket,head,ws=>webSockets.emit('connection',ws,req));
 });
 webSockets.on('connection',(ws,req)=>{
  sockets.add(ws);ws.isAlive=true;ws.rtt=null;ws.remoteAddress=req.socket.remoteAddress;
  let token=null,disconnect=null,authenticated=false;
  const authTimeout=setTimeout(()=>ws.close(4401,'Autenticación requerida.'),5000);
  ws.on('pong',()=>{ws.isAlive=true;});
  ws.on('message',(raw,isBinary)=>{
   if(isBinary||raw.length>8192){ws.close(4400,'Mensaje inválido.');return;}
   let message;try{message=JSON.parse(raw.toString('utf8'));}catch{send(ws,{type:'error',status:400,error:'JSON inválido.'});return;}
   try{
    if(!authenticated){
     if(message.type!=='auth'||typeof message.token!=='string')throw Object.assign(new Error('Autenticación requerida.'),{status:401});
     const state=service.get(message.token);token=message.token;authenticated=true;clearTimeout(authTimeout);ws.roomCode=state.code;ws.playerId=state.selfId;
     send(ws,{type:'hello',protocol:2,transport:'websocket'});
     disconnect=service.connect(token,next=>send(ws,{type:'state',state:next},true));
     console.log(`[ws] connected room=${ws.roomCode} player=${ws.playerId} ip=${ws.remoteAddress||'-'}`);appPing(ws);return;
    }
    if(message.type==='pong'&&ws.pendingPing?.id===message.id){
     ws.rtt=Math.round(performance.now()-ws.pendingPing.at);ws.pendingPing=null;send(ws,{type:'latency',rtt:ws.rtt});return;
    }
    if(message.type!=='action'||!message.action||typeof message.action!=='object')throw new Error('Mensaje WebSocket desconocido.');
    if(!rate('ws-token:'+token,100,1000))throw Object.assign(new Error('Entradas demasiado rápidas.'),{status:429});
    const result=service.action(token,message.action,{receivedAt:performance.now(),rtt:ws.rtt});
    if(typeof message.requestId==='string')send(ws,{type:'ack',requestId:message.requestId,result});
   }catch(error){
    send(ws,{type:'error',requestId:typeof message.requestId==='string'?message.requestId:undefined,status:error.status||400,error:error.message||'Mensaje inválido.'});
    if(!authenticated&&(error.status===401||error.status===404))ws.close(4401,'Sesión inválida.');
   }
  });
  ws.on('error',error=>console.warn(`[ws] error room=${ws.roomCode||'-'} player=${ws.playerId||'-'}: ${error.message}`));
  ws.on('close',(code)=>{clearTimeout(authTimeout);sockets.delete(ws);disconnect?.();if(authenticated)console.log(`[ws] disconnected room=${ws.roomCode} player=${ws.playerId} code=${code}`);});
 });

 server.headersTimeout=10000;server.requestTimeout=15000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
 const tick=setInterval(()=>service.tick(),50),heartbeat=setInterval(()=>{for(const ws of sockets)appPing(ws);},5000),clean=setInterval(()=>{for(const [key,v]of limits)if(Date.now()-v.at>60000)limits.delete(key);},60000);
 return {url:`http://${host}:${server.address().port}`,webSocketUrl:`ws://${host}:${server.address().port}/ws`,service,async close(){clearInterval(tick);clearInterval(heartbeat);clearInterval(clean);service.close();for(const res of streams)res.end();for(const ws of sockets)ws.close(1001,'Servidor detenido.');webSockets.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
if(process.argv[1]&&pathToFileURL(fileURLToPath(import.meta.url)).href===pathToFileURL(process.argv[1]).href){
 const instance=await startOnlineServer({port:Number(process.env.PORT||8787),host:process.env.HOST||'0.0.0.0',allowedOrigins:[process.env.RENDER_EXTERNAL_URL,process.env.FLY_APP_NAME&&`https://${process.env.FLY_APP_NAME}.fly.dev`,...(process.env.ALLOWED_ORIGINS||'').split(',')].filter(Boolean)});
 console.log('UPI Party room server:',instance.url);console.log('WebSocket:',instance.webSocketUrl);console.log('Salas en memoria: se pierden al reiniciar o desplegar.');
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await instance.close();process.exit(0);});
}
