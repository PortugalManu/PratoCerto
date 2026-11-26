// Reconhece alimentos escritos do seu jeito e converte em porções da lista de substituição.
import { LISTA } from './lista.js';

/* Macros médios por 1 porção de cada grupo (aprox.), usados quando o alimento não tem valor TACO próprio */
const GROUP_MACROS={"Pão":{p:2.2,c:13.5,f:0.9},"Recheio ou molho":{p:0.3,c:1,f:2.2},"Carne ou ovo":{p:25,c:1,f:10.5},"Arroz":{p:1.6,c:17.5,f:0.3},"Feijão":{p:2.9,c:8,f:0.3},"Leite":{p:3.3,c:4.5,f:2.6},"Fruta":{p:0.9,c:17,f:0.3},"Vegetal refogado":{p:1.5,c:6,f:2.4},"Castanha":{p:1,c:1.2,f:2.6},"Vegetal cru ou cozido":{p:0,c:0,f:0}};

/* Palavras do dia a dia -> alimento da lista, com macros TACO por 100 g [kcal,p,c,f] */
const PREF=[
 [["arroz","arroz branco"],"Arroz polido cozido",[128,2.5,28.1,0.2]],
 [["arroz integral"],"Arroz integral cozido",[124,2.6,25.8,1.0]],
 [["feijao","feijao carioca"],"Feijão carioca cozido",[76,4.8,13.6,0.5]],
 [["feijao preto"],"Feijão preto cozido",[77,4.5,14.0,0.5]],
 [["macarrao","massa","espaguete","penne"],"Macarrão cozido",[157,5.8,30.9,0.9]],
 [["macarrao integral"],"Macarrão integral cozido",[124,5.3,26.5,0.5]],
 [["batata doce","batata-doce"],"Batata doce cozida",[77,0.6,18.4,0.1]],
 [["batata","batata inglesa"],"Batata inglesa cozida",[52,1.2,11.9,0]],
 [["pure","pure de batata"],"Purê de batata",[94,1.9,14.6,3.3]],
 [["mandioca","aipim","macaxeira"],"Mandioca cozida (aipim)",[125,0.6,30.1,0.3]],
 [["inhame"],"Inhame cozido",[97,2.1,23.2,0.1]],
 [["milho","milho verde"],"Milho verde cozido",[98,3.2,17.1,2.1]],
 [["frango","peito de frango","frango grelhado","file de frango","frango cozido"],"Peito de frango cozido ou grelhado",[159,32.0,0,2.5]],
 [["frango assado"],"Peito de frango assado",[163,31.5,0,3.2]],
 [["coxa de frango","coxa"],"Coxa de frango assada",[215,27,0,11]],
 [["sobrecoxa"],"Sobrecoxa de frango assada",[233,25,0,14]],
 [["carne","carne de panela","carne cozida"],"Carne bovina cozida",[219,30,0,10]],
 [["carne moida","moida","patinho moido"],"Carne bovina moída refogada",[212,26.7,0,10.9]],
 [["bife","patinho","alcatra","contra file","file mignon"],"Bife bovino grelhado",[219,35.9,0,7.3]],
 [["carne assada"],"Carne bovina assada",[231,31,0,11]],
 [["lombo","porco","carne de porco"],"Lombo de porco assado",[210,35.7,0,6.4]],
 [["hamburguer"],"Hambúrguer bovino grelhado",[210,20,4,12]],
 [["peixe","tilapia","merluza","pescada"],"Peixe assado",[128,26,0,2.7]],
 [["salmao"],"Salmão cozido ou grelhado",[229,23.9,0,14]],
 [["atum"],"Atum ao natural enlatado (em água e sal)",[116,26,0,1]],
 [["sardinha"],"Sardinha enlatada (em molho de tomate)",[178,20,1,10]],
 [["ovo","ovos","ovo cozido","ovos cozidos"],"Ovo de galinha cozido",[146,13.3,0.6,9.5]],
 [["ovo frito","ovos fritos"],"Ovo de galinha frito",[240,15.6,1.2,18.6]],
 [["ovo mexido","ovos mexidos"],"Ovo mexido",[200,13,1.5,15]],
 [["omelete"],"Omelete simples",[154,11,1,12]],
 [["pao","pao frances","pao de sal","paozinho"],"Pão francês",[300,8,58.6,3.1]],
 [["pao de forma"],"Pão de forma",[253,7.5,49,2.7]],
 [["pao integral","pao de forma integral"],"Pão de forma integral",[253,9.4,49.9,3.7]],
 [["pao de queijo"],"Pão de queijo",[363,5.1,34.2,24.6]],
 [["rap 10","rap10","wrap"],"Pão folha integral (Rap 10)",[290,8,50,6]],
 [["cuscuz"],"Cuscuz de milho com sal",[113,2.2,25.3,0.7]],
 [["aveia"],"Aveia em flocos finos",[394,13.9,66.6,8.5]],
 [["granola"],"Granola tradicional",[421,9.8,66,13]],
 [["torrada"],"Torrada industrializada",[377,10.5,74.6,3.3]],
 [["biscoito de arroz","bolacha de arroz"],"Bolacha de arroz integral",[380,8,80,3]],
 [["leite","leite integral"],"Leite integral",[61,2.9,4.3,3.2]],
 [["leite desnatado"],"Leite desnatado",[35,3.4,5,0.1]],
 [["iogurte","iogurte natural"],"Iogurte natural",[51,4.1,1.9,3]],
 [["iogurte grego"],"Iogurte grego",[110,4,13,4.5]],
 [["queijo","mucarela","mussarela"],"Queijo muçarela",[330,22.6,3,25.2]],
 [["queijo minas","queijo branco","minas frescal"],"Queijo minas frescal",[264,17.4,3.2,20.2]],
 [["cottage"],"Queijo cottage",[98,11,3.4,4.3]],
 [["ricota"],"Ricota",[140,12.6,3.8,8.1]],
 [["requeijao"],"Requeijão cremoso",[257,9.6,2.4,23.4]],
 [["banana"],"Banana prata",[98,1.3,26,0.1]],
 [["maca"],"Maçã vermelha",[56,0.3,15.2,0]],
 [["mamao","papaia"],"Mamão papaia",[40,0.5,10.4,0.1]],
 [["morango","morangos"],"Morango",[30,0.9,6.8,0.3]],
 [["laranja"],"Laranja",[37,1,8.9,0.1]],
 [["uva","uvas"],"Uva itália",[53,0.7,13.6,0.2]],
 [["melancia"],"Melancia",[33,0.9,8.1,0]],
 [["melao"],"Melão",[29,0.7,7.5,0]],
 [["abacate"],"Abacate",[96,1.2,6,8.4]],
 [["manga"],"Manga (espada, haden, rosa ou tommy)",[64,0.4,16.7,0.3]],
 [["abacaxi"],"Abacaxi",[48,0.9,12.3,0.1]],
 [["pera"],"Pera",[53,0.6,14,0.1]],
 [["kiwi"],"Kiwi",[51,1.3,11.5,0.6]],
 [["tangerina","mexerica","bergamota"],"Tangerina poncã (mexerica)",[38,0.8,9.6,0.1]],
 [["acai"],"Açaí (polpa)",[58,0.8,6.2,3.9]],
 [["azeite"],"Azeite de oliva",[884,0,0,100]],
 [["manteiga"],"Manteiga com sal",[726,0.4,0.1,82.4]],
 [["pasta de amendoim","creme de amendoim"],"Pasta integral de amendoim",[588,25,20,50]],
 [["mel"],"Mel de abelha",[309,0,84,0]],
 [["castanha","castanha do para","castanha-do-para"],"Castanha-do-brasil (do Pará)",[643,14.5,15.1,63.5]],
 [["castanha de caju"],"Castanha-de-caju torrada sem sal",[570,18.5,29.1,46.3]],
 [["amendoim"],"Amendoim torrado salgado",[606,22.5,18.7,54]],
 [["amendoa","amendoas"],"Amêndoa torrada sem sal",[581,18.6,29.5,47.3]],
 [["chia"],"Chia (grãos ou farinha)",[486,16.5,42.1,30.7]],
 [["lentilha"],"Lentilha cozida",[93,6.3,16.3,0.5]],
 [["grao de bico"],"Grão-de-bico cozido",[164,8.9,27.4,2.6]],
 [["ervilha"],"Ervilha congelada",[73,5.4,12.6,0.4]],
 [["brocolis"],"Brócolis refogado",[50,2.1,4.4,2.6]],
 [["abobrinha"],"Abobrinha refogada",[24,1.1,3,1]],
 [["abobora"],"Abóbora refogada",[40,1,8,1]],
 [["cenoura refogada"],"Cenoura refogada",[50,1.3,7.7,2]],
 [["couve"],"Couve refogada",[90,1.7,8.7,6.6]],
 [["vagem"],"Vagem refogada",[40,1.8,7,0.5]],
];
/* Alimentos fora da lista (contam calorias, sem porção de grupo) */
const EXTRA=[
 [["whey","whey protein"],"Whey protein",[400,80,8,6],30],
 [["tapioca","goma de tapioca"],"Tapioca (goma)",[240,0,60,0],0],
 [["chocolate"],"Chocolate ao leite",[540,7.2,59.6,30.3],0],
 [["acucar"],"Açúcar",[387,0.3,99.5,0],0],
 [["cafe","cafe preto"],"Café sem açúcar",[2,0.1,0.3,0],0],
 [["presunto"],"Presunto",[94,14.3,2.1,2.7],15],
 [["peito de peru","peru"],"Peito de peru",[110,20,2,2.5],15],
];
/* Vegetais crus/cozidos: à vontade */
const FREE_VEG=["salada","alface","tomate","pepino","rucula","agriao cru","folhas","legumes","verduras","repolho cru","cenoura","beterraba","cebola","pimentao","chuchu cozido"];

