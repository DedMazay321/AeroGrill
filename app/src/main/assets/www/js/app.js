'use strict';
/* ---------- Состояние ---------- */
const LS_KEY = 'aerogrill.v1';
const st = Object.assign({
  fav: {}, cat: 'all', flt: {}, q: '',
  profile: { sex: 'm', age: 30, weight: 75, height: 175, act: 1.375, goal: 'keep' },
  target: null, meals: 4, excl: {}, persons: 1, kmode: 'day', calcOpen: false,
  dishT: { k: 550, p: 40, f: 18, c: 50 }, dishType: 'm', dishRes: null, menu: null,
  adapt: {}, steps: {}, shop: { items: {}, extras: [], done: {} }, timer: null, sort: 'def', autoUpd: true,
  cooked: {}, port: {}, notes: {}, mytime: {}, tw: { time: 40, kind: 'm', home: '0', seed: 0 }, ttsAuto: false, week: null, weekOpen: 0, pantry: {}, ptab: 'have'
}, load());

// Данные хранятся в двух местах: в хранилище страницы и в Android-оболочке. После обновления страницы
// могут открыться с другого адреса, где хранилище пустое или устарело, — тогда берётся более свежая копия.
function load() {
  const read = get => { try { return JSON.parse(get()) || {}; } catch (e) { return {}; } };
  const a = read(() => localStorage.getItem(LS_KEY)), b = read(() => window.AndroidBridge.loadState());
  return (b.savedAt || 0) > (a.savedAt || 0) ? b : a;
}
function save() {
  st.savedAt = Date.now();
  const json = JSON.stringify(st);
  try { localStorage.setItem(LS_KEY, json); } catch (e) { /* хранилище недоступно */ }
  try { window.AndroidBridge.saveState(json); } catch (e) { /* открыто в браузере или старая оболочка */ }
}

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const byId = id => RECIPES.find(r => r.id === id);
const N4 = ['k', 'p', 'f', 'c'];
const NAMES = { k: 'Калории', p: 'Белки', f: 'Жиры', c: 'Углеводы' };

/* ---------- Форматирование ---------- */
const num = v => String(Math.round(v * 10) / 10).replace('.', ',');
const frac = v => { const w = Math.floor(v), h = v - w >= 0.5; return (w || !h ? w : '') + (h ? '½' : ''); };
function dur(min) {
  if (min < 90) return min + ' мин';
  const h = Math.floor(min / 60), m = min % 60;
  return h + ' ч' + (m ? ' ' + m + ' мин' : '');
}
function roundG(g) { return g < 15 ? Math.max(1, Math.round(g)) : g < 100 ? Math.round(g / 5) * 5 : Math.round(g / 10) * 10; }
// вес [чайной, столовой] ложки
const SPOON = { oil: [5, 14], honey: [9, 25], soy_sauce: [6, 18], mustard: [6, 18], sour_cream: [8, 22], sugar: [7, 20], flour: [8, 25], semolina: [7, 20], bbq_sauce: [7, 20], tomato_sauce: [7, 20], butter: [5, 15] };
// Количество с дробью: 0,25 → ¼, 1,5 → 1½
function qty(v) {
  const q = Math.max(0.25, Math.round(v * 4) / 4), w = Math.floor(q), f = { 0.25: '¼', 0.5: '½', 0.75: '¾' }[q - w] || '';
  return (w || !f ? w : '') + f;
}
// «Соль — 1 ч. л.» на нужное число порций; строки без числа («по вкусу», «половина лимона») остаются как есть
function extraLine(x, f) {
  const p = x.split(' — '), m = p[1] && p[1].match(/^(\d+)?([½¼¾])?\s+(.+)$/);
  if (!m || f === 1 || (!m[1] && !m[2])) return p;
  const v = (+m[1] || 0) + ({ '½': 0.5, '¼': 0.25, '¾': 0.75 }[m[2]] || 0);
  return [p[0], qty(v * f) + ' ' + m[3]];
}
const extras = (r, portions) => r.extra.map(x => extraLine(x, portions / r.serves));
const PORT_WORD = n => n % 10 === 1 && n % 100 !== 11 ? 'порцию' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'порции' : 'порций';
function amountText(a) {
  const ing = ING[a.id];
  if (a.pcs != null) return frac(a.pcs) + ' ' + ing.u[0] + ' (≈' + a.g + ' г)';
  const sp = SPOON[a.id];
  if (!sp || a.g > sp[1] * 6) return a.g >= 1000 ? num(a.g / 1000) + ' кг' : a.g + ' г';
  const big = a.g > sp[0] * 3, n = Math.max(0.5, Math.round(a.g / sp[big ? 1 : 0] * 2) / 2);
  return a.g + ' г (≈' + frac(n) + (big ? ' ст. л.)' : ' ч. л.)');
}

/* ---------- Расчёт продуктов и КБЖУ ---------- */
const BOUNDS = { p: [0.6, 1.8], c: [0.5, 1.8], f: [0.4, 1.4], v: [0.6, 1.8], a: [0.5, 2] };
const grp = (r, i) => i[2] === 's' ? 's' : r.rigid ? 'a' : i[2];
const groupsOf = r => [...new Set(r.ing.map(i => grp(r, i)).filter(g => g !== 's'))];
function multOf(r, m, g) {
  if (!m) return 1;
  if (g !== 's') return m[g] == null ? 1 : m[g];
  const gs = groupsOf(r);
  return gs.reduce((a, x) => a + (m[x] == null ? 1 : m[x]), 0) / gs.length;
}
// Количество продуктов на `portions` порций с поправками по группам
function amounts(r, portions, m) {
  return r.ing.map(i => {
    const ing = ING[i[0]];
    let g = i[1] / r.serves * portions * multOf(r, m, grp(r, i)), pcs = null;
    if (ing.u) {
      const step = ing.u[1] >= 100 ? 0.5 : 1;
      pcs = Math.max(step, Math.round(g / ing.u[1] / step) * step);
      g = Math.round(pcs * ing.u[1]);
    } else g = roundG(g);
    return { id: i[0], g, pcs };
  });
}
function nutri(list) {
  const t = [0, 0, 0, 0];
  list.forEach(a => ING[a.id].k.forEach((v, i) => { t[i] += v * a.g / 100; }));
  return t;
}
const perServing = r => r._n || (r._n = nutri(amounts(r, r.serves)).map(v => v / r.serves));
const tArr = T => N4.map(n => +T[n] || 0);

const WT = [2, 1.5, 1, 1];
function errOf(R, T) {
  let s = 0, w = 0;
  T.forEach((t, i) => { if (t > 0) { s += WT[i] * Math.pow((R[i] - t) / t, 2); w += WT[i]; } });
  return w ? Math.sqrt(s / w) : 0;
}
// Подгонка: одна порция каждого блюда, множители по группам продуктов подбираются
// покоординатным спуском так, чтобы сумма КБЖУ была ближе всего к цели.
function fitCombo(ids, T) {
  const vars = [], R = [0, 0, 0, 0];
  ids.forEach((id, ri) => {
    const r = byId(id), A = {};
    r.ing.forEach(i => {
      const g = grp(r, i), k = ING[i[0]].k.map(v => v * i[1] / r.serves / 100);
      if (g === 's') k.forEach((v, n) => { R[n] += v; });
      else (A[g] = A[g] || [0, 0, 0, 0]).forEach((_, n) => { A[g][n] += k[n]; });
    });
    Object.keys(A).forEach(g => vars.push({ ri, g, A: A[g], lo: BOUNDS[g][0], hi: BOUNDS[g][1], x: 1 }));
  });
  vars.forEach(v => v.A.forEach((a, n) => { R[n] += a; }));
  const w = T.map((t, i) => t > 0 ? WT[i] / (t * t) : 0), lam = 0.03;
  for (let it = 0; it < 30; it++) vars.forEach(v => {
    let nu = lam, de = lam;
    for (let n = 0; n < 4; n++) { nu += w[n] * v.A[n] * (T[n] - R[n] + v.A[n] * v.x); de += w[n] * v.A[n] * v.A[n]; }
    const nx = Math.min(v.hi, Math.max(v.lo, nu / de));
    for (let n = 0; n < 4; n++) R[n] += v.A[n] * (nx - v.x);
    v.x = nx;
  });
  const items = ids.map(id => ({ id, m: {} }));
  vars.forEach(v => { items[v.ri].m[v.g] = Math.round(v.x * 100) / 100; });
  const total = [0, 0, 0, 0];
  items.forEach(it => { it.n = nutri(amounts(byId(it.id), 1, it.m)); it.n.forEach((v, n) => { total[n] += v; }); });
  return { items, total, err: errOf(total, T) };
}

// Блюда с оценкой 1–2 в меню не предлагаются
const ck = id => st.cooked[id] || { n: 0, rate: 0, last: 0 };
const allowed = r => !(ck(r.id).rate && ck(r.id).rate <= 2) && !Object.keys(st.excl).some(k => st.excl[k] && r.ing.some(i => EXCLUDE[k].x.includes(ING[i[0]].x)));
const pool = k => RECIPES.filter(r => r.meal.includes(k) && allowed(r));
const pick = a => a[Math.floor(Math.random() * a.length)];

/* ---------- Подбор одного приёма пищи ---------- */
function findDishes() {
  const T = tArr(st.dishT), sides = pool('s'), combos = [];
  const types = st.dishType === 'any' ? ['b', 'm', 'n'] : [st.dishType];
  const seen = {};
  types.forEach(t => pool(t).forEach(r => {
    if (seen[r.id]) return;
    seen[r.id] = 1;
    combos.push([r.id]);
    if (r.side && r.meal.includes('m')) sides.forEach(s => combos.push([r.id, s.id]));
  }));
  const res = combos.map(c => fitCombo(c, T)).sort((a, b) => a.err - b.err), used = {}, out = [];
  res.forEach(x => {
    const main = x.items[0].id;
    used[main] = (used[main] || 0) + 1;
    if (used[main] <= 1 && out.length < 12) out.push(x);
  });
  st.dishRes = out;
}

