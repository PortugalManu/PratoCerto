/* Leitura por foto e de frases difíceis com o Gemini (cota gratuita do Google AI Studio).
 * A chave fica só neste celular (localStorage); nunca vai para o GitHub nem para o Firebase. */
import { GROUPS, listPrompt } from './alimentos.js';

const LS = 'pc:geminiKey';
// Nomes de reserva, caso não dê para perguntar ao Google quais modelos a chave pode usar
const RESERVA = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash'];
const PREFERIDOS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.1-flash-lite'];
let modelosCache = null;
/* Pergunta ao Google (sem gastar cota) quais modelos "flash" esta chave pode usar e ordena:
   primeiro os recomendados para a cota grátis, depois os mais novos; preview e 2.x por último. */
async function modelos(key) {
  if (modelosCache) return modelosCache;
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key } });
    const j = await r.json();
    const nomes = (j.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map(m => m.name.replace(/^models\//, ''))
      .filter(n => /^gemini-.*flash/.test(n) && !/image|tts|live|audio|embed|native|computer|robot|thinking-exp/.test(n));
    if (!nomes.length) throw 0;
    const ver = n => +(n.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] || 0);
    const nota = n => { const i = PREFERIDOS.indexOf(n); if (i >= 0) return 1000 - i;
      return ver(n) * 10 - (/preview|exp/.test(n) ? 50 : 0) - (/-\d{3,}$|-\d{2}-\d{2}/.test(n) ? 5 : 0) + (/latest/.test(n) ? -1 : 0); };
    modelosCache = [...new Set(nomes)].sort((x, y) => nota(y) - nota(x)).slice(0, 6);
  } catch { modelosCache = RESERVA; }
  return modelosCache;
}
export function modelosUsados() { return modelosCache || []; }
const espera = ms => new Promise(r => setTimeout(r, ms));
const URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

export function getKey() { try { return localStorage.getItem(LS) || ''; } catch { return ''; } }
export function setKey(k) { try { k ? localStorage.setItem(LS, k.trim()) : localStorage.removeItem(LS); } catch {} }

/* Confere a chave com uma consulta que não gasta cota */
export async function testarChave(key) {
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', { headers: { 'x-goog-api-key': key } });
    if (r.ok) return { ok: true };
    const j = await r.json().catch(() => ({}));
    return { ok: false, msg: j?.error?.message || ('erro ' + r.status) };
  } catch { return { ok: false, rede: true }; }
}

/* Reduz a foto (até ~1280 px, JPEG) antes de enviar: mais rápido e gasta menos cota */
export async function prepararFoto(file, max = 1280) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return { inline_data: { mime_type: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.82).split(',')[1] } };
}

class GeminiErro extends Error { constructor(msg, code) { super(msg); this.code = code; } }

