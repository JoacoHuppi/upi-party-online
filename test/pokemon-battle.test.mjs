// El minijuego Pokemon corriendo con los archivos que se despliegan: sala, motor y ranking.
// Sin red ni navegador; comprueba que lo copiado al repo funciona junto.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoomService,POKEMON_MODES} from '../room-service.js';
import {createPokemonRanking,createMemoryRankingStore,rankingStoreFromEnv} from '../pokemon-ranking.mjs';
import {createTeamBuilder} from '../pokemon-teams.mjs';
import {POKEDEX,RANDOM_POOL} from '../pokemon-data.js';

const action=(type,matchId,cell,extra={})=>({type,matchId,cell,actionId:crypto.randomUUID(),...extra});
const breathe=()=>new Promise(res=>setTimeout(res,1));

test('el catalogo desplegado trae las nueve generaciones y el pool de Random',()=>{
 assert.ok(POKEDEX.length>800);
 assert.deepEqual([...new Set(POKEDEX.map(p=>p.gen))].sort((a,b)=>a-b),[1,2,3,4,5,6,7,8,9]);
 assert.ok(RANDOM_POOL.species>400);
 assert.deepEqual(Object.keys(RANDOM_POOL.byGen).map(Number).sort((a,b)=>a-b),[1,2,3,4,5,6,7,8,9]);
});

test('los equipos se arman en el servidor y rechazan entradas invalidas',()=>{
 const builder=createTeamBuilder();
 const six=POKEDEX.slice(0,6).map(p=>p.id);
 const team=builder.buildCollectionTeam(six,'repo');
 assert.equal(team.length,6);
 assert.ok(team.every(set=>set.level===50&&set.moves.length>=1));
 assert.throws(()=>builder.buildCollectionTeam([...six,six[0]],'repo'));
 assert.throws(()=>builder.buildCollectionTeam(['especie-inventada'],'repo'));
 assert.equal(builder.buildRandomTeam('repo').length,6);
});

test('sin variables de ranking configuradas el servidor sigue arrancando',()=>{
 assert.equal(rankingStoreFromEnv({}).kind,'memory');
});

test('una sala Pokemon juega un combate entero y anota una sola victoria',async()=>{
 const store=createMemoryRankingStore(),ranking=createPokemonRanking({store});
 let clock=0;
 const service=createRoomService({now:()=>clock,countdownMs:300,battleTimeoutMs:60000,ranking});
 const advance=async(ms=100)=>{clock+=ms;service.tick();await breathe();};
 const states=new Map();
 const stateOf=token=>states.get(token)??service.get(token);
 const host=service.create({name:'Ana',mode:'pokemonrandom'});
 const guest=service.join({code:host.code,name:'Beto'});
 for(const token of [host.token,guest.token])service.connect(token,packet=>states.set(token,packet));
 assert.equal(POKEMON_MODES[stateOf(host.token).mode],'random');
 const id=stateOf(host.token).matchId;
 service.action(host.token,action('ready',id,undefined,{ladderId:'repo-ana'}));
 service.action(guest.token,action('ready',id,undefined,{ladderId:'repo-beto'}));
 await advance(400);
 for(let i=0;i<600&&stateOf(host.token).booting;i++)await advance(50);
 assert.equal(stateOf(host.token).booting,false,'el combate tiene que arrancar');
 // Cada jugador ve su propio lado y su propio pedido.
 assert.equal(stateOf(host.token).game.side,'p1');
 assert.equal(stateOf(guest.token).game.side,'p2');
 assert.notDeepEqual(stateOf(host.token).game.request,stateOf(guest.token).game.request);
 const matchId=stateOf(host.token).matchId;
 let rounds=0;
 while(stateOf(host.token).phase==='playing'&&rounds<400){
  for(const token of [host.token,guest.token]){
   const game=stateOf(token).game;
   if(!game?.request||game.request.wait)continue;
   const request=game.request;
   let choice=null;
   if(request.teamPreview)choice='team 123456';
   else if(request.forceSwitch){const slot=request.side.pokemon.findIndex(p=>!p.active&&!p.condition.endsWith(' fnt'));if(slot>=0)choice='switch '+(slot+1);}
   else{const moves=request.active?.[0]?.moves||[],index=moves.findIndex(m=>!m.disabled&&(m.pp===undefined||m.pp>0));choice=index>=0?'move '+(index+1):null;}
   if(choice)service.action(token,action('choose',stateOf(token).matchId,{requestId:game.requestId,choice}));
  }
  await advance(50);rounds++;
 }
 const result=stateOf(host.token).result;
 assert.equal(stateOf(host.token).phase,'result');
 assert.ok(result,'el servidor tiene que declarar un resultado');
 await breathe();await breathe();
 if(result.winner){
  assert.equal(store.rows().length,1,'una fila por combate');
  assert.equal(store.rows()[0].battleId,matchId);
  assert.equal(store.rows()[0].mode,'random');
  const top=await ranking.top();
  assert.equal(top[0].wins,1);
  assert.equal(top[0].random,1);
 }
 service.close();
});