/* ---------- Меню на день ---------- */
const SLOT = { b: 'Завтрак', L: 'Обед', D: 'Ужин', n: 'Перекус' };
const PLAN = { 3: ['b', 'L', 'D'], 4: ['b', 'L', 'n', 'D'], 5: ['b', 'n', 'L', 'n', 'D'] };
function slotOptions(key, used) {
  const free = r => !used[r.id];
  if (key === 'b' || key === 'n') return pool(key).filter(free).map(r => [r.id]);
  const sides = pool('s').filter(free), out = [];
  pool('m').filter(free).forEach(r => {
    out.push([r.id]);
    if (r.side) sides.forEach(s => out.push([r.id, s.id]));
  });
  return out;
}
function buildMenu(slots, T) {
  const fit = fitCombo([].concat(...slots.map(s => s.ids)), T);
  let i = 0;
  return { err: fit.err, total: fit.total, slots: slots.map(s => ({ key: s.key, items: s.ids.map(() => fit.items[i++]) })) };
}
// Лучшее из `iters` случайных меню на день. banned — блюда, которые брать нельзя (уже стоят в других днях недели);
// если без них приём пищи собрать не из чего, запрет для него снимается.
function makeMenu(T, banned, iters) {
  const plan = PLAN[st.meals];
  let best = null;
  for (let it = 0; it < iters; it++) {
    const day = {}, slots = [];
    for (const key of plan) {
      let opts = slotOptions(key, Object.assign({}, banned, day));
      if (!opts.length) opts = slotOptions(key, day);
      if (!opts.length) continue;
      const ids = pick(opts);
      ids.forEach(id => { day[id] = 1; });
      slots.push({ key, ids });
    }
    if (!slots.length) break;
    const m = buildMenu(slots, T);
    if (!best || m.err < best.err) best = m;
  }
  return best;
}
const idsOf = menus => { const u = {}; menus.forEach(m => m.slots.forEach(s => s.items.forEach(x => { u[x.id] = 1; }))); return u; };
function genMenu() { st.menu = makeMenu(tArr(st.target), {}, 400); }
function genWeek() {
  const T = tArr(st.target), days = [];
  for (let d = 0; d < 7; d++) {
    const m = makeMenu(T, idsOf(days), 200);
    if (!m) break;
    days.push(m);
  }
  st.week = days.length === 7 ? { days } : null;
  st.weekOpen = 0;
}
// Замена одного приёма пищи в меню; banned — блюда других дней
function swapIn(menu, idx, banned) {
  const T = tArr(st.target), cur = menu.slots, used = Object.assign({}, banned);
  cur.forEach((s, i) => { if (i !== idx) s.items.forEach(x => { used[x.id] = 1; }); });
  used[cur[idx].items[0].id] = 1;
  const variants = slotOptions(cur[idx].key, used).map(ids =>
    buildMenu(cur.map((s, i) => ({ key: s.key, ids: i === idx ? ids : s.items.map(x => x.id) })), T));
  if (!variants.length) { toast('Других подходящих блюд нет'); return menu; }
  variants.sort((x, y) => x.err - y.err);
  return pick(variants.slice(0, 4));
}
const otherDays = d => idsOf(st.week.days.filter((m, i) => i !== d));

/* ---------- Норма КБЖУ ---------- */
function calcTarget() {
  const p = st.profile;
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'm' ? 5 : -161);
  const k = bmr * p.act * { lose: 0.85, keep: 1, gain: 1.1 }[p.goal];
  const pr = p.weight * { lose: 2, keep: 1.6, gain: 1.8 }[p.goal], f = p.weight * 0.9;
  st.target = { k: Math.round(k / 10) * 10, p: Math.round(pr), f: Math.round(f), c: Math.max(0, Math.round((k - pr * 4 - f * 9) / 4)) };
}
if (!st.target) calcTarget();

/* ---------- Общие куски разметки ---------- */
const kbLine = n => `<b>${Math.round(n[0])} ккал</b> · Б ${Math.round(n[1])} · Ж ${Math.round(n[2])} · У ${Math.round(n[3])}`;
function nutriCells(n) {
  return `<div class="panel four">
    <div class="cell k"><small>ккал</small><b>${Math.round(n[0])}</b></div>
    <div class="cell"><small>белки</small><b>${Math.round(n[1])} г</b></div>
    <div class="cell"><small>жиры</small><b>${Math.round(n[2])} г</b></div>
    <div class="cell"><small>углеводы</small><b>${Math.round(n[3])} г</b></div></div>`;
}
function bars(total, T) {
  return N4.map((n, i) => {
    if (!(T[i] > 0)) return '';
    const d = (total[i] - T[i]) / T[i], off = Math.abs(d) > 0.08;
    return `<div class="bar"><div class="row between"><span>${NAMES[n]}</span>
      <span><b>${Math.round(total[i])}</b> из ${Math.round(T[i])}${i ? ' г' : ''} <span class="badge ${off ? 'warn' : 'ok'}">${Math.round(d * 100) ? (d > 0 ? '+' : '−') + Math.round(Math.abs(d) * 100) + '%' : 'точно'}</span></span></div>
      <div class="track"><i class="${off ? 'off' : ''}" style="width:${Math.min(100, total[i] / T[i] * 100)}%"></i></div></div>`;
  }).join('');
}
function seg(act, cur, opts) {
  return `<div class="seg">${opts.map(o => `<button data-act="${act}" data-v="${o[0]}" class="${String(cur) === String(o[0]) ? 'on' : ''}">${o[1]}</button>`).join('')}</div>`;
}
const field = (label, bind, val, attrs = '') => `<div class="field"><label>${label}</label><input type="number" inputmode="decimal" data-bind="${bind}" value="${val}" ${attrs}></div>`;
function targetFields(key) {
  const T = st[key];
  return `<div class="fields">${field('Ккал', key + '.k', T.k)}${field('Белки, г', key + '.p', T.p)}${field('Жиры, г', key + '.f', T.f)}${field('Углеводы, г', key + '.c', T.c)}</div>`;
}
function miniDish(it) {
  const r = byId(it.id);
  return `<a class="mini" data-act="open-fit" data-id="${r.id}" data-m='${JSON.stringify(it.m)}'>
    ${tile(r)}
    <div class="grow"><b>${r.name}</b><div class="kb">${kbLine(it.n)}</div>
    <div class="small muted">«${r.prog}» · ${r.temp} °C · ${dur(r.cook)}${r.steam ? ' · <span class="steam-c">пар</span>' : ''}</div></div><span class="muted">›</span></a>`;
}

// Плитка блюда: фото, а если его нет — эмодзи
const tile = r => `<div class="tile">${PHOTOS[r.id] ? `<img loading="lazy" src="img/${r.id}.jpg" alt="">` : r.e}</div>`;

// Выбранное число порций запоминается для каждого рецепта (кроме подобранных под КБЖУ)
function setPortions(v) {
  rv.portions = Math.min(20, Math.max(1, v));
  if (!rv.fit) st.port[rv.id] = rv.portions;
}
function markCooked(id) { const c = st.cooked[id] = st.cooked[id] || { n: 0, rate: 0, last: 0 }; c.n++; c.last = Date.now(); }

/* ---------- Экран: каталог ---------- */
function recipeMatches(r) {
  if (st.cat !== 'all' && r.cat !== st.cat) return false;
  if (st.flt.fav && !st.fav[r.id]) return false;
  if (st.flt.steam && !r.steam) return false;
  if (st.flt.fast && r.prep + r.cook > 30) return false;
  if (st.flt.protein && perServing(r)[1] < 25) return false;
  if (st.flt.light && perServing(r)[0] > 350) return false;
  if (st.flt.world && !r.cuisine) return false;
  if (st.flt.fest && !r.fest) return false;
  if (st.flt.cooked && !ck(r.id).n) return false;
  if (st.flt.fresh && ck(r.id).n) return false;
  const q = st.q.trim().toLowerCase();
  return !q || r.name.toLowerCase().includes(q) || (r.cuisine || '').toLowerCase().includes(q) || r.prog.toLowerCase().includes(q) || r.ing.some(i => ING[i[0]].n.toLowerCase().includes(q));
}
function recipeCard(r) {
  return `<a class="rcard" href="#/r/${r.id}">${tile(r)}<div class="grow"><h3>${r.name}</h3>
    <div class="meta">${r.cuisine ? `<span>🌍 ${r.cuisine}</span>` : ''}<span>⏱ ${dur(r.prep + r.cook)}</span><span>«${r.prog}» ${r.temp} °C</span>${r.steam ? '<span class="steam">💨 пар</span>' : ''}${ck(r.id).rate ? `<span class="rate">★ ${ck(r.id).rate}</span>` : ''}${ck(r.id).n ? `<span>✓ готовил${ck(r.id).n > 1 ? ' ×' + ck(r.id).n : ''}</span>` : ''}${st.notes[r.id] ? '<span>📝</span>' : ''}${doneCount(r) ? `<span class="badge ${doneCount(r) === r.steps.length ? 'ok' : ''}">шаги ${doneCount(r)}/${r.steps.length}</span>` : ''}</div>
    <div class="kb">${kbLine(perServing(r))}</div></div>
    <button class="fav ${st.fav[r.id] ? 'on' : ''}" data-act="fav" data-id="${r.id}">⭐</button></a>`;
}
const SORTS = {
  def: ['По разделам', null],
  time: ['Сначала быстрые', (a, b) => a.prep + a.cook - b.prep - b.cook],
  kcal: ['Меньше калорий', (a, b) => perServing(a)[0] - perServing(b)[0]],
  protein: ['Больше белка', (a, b) => perServing(b)[1] - perServing(a)[1]],
  name: ['По алфавиту', (a, b) => a.name.localeCompare(b.name, 'ru')],
  rate: ['Сначала с высокой оценкой', (a, b) => ck(b.id).rate - ck(a.id).rate || ck(b.id).n - ck(a.id).n],
  recent: ['Недавно готовил', (a, b) => ck(b.id).last - ck(a.id).last]
};
function listHtml() {
  const list = RECIPES.filter(recipeMatches), sort = (SORTS[st.sort] || SORTS.def)[1];
  if (sort) list.sort(sort);
  return `<div class="row between" style="margin-bottom:10px"><span class="muted small">Найдено: ${list.length}</span>
      <select class="sortsel" data-sel="sort">${Object.keys(SORTS).map(k => `<option value="${k}" ${st.sort === k ? 'selected' : ''}>${SORTS[k][0]}</option>`).join('')}</select></div>`
    + (list.length ? list.map(recipeCard).join('') : '<div class="empty">Ничего не найдено.<br>Измените запрос или фильтры.</div>');
}
function featured() {
  const pool = RECIPES.filter(r => PHOTOS[r.id] && r.meal.includes('m'));
  const day = Math.floor(Date.now() / 86400000), i = (day + (st.featOff || 0)) % pool.length;
  return pool[(i + pool.length) % pool.length];
}
function featureHtml() {
  const r = featured(), n = perServing(r);
  return `<section class="feature desk-only" style="background-image:url('img/${r.id}.jpg')"><div class="feature-in">
    <span class="eyebrow">Рецепт дня</span><h1>${r.name}</h1>
    <p>⏱ ${dur(r.prep + r.cook)} · программа «${r.prog}» · ${r.temp} °C${r.steam ? ' · 💨 с паром' : ''} · ${Math.round(n[0])} ккал на порцию</p>
    <div class="row" style="margin-top:18px"><a class="btn sm" href="#/r/${r.id}">Открыть рецепт</a><button class="btn sm ghost glass" data-act="feature-next">Другой рецепт ›</button></div></div></section>`;
}
const SWEET = ['sugar', 'honey', 'chocolate', 'cocoa', 'banana', 'apple', 'pear', 'pineapple', 'strawberry', 'cherry', 'raisins', 'orange'];
// Сравнимое случайное число для перемешивания вариантов: одинаковое при перерисовке, новое по кнопке «Другие»
const hashSeed = (txt, seed) => { let h = seed * 2654435761 >>> 0; for (const c of txt) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; };
function todayPicks() {
  const w = st.tw, sweet = r => r.ing.some(i => SWEET.includes(i[0])) && ['dessert', 'breakfast', 'dry'].includes(r.cat);
  const fits = r => {
    if (w.time && r.prep + r.cook > w.time) return false;
    if (w.kind === 'm') return r.meal.includes('m');
    if (w.kind === 'pp') return (r.meal.includes('m') || r.meal.includes('b')) && perServing(r)[0] <= 400 && perServing(r)[1] >= 20;
    if (w.kind === 'b') return r.meal.includes('b');
    return sweet(r);
  };
  const missing = r => [...new Set(r.ing.map(i => i[0]))].filter(id => !st.pantry[id]).length;
  let list = RECIPES.filter(r => allowed(r) && fits(r)).map(r => ({ r, miss: w.home === '1' ? missing(r) : 0, h: hashSeed(r.id, w.seed) }));
  if (w.home === '1') list = list.filter(x => x.miss <= 2);
  return list.sort((a, b) => a.miss - b.miss || a.h - b.h).slice(0, 3);
}
function viewToday() {
  const w = st.tw, picks = todayPicks(), hasHome = Object.keys(st.pantry).some(k => st.pantry[k]);
  return `<div class="top"><button class="icon-btn" data-act="back">‹</button></div>
    <h1>Что приготовить сегодня?</h1><p class="muted small" style="margin:4px 0 14px">Три вопроса — и три готовых варианта</p>
    <div class="card">
      <p class="q">1. Сколько есть времени?</p>${seg('tw-time', w.time, [[20, '20 мин'], [40, '40 мин'], [90, '1,5 ч'], [0, 'Не важно']])}
      <p class="q">2. Чего хочется?</p>${seg('tw-kind', w.kind, [['m', 'Сытное'], ['pp', 'ПП'], ['b', 'Завтрак'], ['sweet', 'Сладкое']])}
      <p class="q">3. Готовить из того, что дома?</p>${seg('tw-home', w.home, [['0', 'Не важно'], ['1', 'Да']])}
      ${w.home === '1' && !hasHome ? '<p class="small muted" style="margin-top:8px">Сначала отметьте продукты во вкладке <a href="#/pantry" style="color:var(--accent)">«Дома»</a>.</p>' : ''}</div>
    ${picks.length ? `<h2>Попробуйте</h2><div id="list" class="picks">${picks.map(x => recipeCard(x.r) + (x.miss ? `<p class="small muted pick-miss">Не хватает продуктов: ${x.miss}</p>` : '')).join('')}</div>
      <button class="btn ghost" data-act="tw-more">🎲 Другие варианты</button>`
      : '<div class="empty">Ничего не подошло. Увеличьте время или выберите «Не важно» в третьем вопросе.</div>'}`;
}
function viewRecipes() {
  const flt = [['fav', '⭐ Избранное'], ['fast', '⏱ До 30 минут'], ['steam', '💨 С паром'], ['protein', '💪 Белок от 25 г'], ['light', '🥗 До 350 ккал'], ['world', '🌍 Кухни мира'], ['fest', '🎉 Праздничное'], ['cooked', '✓ Готовил'], ['fresh', '🆕 Не пробовал']];
  return `<div id="updb">${updateBanner()}</div>${featureHtml()}<a class="today-card" href="#/today"><span class="today-ico">🍳</span><span class="grow"><b>Что приготовить сегодня?</b><br><span class="small muted">Три вопроса — и готовые варианты</span></span><span class="muted">›</span></a><h1>Рецепты для аэрогриля</h1><p class="muted small">${RECIPES.length} рецептов · Weissgauff WAF 720 DB Steam Fry</p>
    <div class="search-wrap"><input class="search" type="search" placeholder="Блюдо, продукт или программа" value="${esc(st.q)}" data-search></div>
    <div class="chips"><button class="chip ${st.cat === 'all' ? 'on' : ''}" data-act="cat" data-v="all">Все</button>
      ${Object.keys(CATS).map(c => `<button class="chip ${st.cat === c ? 'on' : ''}" data-act="cat" data-v="${c}">${CATS[c]}</button>`).join('')}</div>
    <div class="chips">${flt.map(f => `<button class="chip ${st.flt[f[0]] ? 'on' : ''}" data-act="flt" data-v="${f[0]}">${f[1]}</button>`).join('')}</div>
    <div id="list">${listHtml()}</div>`;
}

