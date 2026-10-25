"""Фото блюд с Wikimedia Commons (свободные лицензии).

  python tools/photos.py search   — найти кандидатов и собрать контактные листы для отбора
  python tools/photos.py build    — по файлу picks.json собрать app/.../www/img и js/data-photos.js

picks.json: {"id рецепта": номер кандидата (0..3)}; рецепты без записи остаются с эмодзи.
"""
import io, json, os, re, sys, time, html
from concurrent.futures import ThreadPoolExecutor
import requests
from PIL import Image, ImageDraw, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.environ.get('PHOTO_WORK', os.path.join(ROOT, 'build', 'photos'))
WWW = os.path.join(ROOT, 'app', 'src', 'main', 'assets', 'www')
API = 'https://commons.wikimedia.org/w/api.php'
UA = {'User-Agent': 'AeroGrillApp/1.2 (https://github.com/DedMazay321/AeroGrill)'}
PER = 4
OK_LICENSE = re.compile(r'^(CC0|Public domain|PD|CC BY(-SA)? \d)', re.I)

QUERIES = {
    'wings': 'crispy chicken wings', 'wings-honey': 'honey soy chicken wings', 'breast-steam': 'grilled chicken breast sliced',
    'thighs': 'roasted chicken thighs', 'drumsticks': 'roasted chicken drumsticks', 'nuggets': 'chicken nuggets',
    'turkey-cutlets': 'turkey patties', 'chicken-kebab': 'chicken skewers', 'pork-kebab': 'shashlik pork',
    'ribs': 'barbecue pork ribs', 'steak': 'ribeye steak grilled', 'pork-steak': 'grilled pork chop', 'burger': 'homemade hamburger',
    'salmon': 'salmon fillet lemon', 'cod-panko': 'breaded fish fillet', 'mackerel': 'grilled mackerel', 'shrimp-garlic': 'garlic shrimp',
    'shrimp-panko': 'fried breaded shrimp', 'tofu': 'crispy fried tofu cubes', 'fries': 'french fries', 'potato-wedges': 'potato wedges',
    'fries-frozen': 'french fries basket', 'sweet-potato': 'sweet potato fries', 'veg-grill': 'grilled vegetables',
    'broccoli-steam': 'broccoli cauliflower cheese', 'mushrooms': 'stuffed mushrooms', 'stuffed-peppers': 'stuffed bell peppers',
    'chickpeas': 'roasted chickpeas', 'pizza': 'pizza margherita', 'pizza-tortilla': 'tortilla pizza', 'quesadilla': 'quesadilla',
    'egg-toast': 'egg in toast', 'syrniki': 'syrniki', 'casserole': 'zapekanka cottage cheese', 'frittata': 'frittata',
    'muffins': 'banana muffins', 'cake': 'raisin pound cake', 'baked-apples': 'baked apples', 'oat-cookies': 'oatmeal cookies',
    'granola': 'granola', 'apple-chips': 'dried apple chips', 'banana-chips': 'dried banana chips', 'jerky': 'beef jerky',
    'chicken-whole': 'roast chicken whole', 'legs-bbq': 'barbecue chicken legs', 'chicken-schnitzel': 'chicken schnitzel',
    'chicken-rolls': 'chicken roulade cheese', 'chicken-teriyaki': 'teriyaki chicken', 'chicken-hearts': 'chicken hearts skewers',
    'chicken-liver': 'chicken liver onions', 'turkey-steak': 'turkey steak', 'turkey-meatballs': 'turkey meatballs',
    'chicken-strips': 'chicken tenders', 'wings-buffalo': 'buffalo wings', 'chicken-tandoori': 'tandoori chicken',
    'duck-breast': 'duck breast sliced', 'chicken-lula': 'chicken kofta kebab', 'chicken-potato': 'roast chicken potatoes',
    'pork-tenderloin': 'pork tenderloin sliced', 'buzhenina': 'buzhenina', 'pork-schnitzel': 'wiener schnitzel',
    'lamb-lula': 'lula kebab', 'meatballs-tomato': 'meatballs tomato sauce', 'cutlets': 'kotlety', 'bacon': 'crispy bacon strips',
    'kupaty': 'grilled sausages', 'roast-beef': 'roast beef sliced', 'lamb-rack': 'rack of lamb', 'meatloaf': 'meatloaf',
    'pork-french': 'meat french style cheese baked', 'fajitas': 'beef fajitas', 'sausage-rolls': 'sausage in dough',
    'trout-whole': 'grilled whole trout', 'pollock-lemon': 'baked white fish fillet', 'fish-cakes': 'fish cakes',
    'tuna-steak': 'seared tuna steak', 'salmon-teriyaki': 'teriyaki salmon', 'squid-rings': 'fried calamari rings',
    'fish-sticks': 'fish fingers', 'pink-salmon-cheese': 'baked salmon cheese', 'salmon-skewers': 'salmon skewers',
    'tilapia': 'tilapia fillet cooked', 'shrimp-bacon': 'bacon wrapped shrimp', 'corn': 'grilled corn on the cob',
    'carrots-honey': 'glazed carrots', 'zucchini-sticks': 'zucchini fries', 'eggplant-boats': 'stuffed eggplant',
    'cauliflower-spicy': 'roasted cauliflower', 'brussels-bacon': 'brussels sprouts bacon', 'green-beans': 'green beans garlic',
    'pumpkin-honey': 'roasted pumpkin cubes', 'jacket-potato': 'baked potato sour cream', 'hasselback': 'hasselback potatoes',
    'draniki': 'draniki', 'onion-rings': 'onion rings', 'mushrooms-garlic': 'roasted mushrooms', 'tomato-mozzarella': 'baked tomatoes mozzarella',
    'falafel': 'falafel', 'peppers-roasted': 'roasted peppers', 'zucchini-fritters': 'zucchini fritters', 'ratatouille': 'ratatouille',
    'potato-chips': 'homemade potato chips', 'mozzarella-sticks': 'mozzarella sticks', 'pizza-pepperoni': 'pepperoni pizza',
    'pizza-ham-mushroom': 'pizza ham mushrooms', 'croque': 'croque monsieur', 'burrito': 'burrito', 'samsa': 'samsa',
    'cheese-puffs': 'puff pastry cheese', 'lavash-cheese': 'lavash cheese grilled', 'hot-dog': 'hot dog', 'calzone': 'calzone',
    'bruschetta': 'bruschetta tomato', 'julienne': 'julienne mushrooms cocotte', 'khachapuri': 'adjarian khachapuri',
    'garlic-bread': 'garlic bread', 'boiled-eggs': 'boiled eggs halved', 'egg-avocado': 'baked egg avocado',
    'baked-oats': 'baked oatmeal', 'french-toast': 'french toast', 'cocotte': 'oeufs cocotte', 'cottage-muffins': 'cottage cheese muffins',
    'omelette': 'omelette ham cheese', 'granola-bars': 'granola bars', 'charlotte': 'sharlotka apple cake', 'brownie': 'chocolate brownies',
    'cheesecake': 'cheesecake slice', 'cookies': 'chocolate chip cookies', 'croissants': 'chocolate croissant',
    'bananas-chocolate': 'baked banana chocolate', 'mannik': 'mannik cake', 'carrot-cake': 'carrot cake', 'cinnamon-rolls': 'cinnamon rolls',
    'pineapple-grill': 'grilled pineapple', 'fondant': 'chocolate fondant', 'honey-almonds': 'honey roasted almonds', 'meringue': 'meringue cookies',
    'croutons': 'croutons', 'lavash-chips': 'pita chips', 'baked-pears': 'baked pears', 'dried-tomatoes': 'sun-dried tomatoes',
    'dried-mushrooms': 'dried mushrooms', 'dried-greens': 'dried herbs dill', 'pastila': 'fruit leather', 'dried-pears': 'dried pears',
    'chicken-jerky': 'chicken jerky', 'strawberry-chips': 'dried strawberries',
    'satay': 'chicken satay',
    'korean-wings': 'korean fried chicken wings',
    'chkmeruli': 'chkmeruli',
    'cevapcici': 'ćevapi',
    'shawarma': 'shawarma wrap',
    'focaccia': 'focaccia rosemary',
    'lavash-lasagna': 'lasagna slice',
    'nachos': 'nachos cheese',
    'enchiladas': 'enchiladas',
    'souvlaki': 'souvlaki skewers',
    'moussaka': 'moussaka',
    'yakitori': 'yakitori',
    'sweet-sour-pork': 'sweet and sour pork',
    'tikka-masala': 'chicken tikka masala',
    'patatas-bravas': 'patatas bravas',
    'med-salad': 'greek salad grilled chicken',
    'lamb-kebab': 'lamb shashlik',
    'quiche': 'quiche lorraine',
    'kentucky': 'fried chicken drumsticks',
    'peppers-beef-rice': 'stuffed peppers rice',
    'pepper-steak': 'pepper steak',
    'salmon-veg': 'salmon vegetables baked',
    'tilapia-capers': 'fish fillet capers',
    'potato-bacon-cheese': 'potato gratin bacon',
    'mushroom-skewers': 'mushroom skewers',
    'turkey-veg-steam': 'turkey vegetables',
    'chicken-zucchini-cutlets': 'chicken cutlets',
    'cod-broccoli': 'cod broccoli',
    'egg-muffins': 'egg muffins',
    'chicken-crust-pizza': 'chicken crust pizza',
    'zucchini-boats': 'stuffed zucchini',
    'pollock-parcel': 'fish en papillote',
    'beet-feta': 'beetroot salad feta',
    'veg-chips': 'vegetable chips beetroot',
    'cottage-cocoa-cake': 'chocolate cake slice',
    'shrimp-veg': 'shrimp vegetables stir',
    'fried-pelmeni': 'fried pelmeni',
    'pasta-bake': 'macaroni bake cheese',
    'sunny-eggs': 'fried eggs sunny side',
    'baby-potatoes': 'new potatoes dill',
    'cheese-crust-chicken': 'parmesan crusted chicken',
    'eggplant-crispy': 'fried eggplant slices',
    'mushrooms-cream': 'mushrooms sour cream',
    'bacon-chicken': 'bacon wrapped chicken breast',
    'hot-sandwiches': 'hot sandwich ham cheese tomato',
    'duck-legs': 'duck leg confit',
    'pork-prunes': 'pork loin prunes',
    'chicken-roll-mushroom': 'chicken roulade sliced',
    'eggplant-rolls': 'eggplant rolls walnut',
    'puff-baskets': 'mushroom tartlets',
    'cabbage-pie': 'cabbage pie',
    'strudel': 'apple strudel',
    'meat-pies': 'pirozhki',
    'banana-bread': 'banana bread',
    'vatrushki': 'vatrushka',
    'cherry-muffins': 'chocolate muffins',
    'orange-cake': 'orange cake',
}

