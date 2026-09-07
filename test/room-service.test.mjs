import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoomService} from '../room-service.js';

const action=(type,matchId,cell,extra={})=>({type,matchId,cell,actionId:crypto.randomUUID(),...extra});

test('movement accepts fresh snapshots, drops stale sequences and stays room-scoped',()=>{
 let clock=0;
 const service=createRoomService({now:()=>clock,countdownMs:0,seed:()=>1});
 const one=service.create({name:'Uno',mode:'party',character:'male-a'});
 const two=service.join({code:one.code,name:'Dos',character:'female-a'});
 const other=service.create({name:'Otro',mode:'party',character:'male-a'});
 const seenOne=[],seenTwo=[],seenOther=[];
 const closeOne=service.connect(one.token,state=>seenOne.push(state));
 const closeTwo=service.connect(two.token,state=>seenTwo.push(state));
 const closeOther=service.connect(other.token,state=>seenOther.push(state));
 clock=40;
 const fresh=service.action(one.token,action('move',one.state.matchId,{x:2,y:0,z:2.1,yaw:.2},{seq:2,epoch:'connection-a'}),{receivedAt:clock});
 assert.equal(fresh.accepted,true);
 clock=80;
 const stale=service.action(one.token,action('move',one.state.matchId,{x:9,y:0,z:2.1,yaw:.2},{seq:1,epoch:'connection-a'}),{receivedAt:clock});
 assert.equal(stale.stale,true);
 assert.equal(service.get(two.token).players.find(player=>player.id===one.state.selfId).pose.x,2);
 assert.equal(seenOther.at(-1).players.length,1);
 assert.equal(seenOther.at(-1).code,other.code);
 closeOne();closeTwo();closeOther();service.close();
});

test('server receipt time decides reaction input and RTT only flags a close call',()=>{
 let clock=0;
 const service=createRoomService({now:()=>clock,countdownMs:0,seed:()=>7});
 const one=service.create({name:'Uno',mode:'fakeout',character:'male-a'});
 const two=service.join({code:one.code,name:'Dos',character:'female-a'});
 const closeOne=service.connect(one.token,()=>{}),closeTwo=service.connect(two.token,()=>{});
 service.action(one.token,action('ready',one.state.matchId),{receivedAt:clock});
 service.action(two.token,action('ready',one.state.matchId),{receivedAt:clock});
 service.tick();
 for(let i=0;i<200&&service.get(one.token).game?.cue!=='go';i++){clock+=50;service.tick();}
 const before=service.get(one.token);
 assert.equal(before.game.cue,'go');
 const firstAt=clock;
 const first=service.action(one.token,{...action('press',before.matchId),clientTimestamp:-999999},{receivedAt:firstAt,rtt:80});
 assert.equal(first.accepted,true);
 clock+=10;
 const second=service.action(two.token,{...action('press',before.matchId),clientTimestamp:999999999},{receivedAt:clock,rtt:80});
 assert.equal(second.accepted,false);
 const state=service.get(one.token);
 assert.equal(state.game.roundWinner,one.state.selfId);
 assert.deepEqual(state.timing.kind,'close-call');
 assert.equal(state.timing.serverDeltaMs,10);
 assert.equal(state.timing.order,'server-receipt');
 closeOne();closeTwo();service.close();
});

test('sequence, aim and odd inputs remain server-authoritative through room actions',()=>{
 for(const mode of ['sequence','aim','odd']){
  let clock=0;
  const service=createRoomService({now:()=>clock,countdownMs:0,seed:()=>11});
  const one=service.create({name:'Uno',mode,character:'male-a'});
  const two=service.join({code:one.code,name:'Dos',character:'female-a'});
  const closeOne=service.connect(one.token,()=>{}),closeTwo=service.connect(two.token,()=>{});
  service.action(one.token,action('ready',one.state.matchId),{receivedAt:clock});
  service.action(two.token,action('ready',one.state.matchId),{receivedAt:clock});
  service.tick();
  let state=service.get(one.token);
  assert.equal(state.phase,'playing');
  if(mode==='sequence'){
   const lit=state.game.lit;
   clock=600;service.tick();
   clock=820;service.tick();
   state=service.get(one.token);
   assert.equal(state.game.phase,'input');
   const result=service.action(one.token,action('pick',state.matchId,lit),{receivedAt:clock});
   assert.equal(result.accepted,true);
   assert.equal(service.get(one.token).game.completed,1);
  }else{
   clock=250;service.tick();
   state=service.get(one.token);
   const choice=mode==='aim'
    ?{index:state.game.target.index,x:state.game.target.x,y:state.game.target.y}
    :{index:state.game.board.index,cell:state.game.board.odd};
   const result=service.action(one.token,action('pick',state.matchId,choice),{receivedAt:clock});
   assert.equal(result.accepted,true);
   assert.equal(service.get(one.token).game.lastHit.player,one.state.selfId);
  }
  closeOne();closeTwo();service.close();
 }
});