/* ===== Índices ===== */
function norm(s){return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[“”"]/g,"").replace(/\s+/g," ").trim()}
const r0=n=>Math.round(n), r1=n=>Math.round(n*10)/10, r2=n=>Math.round(n*100)/100;
const GROUPS=LISTA.map(g=>({name:g.name,kcal:g.kcal,free:!!g.free,items:g.items.map(([name,qty,measure,g2,sub])=>({name,qty,measure,g:g2,sub,group:g.name,key:norm(name.replace(/\(.*?\)/g," ")),full:norm(name)}))}));
const GBY=Object.fromEntries(GROUPS.map(g=>[g.name,g]));
const ALL=GROUPS.flatMap(g=>g.items);
function itemByName(n){const k=norm(n);return ALL.find(i=>i.full===k)||ALL.find(i=>i.key===k)}
const PREF_IDX=PREF.flatMap(([als,name,taco])=>{const it=itemByName(name);if(!it)console.warn("lista sem",name);return it?als.map(a=>({a:norm(a),it,taco})):[]});
const EXTRA_IDX=EXTRA.flatMap(([als,name,taco,unit])=>als.map(a=>({a:norm(a),ex:{name,taco,unit}})));
/* Produtos que a pessoa salvou pelo rótulo: [{name, per100:[kcal,p,c,f], porcao}] */
let MEUS_IDX=[];
const limpaNome=n=>norm(n).replace(/[.,;:!]+$/,"").trim();
function setMeusProdutos(lista){MEUS_IDX=(lista||[]).filter(x=>x&&x.name&&x.per100).map(x=>({a:limpaNome(x.name),ex:{name:String(x.name).replace(/[.,;:!]+$/,"").trim(),taco:x.per100,unit:+x.porcao||0,group:GBY[x.group]&&!GBY[x.group].free?x.group:null}}))}
/* Sugere em que grupo da lista um produto do rótulo se encaixa (a pessoa pode trocar) */
function grupoSugerido(nome,per100){
  const t=norm(nome||""),[k,p,c,f]=(per100||[]).map(v=>+v||0);
  if(/\b(queijo|requeijao|iogurte|leite|coalhada|ricota|cottage|kefir)\b/.test(t))return "Leite";
  if(/\b(pao|paes|torrada|bisnaguinha|wrap|tortilha|biscoito|bolacha|cream cracker|granola|aveia|cereal|cuscuz|tapioca)\b/.test(t))return "Pão";
  if(/\b(castanha|amendoim|nozes|amendoa|pasta de amendoim|mix de nuts)\b/.test(t))return "Castanha";
  if(/\b(fruta|banana|maca|uva passa|banana passa)\b/.test(t))return "Fruta";
  if(/\b(hamburguer|frango|carne|peito|file|atum|sardinha|ovo|ovos|salsicha|linguica|kibe|almondega|patinho|tilapia|salmao|peru|presunto)\b/.test(t))return "Carne ou ovo";
  if(k&&p*4/k>=0.3)return "Carne ou ovo";
  return "";
}
const COMMON=new Set(PREF.map(p=>p[1]));
function hasWord(t,a){return new RegExp("(^|[^a-z0-9])"+a.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"([^a-z0-9]|$)").test(t)}
function longest(list,t){let best=null;for(const x of list)if(hasWord(t,x.a)&&(!best||x.a.length>best.a.length))best=x;return best}
const STOP=new Set(["de","do","da","dos","das","com","sem","e","um","uma","no","na","em","o","a","os","as","pra","para"]);

/* Encontra o alimento: {kind:"list",it,taco} | {kind:"extra",ex} | {kind:"free",name} | null */
function matchFood(t,preferGroups){
  t=norm(t).replace(/\bpaes\b/g,"pao").replace(/\bpaezinhos?\b/g,"pao");if(!t)return null;
  // produto salvo pelo rótulo citado em parte (ex.: "hamburguer rezende" → "Hambúrguer assado Rezende")
  {const tk=t.split(" ").filter(w=>w.length>2&&!STOP.has(w));
   const meu=tk.length>=2&&MEUS_IDX.find(x=>tk.every(w=>hasWord(x.a,w)));if(meu)return{kind:"extra",ex:meu.ex}}
  // nome completo da lista (ex.: "iogurte grego lacfree")
  let best=null;
  for(const it of ALL){if(it.key.length>=4&&hasWord(t,it.key)&&(!best||it.key.length>best.key.length||(it.key.length===best.key.length&&preferGroups?.includes(it.group))))best=it}
  const p=longest(PREF_IDX,t),e=longest([...MEUS_IDX,...EXTRA_IDX],t);
  const cands=[p&&{kind:"list",it:p.it,taco:p.taco,len:p.a.length},best&&{kind:"list",it:best,len:best.key.length,taco:PREF_IDX.find(x=>x.it===best)?.taco},e&&{kind:"extra",ex:e.ex,len:e.a.length}].filter(Boolean);
  const fv=FREE_VEG.find(a=>hasWord(t,a));
  if(fv)cands.push({kind:"free",name:fv,len:fv.length});
  if(cands.length){cands.sort((a,b)=>b.len-a.len);return cands[0]}
  // todas as palavras contidas num nome da lista -> o nome mais curto
  const toks=t.split(" ").filter(w=>w.length>2&&!STOP.has(w));
  if(!toks.length)return null;
  const meu=MEUS_IDX.find(x=>toks.every(w=>hasWord(x.a,w)));
  if(meu)return{kind:"extra",ex:meu.ex};
  const hits=ALL.filter(it=>toks.every(w=>hasWord(it.key,w))).sort((a,b)=>a.key.length-b.key.length);
  return hits[0]?{kind:"list",it:hits[0]}:null;
}

/* Converte alimento + gramas em registro com porções, kcal e macros */
function toItem(m,grams){
  if(m.kind==="free"){const name=m.name[0].toUpperCase()+m.name.slice(1);return{name,grams:r0(grams),group:"Vegetal cru ou cozido",portions:0,kcal:r0(grams*0.2),p:r1(grams*0.012),c:r1(grams*0.035),f:r1(grams*0.002)}}
  if(m.kind==="extra"){const [k,p,c,f]=m.ex.taco,x=grams/100,g=m.ex.group&&GBY[m.ex.group];
    // produto do rótulo com grupo escolhido: conta porções pela equivalência de calorias do grupo
    return{name:m.ex.name,grams:r0(grams),group:g?g.name:"Fora da lista",portions:g?r2(k*x/g.kcal):0,kcal:r0(k*x),p:r1(p*x),c:r1(c*x),f:r1(f*x)}}
  const it=m.it,g=GBY[it.group],portions=r2(grams/it.g);
  let mac;if(m.taco){const x=grams/100;mac={p:m.taco[1]*x,c:m.taco[2]*x,f:m.taco[3]*x}}else{const gm=GROUP_MACROS[it.group]||{p:0,c:0,f:0};mac={p:gm.p*portions,c:gm.c*portions,f:gm.f*portions}}
  return{name:it.name,grams:r0(grams),group:it.group,portions,kcal:r0(portions*g.kcal),p:r1(mac.p),c:r1(mac.c),f:r1(mac.f)};
}

/* ===== Entendendo o que você escreveu ===== */
const NUMWORDS={um:1,uma:1,dois:2,duas:2,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,meio:.5,meia:.5};
const UNITS=[ // [regex, chave na medida caseira, gramas padrão]
 [/^(colher(?:es)? de sopa|colh\.? sopa)\b/,"colh. sopa",25],[/^(colher(?:es)? de servir|colh\.? servir)\b/,"colh. servir",60],
 [/^(colher(?:es)? de cha)\b/,"colh. cha",5],[/^(colher(?:es)? de sobremesa)\b/,"colh. sobr",10],[/^(colher(?:es)?)\b/,"colh",25],
 [/^(porc(?:ao|oes))\b/,"PORCAO",0],[/^(fatias?)\b/,"fatia",25],[/^(unidades?|unid\.?)\b/,"unid",0],[/^(copos?)\b/,"cop",200],
 [/^(xicaras?)\b/,"xicara",120],[/^(conchas?)\b/,"CONCHA",100],[/^(escumadeiras?)\b/,"ESCUM",90],[/^(pedac(?:o|os))\b/,"ped",0],
 [/^(files?)\b/,"file",0],[/^(bifes?)\b/,"bife",0],[/^(scoops?|dosadores?)\b/,"SCOOP",30],[/^(potes?)\b/,"POTE",170]];
const SPOON_R={cafe:.5,cha:1,sobr:2,sopa:3,servir:7.5};
function spoonType(s){s=norm(s);if(!/colh/.test(s))return null;return s.includes("servir")?"servir":s.includes("sopa")?"sopa":s.includes("sobr")?"sobr":s.includes("cha")?"cha":s.includes("cafe")?"cafe":null}
const COUNTABLE=/unid|fatia|file|bife|coxa|ped|ovo|posta|casquinha|porcao|copo|xicara/;

function parseSegment(seg,preferGroups){
  const gm=seg.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|gr|grs|gramas?|ml)\b/);
  let grams=gm?parseFloat(gm[1].replace(",","."))*(gm[2]==="kg"?1000:1):null;
  const together=/\b(tudo|total|junto|ao todo)\b/.test(seg)||/\scom\s/.test(seg)||(gm&&seg.slice(0,gm.index).trim().length>0); // peso no fim = peso do prato todo
  let rest=seg.replace(gm?gm[0]:"","").replace(/\b(tudo|total|junto|no total|ao todo)\b/g," ").replace(/\s+/g," ").trim().replace(/^(de|do|da)\s+/,"");
  // prato misto com um peso só: "macarrão com carne tudo 140g"
  const parts=rest.split(/\s+(?:com|e|mais)\s+/).map(s=>s.replace(/^(de|do|da)\s+/,"").trim()).filter(Boolean);
  if(grams&&parts.length>1&&!together){
    // "120g de frango e salada": o peso é do primeiro; o resto é lido separado
    const first=parseSegment(gm[0]+" de "+parts[0],preferGroups);
    if(first){const out={items:[...first.items],estimated:first.estimated,unknown:[]};
      for(const p of parts.slice(1)){const r=parseSegment(p,preferGroups);if(r){out.items.push(...r.items);out.estimated||=r.estimated}else out.unknown.push(p)}
      return out}
  }
  if(grams&&parts.length>1){
    const ms=parts.map(p=>matchFood(p,preferGroups));
    if(ms.every(Boolean)&&!matchWhole(rest,preferGroups)){
      const w=ms.map(m=>m.kind==="list"&&m.it.group==="Carne ou ovo"?1:m.kind==="free"?0.5:1.5),sw=w.reduce((a,b)=>a+b,0);
      return{items:ms.map((m,i)=>toItem(m,grams*w[i]/sw)),estimated:true};
    }
  }
  let qty=null;const qm=rest.match(/^(\d+(?:[.,]\d+)?|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|meio|meia)\s+/);
  if(!grams&&qm){qty=NUMWORDS[qm[1]]??parseFloat(qm[1].replace(",","."));rest=rest.slice(qm[0].length)}
  let unit=null;for(const u of UNITS){const m=rest.match(u[0]);if(m){unit=u;rest=rest.slice(m[0].length).replace(/^\s*(de|do|da|cheias?|rasas?)\s+/,"").replace(/^(de|do|da)\s+/,"");break}}
  const m=matchFood(rest||seg,preferGroups);
  if(!m)return null;
  if(!grams){
    const it=m.kind==="list"?m.it:null,meas=it?norm(it.measure):"";
    if(unit&&unit[1]==="PORCAO"&&it)grams=(qty||1)*it.g;
    else if(unit&&it&&!/^[A-Z]/.test(unit[1])&&meas.includes(unit[1]))grams=(qty||1)*it.g/it.qty;
    else if(unit&&it&&spoonType(unit[1])&&spoonType(meas))grams=(qty||1)*it.g/it.qty*SPOON_R[spoonType(unit[1])]/SPOON_R[spoonType(meas)];
    else if(m.kind==="extra"&&m.ex.unit&&(!unit||/PORCAO|unid|fatia|POTE|SCOOP|ped/.test(unit[1])))grams=(qty||1)*m.ex.unit;
    else if(unit&&unit[2])grams=(qty||1)*unit[2];
    else if(!unit&&qty&&it&&COUNTABLE.test(meas))grams=qty*it.g/it.qty;
    else if(!unit&&qty&&m.kind==="extra"&&m.ex.unit)grams=qty*m.ex.unit;
    else if(m.kind==="free")grams=100;
    else return null;
  }
  return{items:[toItem(m,grams)],estimated:false};
}
function matchWhole(t,pg){const m=matchFood(t,pg);return m&&m.kind==="list"&&norm(t)===m.it.key?m:null} // ex.: "arroz com lentilhas" é um item da lista

