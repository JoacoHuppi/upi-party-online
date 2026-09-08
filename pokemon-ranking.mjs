// Ranking de victorias Pokemon. Vive en el servidor: el ganador lo decide el motor, nunca el cliente.
// Reglas que no se negocian:
//  - Solo se registra una fila por combate (battleId). El deduplicado es del almacen, no de la memoria.
//  - Nunca se acepta un contador acumulado ni un ganador propuesto por el cliente: solo se suman filas.
//  - No se toca la tabla de "highest score": es otra tabla y otro camino.
export const RANKING_MODES=['collection','random'];
// Nombres de variables de entorno. NUNCA escribir los valores en el repo ni en los checkpoints.
export const RANKING_ENV={url:'UPI_RANKING_URL',key:'UPI_RANKING_SERVICE_KEY',table:'UPI_RANKING_TABLE'};

// Almacen de memoria: sirve para pruebas y para que un servidor sin configurar no se caiga.
export function createMemoryRankingStore(){
 const rows=new Map();
 return {
  kind:'memory',
  async record(entry){
   if(rows.has(entry.battleId))return 'duplicate';
   rows.set(entry.battleId,entry);return 'inserted';
  },
  async top(mode=null,limit=20){
   const tally=new Map();
   for(const row of rows.values()){
    if(mode&&row.mode!==mode)continue;
    const current=tally.get(row.playerId)||{playerId:row.playerId,name:row.name,wins:0,collection:0,random:0};
    current.wins++;current[row.mode]++;current.name=row.name;tally.set(row.playerId,current);
   }
   return [...tally.values()].sort((a,b)=>b.wins-a.wins||a.playerId.localeCompare(b.playerId)).slice(0,limit);
  },
  rows:()=>[...rows.values()]
 };
}

// Almacen real: una fila por combate, con `battle_id` UNIQUE. El deduplicado lo garantiza la base,
// no este proceso, asi que dos servidores o un reintento no pueden contar la misma victoria dos veces.
export function createSupabaseRankingStore({url,serviceKey,table='upi3d_pokemon_wins',fetchImpl=fetch,timeoutMs=8000}){
 if(!url||!serviceKey)throw new Error('Ranking sin configurar: faltan '+RANKING_ENV.url+' y/o '+RANKING_ENV.key);
 const headers={apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'};
 return {
  kind:'supabase',
  async record(entry){
   const response=await fetchImpl(`${url}/rest/v1/${table}?on_conflict=battle_id`,{
    method:'POST',
    headers:{...headers,Prefer:'resolution=ignore-duplicates,return=representation'},
    body:JSON.stringify({battle_id:entry.battleId,player_id:entry.playerId,name:entry.name,mode:entry.mode,won_at:new Date(entry.at).toISOString()}),
    signal:AbortSignal.timeout(timeoutMs)
   });
   if(!response.ok)throw new Error('El ranking rechazó la victoria ('+response.status+').');
   const inserted=await response.json().catch(()=>[]);
   return Array.isArray(inserted)&&inserted.length?'inserted':'duplicate';
  },
  async top(mode=null,limit=20){
   const query=mode?`&mode=eq.${mode}`:'';
   const response=await fetchImpl(`${url}/rest/v1/${table}?select=player_id,name,mode${query}&limit=5000`,{headers,signal:AbortSignal.timeout(timeoutMs)});
   if(!response.ok)throw new Error('No se pudo leer el ranking ('+response.status+').');
   const rows=await response.json();
   const tally=new Map();
   for(const row of rows){
    const current=tally.get(row.player_id)||{playerId:row.player_id,name:row.name,wins:0,collection:0,random:0};
    current.wins++;if(RANKING_MODES.includes(row.mode))current[row.mode]++;current.name=row.name||current.name;
    tally.set(row.player_id,current);
   }
   return [...tally.values()].sort((a,b)=>b.wins-a.wins||String(a.playerId).localeCompare(String(b.playerId))).slice(0,limit);
  }
 };
}

// Elige almacen segun el entorno. Sin configurar no rompe nada: cuenta en memoria y lo dice.
export function rankingStoreFromEnv(env=process.env){
 const url=env[RANKING_ENV.url],serviceKey=env[RANKING_ENV.key];
 if(!url||!serviceKey)return createMemoryRankingStore();
 return createSupabaseRankingStore({url,serviceKey,table:env[RANKING_ENV.table]||undefined});
}

export function createPokemonRanking({store=createMemoryRankingStore(),now=()=>Date.now(),onError=()=>{}}={}){
 // Cortafuegos rapido para reintentos dentro del mismo proceso. La verdad la tiene el almacen.
 const seen=new Set();
 return {
  store,
  async recordWin({battleId,mode,playerId,name}={}){
   if(typeof battleId!=='string'||!battleId||battleId.length>120)return {status:'invalid',reason:'battleId'};
   if(!RANKING_MODES.includes(mode))return {status:'invalid',reason:'mode'};
   // Sin identidad de ladder no se puede atribuir: el combate vale igual, pero no suma al ranking global.
   if(typeof playerId!=='string'||!playerId||playerId.length>80)return {status:'skipped',reason:'sin identidad'};
   if(seen.has(battleId))return {status:'duplicate'};
   const entry={battleId,mode,playerId,name:String(name||'Jugador').slice(0,20),at:now()};
   try{
    const result=await store.record(entry);
    seen.add(battleId);
    if(seen.size>2000)seen.delete(seen.values().next().value);
    return {status:result==='inserted'?'recorded':'duplicate'};
   }catch(error){onError(error);return {status:'failed',reason:String(error?.message||error).slice(0,160)};}
  },
  async top(mode=null,limit=20){
   if(mode!==null&&!RANKING_MODES.includes(mode))throw new Error('Modo de ranking invalido');
   return store.top(mode,limit);
  }
 };
}
