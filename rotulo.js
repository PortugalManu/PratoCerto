/* Leitura da tabela nutricional (rótulo) sem precisar do Gemini:
 * o próprio celular lê o texto da foto (Tesseract.js, grátis) e o app procura os números. */
const BASE = new URL('./ocr/', import.meta.url).href; // arquivos do leitor ficam dentro do app
const TESS = BASE + 'tesseract.min.js';
let worker = null;

function carregarScript(src) {
  return new Promise((ok, erro) => {
    if (window.Tesseract) return ok();
    const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => erro(new Error('Não consegui abrir o leitor de rótulo. Confira a internet (na primeira vez ele baixa uns 6 MB).'));
    document.head.appendChild(s);
  });
}

/* Deixa a foto em tons de cinza e com mais contraste: ajuda muito a leitura */
async function prepararParaLeitura(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
  const s = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  const g = c.getContext('2d'); g.drawImage(bmp, 0, 0, c.width, c.height);
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    let v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    v = Math.max(0, Math.min(255, (v - 128) * 1.5 + 128));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  g.putImageData(img, 0, 0);
  return c;
}

export async function lerTextoDaFoto(file, aoProgredir) {
  await carregarScript(TESS);
  if (!worker) {
    aoProgredir?.('Preparando o leitor (só demora na primeira vez)…');
    worker = await window.Tesseract.createWorker('por', 1, {
      workerPath: BASE + 'worker.min.js', corePath: BASE, langPath: BASE, gzip: true,
      logger: m => { if (m.status === 'recognizing text') aoProgredir?.(`Lendo o rótulo… ${Math.round(m.progress * 100)}%`); },
    });
  }
  const { data } = await worker.recognize(await prepararParaLeitura(file));
  return data.text || '';
}

const num = s => parseFloat(String(s).replace(/\s/g, '').replace(',', '.'));
const NUM = /(\d+(?:[.,]\d+)?)/g;

/* Do texto lido, tira: porção (g/ml), e kcal/proteína/carbo/gordura por 100 g */
export function entenderRotulo(texto) {
  const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean);
  const plano = linhas.join(' ').toLowerCase();
  const out = { porcao: null, per100: null, porPorcao: null, achados: 0 };

  const pm = plano.match(/por[cç][aã]o\s*(?:de|:)?\s*(\d+(?:[.,]\d+)?)\s*(g|ml)/) || plano.match(/(\d+(?:[.,]\d+)?)\s*(g|ml)\s*\(/);
  if (pm) out.porcao = num(pm[1]);
  // tabela nova (2022+): colunas "100 g | porção | %VD"; antiga: só "porção | %VD"
  const tem100 = /\b100\s*(g|ml)\b/.test(plano);

  const pega = (re, energia) => {
    const l = linhas.find(x => re.test(x.toLowerCase()));
    if (!l) return null;
    let t = l.toLowerCase().replace(re, ' ');
    if (energia) {
      const k = [...t.matchAll(/(\d+(?:[.,]\d+)?)\s*kcal/g)].map(m => num(m[1]));
      if (k.length) return k;
      t = t.replace(/\(\s*kcal\s*\)/g, ' ').replace(/(\d+(?:[.,]\d+)?)\s*kj/g, ' ');
    }
    t = t.replace(/\d+(?:[.,]\d+)?\s*%/g, ' '); // tira %VD
    return [...t.matchAll(NUM)].map(m => num(m[1]));
  };
  const k = pega(/valor\s+energ[eé]tico|energia/, true);
  const p = pega(/prote[ií]nas?/);
  const c = pega(/carboidratos?(\s+totais)?|carboidratos?\s+dispon[ií]veis/);
  const f = pega(/gorduras?\s+totais|lip[ií]deos|gorduras?\s+totais?/);
  const val = (arr, i) => (arr && arr.length > i ? arr[i] : null);
  const linha = i => [val(k, i), val(p, i), val(c, i), val(f, i)];
  out.achados = [k, p, c, f].filter(a => a && a.length).length;

  if (tem100 && (k?.length || 0) >= 2) {
    out.per100 = linha(0); out.porPorcao = linha(1);
    // a leitura às vezes "come" a vírgula (2,1 vira 21): confere uma coluna com a outra
    if (!out.porcao && out.per100[0] && out.porPorcao[0]) out.porcao = Math.round(out.porPorcao[0] / out.per100[0] * 100);
    if (out.porcao) for (let i = 0; i < 4; i++) {
      const a = out.per100[i], b = out.porPorcao[i]; if (a == null || b == null) continue;
      const ok = (x, y) => Math.abs(x * out.porcao / 100 - y) <= Math.max(0.3, y * 0.15);
      if (ok(a, b)) continue;
      const tent = [[a, b / 10], [a, b / 100], [a / 10, b], [a / 10, b / 10], [a / 10, b / 100]].find(([x, y]) => ok(x, y));
      if (tent) { out.per100[i] = tent[0]; out.porPorcao[i] = Math.round(tent[1] * 100) / 100; }
      else out.porPorcao[i] = Math.round(a * out.porcao) / 100;
    }
  }
  else if (tem100 && !out.porcao) out.per100 = linha(0);
  else out.porPorcao = linha(0);

  if (!out.per100 && out.porPorcao && out.porcao) out.per100 = out.porPorcao.map(v => v == null ? null : Math.round(v / out.porcao * 1000) / 10);
  if (!out.porPorcao && out.per100 && out.porcao) out.porPorcao = out.per100.map(v => v == null ? null : Math.round(v * out.porcao) / 100);
  return out;
}
