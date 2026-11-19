/* Prato Certo — app do celular (PWA).
 * Registros e dieta ficam no Firebase (sua conta Google) e, como cópia, no próprio celular. */
import { GROUPS, GBY, ALL, GROUP_MACROS, PREF_IDX, COMMON, norm, r0, r1, r2, itemByName, toItem, localParse } from './alimentos.js';
import { firebaseConfig } from './firebase-config.js';

const APP_VERSAO = 2;

/* ===== Dieta de exemplo (até você colar a sua) ===== */
const EXAMPLE_DIET = { example: true, importedAt: null, meals: [
  { name: 'Café da manhã', time: '07:00', portions: [{ group: 'Pão', n: 2 }, { group: 'Leite', n: 1 }, { group: 'Fruta', n: 1 }, { group: 'Recheio ou molho', n: 1 }] },
  { name: 'Almoço', time: '12:30', portions: [{ group: 'Arroz', n: 2 }, { group: 'Feijão', n: 1 }, { group: 'Carne ou ovo', n: 1 }, { group: 'Vegetal refogado', n: 1 }, { group: 'Vegetal cru ou cozido', n: 0 }] },
  { name: 'Lanche da tarde', time: '16:00', portions: [{ group: 'Leite', n: 1 }, { group: 'Fruta', n: 1 }, { group: 'Castanha', n: 1 }] },
  { name: 'Jantar', time: '20:00', portions: [{ group: 'Arroz', n: 2 }, { group: 'Carne ou ovo', n: 1 }, { group: 'Vegetal refogado', n: 1 }, { group: 'Vegetal cru ou cozido', n: 0 }] }] };

let profile = { diet: EXAMPLE_DIET };
let day = { entries: [] };
let curDate = new Date();
let selMeal = null, sugMeal = null;
let pendingManual = null; // {text, meal, items, unknown:[...]}

/* ===== Datas e refeições ===== */
const dkey = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const isToday = () => dkey(curDate) === dkey(new Date());
const dietFor = () => day.diet || profile.diet; // dias antigos usam a dieta da época
function mealNames(diet = dietFor()) { const m = (diet?.meals || []).map(x => x.name); return m.length ? m : ['Café da manhã', 'Almoço', 'Lanche', 'Jantar']; }
function guessMeal() {
  const ms = dietFor()?.meals || [], now = new Date(), mins = now.getHours() * 60 + now.getMinutes();
  const timed = ms.filter(m => /^\d{1,2}[:h]\d{0,2}/.test(m.time || ''));
  if (timed.length) { let best = timed[0], bd = 1e9; for (const m of timed) { const [h, mm] = m.time.split(/[:h]/).map(Number); const d = Math.abs(h * 60 + (mm || 0) - mins); if (d < bd) { bd = d; best = m; } } return best.name; }
  const h = now.getHours(), names = mealNames(), want = h < 10 ? 'cafe' : h < 15 ? 'almoco' : h < 19 ? 'lanche' : 'jantar';
  return names.find(n => norm(n).includes(want)) || names[0];
}
const mealGroups = name => (dietFor()?.meals || []).find(m => m.name === name)?.portions.map(p => p.group) || [];

/* ===== Armazenamento ===== */
// Cópia local (sempre) + Firestore em users/{uid}/data/profile e users/{uid}/days/{AAAA-MM-DD}
const local = {
  get(k) { try { return JSON.parse(localStorage.getItem('pc:' + k) || 'null'); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('pc:' + k, JSON.stringify(v)); } catch {} },
  keys() { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('pc:')) out.push(k.slice(3)); } } catch {} return out; },
};
let cloud = null; // {get(k), set(k,v)} quando logado
const fb = {};    // módulos do Firebase

