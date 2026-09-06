export const RARITIES=[{id:'common',name:'Común',weight:6000,color:'#768896',shards:5},{id:'rare',name:'Raro',weight:2700,color:'#2c82d0',shards:10},{id:'epic',name:'Épico',weight:1000,color:'#9464d1',shards:20},{id:'legendary',name:'Legendario',weight:250,color:'#b78720',shards:30},{id:'mythic',name:'Mítico',weight:50,color:'#d7589f',shards:40}];
export const WORLDS=[
 {id:'studio',name:'Patio original',rarity:'base',sky:'#e7eef3',icon:'☀'},
 {id:'mountains',name:'Cumbres alpinas',rarity:'common',sky:'#b9dbec',icon:'⛰'},
 {id:'japan',name:'Calle de Japón',rarity:'rare',sky:'#222c52',icon:'🏮'},
 {id:'sakura',name:'Jardín sakura',rarity:'epic',sky:'#f2dfe8',icon:'🌸'},
 {id:'moon',name:'Valle lunar',rarity:'legendary',sky:'#151a32',icon:'☾'},
 {id:'cosmos',name:'Japón astral',rarity:'mythic',sky:'#17112f',icon:'✦'}
];
export const CATALOG=[
 ...WORLDS.map(w=>({...w,slot:'world'})),
 {id:'nico-ocean',name:'Nico · Oceánico',slot:'character',asset:'male-a',color:'#8ed5ed',rarity:'rare',icon:'🌊'},
 {id:'luna-sakura',name:'Luna · Sakura',slot:'character',asset:'female-a',color:'#f3b8d7',rarity:'rare',icon:'🌸'},
 {id:'nico-forest',name:'Nico · Bosque',slot:'character',asset:'male-a',color:'#a9dcc0',rarity:'common',icon:'🌿'},
 {id:'vera-ice',name:'Vera · Glaciar',slot:'character',asset:'female-e',color:'#a1dcfa',rarity:'epic',icon:'❄'},
 {id:'alex-sunset',name:'Alex · Atardecer',slot:'character',asset:'male-e',color:'#f9c894',rarity:'epic',icon:'🌅'},
 {id:'luna-gold',name:'Luna · Gala',slot:'character',asset:'female-a',color:'#f8dfa0',rarity:'legendary',icon:'✨'},
 {id:'ice-shades',name:'Gafas glaciar',slot:'face',asset:'sunglasses',rarity:'rare',color:'#96e4f5',icon:'🕶'},
 {id:'lava-mask',name:'Máscara volcánica',slot:'face',asset:'mask',rarity:'epic',color:'#c55b46',icon:'🎭'},
 {id:'forest-hat',name:'Explorador del bosque',slot:'head',asset:'hat',rarity:'common',color:'#538970',icon:'🎩'},
 {id:'sakura-hat',name:'Sombrero sakura',slot:'head',asset:'sombrero',rarity:'rare',color:'#e9a7c5',icon:'👒'},
 {id:'moon-reader',name:'Lentes lunares',slot:'face',asset:'glasses',rarity:'epic',color:'#d8d3f0',icon:'👓'},
 {id:'ember-hat',name:'Corona de brasas',slot:'head',asset:'hat',rarity:'legendary',color:'#ed9b58',finish:'gold',icon:'🎩'},
 {id:'male-a',name:'Nico',slot:'character',asset:'male-a',rarity:'base',icon:'🧑'},
 {id:'female-a',name:'Luna',slot:'character',asset:'female-a',rarity:'base',icon:'👩'},
 {id:'straw',name:'Sol de verano',slot:'head',asset:'sombrero',rarity:'common',icon:'👒'},
 {id:'reader',name:'Lentes clásicos',slot:'face',asset:'glasses',rarity:'common',icon:'👓'},
 {id:'shades',name:'Modo incógnito',slot:'face',asset:'sunglasses',rarity:'common',icon:'🕶️'},
 {id:'mint-mask',name:'Máscara menta',slot:'face',asset:'mask',rarity:'common',color:'#66d5bc',icon:'🎭'},
 {id:'noir',name:'Sombrero nocturno',slot:'head',asset:'hat',rarity:'rare',color:'#233344',icon:'🎩'},
 {id:'electric',name:'Lentes eléctricos',slot:'face',asset:'sunglasses',rarity:'rare',color:'#328ef1',icon:'🕶️'},
 {id:'rose-mask',name:'Máscara coral',slot:'face',asset:'mask',rarity:'rare',color:'#ec779b',icon:'🎭'},
 {id:'aurora',name:'Sombrero aurora',slot:'head',asset:'sombrero',rarity:'epic',color:'#a381d5',finish:'satin',icon:'👒'},
 {id:'male-e',name:'Alex',slot:'character',asset:'male-e',rarity:'epic',icon:'🧑'},
 {id:'female-e',name:'Vera',slot:'character',asset:'female-e',rarity:'epic',icon:'👩'},
 {id:'gold-hat',name:'Gala de oro',slot:'head',asset:'hat',rarity:'legendary',color:'#ecc461',finish:'gold',icon:'🎩'},
 {id:'gold-shades',name:'Mirada dorada',slot:'face',asset:'sunglasses',rarity:'legendary',color:'#f5d56b',finish:'gold',icon:'🕶️'},
 {id:'prism-hat',name:'Prisma estelar',slot:'head',asset:'hat',rarity:'mythic',color:'#c399f2',finish:'prism',icon:'🎩'}
];
export const findItem=id=>CATALOG.find(x=>x.id===id);
export function rarityFromRoll(n){if(!Number.isInteger(n)||n<0||n>=10000)throw new Error('Invalid rarity roll');let total=0;for(const r of RARITIES){total+=r.weight;if(n<total)return r;}}
export function randomInt(limit){const a=new Uint32Array(1),max=Math.floor(2**32/limit)*limit;do{crypto.getRandomValues(a);}while(a[0]>=max);return a[0]%limit;}
export function itemChance(item){if(item.rarity==='base')return 0;return RARITIES.find(r=>r.id===item.rarity).weight/100/CATALOG.filter(i=>i.rarity===item.rarity).length;}