function localParse(text,preferGroups){
  const t=norm(text).replace(/^(eu )?(comi|almocei|jantei|tomei|bebi|lanchei)\s*/,"");
  const segs=t.split(/\s*(?:,|;|\+|\n|\be tambem\b|\be\b(?=\s*(?:\d|um |uma |dois |duas |tres |meio |meia )))\s*/).filter(Boolean);
  const items=[],unknown=[];let estimated=false;
  for(const seg of segs){const r=parseSegment(seg,preferGroups);if(!r){unknown.push(seg);continue}items.push(...r.items);estimated||=r.estimated;if(r.unknown)unknown.push(...r.unknown)}
  return{items,unknown,estimated};
}


let LIST_PROMPT = null;
function listPrompt() { return LIST_PROMPT ??= GROUPS.map(g => g.free ? `## ${g.name}: à vontade, 0 kcal` : `## ${g.name} (1 porção = ${g.kcal} kcal)\n` + g.items.map(i => `${i.name}: ${String(i.qty).replace('.', ',')} ${i.measure} = ${i.g}g`).join('\n')).join('\n\n'); }

export { setMeusProdutos, grupoSugerido, listPrompt, GROUPS, GBY, ALL, GROUP_MACROS, PREF_IDX, COMMON, norm, r0, r1, r2, itemByName, matchFood, toItem, localParse };