function cloudPath(uid, k) { return k === 'profile' ? ['users', uid, 'data', 'profile'] : ['users', uid, 'days', k.replace(/^day-/, '')]; }
function makeCloud(uid) {
  const { db, doc, getDoc, setDoc } = fb;
  return {
    async get(k) { const s = await getDoc(doc(db, ...cloudPath(uid, k))); return s.exists() ? s.data() : null; },
    async set(k, v) { await setDoc(doc(db, ...cloudPath(uid, k)), JSON.parse(JSON.stringify(v))); },
  };
}
let saving = Promise.resolve();
function save(k, v) {
  local.set(k, v);
  if (!cloud) return Promise.resolve();
  const c = cloud;
  saving = saving.then(() => c.set(k, v)).catch(e => { console.warn(e); setStatus('logStatus', 'Sem conexão: ficou salvo no celular e sobe quando a internet voltar.', true); });
  return saving;
}
async function load(k) {
  if (cloud) { try { const v = await cloud.get(k); if (v) { local.set(k, v); return v; } } catch (e) { console.warn(e); } }
  return local.get(k);
}
function saveDay() {
  if (!day.diet) day.diet = JSON.parse(JSON.stringify({ meals: profile.diet.meals, targets: profile.diet.targets || null }));
  return save('day-' + dkey(curDate), day);
}

/* ===== Cálculos ===== */
const sum = items => items.reduce((a, i) => ({ kcal: a.kcal + (+i.kcal || 0), p: a.p + (+i.p || 0), c: a.c + (+i.c || 0), f: a.f + (+i.f || 0) }), { kcal: 0, p: 0, c: 0, f: 0 });
function portionMacros(portions) { return portions.reduce((a, { group, n }) => { const g = GBY[group], m = GROUP_MACROS[group]; if (!g || !m) return a; return { kcal: a.kcal + g.kcal * n, p: a.p + m.p * n, c: a.c + m.c * n, f: a.f + m.f * n }; }, { kcal: 0, p: 0, c: 0, f: 0 }); }
function dietTargets(diet) { const s = portionMacros((diet?.meals || []).flatMap(m => m.portions)); return { kcal: r0(s.kcal), p: r0(s.p), c: r0(s.c), f: r0(s.f) }; }
function targets(diet = dietFor()) { const t = diet?.targets; return t && t.kcal ? t : dietTargets(diet); }
const fmtN = n => String(r2(n)).replace('.', ',');

/* ===== Render ===== */
const $ = id => document.getElementById(id);
function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const k in attrs) { const v = attrs[k]; if (v == null || v === false) continue; if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); }
  for (const c of kids.flat()) { if (c == null || c === false) continue; e.append(c.nodeType ? c : String(c)); }
  return e;
}
function setStatus(id, msg, err) { const s = $(id); s.textContent = msg || ''; s.classList.toggle('err', !!err); }

function renderDate() {
  const today = dkey(new Date()), k = dkey(curDate), y = new Date(); y.setDate(y.getDate() - 1);
  $('dateLbl').textContent = k === today ? 'Hoje' : k === dkey(y) ? 'Ontem' : curDate.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  $('nextDay').disabled = k >= today;
}
function renderSummary() {
  const s = sum(day.entries.flatMap(e => e.items)), t = targets();
  const pct = (a, b) => b ? Math.min(100, a / b * 100) : 0;
  $('kcalNow').textContent = r0(s.kcal);
  $('kcalOf').textContent = t.kcal ? `de ${t.kcal} kcal da dieta` : 'kcal';
  $('kcalBar').style.width = pct(s.kcal, t.kcal) + '%';
  $('summary').classList.toggle('over', !!t.kcal && s.kcal > t.kcal * 1.05);
  for (const [id, k] of [['mP', 'p'], ['mC', 'c'], ['mF', 'f']]) {
    const m = $(id); m.querySelector('.val').replaceChildren(r0(s[k]) + 'g ', el('small', {}, t[k] ? '/ ' + t[k] + 'g' : ''));
    m.querySelector('i').style.width = pct(s[k], t[k]) + '%'; m.classList.toggle('over', !!t[k] && s[k] > t[k] * 1.1);
  }
  const r = $('remaining'); r.replaceChildren();
  if (!day.entries.length) { r.append('Nada registrado ainda. Meta do dia: ', el('strong', {}, t.p + 'g de proteína'), ' e ', el('strong', {}, t.kcal + ' kcal'), '.'); return; }
  const fp = r0(t.p - s.p), fk = r0(t.kcal - s.kcal);
  if (fp > 0) r.append('Faltam ', el('strong', {}, fp + 'g de proteína')); else r.append(el('strong', {}, 'Meta de proteína batida'));
  if (fk >= 0) r.append(' e ', el('strong', {}, fk + ' kcal'), ' para fechar o dia.'); else r.append(' · ', el('strong', {}, Math.abs(fk) + ' kcal'), ' acima da dieta.');
}
function renderChips(boxId, cur, onPick) { $(boxId).replaceChildren(...mealNames().map(m => el('button', { class: 'chip', 'aria-pressed': String(m === cur), onclick: () => onPick(m) }, m))); }
function pickMeal(m) { selMeal = m; renderChips('mealChips', selMeal, pickMeal); }
function pickSug(m) { sugMeal = m; renderChips('sugMealChips', sugMeal, pickSug); }

