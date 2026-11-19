// Confere um código de dieta antes de mandar para a pessoa colar no app.
// Uso: node tools/checar-dieta.mjs < dieta.json
import { GBY, GROUP_MACROS } from '../alimentos.js';
let txt = ''; for await (const c of process.stdin) txt += c;
const j = JSON.parse(txt.match(/\{[\s\S]*\}/)[0]);
let tot = { kcal: 0, p: 0 }, erros = 0;
for (const m of j.meals || []) {
  let k = 0, p = 0;
  for (const x of m.portions || []) {
    const g = GBY[x.group];
    if (!g) { console.log(`  ✗ grupo inválido: "${x.group}" em ${m.name}`); erros++; continue; }
    k += g.kcal * (x.n || 0); p += GROUP_MACROS[x.group].p * (x.n || 0);
  }
  tot.kcal += k; tot.p += p;
  console.log(`${m.name}${m.time ? ' (' + m.time + ')' : ''}: ${Math.round(k)} kcal, ~${Math.round(p)} g proteína — ` + (m.portions || []).map(x => `${x.n} ${x.group}`).join(', '));
}
console.log(`Total do dia: ${Math.round(tot.kcal)} kcal, ~${Math.round(tot.p)} g proteína${j.targets ? ` (metas da dieta: ${j.targets.kcal} kcal)` : ''}`);
console.log(erros ? `${erros} erro(s).` : 'OK — código válido.');
console.log('\nCódigo para colar no app:\n' + JSON.stringify(j));
