// Цены для списка покупок. Берёт каталоги магазинов, которые собирает проект «Копейка»
// (E:\Finance\tracker\data\stores), сопоставляет товары с продуктами рецептов и пишет
// app/src/main/assets/www/js/data-prices.js.
//
//   node tools/prices.mjs            — пересобрать цены
//   KOPEYKA=путь node tools/prices.mjs — если «Копейка» лежит в другой папке
//   node tools/prices.mjs --publish  — выложить цены в ветку prices на GitHub (data-prices.js не трогает).
//     Приложение при запуске берёт оттуда свежие цены. Запускается планировщиком Windows
//     (задача «АэроГриль — цены»), журнал — build/prices-publish.log.
//
// Основной магазин — «Пятёрочка». Если товара там нет, берётся «Магнит» с пометкой магазина.
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const ROOT = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)))
const STORES = path.join(process.env.KOPEYKA || 'E:/Finance', 'tracker/data/stores')
const OUT = path.join(ROOT, 'app/src/main/assets/www/js/data-prices.js')

// Продукт рецептов → поиск по названию товара. q — должно встретиться, x — не должно.
// conv — сколько граммов товара нужно на грамм продукта рецепта (отварной рис из сухого и т. п.).
// buy — покупать как другой продукт (готовая грудка — это сырое филе).
const RULES = {
  chicken_wing: { q: /крыл/, x: /копч|гриль|готов|соус|баффало|панир/ },
  chicken_breast: { q: /филе (грудки|груд)|грудк.*филе|филе куриное/, x: /копч|варен|запеч|гриль|рубл|котлет|наггет|бедр/ },
  chicken_cooked: { buy: 'chicken_breast', conv: 1.3 },
  chicken_thigh: { q: /филе бедр/, x: /копч|гриль|шашлык|маринад/ },
  chicken_drum: { q: /голен/, x: /копч|гриль|маринад|утин|индей/ },
  chicken_whole: { q: /тушка (цыпл|кур)/, x: /копч|гриль/ },
  chicken_leg: { q: /окороч|окорок цыпл/, x: /копч|свин/ },
  chicken_heart: { q: /^(сердечки|сердца|сердце) (кур|цыпл)/ },
  chicken_liver: { q: /печень (цыпл|кур)/, x: /трески|говяж/ },
  chicken_mince: { q: /фарш (из )?(цыпл|кур)/ },
  turkey_mince: { q: /фарш (из )?индей/ },
  turkey_fillet: { q: /филе.*индей|индей.*филе|грудк.*индей/, x: /копч|варен|колбас/ },
  duck_breast: { q: /утин.*груд|груд.*утк|филе утк/ },
  duck_leg: { q: /утин.*(ножк|окорок)|(ножк|окорок).*утк/ },
  pork_neck: { q: /шейк|шея/, x: /копч|варен|буженин|говяж/ },
  pork_ribs: { q: /ребр.*свин|свин.*ребр|ребрышки/, x: /копч|варен|говяж/ },
  pork_loin: { q: /корейк|карбонад|отбивн/, x: /копч|варен|сырокопч/ },
  pork_tenderloin: { q: /вырезк.*свин|свин.*вырезк/ },
  mixed_mince: { q: /фарш.*(домашн|свин.*говяж|говяж.*свин)/ },
  beef_mince: { q: /фарш.*говяж|говяж.*фарш/, x: /свин/ },
  beef_steak: { q: /стейк.*(говяж|рибай|ribeye|мачете|чак)|рибай/ },
  beef_lean: { q: /говядин.*(вырезк|огузок|кострец|мякот)/ },
  beef_roast: { q: /говядин.*(толст|оковалок|кострец|мякот)/ },
  lamb: { q: /баранин|ягнят/, x: /фарш|каре/ },
  lamb_ribs: { q: /каре.*(ягн|баран)/ },
  lamb_mince: { q: /фарш.*баран/ },
  bacon: { q: /бекон/, x: /чипс|соус|вкус/ },
  sausages: { q: /купат|колбаск.*(гриль|жарк|баварск)/ },
  hotdog_sausage: { q: /^сосиск/ },
  ham: { q: /ветчин/ },
  pepperoni: { q: /пепперони/ },
  salmon: { q: /^(лосось|семга|филе лосос|стейк лосос|стейк семг|филе семг)/, x: /копч|солен|слабосол|пресерв|икр|консерв|паштет|кусочк|в томат|в масле|натурал/ },
  pink_salmon: { q: /^(горбуша|кета|филе горбуш)/, x: /копч|солен|консерв|икр|натурал|в масле|в томат|пресерв/ },
  trout_whole: { q: /форел|дорад|сибас/, x: /копч|солен|филе|консерв|икр/ },
  cod: { q: /треск/, x: /печень|копч|консерв|сушен|икр/ },
  pollock: { q: /минта|хек/, x: /консерв|икр|сушен/ },
  tilapia: { q: /тилапи/ },
  mackerel: { q: /^скумбри/, x: /копч|консерв|пресерв|солен|натурал|масл|в томат|кусочк/ },
  tuna: { q: /тунц.*стейк|стейк.*тунц/ },
  shrimp: { q: /креветк/, x: /чипс|соус|салат/ },
  squid: { q: /кальмар/, x: /сушен|копч|консерв|кольц.*панир/ },
  egg: { q: /^яйц|яйцо кур/, x: /перепел|шоколад/, pcs: 55 },
  egg_white: { buy: 'egg' },
  cottage: { q: /^творог/, x: /зерн|масс|сырок|паст|десерт/ },
  cheese_hard: { q: /^сыр .*(российск|голланд|гауда|маасдам|пармез|чеддер|костром|тильзит|эдам|ламберт|сметанков|полутверд|тверд)/, x: /плавл|колбас|творож|продукт/ },
  mozzarella: { q: /моцарел/ },
  cream_cheese: { q: /творожн.*сыр|сыр.*творожн|креметт|сливочн.*сыр.*мягк/, x: /сырок|ванил|глазир|десерт/ },
  feta: { q: /фета|брынз|фетакс/ },
  milk: { q: /^молоко|молоко.*2[,.]5/, x: /сгущ|кокос|миндал|овсян|соев|шоколад|детск/ },
  kefir: { q: /кефир/ },
  yogurt: { q: /йогурт.*(греческ|натурал)|греческ.*йогурт/ },
  sour_cream: { q: /^сметан/ },
  cream: { q: /^сливки/, x: /взбит|кокос|раститель/ },
  butter: { q: /масло сливочное|сливочное масло/, x: /арахис|шоколад|растительн/ },
  tofu: { q: /тофу/ },
  potato: { q: /^картофель/, x: /фри|пюре|чипс|долька|сладк/ },
  sweet_potato: { q: /батат/ },
  frozen_fries: { q: /картофель фри|фри .*заморож|картофельные дольки/ },
  carrot: { q: /^морковь/, x: /корейск|по-корейски/ },
  beet: { q: /^св[её]кла/, x: /маринов/ },
  onion: { q: /^лук репчат|^лук золот|^лук( желт)?/, x: /зелен|порей|красн|кольца|жарен|сушен/ },
  garlic: { q: /^чеснок/, x: /сушен|молот|гранул/ },
  cabbage: { q: /капуста белокочан/ },
  broccoli: { q: /^(капуста )?брокколи/ },
  cauliflower: { q: /^капуста цветн|^цветная капуст/ },
  brussels: { q: /брюссельск/ },
  green_beans: { q: /стручков|фасоль зелен/ },
  zucchini: { q: /кабач|цукин/, x: /икра|оладь/ },
  eggplant: { q: /баклажан/, x: /икра|консерв/ },
  bell_pepper: { q: /перец (сладк|болгар|красн|желт|рамиро)/, x: /молот|чили|остр|фарширов|маринов/ },
  tomato: { q: /^томат|^помидор/, x: /паста|сок|соус|вялен|сушен|маринов|консерв|кетчуп/ },
  cucumber: { q: /^огур/, x: /маринов|солен|консерв/ },
  lettuce: { q: /салат (айсберг|ромэн|листов|лолло|микс)|^салат/, x: /оливье|крабов|морков|капуст|салат из/ },
  spinach: { q: /^шпинат/ },
  greens: { q: /^(укроп|петрушк|кинза|зелень|набор зелени)/, x: /сушен|приправ/ },
  mushrooms: { q: /^шампиньон/, x: /маринов|консерв|резан.*консерв|суп|жульен/ },
  pumpkin: { q: /^тыкв/, x: /семечк|масло|сок/ },
  corn_cob: { q: /кукуруз.*почат|початк/ },
  corn_canned: { q: /кукуруза (сладк|консерв)|кукуруза бондюэль|кукуруза.*ж\/б/ },
  avocado: { q: /авокадо/, x: /масло/ },
  apple: { q: /^яблок/, x: /сушен|сок|пюре|чипс/ },
  pear: { q: /^груш/, x: /сок|сушен|пюре/ },
  banana: { q: /^банан/, x: /чипс|сушен|пюре/ },
  orange: { q: /^апельсин/, x: /сок/ },
  pineapple: { q: /^ананас/, x: /консерв|кольца|сок/ },
  strawberry: { q: /^клубник/, x: /джем|варенье|сок/ },
  cherry: { q: /^вишн/, x: /джем|варенье|сок|сироп/ },
  bread_toast: { q: /хлеб.*тост|тостов/, x: /хлебц/ },
  baguette: { q: /багет/ },
  bun: { q: /булоч.*(гамбург|бургер|кунжут)/ },
  tortilla: { q: /^(лепешк|тортиль)/ },
  lavash: { q: /^лаваш/ },
  pizza_dough: { q: /тесто.*(пицц|дрожж)/, x: /слоен/ },
  yeast_dough: { q: /тесто.*дрожжев/, x: /слоен/ },
  puff_pastry: { q: /тесто.*слоен/ },
  pelmeni: { q: /пельмен/ },
  oil: { q: /масло подсолнечн|масло растительн|масло оливк/, x: /сливочн/ },
  flour: { q: /^мука пшеничн|^мука/, x: /ржан|рисов|кукуруз|миндал|блин/ },
  oat: { q: /хлопья овсян|овсян.*хлопья|геркулес/, x: /быстр.*вкус|с добавк/ },
  semolina: { q: /^(крупа манн|манн)/ },
  rice_cooked: { q: /^рис/, x: /бурый|дикий|в пакет.*вкус|лапша|мука/, conv: 1 / 2.5 },
  pasta_cooked: { q: /макарон|спагетти|рожки|перья|ракушки|фузилли|пенне|паста /, x: /лазань|соус|быстр/, conv: 1 / 2.3 },
  chickpeas: { q: /^нут/ },
  breadcrumbs: { q: /сухари паниров|панировочн/ },
  cornflakes: { q: /кукурузн.*хлопья|хлопья кукурузн/, x: /глазур|шоколад|мед/ },
  sugar: { q: /^сахар/, x: /замени|ванил|тростн.*кубик/ },
  honey: { q: /^м[её]д( |$)/ },
  cocoa: { q: /какао.*порош|какао$/ },
  chocolate: { q: /шоколад.*(горьк|темн|тёмн)/, x: /конфет|паст|напит/ },
  tomato_sauce: { q: /^(томатн|паста томатн|пассат|томаты.*протерт|соус томатн)/ },
  soy_sauce: { q: /соев.*соус|соус соев/ },
  teriyaki: { q: /терияки/ },
  bbq_sauce: { q: /^(соус.*барбекю|кетчуп)/ },
  mustard: { q: /^горчиц/ },
  peanut_butter: { q: /арахисов.*паст|паст.*арахис/ },
  walnut: { q: /^(орех.*грецк|грецк)/ },
  almonds: { q: /^(миндаль|орех.*миндал)/ },
  raisins: { q: /^изюм/ },
  prunes: { q: /^чернослив/ },
  olives: { q: /^(оливки|маслины)/ },
  tortilla_chips: { q: /начос|кукурузн.*чипс|тортилья.*чипс/ },
  cookies: { q: /печенье.*(песочн|сахарн|юбилейн)/ }
}