function portionChips(meal, entries) {
  const eaten = {}; for (const e of entries) for (const i of e.items) if (i.portions) eaten[i.group] = (eaten[i.group] || 0) + i.portions;
  const chips = [];
  for (const { group, n } of meal?.portions || []) {
    if (GBY[group]?.free) { chips.push(el('span', { class: 'pc free' }, 'Vegetais crus · à vontade')); continue; }
    const e = eaten[group] || 0; delete eaten[group];
    chips.push(el('span', { class: 'pc' + (e > n * 1.15 ? ' over' : e >= n * 0.9 ? ' done' : '') }, `${group} ${fmtN(e)}/${fmtN(n)}`));
  }
  for (const g in eaten) chips.push(el('span', { class: 'pc over' }, `${g} ${fmtN(eaten[g])} (fora)`));
  return el('div', { class: 'por' }, chips);
}
function itemRow(i, est) {
  return el('div', { class: 'item' },
    el('span', { class: 'n' }, `${i.name} · ${i.grams}g `, i.portions ? el('span', { class: 'tag' }, `${fmtN(i.portions)} ${i.group}`) : null, ' ', i.group === 'Fora da lista' ? el('span', { class: 'tag out' }, 'fora da lista') : null, ' ', est ? el('span', { class: 'tag est' }, 'estimado') : null),
    el('span', { class: 'm' }, `${r0(i.kcal)} kcal · P ${r1(i.p)}g`));
}
function renderMeals() {
  const box = $('meals'); box.replaceChildren();
  const meals = dietFor()?.meals || [], names = [...mealNames()];
  for (const e of day.entries) if (!names.includes(e.meal)) names.push(e.meal);
  for (const name of names) {
    const meal = meals.find(m => m.name === name), es = day.entries.filter(e => e.meal === name);
    const s = sum(es.flatMap(e => e.items)), d = meal ? portionMacros(meal.portions) : null;
    const card = el('div', { class: 'card' },
      el('div', { class: 'meal-h' }, el('h3', {}, name + (meal?.time ? ' · ' + meal.time : '')), el('small', {}, `${r0(s.kcal)}${d ? ' / ' + r0(d.kcal) : ''} kcal · P ${r0(s.p)}g`)),
      meal ? portionChips(meal, es) : null);
    for (const e of es) {
      const ent = el('div', { class: 'entry' }, el('div', { class: 'entry-top' }, el('span', { class: 'entry-text' }, '“' + e.text + '”'), el('button', { class: 'ghost icon', 'aria-label': 'Apagar registro', onclick: () => removeEntry(e.id) }, '✕')));
      for (const i of e.items) ent.append(itemRow(i, e.estimated));
      card.append(ent);
    }
    if (!es.length && isToday()) card.append(el('p', { class: 'empty' }, 'Nada registrado nesta refeição.'));
    box.append(card);
  }
}
function subsList(group, n) {
  const g = GBY[group]; if (!g) return el('p', { class: 'empty' }, 'Grupo não encontrado na lista.');
  if (g.free) return el('p', { class: 'hint' }, 'Folhas, tomate, pepino, cenoura crua, legumes cozidos sem óleo: à vontade.');
  const box = el('div', { class: 'subs' }); let sub = null;
  for (const it of g.items) {
    if (it.sub && it.sub !== sub) { sub = it.sub; box.append(el('div', { class: 'lbl', style: 'margin-top:6px' }, sub)); }
    box.append(el('div', { class: 'sub' }, el('span', { class: 'n' }, it.name), el('span', {}, `${fmtN(it.qty * n)} ${it.measure} · ${r0(it.g * n)}g`)));
  }
  return box;
}

