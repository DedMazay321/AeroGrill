'use strict';
/* ---------- Состояние ---------- */
const LS_KEY = 'aerogrill.v1';
const st = Object.assign({
  fav: {}, cat: 'all', flt: {}, q: '',
  profile: { sex: 'm', age: 30, weight: 75, height: 175, act: 1.375, goal: 'keep' },
  target: null, meals: 4, excl: {}, persons: 1, kmode: 'day', calcOpen: false,
  dishT: { k: 550, p: 40, f: 18, c: 50 }, dishType: 'm', dishRes: null, menu: null,
  adapt: {}, steps: {}, shop: { items: {}, extras: [], done: {} }, timer: null, sort: 'def'
}, load());

function load() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (e) { return {}; } }
function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(st)); } catch (e) { /* хранилище недоступно */ } }

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
function amountText(a) {
  const ing = ING[a.id];
  if (a.pcs != null) return frac(a.pcs) + ' ' + ing.u[0] + ' (≈' + a.g + ' г)';
  const sp = SPOON[a.id];
  if (!sp || a.g > sp[1] * 6) return a.g + ' г';
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

const allowed = r => !Object.keys(st.excl).some(k => st.excl[k] && r.ing.some(i => EXCLUDE[k].x.includes(ING[i[0]].x)));
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
function genMenu() {
  const T = tArr(st.target), plan = PLAN[st.meals];
  let best = null;
  for (let it = 0; it < 400; it++) {
    const used = {}, slots = [];
    for (const key of plan) {
      const opts = slotOptions(key, used);
      if (!opts.length) continue;
      const ids = pick(opts);
      ids.forEach(id => { used[id] = 1; });
      slots.push({ key, ids });
    }
    if (!slots.length) break;
    const m = buildMenu(slots, T);
    if (!best || m.err < best.err) best = m;
  }
  st.menu = best;
}
function swapSlot(idx) {
  const T = tArr(st.target), cur = st.menu.slots, used = {};
  cur.forEach((s, i) => { if (i !== idx) s.items.forEach(x => { used[x.id] = 1; }); });
  used[cur[idx].items[0].id] = 1;
  const variants = slotOptions(cur[idx].key, used).map(ids =>
    buildMenu(cur.map((s, i) => ({ key: s.key, ids: i === idx ? ids : s.items.map(x => x.id) })), T));
  if (!variants.length) return toast('Других подходящих блюд нет');
  variants.sort((a, b) => a.err - b.err);
  st.menu = pick(variants.slice(0, 4));
}

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

/* ---------- Экран: каталог ---------- */
function recipeMatches(r) {
  if (st.cat !== 'all' && r.cat !== st.cat) return false;
  if (st.flt.fav && !st.fav[r.id]) return false;
  if (st.flt.steam && !r.steam) return false;
  if (st.flt.fast && r.prep + r.cook > 30) return false;
  if (st.flt.protein && perServing(r)[1] < 25) return false;
  if (st.flt.light && perServing(r)[0] > 350) return false;
  const q = st.q.trim().toLowerCase();
  return !q || r.name.toLowerCase().includes(q) || r.prog.toLowerCase().includes(q) || r.ing.some(i => ING[i[0]].n.toLowerCase().includes(q));
}
function recipeCard(r) {
  return `<a class="rcard" href="#/r/${r.id}">${tile(r)}<div class="grow"><h3>${r.name}</h3>
    <div class="meta"><span>⏱ ${dur(r.prep + r.cook)}</span><span>«${r.prog}» ${r.temp} °C</span>${r.steam ? '<span class="steam">💨 пар</span>' : ''}${doneCount(r) ? `<span class="badge ${doneCount(r) === r.steps.length ? 'ok' : ''}">шаги ${doneCount(r)}/${r.steps.length}</span>` : ''}</div>
    <div class="kb">${kbLine(perServing(r))}</div></div>
    <button class="fav ${st.fav[r.id] ? 'on' : ''}" data-act="fav" data-id="${r.id}">⭐</button></a>`;
}
const SORTS = {
  def: ['По разделам', null],
  time: ['Сначала быстрые', (a, b) => a.prep + a.cook - b.prep - b.cook],
  kcal: ['Меньше калорий', (a, b) => perServing(a)[0] - perServing(b)[0]],
  protein: ['Больше белка', (a, b) => perServing(b)[1] - perServing(a)[1]],
  name: ['По алфавиту', (a, b) => a.name.localeCompare(b.name, 'ru')]
};
function listHtml() {
  const list = RECIPES.filter(recipeMatches), sort = (SORTS[st.sort] || SORTS.def)[1];
  if (sort) list.sort(sort);
  return `<div class="row between" style="margin-bottom:10px"><span class="muted small">Найдено: ${list.length}</span>
      <select class="sortsel" data-sel="sort">${Object.keys(SORTS).map(k => `<option value="${k}" ${st.sort === k ? 'selected' : ''}>${SORTS[k][0]}</option>`).join('')}</select></div>`
    + (list.length ? list.map(recipeCard).join('') : '<div class="empty">Ничего не найдено.<br>Измените запрос или фильтры.</div>');
}
function viewRecipes() {
  const flt = [['fav', '⭐ Избранное'], ['fast', '⏱ До 30 минут'], ['steam', '💨 С паром'], ['protein', '💪 Белок от 25 г'], ['light', '🥗 До 350 ккал']];
  return `<div id="updb">${updateBanner()}</div><h1>Рецепты для аэрогриля</h1><p class="muted small">${RECIPES.length} рецептов · Weissgauff WAF 720 DB Steam Fry</p>
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
  if (rv.id !== id || rv.fit !== !!m) Object.assign(rv, { id, fit: !!m, portions: m ? 1 : r.serves });
  const done = st.steps[id] || {}, nDone = doneCount(r), total = r.steps.length;
  const list = amounts(r, rv.portions, m), n = nutri(list).map(v => v / rv.portions), ph = PHOTOS[id];
  const load = list.reduce((a, x) => a + x.g, 0) / r.ing.reduce((a, i) => a + i[1], 0);
  return `<div class="top"><button class="icon-btn" data-act="back">‹</button>
      <button class="icon-btn fav ${st.fav[id] ? 'on' : ''}" data-act="fav" data-id="${id}">⭐</button></div>
    ${ph ? `<div class="photo"><img src="img/${id}.jpg" alt=""><a href="${esc(ph.u)}">Фото: ${esc(ph.a)} · ${esc(ph.l)}</a></div>` : ''}
    <div class="hero">${ph ? '' : tile(r)}<div><h1>${r.name}</h1>
      <p class="muted small">${CATS[r.cat]} · подготовка ${dur(r.prep)} · готовка ${dur(r.cook)}</p></div></div>
    ${m ? `<div class="note tip">🎯 Количество продуктов подстроено под вашу цель по КБЖУ. <a data-act="unfit" style="color:var(--accent);font-weight:600">Показать исходный рецепт</a></div>` : ''}
    <div class="card"><div class="panel">
      <div class="cell"><small>Программа</small><b>${r.prog}</b></div>
      <div class="cell"><small>Температура</small><b>${r.temp} °C</b></div>
      <div class="cell"><small>Время в аэрогриле</small><b>${dur(r.cook)}</b></div>
      <div class="cell"><small>Функция «Пар»</small><b class="${r.steam ? 'steam-c' : ''}">${r.steam ? '💨 включить' : 'не нужна'}</b></div></div></div>
    <h2>КБЖУ на 1 порцию</h2>${nutriCells(n)}
    <div class="row between"><h2>Продукты</h2>
      <div class="row"><span class="muted small">порций</span><div class="stepper"><button data-act="portions" data-v="-1">−</button><b>${rv.portions}</b><button data-act="portions" data-v="1">+</button></div></div></div>
    <div class="card">${list.map(a => `<div class="ing"><span>${ING[a.id].n}</span><span>${amountText(a)}</span></div>`).join('')}
      ${r.extra.map(x => { const s = x.split(' — '); return `<div class="ing"><span>${s[0]}</span><span>${s[1] || ''}</span></div>`; }).join('')}</div>
    ${load > 1.4 ? '<div class="note">⚠️ Продуктов больше, чем в исходном рецепте. Не заполняйте чашу выше половины и не кладите куски в два слоя — готовьте в два захода или добавьте 3–5 минут и чаще встряхивайте.</div>' : ''}
    <button class="btn ghost" data-act="shop-recipe">🛒 Добавить продукты в список покупок</button>
    <div class="row between"><h2>Приготовление</h2>
      <span class="row"><span class="badge ${nDone === total ? 'ok' : ''}">${nDone} из ${total}</span>${nDone ? '<button class="btn sm ghost" data-act="steps-reset">Сбросить</button>' : ''}</span></div>
    <div class="track" style="margin-bottom:10px"><i style="width:${nDone / total * 100}%"></i></div>
    <button class="btn" style="margin-bottom:10px" data-act="cook-start">▶ Готовить по шагам</button>
    <p class="muted small" style="margin-bottom:8px">Или нажимайте на шаг в списке, когда выполнили его, — отметки сохраняются.</p>
    <div class="card">${r.steps.map((s, i) => `<div class="step ${s.set ? 'cook' : ''} ${done[i] ? 'done' : ''}" data-act="step" data-v="${i}">
      <div class="num">${done[i] ? '✓' : i + 1}</div>
      <div class="grow"><p>${s.t}</p>${s.set ? setBox(s.set, r.name + ' — шаг ' + (i + 1)) : ''}</div></div>`).join('')}</div>
    ${nDone === total ? '<div class="note ok">✅ Все шаги выполнены. Приятного аппетита!</div>' : ''}
    ${r.tip ? `<div class="note tip">💡 ${r.tip}</div>` : ''}`;
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
      ${r.extra.map(x => { const p = x.split(' — '); return `<div class="ing"><span>${p[0]}</span><span>${p[1] || ''}</span></div>`; }).join('')}</div>`
    : `<p class="cook-text">${s.t}</p>${s.set ? setBox(s.set, r.name + ' — шаг ' + (i + 1)) : ''}`;
  return `<div class="row between"><button class="icon-btn" data-act="cook-exit">✕</button>
      <span class="badge">${i < 0 ? 'Продукты' : 'Шаг ' + (i + 1) + ' из ' + total}</span></div>
    <p class="muted small" style="margin:10px 0 6px">${r.name}</p>
    <div class="track"><i style="width:${(i + 1) / total * 100}%"></i></div>
    ${body}
    <div class="cook-nav"><button class="btn ghost" data-act="cook-prev" ${i < 0 ? 'disabled' : ''}>‹ Назад</button>
      <button class="btn" data-act="cook-next">${i === total - 1 ? '✓ Готово' : i < 0 ? 'Начать ›' : 'Сделано, дальше ›'}</button></div>`;
}
function setBox(s, name) {
  return `<div class="set"><div class="panel">
      <div class="cell"><small>Программа</small><b>${s.prog}</b></div>
      <div class="cell"><small>Температура</small><b>${s.temp} °C</b></div>
      <div class="cell"><small>Время</small><b>${dur(s.min)}</b></div>
      <div class="cell"><small>Пар</small><b class="${s.steam ? 'steam-c' : ''}">${s.steam ? '💨 включён' : 'выключен'}</b></div>
      <div class="cell wide"><small>Куда класть</small><b style="white-space:normal;font-size:14px">${s.place}</b></div>
      ${s.fan ? `<div class="cell wide"><small>Обдув</small><b style="white-space:normal;font-size:14px">${s.fan}</b></div>` : ''}</div>
    <button class="btn sm" data-act="timer" data-v="${s.min}" data-label="${esc(name)}">⏱ Запустить таймер на ${dur(s.min)}</button></div>`;
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
    ${seg('kmode', st.kmode, [['day', 'Меню на день'], ['dish', 'Один приём пищи']])}
    <div style="height:12px"></div>
    ${st.kmode === 'day' ? kbjuDay() : kbjuDish()}`;
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
    <div class="card"><table><tr><th>Программа</th><th>Для чего</th><th>Настройки в рецептах</th></tr>
      ${PROGRAMS.map(p => `<tr><td><b>${p.e} ${p.n}</b></td><td>${p.d}</td><td>${p.r}</td></tr>`).join('')}</table>
      <p class="small muted" style="margin-top:8px">В каждом рецепте указаны точные температура и время — выберите программу и выставьте их на панели. Заводские значения программ смотрите в руководстве к прибору.</p></div>
    <h2>💨 Функция «Пар»</h2>
    <div class="card"><ul><li>Перед готовкой налейте в резервуар чистую воду (лучше фильтрованную — меньше накипи).</li>
      <li>Включайте пар для постного мяса, филе птицы, рыбы, рёбер, котлет и овощей — они не пересыхают.</li>
      <li>Для хрустящей корочки (фри, крылья, панировка) пар не нужен. В рецептах с глазурью и сыром пар выключается на последнем этапе.</li>
      <li>После готовки слейте остатки воды и протрите резервуар.</li></ul></div>
    <h2>🍏 Дегидратор</h2>
    <div class="card"><table><tr><th>Продукт</th><th>Нарезка</th><th>°C</th><th>Время</th></tr>
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
      ${RECIPES.filter(r => PHOTOS[r.id]).map(r => `<p class="small" style="margin-top:6px">${r.name} — <a href="${esc(PHOTOS[r.id].u)}" style="color:var(--accent)">${esc(PHOTOS[r.id].a)}, ${esc(PHOTOS[r.id].l)}</a></p>`).join('')}</details></div>
    <p class="muted small">КБЖУ рассчитаны по сырому весу продуктов и являются приблизительными.</p>`;
}

/* ---------- Обновление через GitHub ---------- */
const REPO = 'DedMazay321/AeroGrill';
let VERSION = null; // в браузере версии нет — её сообщает Android-оболочка
try { VERSION = window.AndroidBridge.getVersion(); } catch (e) { /* открыто в браузере */ }
const up = { state: 'idle', list: [], pct: 0, msg: '' };
function verCmp(a, b) {
  const x = a.split('.'), y = b.split('.');
  for (let i = 0; i < 3; i++) { const d = (+x[i] || 0) - (+y[i] || 0); if (d) return d; }
  return 0;
}
const hasUpdate = () => !!(VERSION && st.updNew && verCmp(st.updNew, VERSION) > 0);
const ruDate = d => d.slice(8, 10) + '.' + d.slice(5, 7) + '.' + d.slice(0, 4);
async function checkUpdate() {
  if (up.state === 'checking' || up.state === 'downloading') return;
  up.state = 'checking';
  drawUpdate();
  try {
    const res = await fetch('https://api.github.com/repos/' + REPO + '/releases?per_page=10', { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    up.list = (await res.json()).filter(r => !r.draft && !r.prerelease).map(r => ({
      v: r.tag_name.replace(/^v/, ''), notes: r.body || '', date: r.published_at.slice(0, 10),
      url: (r.assets.find(a => a.name.endsWith('.apk')) || {}).browser_download_url
    }));
    const last = up.list.find(r => r.url);
    st.updNew = last ? last.v : null;
    st.updSeen = Date.now();
    save();
    up.state = hasUpdate() ? 'available' : 'latest';
  } catch (e) {
    up.state = 'error';
    up.msg = 'Не удалось проверить обновления. Проверьте интернет и попробуйте ещё раз.';
  }
  drawUpdate();
}
function installUpdate() {
  const last = up.list.find(r => r.url);
  if (!last) return;
  if (window.AndroidBridge && window.AndroidBridge.installUpdate) {
    up.state = 'downloading'; up.pct = 0;
    window.AndroidBridge.installUpdate(last.url);
  } else window.open(last.url);
  drawUpdate();
}
// Эти две функции вызывает Android-оболочка во время загрузки
window.onUpdateProgress = pct => { up.state = pct >= 100 ? 'confirm' : 'downloading'; up.pct = pct; drawUpdate(); };
window.onUpdateError = msg => { up.state = 'error'; up.msg = 'Не удалось установить обновление: ' + msg; drawUpdate(); };
const notesHtml = t => esc(t).replace(/\r?\n/g, '<br>');
function updateInner() {
  const last = up.list.find(r => r.url), s = up.state;
  const body = s === 'checking' ? '<p class="muted small" style="margin-top:10px">Проверяю обновления…</p>'
    : s === 'available' ? `<div class="note tip" style="margin:12px 0"><b>Доступна версия ${esc(last.v)}</b> от ${ruDate(last.date)}<br>${notesHtml(last.notes)}</div>
        <button class="btn" data-act="upd-install">⬇️ Скачать и установить</button>
        <p class="muted small" style="margin-top:8px">Подойдёт любой интернет — Wi-Fi или мобильный. Рецепты, избранное и отметки сохранятся.</p>`
    : s === 'downloading' ? `<p class="small" style="margin:12px 0 6px">Загрузка обновления… ${up.pct}%</p><div class="track"><i style="width:${up.pct}%"></i></div>`
    : s === 'confirm' ? '<div class="note ok" style="margin:12px 0 0">Обновление загружено. Подтвердите установку в окне Android. Если телефон просит разрешить установку из этого приложения — разрешите и нажмите «Скачать и установить» ещё раз.</div><button class="btn ghost" style="margin-top:10px" data-act="upd-install">Повторить установку</button>'
    : s === 'latest' ? '<p class="small" style="margin-top:10px"><span class="badge ok">У вас последняя версия</span></p>'
    : s === 'error' ? `<div class="note" style="margin:12px 0 0">${esc(up.msg)}</div>` : '';
  const history = !up.list.length ? '' : `<details style="margin-top:12px"><summary class="small muted">История версий</summary>
    ${up.list.map(r => `<p class="small" style="margin-top:8px"><b>${esc(r.v)}</b> <span class="muted">· ${ruDate(r.date)}${r.v === VERSION ? ' · установлена' : ''}</span><br>${notesHtml(r.notes)}</p>`).join('')}</details>`;
  return `<div class="row between"><div><b>Версия приложения</b><div class="muted small">${VERSION ? esc(VERSION) : 'открыто в браузере'}</div></div>
    ${s === 'checking' || s === 'downloading' ? '' : '<button class="btn sm ghost" data-act="upd-check">🔄 Проверить обновления</button>'}</div>${body}${history}`;
}
function drawUpdate() {
  const el = $('#upd'), b = $('#updb');
  if (el) el.innerHTML = updateInner();
  if (b) b.innerHTML = updateBanner();
}
const updateBanner = () => hasUpdate() ? `<a class="note tip" style="display:block" href="#/guide">🆕 Доступна версия ${esc(st.updNew)} — нажмите, чтобы обновить</a>` : '';

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
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
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
}
setInterval(tick, 500);

let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2200); }