const norm = s => s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()
// \b не работает с кириллицей, поэтому граница слова задана явно
const SIZE = /(\d+(?:[.,]\d+)?)\s?(кг|гр|г|мл|л|шт)(?![а-яa-z])/i
const sizeOf = title => {
  const m = title.match(SIZE)
  if (!m) return null
  let n = parseFloat(m[1].replace(',', '.'))
  const u = m[2].toLowerCase()
  if (u === 'кг' || u === 'л') n *= 1000
  return { n, unit: u === 'шт' ? 'pcs' : 'g' }
}

// Товары магазина в общем виде: название, цена, старая цена, фасовка (г/шт) и весовой ли товар
function readStore(file, label, mapper) {
  const p = path.join(STORES, file)
  if (!fs.existsSync(p)) return { label, updated: null, goods: [] }
  const data = JSON.parse(fs.readFileSync(p, 'utf8'))
  return { label, updated: (data.updated || '').slice(0, 10), goods: Object.values(data.goods || {}).map(mapper).filter(g => g && g.price > 0) }
}
const pyat = readStore('pyaterochka.json', 'Пятёрочка', g => {
  // весовой товар: фасовки в названии нет, цена указана за 100 г
  const size = sizeOf(g.title), weighted = !size && g.packUnit !== 'pcs' && g.packSize === 100
  // у части фасованных товаров магазин показывает цену за 100 г — пересчитываем в цену упаковки
  const k = size && size.unit === 'g' && g.packUnit !== 'pcs' && g.packSize === 100 && size.n !== 100 ? size.n / 100 : 1
  return { name: g.title, price: g.price * k, old: g.oldPrice ? g.oldPrice * k : null, img: g.image, weighted, pack: size ? size.n : g.packSize, unit: size ? size.unit : g.packUnit === 'pcs' ? 'pcs' : 'g' }
})
const magnit = readStore('magnit.json', 'Магнит', g => {
  const size = sizeOf(g.title)
  if (!size) return null
  return { name: g.title, price: g.price, old: g.oldPrice || null, img: g.image, weighted: false, pack: size.n, unit: size.unit }
})