async function perguntar(parts) {
  const key = getKey(); if (!key) throw new GeminiErro('Cole a chave do Gemini em Minha dieta → Leitura por foto.', 'sem_chave');
  const body = JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } });
  let lotado = false, semCota = false, ultimo = null; const diag = [];
  for (const m of await modelos(key)) {
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      let r;
      try {
        r = await fetch(URL_BASE + m + ':generateContent', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body });
      } catch { throw new GeminiErro('Sem internet para falar com o Gemini agora.', 'rede'); }
      const j = await r.json().catch(() => ({}));
      const msg = j?.error?.message || '';
      if (r.status === 404) { diag.push(m + ': não existe'); ultimo = msg; break; }                       // modelo não existe: próximo
      if (r.status === 429) { diag.push(m + ': sem cota'); semCota = true; break; }                     // cota deste modelo acabou: próximo
      if (r.status >= 500 || /high demand|overloaded|unavailable/i.test(msg)) { // lotado: espera e tenta de novo, depois próximo
        lotado = true; if (tentativa === 1) diag.push(m + ': lotado (' + r.status + ')'); if (tentativa === 0) { await espera(2000); continue; } break;
      }
      if (!r.ok) {
        if (/API key|API_KEY/i.test(msg) || r.status === 403) throw new GeminiErro('A chave do Gemini não funcionou. Confira se copiou inteira.', 'chave');
        if (/image|inline_data|mime/i.test(msg)) throw new GeminiErro('O Gemini não conseguiu abrir essa imagem. Tente outra foto ou um print.', 'imagem');
        throw new GeminiErro('O Gemini recusou o pedido (' + (msg || r.status) + ').', 'erro');
      }
      const cand = j.candidates?.[0];
      const txt = (cand?.content?.parts || []).map(p => p.text || '').join('');
      if (!txt) {
        if (j.promptFeedback?.blockReason || cand?.finishReason === 'SAFETY') throw new GeminiErro('O Gemini não quis analisar essa imagem. Tente outra.', 'bloqueio');
        ultimo = 'vazio'; break;
      }
      try { return JSON.parse(txt.replace(/^```(?:json)?\s*|\s*```$/g, '')); }
      catch { const mm = txt.match(/\{[\s\S]*\}/); if (mm) { try { return JSON.parse(mm[0]); } catch {} } ultimo = 'json'; break; }
    }
  }
  const det = diag.length ? ' [' + diag.join('; ') + ']' : '';
  if (lotado && !semCota) throw new GeminiErro('Os servidores do Gemini estão lotados agora (é do Google, não do app). Espere 1 ou 2 minutos e toque em Tentar de novo.' + det, 'lotado');
  if (semCota) throw new GeminiErro('Os modelos do Gemini estão sem cota grátis ou lotados agora. Tente daqui a pouco.' + det, 'cota');
  throw new GeminiErro(ultimo === 'json' || ultimo === 'vazio' ? 'A resposta do Gemini veio incompleta. Toque em Tentar de novo.' : 'Nenhum modelo do Gemini respondeu. Tente mais tarde.' + det, 'erro');
}

const FORMATO_ITENS = `Responda só JSON: {"items":[{"name":"Arroz polido cozido","group":"Arroz","grams":120,"kcal":160,"p":3,"c":34,"f":0.3}],"descricao":"arroz, feijão e frango grelhado"}
- "name": exatamente como aparece na LISTA quando o alimento existir nela; senão um nome curto e "group":"Fora da lista".
- "grams": peso estimado em gramas. "kcal","p","c","f": calorias, proteína, carboidrato e gordura daquela quantidade (Tabela TACO).
- Vegetais crus/folhas: group "Vegetal cru ou cozido".`;