/* ---------- Экран: рецепт ---------- */
const rv = { id: null, portions: 1, fit: false };
const doneCount = r => r.steps.filter((s, i) => (st.steps[r.id] || {})[i]).length;
function viewRecipe(id, fit) {
  const r = byId(id);
  if (!r) return '<div class="empty">Рецепт не найден</div>';
  const m = fit ? st.adapt[id] : null;
  if (rv.id !== id || rv.fit !== !!m) Object.assign(rv, { id, fit: !!m, portions: m ? 1 : st.port[id] || r.serves });
  const done = st.steps[id] || {}, nDone = doneCount(r), total = r.steps.length;
  const list = amounts(r, rv.portions, m), n = nutri(list).map(v => v / rv.portions), ph = PHOTOS[id], c = ck(id);
  const weight = list.reduce((a, x) => a + x.g, 0), load = weight / r.ing.reduce((a, i) => a + i[1], 0);
  // Исходный рецепт рассчитан на одну закладку в чашу 7 л: если продуктов заметно больше — нужно несколько заходов
  const batches = Math.max(1, Math.ceil(load - 0.2)), p = rv.portions;
  const loadNote = batches > 1
    ? `<div class="note">⚠️ Всё сразу в чашу не поместится: готовьте в <b>${batches} ${batches < 5 ? 'захода' : 'заходов'}</b>, примерно по ${Math.ceil(p / batches)} ${PORT_WORD(Math.ceil(p / batches))}. Температура и время в шагах — на один заход. Куски кладите в один слой.</div>`
    : load < 0.55 ? '<div class="note tip">Продуктов меньше, чем в исходном рецепте: проверьте готовность на 2–4 минуты раньше указанного.</div>' : '';
  const portionsCard = `<div class="card"><div class="row between"><div><b>На сколько порций готовим?</b>
      <div class="small muted">${m ? 'Подобрано под вашу норму КБЖУ — на 1 человека' : 'Рецепт рассчитан на ' + r.serves + ' ' + PORT_WORD(r.serves)}</div></div>
      <div class="stepper"><button data-act="portions" data-v="-1">−</button><b>${p}</b><button data-act="portions" data-v="1">+</button></div></div>
    <div class="chips wrap" style="margin-top:12px">${[1, 2, 3, 4, 6, 8].map(v => `<button class="chip ${v === p ? 'on' : ''}" data-act="portions-set" data-v="${v}">${v}</button>`).join('')}</div>
    <p class="small" style="margin-top:12px">Нужно продуктов ≈ <b>${weight >= 1000 ? num(weight / 1000) + ' кг' : weight + ' г'}</b> · на все порции <b>${Math.round(n[0] * p)} ккал</b></p></div>${loadNote}`;
  return `<div class="top"><button class="icon-btn" data-act="back">‹</button>
      <button class="icon-btn fav ${st.fav[id] ? 'on' : ''}" data-act="fav" data-id="${id}">⭐</button></div>
    <div class="rgrid"><div class="rside">
    ${ph ? `<div class="photo"><img src="img/${id}.jpg" alt=""><a href="${esc(ph.u)}" target="_blank" rel="noopener">Фото: ${esc(ph.a)} · ${esc(ph.l)}</a></div>` : ''}
    <div class="hero">${ph ? '' : tile(r)}<div><h1>${r.name}</h1>
      <p class="muted small">${r.cuisine ? r.cuisine + ' кухня · ' : ''}${CATS[r.cat]} · подготовка ${dur(r.prep)} · готовка ${dur(r.cook)}</p></div></div>
    ${m ? `<div class="note tip">🎯 Количество продуктов подстроено под вашу цель по КБЖУ. <a data-act="unfit" style="color:var(--accent);font-weight:600">Показать исходный рецепт</a></div>` : ''}
    <div class="card"><div class="panel">
      <div class="cell"><small>Программа</small><b>${r.prog}</b></div>
      <div class="cell"><small>Температура</small><b>${r.temp} °C</b></div>
      <div class="cell"><small>Время в аэрогриле${myCook(r) !== r.cook ? ' · ваше' : ''}</small><b>${dur(myCook(r))}</b></div>
      <div class="cell"><small>Функция «Пар»</small><b class="${r.steam ? 'steam-c' : ''}">${r.steam ? '💨 включить' : 'не нужна'}</b></div></div></div>
    ${portionsCard}
    <h2>КБЖУ на 1 порцию</h2>${nutriCells(n)}
    <h2>Продукты на ${p} ${PORT_WORD(p)}</h2>
    <div class="card">${list.map(a => `<div class="ing"><span>${ING[a.id].n}${st.pantry[a.id] ? '<span class="have">дома</span>' : ''}</span><span>${amountText(a)}</span></div>`).join('')}
      ${extras(r, p).map(e => `<div class="ing"><span>${e[0]}</span><span>${e[1] || ''}</span></div>`).join('')}</div>
    <button class="btn ghost" data-act="shop-recipe">🛒 Добавить продукты в список покупок</button>
    ${list.some(a => st.pantry[a.id]) ? `<button class="btn ghost" style="margin-top:8px" data-act="shop-missing">🛒 Только то, чего нет дома (${list.filter(a => !st.pantry[a.id]).length})</button>` : ''}
    </div><div class="rmain">
    <div class="row between"><h2>Приготовление</h2>
      <span class="row"><span class="badge ${nDone === total ? 'ok' : ''}">${nDone} из ${total}</span>${nDone ? '<button class="btn sm ghost" data-act="steps-reset">Сбросить</button>' : ''}</span></div>
    <div class="track" style="margin-bottom:10px"><i style="width:${nDone / total * 100}%"></i></div>
    <button class="btn" style="margin-bottom:10px" data-act="cook-start">▶ Готовить по шагам</button>
    <p class="muted small" style="margin-bottom:8px">Или нажимайте на шаг в списке, когда выполнили его, — отметки сохраняются.</p>
    <div class="card">${r.steps.map((s, i) => `<div class="step ${s.set ? 'cook' : ''} ${done[i] ? 'done' : ''}" data-act="step" data-v="${i}">
      <div class="num">${done[i] ? '✓' : i + 1}</div>
      <div class="grow"><p>${s.t}</p>${s.set ? setBox(s.set, r.name + ' — шаг ' + (i + 1), r.id, i) : ''}</div></div>`).join('')}</div>
    ${nDone === total ? '<div class="note ok">✅ Все шаги выполнены. Приятного аппетита!</div>' : ''}
    ${r.tip ? `<div class="note tip">💡 ${r.tip}</div>` : ''}
    <h2>Мои заметки и оценка</h2>
    <div class="card"><textarea class="note-box" data-note placeholder="Например: у меня готово за 18 минут, соли меньше">${esc(st.notes[id] || '')}</textarea>
      <div class="stars" style="margin-top:12px">${[1, 2, 3, 4, 5].map(v => `<button class="${v <= c.rate ? 'on' : ''}" data-act="rate" data-v="${v}">★</button>`).join('')}</div>
      <p class="small muted" style="margin:6px 0 12px">${c.n ? 'Готовили ' + c.n + ' ' + (c.n % 10 === 1 && c.n !== 11 ? 'раз' : c.n % 10 >= 2 && c.n % 10 <= 4 && (c.n < 10 || c.n > 20) ? 'раза' : 'раз') + ', последний — ' + new Date(c.last).toLocaleDateString('ru-RU') : 'Вы ещё не готовили это блюдо'}${c.rate && c.rate <= 2 ? '. С такой оценкой блюдо не попадёт в меню.' : ''}</p>
      <button class="btn ghost" data-act="cooked">✓ Отметить, что приготовил</button>
      ${c.n ? '<button class="btn sm ghost" style="margin-top:8px;width:100%" data-act="uncooked">Убрать одну отметку</button>' : ''}</div>
    </div></div>`;
}
// Режим готовки: один шаг на экран крупным текстом. Экран −1 — список продуктов.
function viewCook(id, fit) {
  const r = byId(id);
  if (!r) return '<div class="empty">Рецепт не найден</div>';
  const m = fit ? st.adapt[id] : null;
  if (rv.id !== id || rv.fit !== !!m) Object.assign(rv, { id, fit: !!m, portions: m ? 1 : r.serves });
  if (rv.cookId !== id) Object.assign(rv, { cookId: id, cook: -1 });
  const i = rv.cook, total = r.steps.length, s = r.steps[i];
  const body = i < 0
    ? `<h1 style="margin:18px 0 6px">Подготовьте продукты</h1><p class="muted" style="margin-bottom:12px">На ${rv.portions} ${rv.portions === 1 ? 'порцию' : rv.portions < 5 ? 'порции' : 'порций'}</p>
      <div class="card">${amounts(r, rv.portions, m).map(a => `<div class="ing"><span>${ING[a.id].n}</span><span>${amountText(a)}</span></div>`).join('')}
      ${extras(r, rv.portions).map(e => `<div class="ing"><span>${e[0]}</span><span>${e[1] || ''}</span></div>`).join('')}</div>`
    : `<p class="cook-text">${s.t}</p>${s.set ? setBox(s.set, r.name + ' — шаг ' + (i + 1), r.id, i) : ''}`;
  return `<div class="row between"><button class="icon-btn" data-act="cook-exit">✕</button>
      <span class="row">${canSpeak() ? `<button class="icon-btn ${st.ttsAuto ? 'on-btn' : ''}" data-act="tts" title="Читать шаги вслух">🔊</button>` : ''}
      ${canListen() ? `<button class="icon-btn ${voice.on ? 'on-btn' : ''}" data-act="voice" title="Управление голосом">🎙</button>` : ''}
      <span class="badge">${i < 0 ? 'Продукты' : 'Шаг ' + (i + 1) + ' из ' + total}</span></span></div>
    ${voice.on ? '<p class="small voice-hint">🎙 Слушаю: «дальше», «назад», «таймер», «повтори», «стоп»</p>' : ''}
    <p class="muted small" style="margin:10px 0 6px">${r.name}</p>
    <div class="track"><i style="width:${(i + 1) / total * 100}%"></i></div>
    ${body}
    <p class="small muted swipe-hint">Листайте шаги свайпом влево и вправо</p>
    <div class="cook-nav"><button class="btn ghost" data-act="cook-prev" ${i < 0 ? 'disabled' : ''}>‹ Назад</button>
      <button class="btn" data-act="cook-next">${i === total - 1 ? '✓ Готово' : i < 0 ? 'Начать ›' : 'Сделано, дальше ›'}</button></div>`;
}
// Своё время для шага: если аэрогриль готовит быстрее или медленнее, поправка запоминается для рецепта
const myMin = (rid, i, s) => { const t = (st.mytime[rid] || {})[i]; return t == null ? s.min : t; };
const myCook = r => r.steps.reduce((a, s, i) => a + (s.set ? myMin(r.id, i, s.set) : 0), 0);
function setBox(s, name, rid, i) {
  const mm = rid ? myMin(rid, i, s) : s.min, own = mm !== s.min;
  return `<div class="set"><div class="panel">
      <div class="cell"><small>Программа</small><b>${s.prog}</b></div>
      <div class="cell"><small>Температура</small><b>${s.temp} °C</b></div>
      <div class="cell"><small>Время${own ? ' · ваше' : ''}</small><div class="row between"><b>${dur(mm)}</b>
        ${rid ? `<span class="adj"><button data-act="mytime" data-id="${rid}" data-i="${i}" data-v="-1" title="Меньше">−</button><button data-act="mytime" data-id="${rid}" data-i="${i}" data-v="1" title="Больше">+</button></span>` : ''}</div>
        ${own ? `<small>в рецепте ${dur(s.min)} · <a data-act="mytime-reset" data-id="${rid}" data-i="${i}" style="color:var(--accent)">сбросить</a></small>` : ''}</div>
      <div class="cell"><small>Пар</small><b class="${s.steam ? 'steam-c' : ''}">${s.steam ? '💨 включён' : 'выключен'}</b></div>
      <div class="cell wide"><small>Куда класть</small><b style="white-space:normal;font-size:14px">${s.place}</b></div>
      ${s.fan ? `<div class="cell wide"><small>Обдув</small><b style="white-space:normal;font-size:14px">${s.fan}</b></div>` : ''}</div>
    <button class="btn sm" data-act="timer" data-v="${mm}" data-label="${esc(name)}">⏱ Запустить таймер на ${dur(mm)}</button></div>`;
}