// Цена за 100 г (или за штуку) — по ней сравниваются товары
const unitPrice = (g, rule) => g.weighted ? g.price : g.unit === 'pcs' ? g.price / g.pack * (rule.pcs ? 100 / rule.pcs : 1) : g.price / g.pack * 100

function match(store, rule) {
  return store.goods.filter(g => { const t = norm(g.name); return rule.q.test(t) && !(rule.x && rule.x.test(t)) && (g.unit !== 'pcs' || rule.pcs) })
    .sort((a, b) => unitPrice(a, rule) - unitPrice(b, rule)).slice(0, 6)
}

const offers = {}, report = { pyat: 0, magnit: 0, none: [] }
for (const [id, rule0] of Object.entries(RULES)) {
  const rule = rule0.buy ? Object.assign({}, RULES[rule0.buy], rule0) : rule0
  let found = match(pyat, rule), store = pyat.label
  if (!found.length) { found = match(magnit, rule); store = magnit.label }
  if (!found.length) { report.none.push(id); continue }
  report[store === pyat.label ? 'pyat' : 'magnit']++
  offers[id] = { store, conv: rule.conv || 1, pcs: rule.pcs || 0, list: found.map(g => ({ n: g.name, p: g.price, o: g.old && g.old > g.price ? g.old : null, i: g.img, w: g.weighted ? 1 : 0, s: g.pack, u: g.unit })) }
}

