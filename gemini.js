/* Leitura por foto e de frases difíceis com o Gemini (cota gratuita do Google AI Studio).
 * A chave fica só neste celular (localStorage); nunca vai para o GitHub nem para o Firebase. */
import { GROUPS, listPrompt } from './alimentos.js';

const LS = 'pc:geminiKey';
const MODELS = ['gemini-flash-latest', 'gemini-2.5-flash'];
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
  let ultimo;
  for (const m of MODELS) {
    let r;
    try {
      r = await fetch(URL_BASE + m + ':generateContent', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } }),
      });
    } catch { throw new GeminiErro('Sem internet para falar com o Gemini agora.', 'rede'); }
    if (r.status === 404) { ultimo = new GeminiErro('Modelo do Gemini indisponível.', 'modelo'); continue; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = j?.error?.message || '';
      if (r.status === 429) throw new GeminiErro('Acabou a cota grátis do Gemini por agora. Tente daqui a pouco.', 'cota');
      if (/API key|API_KEY/i.test(msg) || r.status === 403) throw new GeminiErro('A chave do Gemini não funcionou. Confira se copiou inteira.', 'chave');
      throw new GeminiErro('O Gemini recusou o pedido (' + (msg || r.status) + ').', 'erro');
    }
    const txt = (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    if (!txt) throw new GeminiErro('O Gemini não respondeu nada. Tente outra foto.', 'vazio');
    try { return JSON.parse(txt.replace(/^```(?:json)?\s*|\s*```$/g, '')); }
    catch { const mm = txt.match(/\{[\s\S]*\}/); if (mm) return JSON.parse(mm[0]); throw new GeminiErro('Resposta do Gemini veio quebrada. Tente de novo.', 'json'); }
  }
  throw ultimo;
}

const FORMATO_ITENS = `Responda só JSON: {"items":[{"name":"Arroz polido cozido","group":"Arroz","grams":120,"kcal":160,"p":3,"c":34,"f":0.3}],"descricao":"arroz, feijão e frango grelhado"}
- "name": exatamente como aparece na LISTA quando o alimento existir nela; senão um nome curto e "group":"Fora da lista".
- "grams": peso estimado em gramas. "kcal","p","c","f": calorias, proteína, carboidrato e gordura daquela quantidade (Tabela TACO).
- Vegetais crus/folhas: group "Vegetal cru ou cozido".`;

/* Foto do prato → itens com peso estimado */
export function lerPrato(foto, observacao, gruposDaRefeicao) {
  return perguntar([foto, { text:
`Você é nutricionista brasileiro. Identifique cada alimento da foto do prato e estime o peso em gramas do que aparece (use o tamanho do prato e talheres como referência).
${observacao ? `A pessoa disse: "${observacao}". Quando ela informar um peso, use esse peso.` : ''}
${gruposDaRefeicao.length ? `A dieta desta refeição usa os grupos: ${gruposDaRefeicao.join(', ')}. Em caso de dúvida entre grupos, prefira esses.` : ''}
${FORMATO_ITENS}

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
