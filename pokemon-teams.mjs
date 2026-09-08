// Construccion de equipos en el servidor con el motor de Pokemon Showdown (MIT).
// Nunca corre en el navegador: el cliente solo manda ids de especie y recibe el resultado.
//
// Dos origenes de sets, ambos derivados del motor:
//  1. Especies con set oficial de Random Battle (509 en gen9): se usa el generador del motor.
//  2. El resto (sobre todo evoluciones intermedias que Random Battle no usa): set derivado del
//     movepool real de la especie con la heuristica documentada en fallbackSet(). No se inventan
//     estadisticas ni movimientos: solo se elige entre lo que la especie realmente aprende.
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {Dex,Teams}=require('pokemon-showdown');
import {POKEDEX} from './pokemon-data.js';

export const RANDOM_FORMAT='gen9randombattle';
// Custom Game respeta el nivel de cada set, que es como se iguala el nivel en el modo Coleccion.
export const COLLECTION_FORMAT='gen9customgame';
export const COLLECTION_LEVEL=50;
export const TEAM_SIZE=6;
// Los sets del motor usan estos EV/IV parejos; el set de respaldo los copia para no introducir otra escala.
const FLAT_EVS={hp:85,atk:85,def:85,spa:85,spd:85,spe:85};
const FLAT_IVS={hp:31,atk:31,def:31,spa:31,spd:31,spe:31};
// Preferencia de movimiento de apoyo para el set de respaldo, en orden. Se toma el primero que la especie aprenda.
const UTILITY_PREFERENCE=['recover','roost','softboiled','slackoff','synthesis','moonlight','morningsun','shoreup',
 'swordsdance','nastyplot','calmmind','dragondance','quiverdance','shellsmash','bulkup','irondefense','agility',
 'stealthrock','spikes','toxicspikes','leechseed','willowisp','thunderwave','toxic','substitute','protect','rest'];

export const RANDOM_POOLS=['official','catalog'];
const dex=Dex.mod('gen9');
export const toSpeciesId=name=>dex.toID(name);
const bstOf=s=>s.baseStats.hp+s.baseStats.atk+s.baseStats.def+s.baseStats.spa+s.baseStats.spd+s.baseStats.spe;
// PRNG determinista para el sorteo propio del pool 'catalog'.
const mulberry=seed=>{let s=seed>>>0;return limit=>{s=s+0x6d2b79f5>>>0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)%limit;};};

// Un unico generador de referencia para saber que especies tienen set oficial.
const referenceGenerator=Teams.getGenerator(RANDOM_FORMAT);
const officialSets=referenceGenerator.randomSets||{};
const officialPoolIds=Object.keys(officialSets).sort();
// Las mismas 860 especies que ve el jugador: el pool 'catalog' de Random sortea sobre esta lista.
const catalogIds=POKEDEX.map(p=>p.id);
export const hasOfficialSet=id=>Boolean(officialSets[id]);
export const officialSetCount=()=>Object.keys(officialSets).length;

function movePool(species){
 return [...dex.species.getMovePool(species.id)]
  .map(id=>dex.moves.get(id))
  .filter(m=>m.exists&&m.isNonstandard===null&&m.id!=='struggle');
}
// Heuristica documentada: se puntua cada movimiento de ataque por potencia, bonus por tipo propio (STAB),
// afinidad con la estadistica ofensiva mas alta y precision. Se toman tres de tipos distintos y un apoyo.
function fallbackSet(species,level){
 const pool=movePool(species);
 if(!pool.length)throw new Error('Especie sin movimientos utilizables: '+species.name);
 const physical=species.baseStats.atk>=species.baseStats.spa;
 const wanted=physical?'Physical':'Special';
 const score=m=>{
  const stab=species.types.includes(m.type)?1.5:1;
  const fits=m.category===wanted?1:.6;
  const accuracy=typeof m.accuracy==='number'?m.accuracy/100:1;
  return m.basePower*stab*fits*accuracy;
 };
 const damaging=pool.filter(m=>m.category!=='Status'&&m.basePower>0).sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id));
 const moves=[],usedTypes=new Set();
 for(const m of damaging){if(moves.length>=3)break;if(usedTypes.has(m.type))continue;moves.push(m.id);usedTypes.add(m.type);}
 for(const m of damaging){if(moves.length>=3)break;if(!moves.includes(m.id))moves.push(m.id);}
 const utility=UTILITY_PREFERENCE.find(id=>pool.some(m=>m.id===id)&&!moves.includes(id));
 if(utility)moves.push(utility);
 for(const m of damaging){if(moves.length>=4)break;if(!moves.includes(m.id))moves.push(m.id);}
 for(const m of pool){if(moves.length>=4)break;if(!moves.includes(m.id))moves.push(m.id);}
 const ability=Object.values(species.abilities)[0]||'No Ability';
 return {name:species.name,species:species.name,item:'',ability,moves,
  nature:'Serious',gender:species.gender||'',evs:{...FLAT_EVS},ivs:{...FLAT_IVS},level,
  teraType:species.types[0],happiness:255,source:'movepool'};
}