/* ---------- Маршруты и события ---------- */
function render(keepScroll) {
  const [, page, id, ...rest] = location.hash.split('/');
  const cook = page === 'r' && rest.includes('cook'), mode = rest.includes('fit') ? 'fit' : '';
  document.body.classList.toggle('cooking', cook);
  const tab = page === 'kbju' || page === 'shop' || page === 'guide' ? page : 'recipes';
  const y = window.scrollY;
  $('#view').innerHTML = cook ? viewCook(id, mode === 'fit') : page === 'r' ? viewRecipe(id, mode === 'fit') : tab === 'kbju' ? viewKbju() : tab === 'shop' ? viewShop() : tab === 'guide' ? viewGuide() : viewRecipes();
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.tab === (page === 'r' && mode === 'fit' ? 'kbju' : tab)));
  window.scrollTo(0, keepScroll && !cook ? y : 0);
}
window.addEventListener('hashchange', () => render(false));

const ACTIONS = {
  cat: v => { st.cat = v; },
  flt: v => { st.flt[v] = !st.flt[v]; },
  fav: (v, el) => { st.fav[el.dataset.id] = !st.fav[el.dataset.id]; },
  back: () => { if (history.length > 1) history.back(); else location.hash = '#/'; return false; },
  unfit: () => { location.replace('#/r/' + rv.id); return false; },
  portions: v => { rv.portions = Math.min(12, Math.max(1, rv.portions + +v)); },
  step: v => { const d = st.steps[rv.id] = st.steps[rv.id] || {}; if (d[v]) delete d[v]; else d[v] = 1; },
  'steps-reset': () => { delete st.steps[rv.id]; },
  'cook-start': () => {
    const r = byId(rv.id), done = st.steps[r.id] || {}, next = r.steps.findIndex((s, i) => !done[i]);
    Object.assign(rv, { cookId: r.id, cook: doneCount(r) && next >= 0 ? next : -1 });
    location.hash = '#/r/' + r.id + (rv.fit ? '/fit' : '') + '/cook';
    return false;
  },
  'cook-prev': () => { rv.cook = Math.max(-1, rv.cook - 1); },
  'cook-next': () => {
    const r = byId(rv.cookId);
    if (rv.cook >= 0) (st.steps[r.id] = st.steps[r.id] || {})[rv.cook] = 1;
    if (rv.cook < r.steps.length - 1) { rv.cook++; return; }
    save();
    toast('Готово! Приятного аппетита');
    history.back();
    return false;
  },
  'cook-exit': () => { history.back(); return false; },
  timer: (v, el) => { if (startTimer(+v, el.dataset.label)) toast('Таймер запущен — не забудьте нажать «Старт» на аэрогриле'); return false; },
  'timer-stop': v => { stopTimer(+v); return false; },
  'timer-add': v => { addMinute(+v); return false; },
  'modal-close': () => { $('#modal').hidden = true; finished = []; return false; },
  'shop-recipe': () => { const r = byId(rv.id); addToShop(amounts(r, rv.portions, rv.fit ? st.adapt[r.id] : null), r.extra); return false; },
  'shop-menu': () => { st.menu.slots.forEach(s => s.items.forEach(it => { const r = byId(it.id); addToShop(amounts(r, st.persons, it.m), r.extra); })); return false; },
  'shop-clear': () => { st.shop = { items: {}, extras: [], done: {} }; },
  check: v => { st.shop.done[v] = !st.shop.done[v]; },
  'open-fit': (v, el) => { st.adapt[el.dataset.id] = JSON.parse(el.dataset.m); save(); location.hash = '#/r/' + el.dataset.id + '/fit'; return false; },
  kmode: v => { st.kmode = v; },
  'calc-toggle': () => { st.calcOpen = !st.calcOpen; },
  sex: v => { st.profile.sex = v; },
  goal: v => { st.profile.goal = v; },
  calc: () => { calcTarget(); st.calcOpen = false; st.menu = null; toast('Норма рассчитана'); },
  meals: v => { st.meals = +v; },
  excl: v => { st.excl[v] = !st.excl[v]; },
  persons: v => { st.persons = Math.min(8, Math.max(1, st.persons + +v)); },
  gen: () => { genMenu(); if (!st.menu) toast('Не из чего собрать меню — снимите часть исключений'); },
  swap: v => { swapSlot(+v); },
  share: (v, el) => { N4.forEach(n => { st.dishT[n] = Math.round(st.target[n] * v / 100); }); st.dishType = el.dataset.t; st.dishRes = null; },
  dishType: v => { st.dishType = v; },
  find: () => { findDishes(); },
  'upd-check': () => { checkUpdate(); return false; },
  'upd-install': () => { installUpdate(); return false; }
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  e.preventDefault();
  if (ACTIONS[el.dataset.act](el.dataset.v, el) === false) return;
  save();
  render(true);
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
  if (!e.target.matches('[data-search]')) return;
  st.q = e.target.value;
  $('#list').innerHTML = listHtml();
});

render(false);
tick();
// Раз в 6 часов при запуске тихо проверяем, не вышла ли новая версия
if (VERSION && Date.now() - (st.updSeen || 0) > 6 * 3600000) checkUpdate();