/* --- Minha dieta (ver e editar) --- */
let editing = null; // cópia da dieta durante a edição
function renderDiet() {
  const v = $('dietView'), d = editing || profile.diet; v.replaceChildren();
  v.append(el('div', { class: 'meal-h' }, el('h2', {}, editing ? 'Editando a dieta' : 'Dieta atual'),
    editing ? null : el('span', { class: 'row' }, d?.importedAt ? el('small', { class: 'hint' }, 'desde ' + new Date(d.importedAt).toLocaleDateString('pt-BR')) : null, el('button', { class: 'small', onclick: startEdit }, 'Editar'))));
  if (d?.example && !editing) v.append(el('div', { class: 'banner' }, 'Dieta de exemplo. Cole o código da sua dieta abaixo ou toque em Editar.'));
  const t = targets(d);
  v.append(el('p', { class: 'nums' }, `${t.kcal} kcal · `, el('span', { class: 'p' }, `P ${t.p}g`), ` · C ${t.c}g · G ${t.f}g por dia`));
  (d?.meals || []).forEach((m, mi) => {
    const s = portionMacros(m.portions);
    const blk = el('div', { class: 'view', style: 'gap:6px;border-top:1px solid var(--line);padding-top:10px' });
    if (editing) {
      blk.append(el('div', { class: 'row' },
        el('input', { type: 'text', value: m.name, 'aria-label': 'Nome da refeição', style: 'flex:2;min-width:0', oninput: e => { m.name = e.target.value; } }),
        el('input', { type: 'text', value: m.time || '', placeholder: '07:00', 'aria-label': 'Horário', style: 'flex:1;min-width:0', oninput: e => { m.time = e.target.value; } }),
        el('button', { class: 'small ghost', onclick: () => { d.meals.splice(mi, 1); renderDiet(); } }, 'Remover')));
      m.portions.forEach((p, pi) => {
        const free = GBY[p.group]?.free;
        blk.append(el('div', { class: 'edit-row' }, el('span', {}, p.group),
          free ? el('span', { class: 'row' }, el('span', { class: 'hint' }, 'à vontade'), el('button', { class: 'small ghost', onclick: () => { m.portions.splice(pi, 1); renderDiet(); } }, '✕'))
            : el('span', { class: 'stepper' },
              el('button', { 'aria-label': 'Menos', onclick: () => { p.n = r2(Math.max(0, p.n - 0.5)); if (!p.n) m.portions.splice(pi, 1); renderDiet(); } }, '−'),
              el('span', {}, fmtN(p.n)),
              el('button', { 'aria-label': 'Mais', onclick: () => { p.n = r2(p.n + 0.5); renderDiet(); } }, '+'))));
      });
      const sel = el('select', { 'aria-label': 'Adicionar grupo' }, el('option', { value: '' }, '+ adicionar grupo'), GROUPS.filter(g => !m.portions.some(p => p.group === g.name)).map(g => el('option', { value: g.name }, g.name)));
      sel.addEventListener('change', () => { if (sel.value) { m.portions.push({ group: sel.value, n: GBY[sel.value].free ? 0 : 1 }); renderDiet(); } });
      blk.append(sel);
    } else {
      blk.append(el('div', { class: 'meal-h' }, el('h3', {}, m.name + (m.time ? ' · ' + m.time : '')), el('small', {}, `${r0(s.kcal)} kcal`)));
      for (const p of m.portions) {
        const free = GBY[p.group]?.free;
        const det = el('details', { class: 'grp' }, el('summary', {}, el('span', {}, free ? 'Vegetais crus ou cozidos — à vontade' : `${fmtN(p.n)} ${p.n === 1 ? 'porção' : 'porções'} de ${p.group}`, p.text ? el('span', { class: 'hint' }, ` (${p.text})`) : null)));
        det.addEventListener('toggle', () => { if (det.open && det.children.length === 1) det.append(subsList(p.group, p.n || 1)); });
        blk.append(det);
      }
      if (m.notes) blk.append(el('p', { class: 'hint' }, m.notes));
    }
    v.append(blk);
  });
  if (editing) {
    v.append(el('div', { class: 'row end' },
      el('button', { class: 'ghost', onclick: () => { d.meals.push({ name: 'Nova refeição', time: '', portions: [] }); renderDiet(); } }, '+ Refeição'),
      el('button', { class: 'ghost', onclick: () => { editing = null; renderDiet(); } }, 'Cancelar'),
      el('button', { class: 'primary', onclick: saveEdit }, 'Salvar dieta')));
  } else if (d?.notes) v.append(el('p', { class: 'hint' }, d.notes));
}
function startEdit() { editing = JSON.parse(JSON.stringify(profile.diet)); delete editing.example; renderDiet(); }
async function saveEdit() {
  const meals = editing.meals.map(m => ({ ...m, name: m.name.trim() || 'Refeição' })).filter(m => m.portions.length);
  if (!meals.length) { alert('A dieta precisa de pelo menos uma refeição com porções.'); return; }
  await setDiet({ ...editing, meals, importedAt: Date.now() });
  editing = null;
}
async function setDiet(diet) {
  if (profile.diet && !profile.diet.example) profile.history = [{ ...profile.diet }, ...(profile.history || [])].slice(0, 5);
  profile.diet = diet;
  selMeal = guessMeal(); sugMeal = null;
  await save('profile', profile);
  // hoje passa a usar a dieta nova; dias anteriores continuam com a da época
  if (isToday()) { delete day.diet; if (day.entries.length) await saveDay(); }
  renderAll();
}
function renderTargets() { const t = targets(profile.diet); $('tKcal').value = t.kcal || ''; $('tP').value = t.p || ''; $('tC').value = t.c || ''; $('tF').value = t.f || ''; }
function renderList() {
  const raw = $('listSearch').value.trim(), q = norm(raw), box = $('listResults'); box.replaceChildren();
  if (q.length < 2) { box.append(el('p', { class: 'empty' }, 'Digite pelo menos 2 letras.')); return; }
  const toks = q.split(' ');
  const hits = ALL.filter(it => toks.every(w => it.full.includes(w))).slice(0, 40);
  const al = PREF_IDX.find(x => x.a === q || x.a.startsWith(q));
  if (al && !hits.includes(al.it)) { box.append(el('p', { class: 'hint' }, `“${raw}” não aparece com esse nome; conta como `, el('strong', {}, al.it.name), ':')); hits.unshift(al.it); }
  if (!hits.length) { box.append(el('p', { class: 'empty' }, 'Não está na lista.')); return; }
  for (const it of hits) box.append(el('div', { class: 'sub' }, el('span', { class: 'n' }, it.name, el('span', { class: 'hint' }, ` · ${it.group} (${GBY[it.group].kcal} kcal)`)), el('span', {}, `${fmtN(it.qty)} ${it.measure} · ${it.g}g`)));
}
function renderAll() { renderDate(); renderSummary(); renderChips('mealChips', selMeal, pickMeal); renderMeals(); renderDiet(); renderTargets(); renderChips('sugMealChips', sugMeal, pickSug); }