session = requests.Session()
session.headers.update(UA)


def get(url, **kw):
    for attempt in range(5):
        r = session.get(url, timeout=40, **kw)
        if r.status_code == 200:
            return r
        time.sleep(2 + attempt * 3)
    r.raise_for_status()


def clean(s):
    s = html.unescape(re.sub(r'<[^>]+>', '', s or '')).strip()
    return re.sub(r'\s+', ' ', s)[:80]


def candidates(query):
    data = get(API, params={
        'action': 'query', 'format': 'json', 'generator': 'search', 'gsrnamespace': 6, 'gsrlimit': 20,
        'gsrsearch': query + ' filetype:bitmap', 'prop': 'imageinfo', 'iiprop': 'url|extmetadata|size|mime',
        'iiurlwidth': 640, 'iiextmetadatafilter': 'LicenseShortName|Artist'}).json()
    pages = sorted(data.get('query', {}).get('pages', {}).values(), key=lambda p: p.get('index', 99))
    out = []
    for p in pages:
        ii = (p.get('imageinfo') or [{}])[0]
        meta = ii.get('extmetadata', {})
        lic = clean(meta.get('LicenseShortName', {}).get('value'))
        w, h = ii.get('width', 0), ii.get('height', 1)
        if ii.get('mime') != 'image/jpeg' or w < 640 or not 0.95 <= w / h <= 2.1 or not OK_LICENSE.match(lic):
            continue
        out.append({'title': p['title'], 'thumb': ii['thumburl'], 'page': ii['descriptionurl'],
                    'author': clean(meta.get('Artist', {}).get('value')) or 'Wikimedia Commons', 'license': lic})
        if len(out) == PER:
            break
    return out