// Nivel para los sets derivados del movepool, que no tienen nivel oficial.
// Aproxima la curva del motor (mas debil = mas nivel). Contrastada con niveles reales de 0.11.11:
// Mewtwo 680 -> 72 (motor 72), Pikachu 320 -> 92 (motor 93), Blissey 540 -> 80 (motor 85).
export function compensatedLevel(bst){
 return Math.min(100,Math.max(70,Math.round(100-(bst-175)*.055)));
}
// Semilla estable por combate y ranura para que dos servidores con la misma entrada den el mismo equipo.
const seedFrom=(text,slot)=>{
 let h=2166136261;
 for(const ch of String(text)+':'+slot){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}
 const n=()=>{h=Math.imul(h^h>>>15,2246822507);h=Math.imul(h^h>>>13,3266489909);return (h^=h>>>16)>>>0;};
 return [n()%0x10000,n()%0x10000,n()%0x10000,n()%0x10000];
};

export function createTeamBuilder({level=COLLECTION_LEVEL,levelMode='fixed'}={}){
 if(!['fixed','balanced'].includes(levelMode))throw new Error('levelMode invalido');
 if(!Number.isInteger(level)||level<1||level>100)throw new Error('level invalido');
 return {
  level,levelMode,officialSets:officialSetCount(),
  // Ids validos para el modo Coleccion: los mismos que el catalogo del cliente.
  isBattleReady(id){return Boolean(dex.species.get(id)?.exists);},
  // ids = especies elegidas por el jugador. El cliente puede mentir, asi que se valida todo aca.
  buildCollectionTeam(ids,seedKey='upi'){
   if(!Array.isArray(ids)||ids.length<1||ids.length>TEAM_SIZE)throw new Error('Equipo con tamano invalido');
   const unique=[...new Set(ids.map(id=>String(id)))];
   if(unique.length!==ids.length)throw new Error('Equipo con especies repetidas');
   return unique.map((id,slot)=>{
    const species=dex.species.get(id);
    if(!species?.exists||species.isNonstandard!==null||species.num<=0)throw new Error('Especie desconocida: '+id);
    if(species.battleOnly)throw new Error('Especie no elegible: '+id);
    let set;
    if(hasOfficialSet(species.id)){
     // El generador puede devolver otra forma de la misma especie base (cosmetica o ligada a objeto): es legal y se respeta.
     set={...Teams.getGenerator(RANDOM_FORMAT,seedFrom(seedKey,slot)).randomSet(species),source:'official'};
    }else set=fallbackSet(species,level);
    set.level=this.levelMode==='fixed'?level:set.level||level;
    // El apodo siempre es la especie que el jugador tiene en su coleccion, aunque salga una forma distinta.
    set.name=species.name;
    return set;
   });
  },
  // pool 'official': el catalogo curado de gen9randombattle (509 especies, las nueve generaciones,
  // sin evoluciones intermedias). pool 'catalog': las 860 del catalogo del jugador, con nivel
  // compensado para los que no tienen set oficial. Random NUNCA lee ni modifica la coleccion.
  buildRandomTeam(seedKey='upi',{pool='official'}={}){
   if(!RANDOM_POOLS.includes(pool))throw new Error('Pool de Random invalido: '+pool);
   const team=pool==='official'
    ?Teams.getGenerator(RANDOM_FORMAT,seedFrom(seedKey,0)).getTeam().map(set=>({...set,source:'random'}))
    :this.buildCatalogRandomTeam(seedKey);
   if(!Array.isArray(team)||team.length!==TEAM_SIZE)throw new Error('El generador no devolvio un equipo de seis');
   const ids=team.map(s=>dex.toID(dex.species.get(s.species).baseSpecies));
   if(new Set(ids).size!==ids.length)throw new Error('El equipo aleatorio salio con especies repetidas');
   return team;
  },
  // Sorteo propio sobre el catalogo completo, reutilizando la misma construccion de sets que Coleccion.
  buildCatalogRandomTeam(seedKey='upi'){
   const next=mulberry(seedFrom(seedKey,'catalog')[0]);
   const picks=[],seen=new Set();
   for(let attempt=0;picks.length<TEAM_SIZE&&attempt<catalogIds.length*20;attempt++){
    const id=catalogIds[next(catalogIds.length)];
    if(seen.has(id))continue;
    seen.add(id);picks.push(id);
   }
   if(picks.length!==TEAM_SIZE)throw new Error('No se pudo sortear un equipo de seis del catalogo');
   return picks.map((id,slot)=>{
    const species=dex.species.get(id);
    const set=hasOfficialSet(species.id)
     ?{...Teams.getGenerator(RANDOM_FORMAT,seedFrom(seedKey,slot)).randomSet(species),source:'random'}
     :{...fallbackSet(species,compensatedLevel(bstOf(species))),source:'random-movepool'};
    if(!set.level)set.level=compensatedLevel(bstOf(species));
    set.name=species.name;
    return set;
   });
  },
  pack:team=>Teams.pack(team),
  // El pool del catalogo no es un equipo valido de gen9randombattle, asi que corre en Custom Game.
  formatFor:(mode,{pool='official'}={})=>mode==='random'&&pool==='official'?RANDOM_FORMAT:COLLECTION_FORMAT,
  randomPoolIds:()=>[...officialPoolIds],
  randomPoolByGen(){const by={};for(const id of officialPoolIds){const g=dex.species.get(id).gen;by[g]=(by[g]||0)+1;}return by;}
 };
}