/* ---------- Экран: КБЖУ ---------- */
function viewKbju() {
  const p = st.profile;
  const calc = !st.calcOpen ? '' : `<div style="margin-top:12px">
    ${seg('sex', p.sex, [['m', 'Мужчина'], ['f', 'Женщина']])}
    <div class="fields" style="margin-top:10px">${field('Возраст', 'profile.age', p.age)}${field('Вес, кг', 'profile.weight', p.weight)}${field('Рост, см', 'profile.height', p.height)}</div>
    <div class="field" style="margin-bottom:10px"><label>Активность</label><select data-bind="profile.act">
      ${[[1.2, 'Минимальная — сидячая работа'], [1.375, 'Лёгкая — 1–3 тренировки в неделю'], [1.55, 'Средняя — 3–5 тренировок'], [1.725, 'Высокая — 6–7 тренировок']].map(o => `<option value="${o[0]}" ${+p.act === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div>
    ${seg('goal', p.goal, [['lose', 'Похудение'], ['keep', 'Поддержание'], ['gain', 'Набор массы']])}
    <button class="btn" style="margin-top:10px" data-act="calc">Рассчитать норму</button>
    <p class="muted small" style="margin-top:8px">Формула Миффлина — Сан Жеора. Это ориентир, а не медицинская рекомендация.</p></div>`;
  return `<h1>Подбор по КБЖУ</h1><p class="muted small" style="margin-bottom:12px">Приложение выбирает блюда и пересчитывает количество продуктов под вашу цель</p>
    <div class="card"><div class="row between" style="margin-bottom:10px"><b>Моя норма на день</b>
      <button class="btn sm ghost" data-act="calc-toggle">${st.calcOpen ? 'Скрыть' : '🧮 Рассчитать'}</button></div>
      ${targetFields('target')}${calc}</div>
    ${seg('kmode', st.kmode, [['day', 'На день'], ['week', 'На неделю'], ['dish', 'Один приём']])}
    <div style="height:12px"></div>
    ${st.kmode === 'day' ? kbjuDay() : st.kmode === 'week' ? kbjuWeek() : kbjuDish()}`;
}
const exclChips = () => `<div class="chips wrap" style="margin-bottom:12px">${Object.keys(EXCLUDE).map(k => `<button class="chip ${st.excl[k] ? 'on' : ''}" data-act="excl" data-v="${k}">${EXCLUDE[k].n}</button>`).join('')}</div>`;
function kbjuDay() {
  const m = st.menu, T = tArr(st.target);
  let res = '';
  if (m) {
    const lack = T[3] - m.total[3];
    res = `<h2>Итог за день</h2><div class="card">${bars(m.total, T)}
        ${T[3] > 0 && lack > T[3] * 0.12 ? `<p class="small muted">Не хватает около ${Math.round(lack)} г углеводов — добавьте гарнир, который варится отдельно: ${Math.round(lack / 0.21 / 10) * 10} г готовой гречки или риса.</p>` : ''}</div>
      ${m.slots.map((s, i) => `<div class="slot-h"><h3>${SLOT[s.key]}</h3><button class="btn sm ghost" data-act="swap" data-v="${i}">🔄 Заменить</button></div>
        <div class="card">${s.items.map(miniDish).join('')}</div>`).join('')}
      <div class="card"><div class="row between"><span>Готовим на человек</span>
        <div class="stepper"><button data-act="persons" data-v="-1">−</button><b>${st.persons}</b><button data-act="persons" data-v="1">+</button></div></div></div>
      <button class="btn" data-act="shop-menu">🛒 Продукты меню — в список покупок</button>`;
  }
  return `<div class="card"><div class="small muted" style="margin-bottom:6px">Приёмов пищи</div>
      ${seg('meals', st.meals, [[3, '3'], [4, '4'], [5, '5']])}
      <div class="small muted" style="margin:12px 0 6px">Исключить</div>${exclChips()}
      <button class="btn" data-act="gen">${m ? '🎲 Собрать другое меню' : 'Собрать меню'}</button></div>${res}`;
}
const DAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
const personsCard = () => `<div class="card"><div class="row between"><span>Готовим на человек</span>
  <div class="stepper"><button data-act="persons" data-v="-1">−</button><b>${st.persons}</b><button data-act="persons" data-v="1">+</button></div></div></div>`;
const DAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const slotGroup = k => k === 'b' ? 'b' : k === 'n' ? 'n' : 'm';
function retotal(day) {
  day.total = [0, 0, 0, 0];
  day.slots.forEach(sl => sl.items.forEach(it => it.n.forEach((v, j) => { day.total[j] += v; })));
  day.err = errOf(day.total, tArr(st.target));
}
// Календарь на компьютере: приёмы пищи можно перетаскивать между днями (завтрак — на завтрак, обед и ужин — между собой)
function weekGrid(w, T) {
  return `<div class="weekgrid">${w.days.map((d, di) => {
    const dev = Math.round((d.total[0] - T[0]) / T[0] * 100);
    return `<div class="wday"><div class="wday-h"><b>${DAY_SHORT[di]}</b><span class="badge ${Math.abs(dev) > 8 ? 'warn' : 'ok'}">${Math.round(d.total[0])} ккал</span></div>
      ${d.slots.map((sl, i) => `<div class="wslot" draggable="true" data-d="${di}" data-s="${i}" data-g="${slotGroup(sl.key)}">
        <small>${SLOT[sl.key]}</small>${sl.items.map(it => { const r = byId(it.id); return `<a data-act="open-fit" data-id="${r.id}" data-m='${JSON.stringify(it.m)}' class="wdish">${tile(r)}<span>${r.name}</span></a>`; }).join('')}</div>`).join('')}
      <button class="btn sm ghost" data-act="week-day" data-v="${di}">🎲 Другой день</button></div>`;
  }).join('')}</div><p class="small muted" style="margin-top:8px">Перетаскивайте приёмы пищи между днями мышью: завтрак — на завтрак, обед и ужин — между собой.</p>`;
}
let dragFrom = null;
document.addEventListener('dragstart', e => { const el = e.target.closest && e.target.closest('.wslot'); if (!el) return; dragFrom = el.dataset; e.dataTransfer.setData('text/plain', ''); el.classList.add('dragging'); });
document.addEventListener('dragend', () => { document.querySelectorAll('.wslot').forEach(el => el.classList.remove('dragging', 'drop-ok')); });
document.addEventListener('dragover', e => {
  const el = e.target.closest && e.target.closest('.wslot');
  if (!el || !dragFrom || el.dataset.g !== dragFrom.g) return;
  e.preventDefault();
  el.classList.add('drop-ok');
});
document.addEventListener('dragleave', e => { const el = e.target.closest && e.target.closest('.wslot'); if (el) el.classList.remove('drop-ok'); });
document.addEventListener('drop', e => {
  const el = e.target.closest && e.target.closest('.wslot');
  if (!el || !dragFrom || el.dataset.g !== dragFrom.g) return;
  e.preventDefault();
  const a = st.week.days[+dragFrom.d], b = st.week.days[+el.dataset.d], i = +dragFrom.s, j = +el.dataset.s;
  const tmp = a.slots[i].items; a.slots[i].items = b.slots[j].items; b.slots[j].items = tmp;
  retotal(a); retotal(b);
  dragFrom = null;
  save();
  render(true);
});
function kbjuWeek() {
  const w = st.week, T = tArr(st.target);
  let res = '';
  if (w) {
    const avg = [0, 0, 0, 0], all = [].concat(...w.days.map(d => [].concat(...d.slots.map(s => s.items.map(x => x.id)))));
    w.days.forEach(d => d.total.forEach((v, i) => { avg[i] += v / 7; }));
    const repeats = all.length - new Set(all).size;
    res = `<h2>В среднем за день</h2><div class="card">${bars(avg, T)}
        <p class="small muted">Блюд на неделю: ${all.length}${repeats ? ', из них повторяются ' + repeats + ' — подходящих блюд не хватило' : ', без повторов'}.</p></div>
      <div class="desk-only">${weekGrid(w, T)}</div><div class="mob-only">
      ${w.days.map((d, di) => {
        const open = st.weekOpen === di;
        return `<div class="card"><button class="dayhead" data-act="week-open" data-v="${di}"><span class="grow"><b>${DAYS[di]}</b><br><span class="kb">${kbLine(d.total)}</span></span><span class="muted">${open ? '▾' : '▸'}</span></button>
          ${open ? d.slots.map((sl, i) => `<div class="slot-h"><h3>${SLOT[sl.key]}</h3><button class="btn sm ghost" data-act="week-swap" data-d="${di}" data-v="${i}">🔄 Заменить</button></div>${sl.items.map(miniDish).join('')}`).join('')
            + `<button class="btn sm ghost" style="margin-top:12px;width:100%" data-act="week-day" data-v="${di}">🎲 Пересобрать весь день</button>`
            : `<p class="small muted" style="margin-top:6px">${d.slots.map(sl => sl.items.map(x => byId(x.id).name).join(' + ')).join(' · ')}</p>`}</div>`;
      }).join('')}</div>
      ${personsCard()}<button class="btn" data-act="shop-week">🛒 Продукты на неделю — в список покупок</button>`;
  }
  return `<div class="card"><div class="small muted" style="margin-bottom:6px">Приёмов пищи в день</div>
      ${seg('meals', st.meals, [[3, '3'], [4, '4'], [5, '5']])}
      <div class="small muted" style="margin:12px 0 6px">Исключить</div>${exclChips()}
      <button class="btn" data-act="gen-week">${w ? '🎲 Собрать другую неделю' : 'Собрать меню на неделю'}</button></div>${res}`;
}
function kbjuDish() {
  const T = tArr(st.dishT), res = st.dishRes;
  return `<div class="card"><div class="small muted" style="margin-bottom:6px">Доля от дневной нормы</div>
      <div class="chips wrap" style="margin-bottom:12px">${[['b', 25, 'Завтрак 25%'], ['m', 35, 'Обед 35%'], ['m', 25, 'Ужин 25%'], ['n', 15, 'Перекус 15%']].map(o => `<button class="chip" data-act="share" data-v="${o[1]}" data-t="${o[0]}">${o[2]}</button>`).join('')}</div>
      ${targetFields('dishT')}
      ${seg('dishType', st.dishType, [['b', 'Завтрак'], ['m', 'Основное'], ['n', 'Перекус'], ['any', 'Любое']])}
      <div class="small muted" style="margin:12px 0 6px">Исключить</div>${exclChips()}
      <button class="btn" data-act="find">Подобрать блюда</button></div>
    ${!res ? '' : !res.length ? '<div class="empty">Подходящих блюд нет — снимите часть исключений.</div>' : `<h2>Лучшие совпадения</h2>` + res.map(x => {
      const pct = Math.max(0, Math.round(100 - x.err * 100));
      return `<div class="card"><div class="row between" style="margin-bottom:4px"><span class="badge ${pct >= 90 ? 'ok' : 'warn'}">совпадение ${pct}%</span><span class="kb">${kbLine(x.total)}</span></div>
        ${x.items.map(miniDish).join('')}</div>`;
    }).join('')}`;
}

/* ---------- Экран: покупки ---------- */
function addToShop(list, extras) {
  list.forEach(a => { st.shop.items[a.id] = (st.shop.items[a.id] || 0) + a.g; delete st.shop.done[a.id]; });
  extras.forEach(x => { const t = x.split(' — ')[0]; if (!st.shop.extras.includes(t)) st.shop.extras.push(t); });
  save();
  toast('Добавлено в список покупок');
}
function addMenus(menus) {
  menus.forEach(m => m.slots.forEach(sl => sl.items.forEach(it => { const r = byId(it.id); addToShop(amounts(r, st.persons, it.m), r.extra); })));
}
function viewShop() {
  const ids = Object.keys(st.shop.items);
  if (!ids.length && !st.shop.extras.length) return `<h1>Список покупок</h1><div class="empty">Пока пусто.<br>Добавьте продукты из рецепта или из меню на день.</div>`;
  const check = (key, name, amt) => `<button class="check ${st.shop.done[key] ? 'on' : ''}" data-act="check" data-v="${esc(key)}"><i>✓</i><span class="grow">${name}</span><span class="muted">${amt}</span></button>`;
  const left = ids.filter(i => !st.shop.done[i]).length + st.shop.extras.filter(x => !st.shop.done['x:' + x]).length;
  return `<div class="row between"><h1>Список покупок</h1><button class="btn sm ghost" data-act="shop-clear">Очистить</button></div>
    <p class="muted small" style="margin-bottom:12px">Осталось купить: ${left}</p>
    ${Object.keys(SECTIONS).map(s => {
      const part = ids.filter(i => ING[i].s === s).sort((a, b) => ING[a].n.localeCompare(ING[b].n, 'ru'));
      return !part.length ? '' : `<h2>${SECTIONS[s]}</h2><div class="card">${part.map(i => {
        const g = st.shop.items[i], u = ING[i].u;
        return check(i, ING[i].n, u ? frac(Math.ceil(g / u[1] * 2) / 2) + ' ' + u[0] : g >= 1000 ? num(g / 1000) + ' кг' : roundG(g) + ' г');
      }).join('')}</div>`;
    }).join('')}
    ${st.shop.extras.length ? `<h2>Специи и мелочи</h2><div class="card">${st.shop.extras.map(x => check('x:' + x, x, '')).join('')}</div>` : ''}`;
}

/* ---------- Экран: что есть дома ---------- */
const BASICS = ['oil', 'flour', 'sugar', 'egg', 'onion', 'garlic', 'butter', 'milk', 'potato'];
let pq = '';
// Рецепты, для которых дома есть всё или не хватает до трёх продуктов
function pantryMatch() {
  return RECIPES.map(r => {
    const need = [...new Set(r.ing.map(i => i[0]))], miss = need.filter(id => !st.pantry[id]);
    return { r, miss, need: need.length };
  }).filter(x => x.miss.length <= 3 && x.miss.length < x.need).sort((x, y) => x.miss.length - y.miss.length || y.need - x.need);
}
function pantryChips() {
  const q = pq.trim().toLowerCase(), chip = id => `<button class="chip ${st.pantry[id] ? 'on' : ''}" data-act="pantry" data-v="${id}">${ING[id].n}</button>`;
  const mine = Object.keys(ING).filter(id => st.pantry[id]).sort((x, y) => ING[x].n.localeCompare(ING[y].n, 'ru'));
  // Отмеченное показываем первым блоком: иначе его не видно среди сотни продуктов ниже
  const top = q || !mine.length ? '' : `<h2>Отмечено (${mine.length})</h2><div class="chips wrap">${mine.map(chip).join('')}</div><p class="small muted" style="margin-top:8px">Нажмите на продукт, чтобы убрать его.</p>`;
  return top + Object.keys(SECTIONS).map(sec => {
    const ids = Object.keys(ING).filter(id => ING[id].s === sec && (!q || ING[id].n.toLowerCase().includes(q))).sort((x, y) => ING[x].n.localeCompare(ING[y].n, 'ru'));
    return !ids.length ? '' : `<h2>${SECTIONS[sec]}</h2><div class="chips wrap">${ids.map(chip).join('')}</div>`;
  }).join('') || '<div class="empty">Такого продукта нет в рецептах</div>';
}
function viewPantry() {
  const have = Object.keys(st.pantry).filter(id => st.pantry[id] && ING[id]).length, match = have ? pantryMatch() : [];
  const full = match.filter(x => !x.miss.length), part = match.filter(x => x.miss.length).slice(0, 40);
  const body = st.ptab === 'have'
    ? `<div class="search-wrap"><input class="search" type="search" placeholder="Найти продукт" value="${esc(pq)}" data-psearch></div>
      <div class="row" style="margin-bottom:4px"><button class="btn sm ghost grow" data-act="pantry-basics">+ Базовые продукты</button><button class="btn sm ghost grow" data-act="pantry-clear">Очистить</button></div>
      <p class="small muted">Базовые — масло, мука, сахар, яйца, лук, чеснок, молоко, картофель. Соль и специи отмечать не нужно. Купленное в списке покупок попадает сюда само.</p>
      <div id="pchips">${pantryChips()}</div>`
    : !have ? '<div class="empty">Сначала отметьте продукты на вкладке «Мои продукты».</div>'
    : `<h2>Всё есть — можно готовить (${full.length})</h2>${full.length ? full.map(x => recipeCard(x.r)).join('') : '<p class="muted small">Пока нет блюд, для которых дома есть всё. Посмотрите ниже — возможно, не хватает одного продукта.</p>'}
      <h2>Не хватает 1–3 продуктов (${part.length})</h2>${part.map(x => `<div class="card"><a class="mini" href="#/r/${x.r.id}">${tile(x.r)}<div class="grow"><b>${x.r.name}</b><div class="kb">${kbLine(perServing(x.r))}</div></div><span class="muted">›</span></a>
        <p class="small" style="margin:6px 0 10px">Не хватает: <b>${x.miss.map(id => ING[id].n.toLowerCase()).join(', ')}</b></p>
        <button class="btn sm ghost" style="width:100%" data-act="pantry-buy" data-id="${x.r.id}">🛒 Добавить недостающее в покупки</button></div>`).join('')}`;
  return `<h1>Что есть дома</h1><p class="muted small" style="margin-bottom:12px">Отметьте продукты, которые у вас есть, — приложение подскажет, что из них приготовить</p>
    ${seg('ptab', st.ptab, [['have', 'Мои продукты (' + have + ')'], ['cook', 'Что приготовить (' + full.length + ')']])}
    <div style="height:12px"></div>${body}`;
}

/* ---------- Экран: справка ---------- */
function viewGuide() {
  if (up.state === 'idle') setTimeout(checkUpdate, 0);
  return `<h1>Справка</h1><p class="muted small" style="margin-bottom:12px">Weissgauff WAF 720 DB Steam Fry</p>
    <div class="card" id="upd">${updateInner()}</div>
    <div class="card"><div class="panel">
      <div class="cell"><small>Объём чаши</small><b>7 л</b></div><div class="cell"><small>Мощность</small><b>2100 Вт</b></div>
      <div class="cell"><small>Температура</small><b>50–200 °C</b></div><div class="cell"><small>Таймер</small><b>до 120 мин</b></div>
      <div class="cell"><small>Отложенный старт</small><b>до 24 ч</b></div><div class="cell"><small>Нагрев</small><b>2 ТЭНа, 360°</b></div></div></div>
    <h2>12 программ</h2>
    <div class="card"><table><tr><th>Программа</th><th>Для чего</th><th>Заводские настройки</th></tr>
      ${PROGRAMS.map(p => `<tr><td><b>${p.e} ${p.n}</b></td><td>${p.d}</td><td>${p.f[0]} °C · ${p.f[1]} мин<br><span class="muted">порция ${p.f[2]} · ${p.f[3]}</span></td></tr>`).join('')}</table>
      <p class="small muted" style="margin-top:8px">Значения — из руководства к WAF 720 DB. В рецептах указаны свои температура и время: выберите программу, нажмите кнопку времени или температуры и выставьте их кнопками «+» и «−» (80–200 °C, 1–120 минут). Чем больше порция, тем больше может понадобиться времени.</p></div>
    <h2>⚙️ Панель управления</h2>
    <div class="card"><ul>
      <li><b>Ручной режим</b> — без программы: сами задаёте температуру и время.</li>
      <li><b>Скорость вентилятора</b> — три ступени: F01, F02, F03. Для лёгких продуктов, сушки, безе и блюд с сыром сверху ставьте F01, чтобы ничего не сдувало.</li>
      <li><b>Верхний и нижний ТЭН</b> включаются по отдельности — например, только верхний, чтобы подрумянить сыр.</li>
      <li><b>Отложенный старт</b> — от 1 до 24 часов. Не используйте его для мяса, рыбы и молочного: продукты испортятся, пока ждут.</li>
      <li><b>Пауза</b> — повторное нажатие кнопки «Старт». Если снять чашу, на экране появится «OPEN», нагрев остановится и продолжится, когда вернёте чашу.</li>
      <li>По окончании — 5 сигналов и надпись «End». Вентилятор ещё немного работает, чтобы остудить ТЭН.</li></ul></div>
    <h2>💨 Функция «Пар»</h2>
    <div class="card"><ul><li>Снимите крышку резервуара для воды, налейте чистую холодную воду и закройте крышку.</li>
      <li>Пар включается во время приготовления: нажмите кнопку «Пар» — загорится её индикатор. Если воды не хватает, загорится индикатор отсутствия воды.</li>
      <li>Пар нужен постному мясу, филе птицы, рыбе, рёбрам, котлетам и овощам — они не пересыхают.</li>
      <li>Для хрустящей корочки (фри, крылья, панировка) пар не нужен. В рецептах с глазурью и сыром его отключают на последнем этапе.</li>
      <li>После готовки слейте остатки воды и протрите резервуар.</li></ul></div>
    <h2>🍏 Дегидратор</h2>
    <div class="card"><p class="small muted" style="margin-bottom:8px">Заводская настройка программы — 80 °C и 120 минут, вентилятор F01. Таймер не длиннее 120 минут, поэтому долгую сушку запускайте несколько раз подряд.</p><table><tr><th>Продукт</th><th>Нарезка</th><th>°C</th><th>Время</th></tr>
      <tr><td>Яблоки, груши</td><td>кольца 2–3 мм</td><td>60</td><td>4–6 ч</td></tr>
      <tr><td>Бананы</td><td>кружки 4–5 мм</td><td>65</td><td>4–6 ч</td></tr>
      <tr><td>Помидоры</td><td>половинки черри</td><td>70</td><td>5–7 ч</td></tr>
      <tr><td>Грибы</td><td>пластины 4 мм</td><td>55</td><td>4–6 ч</td></tr>
      <tr><td>Зелень, травы</td><td>веточки</td><td>50</td><td>1,5–3 ч</td></tr>
      <tr><td>Мясо (джерки)</td><td>полоски 3–4 мм</td><td>70</td><td>4–5 ч</td></tr></table></div>
    <h2>🌡 Безопасная температура внутри</h2>
    <div class="card"><table>
      <tr><td>Курица, индейка</td><td><b>75 °C</b></td></tr><tr><td>Котлеты и фарш</td><td><b>72 °C</b></td></tr>
      <tr><td>Свинина</td><td><b>68–70 °C</b></td></tr><tr><td>Говяжий стейк medium</td><td><b>60–63 °C</b></td></tr>
      <tr><td>Рыба</td><td><b>62 °C</b></td></tr></table></div>
    <h2>Как получить лучший результат</h2>
    <div class="card"><ul>
      <li>Обсушивайте продукты — влага мешает появиться корочке.</li>
      <li>Кладите в один слой и заполняйте чашу не больше чем наполовину.</li>
      <li>Мясо и рыбу готовьте на решётке — сок и жир стекают вниз.</li>
      <li>Встряхивайте мелкую нарезку 1–2 раза за готовку. Чашу можно выдвигать — аэрогриль встанет на паузу и продолжит сам.</li>
      <li>Пергамент и фольгу кладите только под продукты и никогда — в пустую чашу при разогреве.</li>
      <li>Используйте масло с высокой точкой дымления, 1–2 чайные ложки достаточно.</li>
      <li>Следите за блюдом через окошко с подсветкой — чашу не нужно открывать.</li></ul></div>
    <h2>Уход и безопасность</h2>
    <div class="card"><ul>
      <li>Дайте прибору остыть, затем вымойте чашу и решётку мягкой губкой без абразивов.</li>
      <li>Ставьте аэрогриль на ровную термостойкую поверхность, оставляя 15 см до стен.</li>
      <li>Не наливайте масло в чашу — это не фритюрница.</li>
      <li>Корпус и выходящий пар горячие: открывайте чашу от себя.</li></ul></div>
    <h2>Фотографии</h2>
    <div class="card"><p class="small">Фото блюд взяты с Wikimedia Commons по свободным лицензиям и служат иллюстрацией: ваше блюдо может выглядеть иначе. Снимки обрезаны и уменьшены.</p>
      <details style="margin-top:8px"><summary class="small muted">Авторы и лицензии (${Object.keys(PHOTOS).length})</summary>
      ${RECIPES.filter(r => PHOTOS[r.id]).map(r => `<p class="small" style="margin-top:6px">${r.name} — <a href="${esc(PHOTOS[r.id].u)}" target="_blank" rel="noopener" style="color:var(--accent)">${esc(PHOTOS[r.id].a)}, ${esc(PHOTOS[r.id].l)}</a></p>`).join('')}</details></div>
    <p class="muted small">КБЖУ рассчитаны по сырому весу продуктов и являются приблизительными.</p>`;
}

/* ---------- Обновление через GitHub ---------- */
// В каждом релизе два файла: www-shellN.zip — страницы и рецепты, ставятся внутри приложения без участия Android;
// AeroGrill.apk — приложение целиком, нужно, только если страницам требуется оболочка новее установленной (N > SHELL).
const REPO = 'DedMazay321/AeroGrill';
let VERSION = null, SHELL = 0; // в браузере версии нет — её сообщает Android-оболочка
try { VERSION = window.AndroidBridge.getVersion(); } catch (e) { /* открыто в браузере */ }
try { SHELL = window.AndroidBridge.getShell(); } catch (e) { /* оболочка до версии 1.4 */ }
// Сайт в браузере: обновляется сам при каждом открытии, проверять релизы не нужно
const WEB = !window.AndroidBridge;
if (WEB && typeof WEB_VERSION !== 'undefined') VERSION = WEB_VERSION;
const up = { state: 'idle', list: [], pct: 0, msg: '' };
function verCmp(a, b) {
  const x = a.split('.'), y = b.split('.');
  for (let i = 0; i < 3; i++) { const d = (+x[i] || 0) - (+y[i] || 0); if (d) return d; }
  return 0;
}
const hasUpdate = () => !!(VERSION && st.updNew && verCmp(st.updNew, VERSION) > 0);
const latest = () => up.list.find(r => r.url || r.web);
const canWeb = r => !!(r && r.web && SHELL && r.shell <= SHELL);
const ruDate = d => d.slice(8, 10) + '.' + d.slice(5, 7) + '.' + d.slice(0, 4);
async function checkUpdate() {
  if (WEB) return;
  if (up.state === 'checking' || up.state === 'downloading' || up.state === 'ready') return;
  up.state = 'checking';
  drawUpdate();
  try {
    const res = await fetch('https://api.github.com/repos/' + REPO + '/releases?per_page=10', { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    up.list = (await res.json()).filter(r => !r.draft && !r.prerelease).map(r => {
      const web = r.assets.find(a => /^www-shell\d+\.zip$/.test(a.name));
      return {
        v: r.tag_name.replace(/^v/, ''), notes: r.body || '', date: r.published_at.slice(0, 10),
        url: (r.assets.find(a => a.name.endsWith('.apk')) || {}).browser_download_url,
        web: web && web.browser_download_url, shell: web ? +web.name.match(/\d+/)[0] : 0
      };
    });
    const last = latest();
    st.updNew = last ? last.v : null;
    st.updSeen = Date.now();
    save();
    up.state = hasUpdate() ? 'available' : 'latest';
    // Обновление страниц качаем сами и включаем при следующем запуске, чтобы не прерывать готовку
    if (hasUpdate() && st.autoUpd && canWeb(last)) installUpdate(true);
  } catch (e) {
    up.state = 'error';
    up.msg = 'Не удалось проверить обновления. Проверьте интернет и попробуйте ещё раз.';
  }
  drawUpdate();
}
function installUpdate(background) {
  const last = latest();
  if (!last) return;
  if (canWeb(last)) {
    up.state = 'downloading'; up.pct = 0;
    window.AndroidBridge.installWeb(last.web, last.v, !background);
  } else if (!last.url) return;
  else if (window.AndroidBridge && window.AndroidBridge.installUpdate) {
    up.state = 'downloading'; up.pct = 0;
    window.AndroidBridge.installUpdate(last.url);
  } else window.open(last.url);
  drawUpdate();
}
// Эти функции вызывает Android-оболочка во время загрузки
window.onUpdateProgress = pct => { up.state = pct >= 100 ? 'confirm' : 'downloading'; up.pct = pct; drawUpdate(); };
window.onUpdateError = msg => { up.state = 'error'; up.msg = 'Не удалось установить обновление: ' + msg; drawUpdate(); };
window.onWebReady = v => { up.state = 'ready'; up.readyV = v; drawUpdate(); toast('Версия ' + v + ' загружена и включится при следующем запуске'); };
const notesHtml = t => esc(t).replace(/\r?\n/g, '<br>');
function updateInner() {
  if (WEB) return `<b>Версия ${esc(VERSION || '')}</b><div class="muted small">Сайт обновляется сам при каждом открытии</div>
    <p class="small" style="margin-top:10px"><b>Как поставить на телефон или компьютер</b><br>
    iPhone: откройте сайт в Safari → кнопка «Поделиться» → «На экран „Домой“».<br>
    Android: меню Chrome → «Добавить на главный экран» (или установите приложение APK).<br>
    Компьютер: значок установки справа в адресной строке Chrome или Edge.</p>
    <p class="small muted" style="margin-top:8px">Избранное, отметки и список покупок хранятся в этом браузере на этом устройстве.</p>`;
  const last = latest(), s = up.state, web = canWeb(last);
  const body = s === 'checking' ? '<p class="muted small" style="margin-top:10px">Проверяю обновления…</p>'
    : s === 'available' ? `<div class="note tip" style="margin:12px 0"><b>Доступна версия ${esc(last.v)}</b> от ${ruDate(last.date)}<br>${notesHtml(last.notes)}</div>
        <button class="btn" data-act="upd-install">${web ? '⬇️ Обновить сейчас' : '⬇️ Скачать и установить'}</button>
        <p class="muted small" style="margin-top:8px">${web ? 'Обновление ставится внутри приложения за несколько секунд — подтверждать в Android ничего не нужно.' : 'Это обновление меняет саму программу, поэтому Android попросит подтвердить установку.'} Подойдёт любой интернет. Избранное и отметки сохранятся.</p>`
    : s === 'downloading' ? `<p class="small" style="margin:12px 0 6px">Загрузка обновления… ${up.pct}%</p><div class="track"><i style="width:${up.pct}%"></i></div>`
    : s === 'ready' ? `<div class="note ok" style="margin:12px 0">Версия ${esc(up.readyV)} загружена и включится при следующем запуске приложения.</div><button class="btn" data-act="upd-apply">Включить сейчас</button>`
    : s === 'confirm' ? '<div class="note ok" style="margin:12px 0 0">Обновление загружено. Подтвердите установку в окне Android. Если телефон просит разрешить установку из этого приложения — разрешите и нажмите «Скачать и установить» ещё раз.</div><button class="btn ghost" style="margin-top:10px" data-act="upd-install">Повторить установку</button>'
    : s === 'latest' ? '<p class="small" style="margin-top:10px"><span class="badge ok">У вас последняя версия</span></p>'
    : s === 'error' ? `<div class="note" style="margin:12px 0 0">${esc(up.msg)}</div>` : '';
  const history = !up.list.length ? '' : `<details style="margin-top:12px"><summary class="small muted">История версий</summary>
    ${up.list.map(r => `<p class="small" style="margin-top:8px"><b>${esc(r.v)}</b> <span class="muted">· ${ruDate(r.date)}${r.v === VERSION ? ' · установлена' : ''}</span><br>${notesHtml(r.notes)}</p>`).join('')}</details>`;
  return `<div class="row between"><div><b>Версия приложения</b><div class="muted small">${VERSION ? esc(VERSION) : 'открыто в браузере'}</div></div>
    ${s === 'checking' || s === 'downloading' ? '' : '<button class="btn sm ghost" data-act="upd-check">🔄 Проверить обновления</button>'}</div>${body}
    ${SHELL ? `<button class="check ${st.autoUpd ? 'on' : ''}" style="margin-top:8px" data-act="upd-auto"><i>✓</i><span class="grow" style="text-decoration:none;opacity:1">Обновлять автоматически<br><span class="muted small">Новые рецепты и исправления загружаются сами при запуске</span></span></button>` : ''}${history}`;
}
function drawUpdate() {
  const el = $('#upd'), b = $('#updb');
  if (el) el.innerHTML = updateInner();
  if (b) b.innerHTML = updateBanner();
}
const updateBanner = () => WEB ? '' : up.state === 'ready' ? `<a class="note ok" style="display:block" data-act="upd-apply">✅ Версия ${esc(up.readyV)} загружена — нажмите, чтобы включить</a>`
  : hasUpdate() && up.state !== 'downloading' ? `<a class="note tip" style="display:block" href="#/guide">🆕 Доступна версия ${esc(st.updNew)} — нажмите, чтобы обновить</a>` : '';

/* ---------- Таймеры ---------- */
const bridge = (fn, ...a) => { try { if (window.AndroidBridge) window.AndroidBridge[fn](...a); } catch (e) { /* в браузере моста нет */ } };
const MAX_TIMERS = 4;
// До версии 1.3 таймер был один и хранился в st.timer
st.timers = st.timers || (st.timer ? [Object.assign({ id: 1 }, st.timer)] : []);
st.timer = null;
function startTimer(min, label) {
  if (st.timers.length >= MAX_TIMERS) { toast('Одновременно работает не больше ' + MAX_TIMERS + ' таймеров'); return false; }
  const id = st.timerSeq = (st.timerSeq || 1) % 1000 + 1;
  st.timers.push({ id, end: Date.now() + min * 60000, label });
  save();
  bridge('startTimer', id, Math.round(min * 60), label);
  tick();
  return true;
}
function stopTimer(id) { st.timers = st.timers.filter(t => t.id !== id); save(); bridge('cancelTimer', id); tick(); }
function addMinute(id) {
  const t = st.timers.find(x => x.id === id);
  if (!t) return;
  t.end += 60000;
  save();
  bridge('startTimer', id, Math.ceil((t.end - Date.now()) / 1000), t.label);
  tick();
}
let audioCtx;
function audio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) { /* звук недоступен */ }
  return audioCtx;
}
// Пока идёт таймер или открыт режим готовки, экран не гаснет (в приложениях это делает оболочка)
let wakeLock = null, wakePending = false;
function keepAwake() {
  if (!WEB || !navigator.wakeLock) return;
  const want = st.timers.length > 0 || document.body.classList.contains('cooking');
  if (want && !wakeLock && !wakePending && document.visibilityState === 'visible') {
    wakePending = true;
    navigator.wakeLock.request('screen').then(l => { wakeLock = l; l.addEventListener('release', () => { wakeLock = null; }); })
      .catch(() => { /* не разрешено */ }).then(() => { wakePending = false; });
  } else if (!want && wakeLock) { wakeLock.release(); wakeLock = null; }
}
function beep() {
  try {
    const ctx = audio();
    [0, 0.35, 0.7, 1.4, 1.75, 2.1].forEach(t => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.35, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.3);
    });
  } catch (e) { /* звук недоступен */ }
  if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400]);
}
function clock(ms) {
  const left = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(left / 3600), m = Math.floor(left % 3600 / 60), pad = v => String(v).padStart(2, '0');
  return (h ? h + ':' + pad(m) : m) + ':' + pad(left % 60);
}
let barKey = '', finished = [];
function tick() {
  const bar = $('#timerbar'), now = Date.now(), done = st.timers.filter(t => t.end <= now);
  if (done.length) {
    st.timers = st.timers.filter(t => t.end > now);
    save();
    beep();
    finished = finished.concat(done.map(t => t.label));
    $('#modal').innerHTML = `<div class="box"><div class="big">🔔</div><h1>Время вышло!</h1><p class="muted" style="margin:8px 0 18px">${finished.map(esc).join('<br>')}</p><button class="btn" data-act="modal-close">Готово</button></div>`;
    $('#modal').hidden = false;
  }
  const list = st.timers.slice().sort((x, y) => x.end - y.end), key = list.map(t => t.id).join();
  // Разметку пересобираем только при смене состава таймеров, иначе нажатие на кнопку может потеряться
  if (key !== barKey) {
    barKey = key;
    bar.hidden = !list.length;
    bar.innerHTML = list.map(t => `<div class="trow"><div class="time" data-t="${t.id}"></div><div class="grow lbl">${esc(t.label)}</div><button data-act="timer-add" data-v="${t.id}">+1 мин</button><button data-act="timer-stop" data-v="${t.id}">Стоп</button></div>`).join('');
    $('#view').style.paddingBottom = list.length ? `calc(var(--nav-h) + ${40 + list.length * 64}px + env(safe-area-inset-bottom))` : '';
  }
  list.forEach(t => { bar.querySelector(`[data-t="${t.id}"]`).textContent = clock(t.end - now); });
  keepAwake();
}
setInterval(tick, 500);

let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2200); }

/* ---------- Голос и чтение вслух в режиме готовки ---------- */
const NATIVE_VOICE = !!(window.AndroidBridge && window.AndroidBridge.startVoice);
const WebRec = window.SpeechRecognition || window.webkitSpeechRecognition;
const canListen = () => NATIVE_VOICE || (WEB && !!WebRec);
const canSpeak = () => !!(window.AndroidBridge && window.AndroidBridge.speak) || (WEB && 'speechSynthesis' in window);
const voice = { on: false, rec: null };
function speak(text) {
  const t = String(text).replace(/<[^>]+>/g, '');
  if (window.AndroidBridge && window.AndroidBridge.speak) return bridge('speak', t);
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = 'ru-RU';
    speechSynthesis.speak(u);
  } catch (e) { /* озвучка недоступна */ }
}
function speakStep() {
  const r = byId(rv.cookId);
  if (!r) return;
  if (rv.cook < 0) speak('Подготовьте продукты: ' + amounts(r, rv.portions, rv.fit ? st.adapt[r.id] : null).map(a => ING[a.id].n).join(', '));
  else speak('Шаг ' + (rv.cook + 1) + '. ' + r.steps[rv.cook].t);
}
function runAct(name, v, el) { if (ACTIONS[name](v, el) !== false) { save(); render(true); } }
// Голосовые команды: распознанная фраза → действие в режиме готовки
window.onVoice = text => {
  const t = String(text).toLowerCase();
  if (/дальше|далее|следующ|вперёд|вперед|готово|сделано/.test(t)) runAct('cook-next');
  else if (/назад|предыдущ|верни/.test(t)) runAct('cook-prev');
  else if (/таймер|засеки|засечь/.test(t)) { const b = $('[data-act=timer]'); if (b) runAct('timer', b.dataset.v, b); else toast('В этом шаге нет таймера'); }
  else if (/повтор|прочитай|читай|ещё раз|еще раз/.test(t)) speakStep();
  else if (/стоп|хватит|выключи/.test(t)) { voiceStop(); render(true); }
};
window.onVoiceState = (on, msg) => { voice.on = !!on; if (msg) toast(msg); if (document.body.classList.contains('cooking')) render(true); };
function voiceStart() {
  voice.on = true;
  if (NATIVE_VOICE) return bridge('startVoice');
  try {
    const rec = voice.rec = new WebRec();
    rec.lang = 'ru-RU'; rec.continuous = true; rec.interimResults = false;
    rec.onresult = e => window.onVoice(e.results[e.results.length - 1][0].transcript);
    rec.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'network') { voice.on = false; toast('Голосовое управление недоступно в этом браузере'); render(true); } };
    rec.onend = () => { if (voice.on) try { rec.start(); } catch (e) { /* уже запущено */ } };
    rec.start();
  } catch (e) { voice.on = false; toast('Голосовое управление недоступно'); }
}
function voiceStop() {
  voice.on = false;
  if (NATIVE_VOICE) bridge('stopVoice');
  else if (voice.rec) try { voice.rec.stop(); } catch (e) { /* уже остановлено */ }
}
// Свайп влево — следующий шаг, вправо — предыдущий
let touch0 = null;
document.addEventListener('touchstart', e => { touch0 = document.body.classList.contains('cooking') ? e.touches[0] : null; }, { passive: true });
document.addEventListener('touchend', e => {
  if (!touch0) return;
  const t = e.changedTouches[0], dx = t.clientX - touch0.clientX, dy = t.clientY - touch0.clientY;
  touch0 = null;
  if (Math.abs(dx) > 70 && Math.abs(dy) < 60) runAct(dx < 0 ? 'cook-next' : 'cook-prev');
}, { passive: true });

/* ---------- Маршруты и события ---------- */
function render(keepScroll) {
  const [, page, id, ...rest] = location.hash.split('/');
  const cook = page === 'r' && rest.includes('cook'), mode = rest.includes('fit') ? 'fit' : '';
  document.body.classList.toggle('cooking', cook);
  document.body.classList.toggle('catalog', page !== 'r' && (!page || page === '' || page === 'today'));
  document.body.classList.toggle('recipe', page === 'r' && !cook);
  document.body.classList.toggle('kbju-wide', page === 'kbju' && st.kmode === 'week');
  const tab = page === 'kbju' || page === 'shop' || page === 'guide' || page === 'pantry' ? page : 'recipes';
  if (!cook && voice.on) voiceStop();
  const y = window.scrollY;
  $('#view').innerHTML = cook ? viewCook(id, mode === 'fit') : page === 'r' ? viewRecipe(id, mode === 'fit') : tab === 'kbju' ? viewKbju() : tab === 'shop' ? viewShop() : tab === 'guide' ? viewGuide() : tab === 'pantry' ? viewPantry() : page === 'today' ? viewToday() : viewRecipes();
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.tab === (page === 'r' && mode === 'fit' ? 'kbju' : tab)));
  window.scrollTo(0, keepScroll && !cook ? y : 0);
}
window.addEventListener('hashchange', () => render(false));

const ACTIONS = {
  cat: v => { st.cat = v; },
  'feature-next': () => { st.featOff = (st.featOff || 0) + 1; },
  flt: v => { st.flt[v] = !st.flt[v]; },
  fav: (v, el) => { st.fav[el.dataset.id] = !st.fav[el.dataset.id]; },
  back: () => { if (history.length > 1) history.back(); else location.hash = '#/'; return false; },
  unfit: () => { location.replace('#/r/' + rv.id); return false; },
  portions: v => { setPortions(rv.portions + +v); },
  'portions-set': v => { setPortions(+v); },
  'shop-missing': () => { const r = byId(rv.id); addToShop(amounts(r, rv.portions, rv.fit ? st.adapt[r.id] : null).filter(a => !st.pantry[a.id]), r.extra); return false; },
  step: v => { const d = st.steps[rv.id] = st.steps[rv.id] || {}; if (d[v]) delete d[v]; else d[v] = 1; },
  'steps-reset': () => { delete st.steps[rv.id]; },
  'cook-start': () => {
    const r = byId(rv.id), done = st.steps[r.id] || {}, next = r.steps.findIndex((s, i) => !done[i]);
    Object.assign(rv, { cookId: r.id, cook: doneCount(r) && next >= 0 ? next : -1 });
    location.hash = '#/r/' + r.id + (rv.fit ? '/fit' : '') + '/cook';
    return false;
  },
  'cook-prev': () => { rv.cook = Math.max(-1, rv.cook - 1); if (st.ttsAuto) setTimeout(speakStep, 50); },
  'cook-next': () => {
    const r = byId(rv.cookId);
    if (rv.cook >= 0) (st.steps[r.id] = st.steps[r.id] || {})[rv.cook] = 1;
    if (rv.cook < r.steps.length - 1) { rv.cook++; if (st.ttsAuto) setTimeout(speakStep, 50); return; }
    save();
    markCooked(r.id);
    toast('Готово! Блюдо отмечено как приготовленное — поставьте оценку');
    history.back();
    return false;
  },
  'cook-exit': () => { history.back(); return false; },
  tts: () => { st.ttsAuto = !st.ttsAuto; if (st.ttsAuto) speakStep(); else speak(''); },
  voice: () => { if (voice.on) voiceStop(); else voiceStart(); },
  mytime: (v, el) => {
    const r = byId(el.dataset.id), i = +el.dataset.i, s = r.steps[i].set, cur = myMin(r.id, i, s), step = s.min >= 90 ? 10 : 1;
    const t = (st.mytime[r.id] = st.mytime[r.id] || {});
    t[i] = Math.max(1, cur + step * +v);
    if (t[i] === s.min) delete t[i];
  },
  'mytime-reset': (v, el) => { const t = st.mytime[el.dataset.id]; if (t) delete t[el.dataset.i]; },
  'tw-time': v => { st.tw.time = +v; },
  'tw-kind': v => { st.tw.kind = v; },
  'tw-home': v => { st.tw.home = v; },
  'tw-more': () => { st.tw.seed++; },
  timer: (v, el) => { if (startTimer(+v, el.dataset.label)) toast('Таймер запущен — не забудьте нажать «Старт» на аэрогриле'); return false; },
  'timer-stop': v => { stopTimer(+v); return false; },
  'timer-add': v => { addMinute(+v); return false; },
  'modal-close': () => { $('#modal').hidden = true; finished = []; return false; },
  'shop-recipe': () => { const r = byId(rv.id); addToShop(amounts(r, rv.portions, rv.fit ? st.adapt[r.id] : null), r.extra); return false; },
  'shop-menu': () => { addMenus([st.menu]); return false; },
  'shop-clear': () => { st.shop = { items: {}, extras: [], done: {} }; },
  check: v => { st.shop.done[v] = !st.shop.done[v]; if (st.shop.done[v] && ING[v]) st.pantry[v] = true; },
  ptab: v => { st.ptab = v; },
  pantry: v => { st.pantry[v] = !st.pantry[v]; },
  'pantry-basics': () => {
    const added = BASICS.filter(id => !st.pantry[id]);
    added.forEach(id => { st.pantry[id] = true; });
    toast(added.length ? 'Отмечено базовых продуктов: ' + added.length : 'Базовые продукты уже отмечены');
  },
  'pantry-clear': () => { st.pantry = {}; toast('Список очищен'); },
  'pantry-buy': (v, el) => {
    const r = byId(el.dataset.id);
    addToShop(amounts(r, r.serves).filter(x => !st.pantry[x.id]), []);
    return false;
  },
  rate: v => { const c = st.cooked[rv.id] = st.cooked[rv.id] || { n: 0, rate: 0, last: 0 }; c.rate = c.rate === +v ? 0 : +v; },
  cooked: () => { markCooked(rv.id); toast('Отмечено'); },
  uncooked: () => { const c = st.cooked[rv.id]; if (c && c.n) c.n--; },
  'open-fit': (v, el) => { st.adapt[el.dataset.id] = JSON.parse(el.dataset.m); save(); location.hash = '#/r/' + el.dataset.id + '/fit'; return false; },
  kmode: v => { st.kmode = v; },
  'calc-toggle': () => { st.calcOpen = !st.calcOpen; },
  sex: v => { st.profile.sex = v; },
  goal: v => { st.profile.goal = v; },
  calc: () => { calcTarget(); st.calcOpen = false; st.menu = null; st.week = null; toast('Норма рассчитана'); },
  meals: v => { st.meals = +v; },
  excl: v => { st.excl[v] = !st.excl[v]; },
  persons: v => { st.persons = Math.min(8, Math.max(1, st.persons + +v)); },
  gen: () => { genMenu(); if (!st.menu) toast('Не из чего собрать меню — снимите часть исключений'); },
  swap: v => { st.menu = swapIn(st.menu, +v, {}); },
  'gen-week': () => { genWeek(); if (!st.week) toast('Не из чего собрать неделю — снимите часть исключений'); },
  'week-open': v => { st.weekOpen = st.weekOpen === +v ? -1 : +v; },
  'week-swap': (v, el) => { const d = +el.dataset.d; st.week.days[d] = swapIn(st.week.days[d], +v, otherDays(d)); },
  'week-day': v => { const m = makeMenu(tArr(st.target), otherDays(+v), 300); if (m) st.week.days[+v] = m; },
  'shop-week': () => { addMenus(st.week.days); return false; },
  share: (v, el) => { N4.forEach(n => { st.dishT[n] = Math.round(st.target[n] * v / 100); }); st.dishType = el.dataset.t; st.dishRes = null; },
  dishType: v => { st.dishType = v; },
  find: () => { findDishes(); },
  'upd-check': () => { checkUpdate(); return false; },
  'upd-install': () => { installUpdate(false); return false; },
  'upd-apply': () => { bridge('reloadWeb'); return false; },
  'upd-auto': () => { st.autoUpd = !st.autoUpd; save(); drawUpdate(); return false; }
};
document.addEventListener('click', e => {
  if (!audioCtx) audio();
  const el = e.target.closest('[data-act]');
  if (!el) return;
  e.preventDefault();
  if (ACTIONS[el.dataset.act](el.dataset.v, el) === false) return;
  save();
  render(true);
});
document.addEventListener('keydown', e => {
  const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
  if (e.key === '/' && !typing) {
    const box = $('[data-search]') || $('[data-psearch]');
    if (box) { e.preventDefault(); box.focus(); }
  } else if (!typing && document.body.classList.contains('cooking') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
    runAct(e.key === 'ArrowRight' ? 'cook-next' : 'cook-prev');
  } else if (e.key === 'Escape') {
    if (!$('#modal').hidden) { $('#modal').hidden = true; finished = []; }
    else if (typing) document.activeElement.blur();
    else if (location.hash.startsWith('#/r/')) history.back();
  }
});
document.addEventListener('change', e => {
  if (e.target.dataset.sel) { st[e.target.dataset.sel] = e.target.value; save(); $('#list').innerHTML = listHtml(); return; }
  const bind = e.target.dataset.bind;
  if (!bind) return;
  const [obj, key] = bind.split('.');
  st[obj][key] = Math.max(0, parseFloat(String(e.target.value).replace(',', '.')) || 0);
  save();
});
document.addEventListener('input', e => {
  if (e.target.matches('[data-note]')) { const v = e.target.value.trim(); if (v) st.notes[rv.id] = e.target.value; else delete st.notes[rv.id]; save(); return; }
  if (e.target.matches('[data-psearch]')) { pq = e.target.value; $('#pchips').innerHTML = pantryChips(); return; }
  if (!e.target.matches('[data-search]')) return;
  st.q = e.target.value;
  $('#list').innerHTML = listHtml();
});

render(false);
tick();
if ($('#sidever')) $('#sidever').textContent = VERSION ? 'Версия ' + VERSION : '';
// Сайт: работа без интернета и просьба не удалять данные при нехватке места
if (WEB && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  // Когда на сайте вышла новая версия, её служебный скрипт активируется — один раз перезагружаем страницу,
  // чтобы сразу показать новое (при самом первом открытии перезагрузка не нужна)
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => {});
}
if (WEB && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
// Оболочка ждёт этот сигнал: скачанный комплект страниц, который так и не запустился, она удалит
bridge('webOk');
if (VERSION && st.seenVersion && st.seenVersion !== VERSION) toast('Приложение обновлено до версии ' + VERSION);
if (VERSION && st.seenVersion !== VERSION) { st.seenVersion = VERSION; save(); }
// Раз в 6 часов при запуске тихо проверяем, не вышла ли новая версия
if (VERSION && Date.now() - (st.updSeen || 0) > 6 * 3600000) checkUpdate();