def fetch_thumb(job):
    rid, n, c = job
    path = os.path.join(WORK, 'cand', f'{rid}_{n}.jpg')
    if not os.path.exists(path):
        open(path, 'wb').write(get(c['thumb']).content)
    return path


def cover(img, w, h):
    return ImageOps.fit(img.convert('RGB'), (w, h), Image.LANCZOS)


def search(only=None):
    os.makedirs(os.path.join(WORK, 'cand'), exist_ok=True)
    meta_path = os.path.join(WORK, 'candidates.json')
    meta = json.load(open(meta_path, encoding='utf-8')) if os.path.exists(meta_path) else {}
    for rid, q in QUERIES.items():
        if only and rid not in only:
            continue
        if rid in meta and not only:
            continue
        if only:
            for n in range(PER):
                p = os.path.join(WORK, 'cand', f'{rid}_{n}.jpg')
                if os.path.exists(p):
                    os.remove(p)
        meta[rid] = candidates(only[rid] if only else q)
        print(rid, len(meta[rid]), flush=True)
        time.sleep(0.3)
        json.dump(meta, open(meta_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    jobs = [(rid, n, c) for rid, cs in meta.items() for n, c in enumerate(cs) if not only or rid in only]
    with ThreadPoolExecutor(4) as ex:
        list(ex.map(fetch_thumb, jobs))
    ids = [r for r in QUERIES if not only or r in only]
    rows, tw, th, label = 10, 220, 165, 26
    for s in range(0, len(ids), rows):
        chunk = ids[s:s + rows]
        sheet = Image.new('RGB', (PER * tw, len(chunk) * (th + label)), 'white')
        d = ImageDraw.Draw(sheet)
        for y, rid in enumerate(chunk):
            d.text((4, y * (th + label) + 6), f'{rid}   [{QUERIES[rid] if not only else only[rid]}]', fill='black')
            for n in range(len(meta.get(rid, []))):
                im = cover(Image.open(os.path.join(WORK, 'cand', f'{rid}_{n}.jpg')), tw - 4, th)
                sheet.paste(im, (n * tw + 2, y * (th + label) + label))
                d.text((n * tw + 8, y * (th + label) + label + 4), str(n), fill='yellow', stroke_width=2, stroke_fill='black')
        name = os.path.join(WORK, f"sheet_{'redo_' if only else ''}{s // rows:02d}.jpg")
        sheet.save(name, quality=70)
        print(name)


def build():
    meta = json.load(open(os.path.join(WORK, 'candidates.json'), encoding='utf-8'))
    picks = json.load(open(os.path.join(ROOT, 'tools', 'photo-picks.json'), encoding='utf-8'))
    out_dir = os.path.join(WWW, 'img')
    os.makedirs(out_dir, exist_ok=True)
    for f in os.listdir(out_dir):
        os.remove(os.path.join(out_dir, f))
    credits, size = {}, 0
    for rid, n in picks.items():
        c = meta[rid][n]
        im = cover(Image.open(os.path.join(WORK, 'cand', f'{rid}_{n}.jpg')), 480, 360)
        path = os.path.join(out_dir, rid + '.jpg')
        im.save(path, quality=76, optimize=True, progressive=True)
        size += os.path.getsize(path)
        credits[rid] = {'a': c['author'], 'l': c['license'], 'u': c['page']}
    js = ("'use strict';\n// Фото с Wikimedia Commons: a — автор, l — лицензия, u — страница файла. Файл создаёт tools/photos.py build\n"
          'const PHOTOS = ' + json.dumps(credits, ensure_ascii=False, indent=1) + ';\n')
    io.open(os.path.join(WWW, 'js', 'data-photos.js'), 'w', encoding='utf-8', newline='\n').write(js)
    print(len(credits), 'photos,', size // 1024, 'KB')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'search':
        redo = json.loads(sys.argv[2]) if len(sys.argv) > 2 else None
        search(redo)
    elif cmd == 'build':
        build()
    else:
        print(__doc__)
