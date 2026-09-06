import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRoomService} from './room-service.js';

export async function startOnlineServer({port=8787,host='127.0.0.1',allowedOrigins=[],serviceOptions={}}={}){
 const gameHTML=await readFile(new URL('./UPI-Party-3D.html',import.meta.url));
 const service=createRoomService(serviceOptions),limits=new Map(),streams=new Set();
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
 function rate(key,max,windowMs){const t=Date.now(),entry=limits.get(key);if(!entry||t-entry.at>windowMs){limits.set(key,{at:t,n:1});return true;}return ++entry.n<=max;}
 async function body(req){let size=0,parts=[];for await(const part of req){size+=part.length;if(size>4096)throw Object.assign(new Error('Petición demasiado grande.'),{status:413});parts.push(part);}try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw Object.assign(new Error('JSON inválido.'),{status:400});}}
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  const origin=req.headers.origin,localOrigins=[`http://127.0.0.1:${server.address()?.port}`,`http://localhost:${server.address()?.port}`];
  if(origin&&!['null',...localOrigins,...allowedOrigins].includes(origin)){json(res,403,{error:'Origen no permitido.'});return;}
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');}
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  const path=new URL(req.url,'http://localhost').pathname,token=(req.headers.authorization||'').replace(/^Bearer /,'');
  try{
   if(req.method==='GET'&&['/','/UPI-Party-3D.html'].includes(path)){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(gameHTML);return;}
   if(req.method==='GET'&&path==='/health'){json(res,200,{ok:true,protocol:1,modes:['party','fakeout','sequence','aim','odd']});return;}
   if(!rate('ip:'+req.socket.remoteAddress,300,10000)){json(res,429,{error:'Demasiadas peticiones. Esperá unos segundos.'});return;}
   if(req.method==='POST'&&['/api/create','/api/join'].includes(path)){
    if(!rate('entry:'+req.socket.remoteAddress,25,60000)){json(res,429,{error:'Demasiados intentos de sala.'});return;}
    const data=await body(req);if(!data||typeof data!=='object')throw new Error('Petición inválida.');json(res,200,path==='/api/create'?service.create(data):service.join(data));return;
   }
   if(req.method==='GET'&&path==='/api/state'){json(res,200,service.get(token));return;}
   if(req.method==='GET'&&path==='/api/events'){
    service.get(token);let disconnect;
    const send=data=>{if(res.writableLength>65536){res.destroy();return;}res.write('data: '+JSON.stringify(data)+'\n\n');if(data.closed)res.end();};
    // Register before writing headers so a connection-limit error remains JSON.
    const pending=[];disconnect=service.connect(token,data=>{if(res.headersSent)send(data);else pending.push(data);});
    res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Connection':'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders();pending.forEach(send);streams.add(res);
    const keepAlive=setInterval(()=>res.write(': keep-alive\n\n'),10000);req.on('close',()=>{clearInterval(keepAlive);streams.delete(res);disconnect();});return;
   }
   if(req.method==='POST'&&path==='/api/action'){
    if(!rate('token:'+token,100,1000)){json(res,429,{error:'Entradas demasiado rápidas.'});return;}
    json(res,200,service.action(token,await body(req)));return;
   }
   json(res,404,{error:'Ruta no encontrada.'});
  }catch(e){if(!res.headersSent)json(res,e.status||400,{error:e.message||'Petición inválida.'});else res.end();}
 });
 server.headersTimeout=10000;server.requestTimeout=15000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
 const tick=setInterval(()=>service.tick(),25),clean=setInterval(()=>{for(const [key,v]of limits)if(Date.now()-v.at>60000)limits.delete(key);},60000);
 return {url:`http://${host}:${server.address().port}`,service,async close(){clearInterval(tick);clearInterval(clean);service.close();for(const res of streams)res.end();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}
if(process.argv[1]&&pathToFileURL(fileURLToPath(import.meta.url)).href===pathToFileURL(process.argv[1]).href){
 const instance=await startOnlineServer({port:Number(process.env.PORT||8787),host:process.env.HOST||'0.0.0.0',allowedOrigins:[process.env.RENDER_EXTERNAL_URL,...(process.env.ALLOWED_ORIGINS||'').split(',')].filter(Boolean)});
 console.log('UPI Party room server:',instance.url);console.log('Solo pruebas locales por defecto. Sin publicación en Internet ni persistencia de salas.');
 for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await instance.close();process.exit(0);});
}