/* ===== Registrar ===== */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
async function addEntry() {
  const text = $('logText').value.trim(); if (!text) return;
  const meal = selMeal || guessMeal();
  const res = localParse(text, mealGroups(meal));
  if (res.unknown.length) { askManual({ text, meal, items: res.items, estimated: res.estimated, unknown: res.unknown }); return; }
  await commitEntry(text, meal, res.items, res.estimated);
}
async function commitEntry(text, meal, items, estimated) {
  if (!items.length) return;
  day.entries.push({ id: uid(), meal, text, items, estimated, ts: Date.now() });
  $('logText').value = '';
  setStatus('logStatus', 'Adicionado em ' + meal + '.');
  renderSummary(); renderMeals(); await saveDay();
}
async function removeEntry(id) { day.entries = day.entries.filter(e => e.id !== id); renderSummary(); renderMeals(); await saveDay(); }

/* Alimento que o app não conhece: você informa os números (ou o grupo) */
function askManual(p) {
  pendingManual = p;
  const name = p.unknown[0];
  $('manualBox').hidden = false;
  $('manualMsg').replaceChildren('Não reconheci ', el('strong', {}, '“' + name + '”'), p.items.length ? ` (o resto já entendi: ${p.items.map(i => i.name).join(', ')}).` : '.', ' Informe o peso e as calorias (vêm no rótulo), ou escolha o grupo da lista em que ele se encaixa.');
  $('manName').value = name.replace(/^\d+\s*(g|gr|gramas)?\s*(de\s+)?/, '');
  const gm = name.match(/(\d+(?:[.,]\d+)?)\s*(g|gr|gramas)\b/); $('manGrams').value = gm ? gm[1].replace(',', '.') : '';
  $('manKcal').value = ''; $('manP').value = ''; $('manGroup').value = '';
  setStatus('logStatus', '');
  $('manKcal').focus();
}
async function manualAdd() {
  const p = pendingManual; if (!p) return;
  const name = $('manName').value.trim() || p.unknown[0], grams = +$('manGrams').value || 0, group = $('manGroup').value;
  let item;
  if (group) {
    const g = GBY[group], gm = GROUP_MACROS[group], avgG = g.items.length ? g.items.reduce((a, i) => a + i.g, 0) / g.items.length : 100;
    const portions = r2(grams ? grams / avgG : 1);
    item = { name, grams: r0(grams || avgG), group, portions, kcal: r0(portions * g.kcal), p: r1(gm.p * portions), c: r1(gm.c * portions), f: r1(gm.f * portions) };
  } else {
    const kcal = +$('manKcal').value; if (!kcal) { setStatus('logStatus', 'Informe as calorias ou escolha um grupo.', true); return; }
    item = { name, grams: r0(grams), group: 'Fora da lista', portions: 0, kcal: r0(kcal), p: r1(+$('manP').value || 0), c: 0, f: 0 };
  }
  p.items.push(item); p.unknown.shift();
  if (p.unknown.length) { askManual(p); return; }
  $('manualBox').hidden = true; pendingManual = null;
  await commitEntry(p.text, p.meal, p.items, p.estimated);
}
async function manualSkip() {
  const p = pendingManual; if (!p) return; p.unknown.shift();
  if (p.unknown.length) { askManual(p); return; }
  $('manualBox').hidden = true; pendingManual = null;
  if (p.items.length) await commitEntry(p.text, p.meal, p.items, p.estimated); else setStatus('logStatus', 'Nada adicionado.');
}