// at — когда собран файл: из двух наборов цен с одинаковыми датами приложение берёт более поздний
const data = { updated: { 'Пятёрочка': pyat.updated, 'Магнит': magnit.updated }, at: new Date().toISOString(), offers }
const summary = `Пятёрочка: ${report.pyat}, Магнит: ${report.magnit}, без цены: ${report.none.length} (${report.none.join(', ')})`

if (process.argv.includes('--publish')) publish()
else {
  const js = `'use strict';
// Цены для списка покупок. Файл создаёт tools/prices.mjs из каталогов, которые собирает «Копейка».
// offers[продукт]: store — магазин, conv — граммов товара на грамм продукта, pcs — вес штуки (яйца),
// list — товары от самого выгодного: n — название, p — цена, o — цена без скидки, i — фото,
// w — весовой (цена за 100 г), s — фасовка, u — g или pcs.
const PRICES = ${JSON.stringify(data)};
`
  fs.writeFileSync(OUT, js)
  console.log(summary)
  console.log(`Обновлено: Пятёрочка ${pyat.updated}, Магнит ${magnit.updated}; файл ${Math.round(js.length / 1024)} КБ`)
}

// Выкладка в ветку prices: в ней один файл prices.json и одна, последняя, запись
function publish() {
  const BUILD = path.join(ROOT, 'build'), WORK = path.join(BUILD, 'prices-upload'), STATE = path.join(BUILD, 'prices-published.json')
  const LOG = path.join(BUILD, 'prices-publish.log')
  fs.mkdirSync(BUILD, { recursive: true })
  const log = msg => { console.log(msg); fs.appendFileSync(LOG, `${new Date().toISOString()} ${msg}\n`) }
  // без каталогов «Копейки» или при сбое сбора не затираем хорошие цены пустыми
  if (Object.keys(offers).length < 20) { log(`Не выкладываю: найдено только ${Object.keys(offers).length} продуктов. ${summary}`); process.exit(1) }
  const hash = createHash('sha256').update(JSON.stringify({ updated: data.updated, offers })).digest('hex')
  const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {}
  if (state.hash === hash) { log('Цены не изменились'); return }
  const git = args => execFileSync('git', args, {
    cwd: WORK, stdio: 'pipe', timeout: 120000, windowsHide: true,
    // работает без окна: спросить пароль некого, поэтому при заминке со входом — сразу ошибка
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' }
  })
  try {
    fs.rmSync(WORK, { recursive: true, force: true })
    fs.mkdirSync(WORK, { recursive: true })
    fs.writeFileSync(path.join(WORK, 'prices.json'), JSON.stringify(data))
    fs.writeFileSync(path.join(WORK, '.gitattributes'), '* -text\n')
    git(['init', '-q', '-b', 'prices'])
    git(['add', '-A'])
    git(['-c', 'user.name=AeroGrill', '-c', 'user.email=aerogrill@localhost', 'commit', '-q', '-m', 'prices'])
    git(['push', '-q', '--force', 'https://github.com/DedMazay321/AeroGrill.git', 'prices'])
    fs.writeFileSync(STATE, JSON.stringify({ hash, at: data.at }))
    log(`Цены выложены. ${summary}; Пятёрочка ${pyat.updated}, Магнит ${magnit.updated}`)
  } catch (e) {
    log('Не удалось выложить цены: ' + String(e.stderr || e.message).trim().split('\n').pop())
    process.exit(1)
  }
}