/* Foto(s) do prato, print do pedido do iFood ou da página do restaurante → itens com peso estimado */
export function lerPrato(fotos, observacao, gruposDaRefeicao) {
  return perguntar([...fotos, { text:
`Você é nutricionista brasileiro. As imagens são do que a pessoa comeu nesta refeição. Podem ser:
(a) foto do prato ou da embalagem/marmita;
(b) print de pedido de delivery (iFood, Rappi, Aiqfome, WhatsApp do restaurante) ou da página do prato com a descrição;
(c) uma mistura: o print do pedido e a foto da comida que chegou. Nesse caso é a MESMA comida: use o print para saber o que é e a foto para o tamanho. Não conte duas vezes.

Como trabalhar:
1. Separe cada prato/item do pedido e DECOMPONHA em ingredientes (ex.: "Parmegiana com arroz e fritas" → filé empanado, molho de tomate, queijo muçarela, arroz, batata frita; "Poke de salmão" → arroz japonês, salmão cru, manga, molho shoyu…). Cada ingrediente vira um item.
2. Peso: se o print ou a descrição disser peso, tamanho ou quantidade ("500g", "marmita grande", "serve 2 pessoas", "6 unidades", "2x"), use isso. "2x" ou "Qtd: 2" = dobro. Sem informação, use porções típicas de restaurante brasileiro daquele tipo de prato (costumam ser maiores que as caseiras) e, na foto, compare com talheres, embalagem ou prato.
3. Comida de restaurante/delivery leva mais óleo: conte isso em "f" e "kcal" (ex.: arroz e feijão de restaurante, frituras, molhos cremosos).
4. Bebidas também contam (refrigerante, suco, cerveja). Ignore preço, taxa de entrega, cupom, talheres, guardanapo e itens marcados como cancelados.
5. Molhos, maionese, ketchup, sachês: inclua se aparecerem no pedido ou na foto.
${observacao ? `6. A pessoa escreveu: "${observacao}". Isso manda: se informar peso, use; se disser que comeu metade, dividiu com alguém ou deixou algo, ajuste as gramas só do que ELA comeu.` : '6. Se o pedido parecer para mais de uma pessoa (ex.: "serve 2", combo família), estime só 1 pessoa e diga isso em "observacao".'}
${gruposDaRefeicao.length ? `A dieta desta refeição usa os grupos: ${gruposDaRefeicao.join(', ')}. Em caso de dúvida entre grupos, prefira esses.` : ''}
Use "nota" curta por item quando o peso vier do pedido ou for um palpite importante (ex.: "500g do pedido", "palpite: porção de restaurante").
Use "observacao" (uma frase) para avisar algo útil para a pessoa (ex.: "Pedido de 2 pessoas: calculei a metade."); senão "".
Se as imagens não forem de comida, responda {"items":[],"descricao":"","observacao":"Não encontrei comida nas imagens."}

${FORMATO_ITENS}
Campos extras: "nota" em cada item (opcional) e "observacao" no objeto principal.

LISTA DE SUBSTITUIÇÃO (cada linha = 1 porção do grupo):
${listPrompt()}` }]);
}

/* Frase que o app não reconheceu sozinho */
export function lerFrase(texto, gruposDaRefeicao) {
  return perguntar([{ text:
`Você é nutricionista brasileiro. Converta o registro alimentar em alimentos com peso.
- Prato misto com um peso total (ex.: "macarrão com carne tudo 140g"): divida o peso entre os ingredientes em proporções típicas; a soma deve dar o total.
- Sem peso: estime uma porção caseira comum.
${gruposDaRefeicao.length ? `A dieta desta refeição usa os grupos: ${gruposDaRefeicao.join(', ')}.` : ''}
${FORMATO_ITENS}

Registro: """${texto.slice(0, 1500)}"""

LISTA DE SUBSTITUIÇÃO:
${listPrompt()}` }]);
}

/* Foto(s) da dieta → código da dieta em porções */
export function lerDieta(fotos) {
  return perguntar([...fotos, { text:
`Você é nutricionista brasileiro. Leia a dieta nas fotos e organize por refeição, em PORÇÕES dos grupos da lista de substituição.
Grupos válidos (use exatamente estes nomes): ${GROUPS.map(g => g.name).join(', ')}.
- Se a dieta já disser "2 porções de pão", use isso.
- Se citar alimentos com quantidade (ex.: "1 pão francês", "120g de frango"), converta em porções pela lista (1 pão francês = 2 porções de Pão; 120 g de peito de frango = 1 porção de Carne ou ovo) e guarde o texto original em "text".
- Opções do tipo "A ou B": use a quantidade de porções equivalente e cite as opções em "text".
- Vegetais crus/folhas à vontade: group "Vegetal cru ou cozido", n 0.
- Se a dieta trouxer metas de calorias ou macros, coloque em "targets"; senão null.
Responda só JSON:
{"meals":[{"name":"Café da manhã","time":"07:00","portions":[{"group":"Pão","n":2,"text":"1 pão francês"}],"notes":""}],"targets":null,"notes":"orientações gerais curtas"}

LISTA DE SUBSTITUIÇÃO:
${listPrompt()}` }]);
}