/* ===== Dieta vinda do Claude Code ===== */
function matchGroup(name) { const k = norm(name); return GROUPS.find(g => norm(g.name) === k) || GROUPS.find(g => k.includes(norm(g.name).split(' ')[0]) || norm(g.name).includes(k)); }
export function parseDietCode(txt) {
  const m = String(txt).match(/\{[\s\S]*\}/); if (!m) throw new Error('Não achei o código da dieta no texto colado.');
  const j = JSON.parse(m[0]);
  if (!Array.isArray(j.meals) || !j.meals.length) throw new Error('O código não tem refeições.');
  const meals = j.meals.map(mm => ({ name: String(mm.name || 'Refeição'), time: mm.time ? String(mm.time) : '', notes: mm.notes ? String(mm.notes) : '',
    portions: (mm.portions || []).map(p => { const g = matchGroup(String(p.group || '')); return g ? { group: g.name, n: g.free ? 0 : r2(+p.n || 0), text: p.text ? String(p.text) : '' } : null; }).filter(Boolean) })).filter(mm => mm.portions.length);
  if (!meals.length) throw new Error('Nenhuma refeição com grupos válidos.');
  const t = j.targets && +j.targets.kcal ? { kcal: r0(+j.targets.kcal), p: r0(+j.targets.p || 0), c: r0(+j.targets.c || 0), f: r0(+j.targets.f || 0) } : null;
  return { meals, targets: t, notes: j.notes ? String(j.notes) : '', importedAt: Date.now() };
}
async function importDiet() {
  try {
    const diet = parseDietCode($('dietCode').value);
    await setDiet(diet);
    $('dietCode').value = '';
    setStatus('dietStatus', `Dieta nova salva: ${diet.meals.length} refeições.`);
  } catch (e) { setStatus('dietStatus', e instanceof SyntaxError ? 'O código está incompleto. Copie de novo, do { até o }.' : e.message, true); }
}
async function saveTargets() {
  profile.diet = { ...profile.diet, example: false, targets: { kcal: +$('tKcal').value || 0, p: +$('tP').value || 0, c: +$('tC').value || 0, f: +$('tF').value || 0 } };
  if (isToday() && day.diet) day.diet.targets = profile.diet.targets;
  await save('profile', profile); if (isToday() && day.entries.length) await saveDay();
  setStatus('targetStatus', 'Metas salvas.'); renderSummary();
}
async function resetTargets() { profile.diet = { ...profile.diet, targets: null }; if (isToday() && day.diet) day.diet.targets = null; await save('profile', profile); renderTargets(); renderSummary(); setStatus('targetStatus', 'Voltou para os valores da dieta.'); }

/* ===== Sugestões ===== */
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function buildCombos(meal) {
  const m = (profile.diet?.meals || []).find(x => x.name === meal); if (!m) return [];
  const combos = [], used = new Set();
  for (let k = 0; k < 3; k++) {
    const parts = [];
    for (const { group, n } of m.portions) {
      const g = GBY[group]; if (!g) continue;
      if (g.free) { parts.push({ label: 'Salada/legumes crus à vontade' }); continue; }
      const common = g.items.filter(i => COMMON.has(i.name) && !used.has(i.name));
      const pool = common.length ? common : g.items.filter(i => !used.has(i.name));
      const it = pick(pool.length ? pool : g.items); used.add(it.name);
      const pref = PREF_IDX.find(x => x.it === it);
      parts.push({ it, label: `${it.name} — ${fmtN(it.qty * n)} ${it.measure} (${r0(it.g * n)}g)`, item: toItem({ kind: 'list', it, taco: pref?.taco }, it.g * n) });
    }
    combos.push(parts);
  }
  return combos;
}
function suggest() {
  const meal = sugMeal || guessMeal(); pickSug(meal);
  const combos = buildCombos(meal), list = $('sugList');
  list.replaceChildren(el('h2', {}, meal));
  if (!combos.length) { list.append(el('p', { class: 'empty' }, 'Sua dieta não tem essa refeição.')); return; }
  combos.forEach((parts, i) => {
    const items = parts.filter(p => p.item).map(p => p.item), s = sum(items);
    list.append(el('div', { class: 'dish' }, el('h3', {}, 'Opção ' + (i + 1)),
      el('ul', { class: 'plain' }, parts.map(p => el('li', {}, p.label))),
      el('span', { class: 'nums' }, `${r0(s.kcal)} kcal · `, el('span', { class: 'p' }, `P ${r0(s.p)}g`), ` · C ${r0(s.c)}g · G ${r0(s.f)}g`),
      el('div', { class: 'row end' }, el('button', { class: 'small', onclick: () => logItems(parts.filter(p => p.item).map(p => p.it.name).join(', '), items, meal) }, 'Comi esse'))));
  });
  setStatus('sugStatus', 'Toque de novo para outras combinações.');
}
async function logItems(text, items, meal) {
  if (!isToday()) { curDate = new Date(); await loadDay(); }
  await commitEntry(text, meal, items, false);
  showTab('hoje'); renderAll();
}

/* ===== Abas, dias e início ===== */
function showTab(name) { for (const n of ['hoje', 'dieta', 'sugestoes']) { $('tab-' + n).setAttribute('aria-selected', String(n === name)); $('view-' + n).hidden = n !== name; } }
async function loadDay() {
  const okDay = v => v && Array.isArray(v.entries);
  const v = await load('day-' + dkey(curDate)); day = okDay(v) ? v : { entries: [] };
  if (!selMeal || !mealNames().includes(selMeal)) selMeal = isToday() ? guessMeal() : mealNames()[0];
  renderAll();
}
const okProfile = p => p && Array.isArray(p.diet?.meals) && p.diet.meals.every(m => Array.isArray(m.portions));

$('tab-hoje').onclick = () => showTab('hoje');
$('tab-dieta').onclick = () => showTab('dieta');
$('tab-sugestoes').onclick = () => showTab('sugestoes');
$('addBtn').onclick = addEntry;
$('logText').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addEntry(); } });
$('manAdd').onclick = manualAdd;
$('manSkip').onclick = manualSkip;
$('manGroup').replaceChildren(el('option', { value: '' }, '— não, vou digitar as calorias —'), ...GROUPS.filter(g => !g.free).map(g => el('option', { value: g.name }, `${g.name} (${g.kcal} kcal/porção)`)));
$('importDiet').onclick = importDiet;
$('saveTargets').onclick = saveTargets;
$('resetTargets').onclick = resetTargets;
$('sugBtn').onclick = suggest;
$('listSearch').addEventListener('input', renderList);
$('prevDay').onclick = () => { curDate.setDate(curDate.getDate() - 1); selMeal = null; loadDay(); };
$('nextDay').onclick = () => { curDate.setDate(curDate.getDate() + 1); selMeal = null; loadDay(); };

/* --- conta Google (Firebase) --- */
const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';
async function initFirebase() {
  if (!firebaseConfig) { $('accountTxt').textContent = 'Salvando só neste celular (login ainda não configurado).'; return; }
  try {
    const [{ initializeApp }, auth, fs] = await Promise.all([import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js'), import(FB + 'firebase-firestore.js')]);
    const app = initializeApp(firebaseConfig);
    fb.auth = auth.getAuth(app); fb.authMod = auth;
    try { fb.db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache() }); } catch { fb.db = fs.getFirestore(app); }
    Object.assign(fb, { doc: fs.doc, getDoc: fs.getDoc, setDoc: fs.setDoc });
    auth.getRedirectResult(fb.auth).catch(e => console.warn(e));
    auth.onAuthStateChanged(fb.auth, onUser);
  } catch (e) {
    console.warn('Firebase indisponível', e);
    $('accountTxt').textContent = 'Sem conexão com a conta agora. Salvando no celular.';
  }
}
async function login() {
  const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = fb.authMod; const prov = new GoogleAuthProvider();
  try { await signInWithPopup(fb.auth, prov); }
  catch (e) { if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'].includes(e.code)) await signInWithRedirect(fb.auth, prov); else { console.warn(e); $('accountTxt').textContent = 'Não consegui entrar (' + (e.code || e.message) + ').'; } }
}
async function onUser(user) {
  $('loginBtn').hidden = !!user; $('logoutBtn').hidden = !user;
  if (!user) { cloud = null; $('accountTxt').textContent = 'Entre com o Google para salvar na nuvem e ver em qualquer celular.'; return; }
  $('accountTxt').replaceChildren(user.photoURL ? el('img', { src: user.photoURL, alt: '' }) : null, ' ', user.email || 'Conectado');
  cloud = makeCloud(user.uid);
  // primeira vez nesta conta: sobe o que estava só no celular
  try {
    const remote = await cloud.get('profile');
    if (okProfile(remote)) { profile = remote; local.set('profile', remote); }
    else if (!profile.diet?.example) await cloud.set('profile', profile);
    if (!local.get('synced:' + user.uid)) {
      for (const k of local.keys().filter(k => k.startsWith('day-'))) { const v = local.get(k); if (v?.entries?.length && !(await cloud.get(k))) await cloud.set(k, v); }
      local.set('synced:' + user.uid, true);
    }
  } catch (e) { console.warn(e); }
  await loadDay();
}
$('loginBtn').onclick = login;
$('logoutBtn').onclick = () => fb.authMod.signOut(fb.auth);

/* --- instalar e funcionar offline --- */
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('installBtn').hidden = false; });
$('installBtn').onclick = async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice.catch(() => {}); installEvt = null; $('installBtn').hidden = true; };
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const tinhaControle = !!navigator.serviceWorker.controller; let recarregou = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!tinhaControle || recarregou) return; recarregou = true; location.reload(); });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
    reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(() => {});
}

/* --- começo --- */
const lp = local.get('profile'); if (okProfile(lp)) profile = lp;
selMeal = guessMeal();
renderAll(); renderList();
loadDay();
initFirebase();
console.info('Prato Certo versão', APP_VERSAO);
