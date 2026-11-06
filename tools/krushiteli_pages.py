"""Собирает гид по крафту «Крушителей подземелий» из krushiteli/data.json (его скачивает tools/krushiteli_data.py):
  krushiteli-podzemeliy/index.html                — главная гида: поиск по рецептам, разделы, правила катализаторов
  krushiteli-podzemeliy/<раздел>/index.html       — рецепты раздела (оружие, броня, руны…)
  krushiteli-podzemeliy/kalkulyator-krafta/       — калькулятор катализаторов и ресурсов
Данные — вики сообщества (CC BY-SA 3.0), ссылка на источник стоит на каждой странице.
"""
import html, json, math, os, re
from collections import defaultdict, OrderedDict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
OUT = 'krushiteli-podzemeliy'
BASE = 'https://fast-pay-store.github.io/digital-world/'
URL = BASE + OUT + '/'
BOT = 'bot-dungeon-crusher/'
WIKI = 'https://dungeoncrusher.fandom.com/ru/wiki/'
E = lambda s: html.escape(str(s), quote=True)
TR = dict(zip('абвгдеёжзийклмнопрстуфхцчшщъыьэюя', ['a', 'b', 'v', 'g', 'd', 'e', 'e', 'zh', 'z', 'i', 'y', 'k', 'l', 'm', 'n', 'o', 'p', 'r',
                                                 's', 't', 'u', 'f', 'h', 'ts', 'ch', 'sh', 'sch', '', 'y', '', 'e', 'yu', 'ya']))
ICON = ('<link rel="icon" href="%sassets/favicon.svg" type="image/svg+xml">\n<link rel="icon" href="%sassets/favicon-120.png" sizes="120x120" type="image/png">\n'
        '<link rel="apple-touch-icon" href="%sassets/apple-touch-icon.png">' % (BASE, BASE, BASE))


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', ''.join(TR.get(c, c) for c in s.lower())).strip('-')


def base_name(r):
    return re.sub(r'\s*\(\d+\s*уровень\)', '', r).strip()


WEAPON = ['Меч', 'Кинжал', 'Лук', 'Арбалет', 'Топор', 'Копье', 'Молот', 'Моргенштерн', 'Посох света', 'Посох тьмы', 'Книга', 'Кулак',
          'Драконье оружие', 'Лазерный пистолет', 'Плазменное ружье', 'Ружье', 'Гравитационная граната', 'Патроны', 'Стрелы']
ARMOR = ['Шлем', 'Доспехи', 'Ботинки', 'Шлем мага', 'Одеяние мага', 'Ботинки мага', 'Ботинки вора', 'Броня вора', 'Шлем вора',
         'Ботинки дракона', 'Броня дракона', 'Шлем дракона', 'Штурмовая броня']
ACC = ['Кольцо', 'Ожерелье', 'Золотая подкова', 'Адамантиновая подкова', 'Горн', 'Гьяллархорн']
ESS = ['Эссенция удачи', 'Магические бутылки', 'Зелье смешивания', 'Контрафактная вода', 'Жидкое золото', 'Жидкое Золото', 'Кровь Героев',
       'Замороженная частица магии', 'Трольское Можо', 'Очки гилдования']
UNITS = ['Воины', 'Лучники', 'Арбалетчики', 'Волшебники', 'Колдуны', 'Гоблины-берсеркеры', 'Гоблины-снайперы', 'Гоблины-колдуны']

CATS = OrderedDict([
    ('oruzhie', ('Оружие', 'Рецепты оружия: мечи, кинжалы, луки, арбалеты, топоры, посохи, книги и космическое оружие по уровням.')),
    ('bronya', ('Броня', 'Рецепты брони: шлемы, доспехи, ботинки, одеяния мага, броня вора и дракона по уровням.')),
    ('ukrasheniya', ('Кольца, ожерелья и подковы', 'Рецепты колец, ожерелий, подков и горнов.')),
    ('mificheskie', ('Мифические предметы', 'Рецепты мифического снаряжения: мифические мечи, луки, шлемы, доспехи, ботинки, кольца и ожерелья.')),
    ('runy', ('Руны', 'Рецепты рун: руны атаки, защиты, жизни, ловкости, мудрости и охотника — от небольшой до великой.')),
    ('oskolki', ('Осколки героев', 'Как скрафтить осколки героев: рецепты осколков для обычных, осадных и событийных героев.')),
    ('materialy', ('Слитки и материалы', 'Рецепты слитков (железный, золотой, мифрильный, адамантиновый), сфер, камней, наковальни и свитков крафта.')),
    ('esencii', ('Эссенции удачи и зелья', 'Рецепты эссенций удачи, магических бутылок, зелья смешивания и других катализаторов.')),
    ('osobye', ('Особые предметы', 'Рецепты особых предметов: Дар Циндора, Дверь в Никуда, Руническая бомба, Скотобойня, Тайна Бесконечности, случайные предметы.')),
    ('otryady', ('Отряды', 'Рецепты отрядов: воины, лучники, арбалетчики, волшебники, колдуны и гоблины.')),
])


def cat_of(r):
    b = base_name(r)
    if b.startswith('Осколки героя') or b in ('Осколки', 'Осколок'):
        return 'oskolki'
    if b.startswith('Мифическ'):
        return 'mificheskie'
    if 'руна' in b.lower():
        return 'runy'
    if b in WEAPON:
        return 'oruzhie'
    if b in ARMOR:
        return 'bronya'
    if b in ACC:
        return 'ukrasheniya'
    if b.startswith('Эссенция') or b in ESS:
        return 'esencii'
    if b in UNITS:
        return 'otryady'
    if re.search(r'слиток|Сфера|камень|Камень|Наковальня|Свиток|страница|Гиперсфера|Пыль', b):
        return 'materialy'
    return 'osobye'


def need(c):
    """Сколько катализатора нужно до максимума: (эссенций, бутылок, потолок)."""
    if c is None:
        return None
    cap = 100 if c >= 95 else 99
    if c >= cap:
        return (0, 0, cap)
    return (math.ceil((cap - c) / 2.5 - 1e-9), math.ceil((cap - c) / 1.5 - 1e-9), cap)


CSS = '''<style>
.find{width:100%;max-width:620px;padding:12px 14px;font-size:17px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink)}
#res{margin-top:10px;display:grid;gap:6px}
#res a{display:block;padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:var(--card);text-decoration:none;color:var(--ink)}
#res a small{color:var(--muted)}
.types{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;margin:12px 0 22px}
.types a{display:block;padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:var(--card);text-decoration:none;color:var(--ink);font-weight:600}
.types a:hover{border-color:var(--accent)}
.types small{display:block;color:var(--muted);font-weight:400}
.rc{border:1px solid var(--line);border-radius:12px;background:var(--card);padding:14px 16px;margin:10px 0;scroll-margin-top:16px}
.rc:target{border-color:var(--accent);box-shadow:0 0 0 3px rgba(37,99,235,.15)}
.rc h3{margin:0 0 6px;font-size:18px}
.rc .meta{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:14px;color:var(--muted);margin-bottom:8px}
.rc .meta b{color:var(--ink)}
.rc ul{margin:0;padding-left:18px;columns:2;column-gap:28px}
.rc li{break-inside:avoid;margin:2px 0}
.rc .use{font-size:14px;color:var(--muted);margin-top:8px}
.q{font-variant-numeric:tabular-nums;font-weight:700}
.r-обычный{color:inherit}.r-необычный{color:#15803d}.r-редкий{color:#2563eb}.r-эпический{color:#7c3aed}.r-легендарный{color:#c2410c}.r-мифический{color:#b91c1c}
.cta{display:flex;flex-wrap:wrap;gap:12px;align-items:center;background:var(--card);border:1px solid var(--line);border-left:4px solid var(--accent2);border-radius:12px;padding:16px 18px;margin:22px 0}
.cta p{margin:0;flex:1;min-width:240px}
.calc{display:grid;gap:12px;max-width:640px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 18px}
.calc label{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.calc input,.calc select{padding:9px 10px;font-size:16px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--ink)}
.calc .out{font-size:17px;line-height:1.6}
.toc{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 18px}
.toc a{padding:4px 10px;border:1px solid var(--line);border-radius:999px;text-decoration:none;font-size:14px;color:var(--ink);background:var(--card)}
@media(max-width:600px){.rc ul{columns:1}}
</style>'''


def page(title, desc, url, h1, crumbs, body, ld, extra=''):
    depth = url.replace(BASE, '').count('/')
    home = '../' * depth
    return '''<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{t}</title>
<meta name="description" content="{d}">
<link rel="canonical" href="{u}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Digital World">
<meta property="og:title" content="{t}">
<meta property="og:description" content="{d}">
<meta property="og:url" content="{u}">
<meta property="og:locale" content="ru_RU">
<link rel="stylesheet" href="{home}assets/site.css">
{icon}
<script type="application/ld+json">{ld}</script>
<!-- Файл создаётся автоматически (tools/krushiteli_pages.py) из krushiteli/data.json. Руками не править. -->
{css}
</head>
<body>
<header class="top"><div class="wrap"><a href="{home}">Digital World</a><span class="sp"></span><a class="all" href="{home}{OUT}/">Гид по «Крушителям»</a></div></header>
<main><div class="wrap">
<nav class="crumbs" aria-label="Навигация"><ol>{crumbs}</ol></nav>
<h1 style="font-size:clamp(28px,4vw,40px);line-height:1.15;margin:14px 0 10px">{h1}</h1>
{body}
</div></main>
<footer class="f"><div class="wrap">
<div class="row"><span>Нашли ошибку или новый рецепт?</span><a href="https://vk.com/topic-215704478_53215845" target="_blank" rel="noopener">Напишите во ВКонтакте</a><a href="https://t.me/konctantin777" target="_blank" rel="noopener">Telegram</a></div>
<div class="disclaimer">Неофициальный гид. Рецепты — по данным <a href="{wiki}Рецепты" target="_blank" rel="noopener">вики сообщества «Крушители Подземелий»</a> (лицензия <a href="https://creativecommons.org/licenses/by-sa/3.0/deed.ru" target="_blank" rel="noopener">CC BY-SA 3.0</a>); таблицы этого гида распространяются на тех же условиях. Рецепты открыты игроками и могут меняться разработчиком — проверяйте в игре. «Крушители Подземелий» / Dungeon Crusher — товарный знак правообладателей игры.</div>
</div></footer>
{extra}
</body>
</html>
'''.format(t=E(title), d=E(desc), u=E(url), h1=E(h1), body=body, ld=json.dumps(ld, ensure_ascii=False), icon=ICON, css=CSS,
           crumbs=''.join(crumbs), home=home, OUT=OUT, wiki=WIKI, extra=extra)


def cta(prefix):
    return ('<div class="cta"><p><b>Надоело часами крафтить и фармить?</b> Бот для «Крушителей подземелий» сам ведёт бои, собирает награды '
            'и выполняет ежедневные задания 24/7 — на ПК и в браузере. Демо-версия бесплатно.</p>'
            '<a class="btn" href="%s">Бот для Крушителей</a></div>' % (prefix + BOT))


def crumb(items):
    out = []
    for i, (t, h) in enumerate(items):
        out.append('<li aria-current="page">%s</li>' % E(t) if h is None else '<li><a href="%s">%s</a></li>' % (h, E(t)))
    return out


def write(path, s):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w', encoding='utf-8').write(s)


def main():
    D = json.load(open('krushiteli/data.json', encoding='utf-8'))
    R = D['recipes']
    seen = defaultdict(int)
    for r in R:
        seen[r['r']] += 1
    k = defaultdict(int)
    for i, r in enumerate(R):
        k[r['r']] += 1
        r['v'] = k[r['r']] if seen[r['r']] > 1 else 0
        r['cat'] = cat_of(r['r'])
        r['id'] = slug(r['r']) + ('-%d' % i if sum(1 for x in R if x['r'] == r['r']) > 1 else '')
    by_res = defaultdict(list)
    for r in R:
        by_res[r['r']].append(r)
    used = defaultdict(list)
    for r in R:
        for name, n, _ in r['i']:
            used[name].append(r)

    def link_item(name, prefix):
        rs = by_res.get(name)
        if rs:
            r = rs[0]
            return '<a href="%s%s/#%s">%s</a>' % (prefix, r['cat'], r['id'], E(name))
        return E(name)

    def card(r, prefix):
        nd = need(r['c'])
        meta = []
        if r['c'] is not None:
            meta.append('Базовый шанс: <b>%d%%</b>' % r['c'])
        if nd and (nd[0] or nd[1]):
            meta.append('До %d%%: <b>%d</b> эссенций удачи или <b>%d</b> магических бутылок' % (nd[2], nd[0], nd[1]))
        elif nd:
            meta.append('Катализатор не нужен')
        lis = ''.join('<li><span class="q">×%d</span> <span class="r-%s">%s</span></li>' % (n, E(rar), link_item(name, prefix)) for name, n, rar in r['i'])
        u = used.get(r['r'], [])
        us = ''
        if u:
            names = list(OrderedDict.fromkeys(x['r'] for x in u))
            us = '<div class="use">Нужен для: ' + ', '.join(link_item(x, prefix) for x in names[:12]) + ('…' if len(names) > 12 else '') + '</div>'
        return '<div class="rc" id="%s"><h3>%s%s</h3><div class="meta">%s</div><ul>%s</ul>%s</div>' % (r['id'], E(r['r']), (' <small style="color:var(--muted);font-weight:400">— вариант %d</small>' % r['v']) if r['v'] else '', ' · '.join(meta), lis, us)

    total = len(R)
    # ---------- страницы разделов ----------
    counts = {}
    for cid, (cname, cdesc) in CATS.items():
        rs = [r for r in R if r['cat'] == cid]
        counts[cid] = len(rs)
        if not rs:
            continue
        groups = OrderedDict()
        for r in sorted(rs, key=lambda r: (base_name(r['r']), r['r'])):
            groups.setdefault(base_name(r['r']), []).append(r)
        toc = '<div class="toc">' + ''.join('<a href="#g-%s">%s</a>' % (slug(g), E(g)) for g in groups) + '</div>'
        secs = ''.join('<h2 id="g-%s" style="margin-top:28px">%s — рецепт%s</h2>%s' % (
            slug(g), E(g), 'ы по уровням' if len(v) > 1 else '', ''.join(card(r, '../') for r in v)) for g, v in groups.items())
        title = '%s — рецепты крафта «Крушители подземелий»' % cname
        desc = '%s Ингредиенты, базовый шанс и сколько эссенций удачи нужно до 99%%. %d рецептов.' % (cdesc, len(rs))
        body = ('<p class="lead">%s Для каждого рецепта — ингредиенты, базовый шанс и сколько катализатора нужно до максимума. '
                'Нажмите на ингредиент, чтобы увидеть, как его скрафтить.</p>' % E(cdesc)) + toc + cta('../../') + secs + \
               '<p style="margin-top:26px"><a href="../">← Все разделы и поиск по рецептам</a> · <a href="../kalkulyator-krafta/">Калькулятор крафта</a></p>'
        ld = [{'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'Digital World', 'item': BASE},
            {'@type': 'ListItem', 'position': 2, 'name': 'Гид по «Крушителям подземелий»', 'item': URL},
            {'@type': 'ListItem', 'position': 3, 'name': cname, 'item': URL + cid + '/'}]}]
        write('%s/%s/index.html' % (OUT, cid), page(title, desc, URL + cid + '/', '%s: рецепты крафта' % cname,
              crumb([('Каталог', '../../'), ('Крушители подземелий', '../'), (cname, None)]), body, ld))

    # ---------- данные для поиска и калькулятора ----------
    js_data = [[r['r'], r['cat'], r['id'], r['c'], [[a, b] for a, b, _ in r['i']], r['v']] for r in R]
    data_js = 'window.DC=' + json.dumps(js_data, ensure_ascii=False, separators=(',', ':')) + ';'
    write('%s/data.js' % OUT, data_js)

    # ---------- калькулятор ----------
    calc_body = '''<p class="lead">Считает, сколько эссенций удачи или магических бутылок положить в крафт, чтобы шанс был максимальным, и сколько ингредиентов уйдёт на нужное количество предметов.</p>
<h2>Сколько катализатора нужно</h2>
<div class="calc">
<label>Базовый шанс рецепта, %: <input id="bc" type="number" min="1" max="100" value="80" style="width:90px"></label>
<div class="out" id="bo"></div>
</div>
<h2 style="margin-top:28px">Сколько ресурсов на крафт</h2>
<div class="calc">
<label>Что крафтим: <input id="it" list="items" class="find" style="max-width:420px;font-size:16px" placeholder="например, Шлем (5 уровень)"></label>
<datalist id="items"></datalist>
<label>Сколько штук: <input id="cnt" type="number" min="1" value="1" style="width:90px"></label>
<div class="out" id="ro">Выберите предмет.</div>
</div>
<h2 style="margin-top:28px">Правила катализаторов</h2>
<ul>
<li>Одна эссенция удачи повышает шанс на 2,5%, одна магическая бутылка — на 1,5%.</li>
<li>В один крафт можно положить только один вид катализатора — до 100 штук.</li>
<li>Рецепты с базовым шансом меньше 95% поднимаются максимум до 99%, с базовым 95% и выше — до 100%.</li>
<li>Выгоднее крафтить пачкой и класть катализатор на всю пачку, чем по одной штуке.</li>
</ul>
<p>Калькулятор не учитывает, что крафт может не удаться: при шансе 99% примерно один крафт из ста сгорает. Ингредиенты со ссылкой тоже крафтятся — откройте их рецепт.</p>''' + cta('../../') + \
        '<p><a href="../">← Все рецепты и поиск</a></p>'
    calc_js = '''<script src="../data.js"></script>
<script>
(function(){
var bc=document.getElementById('bc'),bo=document.getElementById('bo');
function cat(){var c=Math.max(1,Math.min(100,+bc.value||0));var cap=c>=95?100:99;
if(c>=cap){bo.innerHTML='Шанс уже максимальный ('+cap+'%), катализатор не нужен.';return;}
var e=Math.ceil((cap-c)/2.5-1e-9),b=Math.ceil((cap-c)/1.5-1e-9);
bo.innerHTML='До <b>'+cap+'%</b>: <b>'+e+'</b> эссенций удачи <i>или</i> <b>'+b+'</b> магических бутылок.';}
bc.oninput=cat;cat();
var by={};DC.forEach(function(r){by[r[0]]=r;});
var dl=document.getElementById('items');Object.keys(by).sort().forEach(function(k){var o=document.createElement('option');o.value=k;dl.appendChild(o);});
var it=document.getElementById('it'),cnt=document.getElementById('cnt'),ro=document.getElementById('ro');
var craft={};DC.forEach(function(r){craft[r[0]]=r;});
function run(){var name=it.value.trim(),vs=DC.filter(function(r){return r[0]===name});if(!vs.length){ro.textContent='Выберите предмет из списка.';return;}
var n=Math.max(1,+cnt.value||1);
ro.innerHTML=vs.map(function(r,k){var c=r[3],cap=c>=95?100:99,e=c==null?null:Math.max(0,Math.ceil((cap-c)/2.5-1e-9));
return (vs.length>1?'<b>Вариант '+(k+1)+'</b><br>':'')+'<ul>'+r[4].map(function(i){var x=craft[i[0]];
return '<li><b>'+(i[1]*n).toLocaleString('ru')+'</b> × '+(x?'<a href="../'+x[1]+'/#'+x[2]+'">'+i[0]+'</a>':i[0])+'</li>'}).join('')+'</ul>'+
(c!=null?'Шанс '+c+'%'+(e?' → до '+cap+'%: <b>'+e+'</b> эссенций удачи на крафт':'')+'. ':'')+'<a href="../'+r[1]+'/#'+r[2]+'">Открыть рецепт</a>';}).join('<hr>');}
[it,cnt].forEach(function(e){e.addEventListener('input',run);e.addEventListener('change',run);});
var q=new URLSearchParams(location.search).get('item');if(q){it.value=q;run();}
})();
</script>'''
    write('%s/kalkulyator-krafta/index.html' % OUT, page(
        'Калькулятор крафта «Крушители подземелий» — эссенции удачи и ресурсы',
        'Калькулятор крафта для «Крушителей подземелий»: сколько эссенций удачи и магических бутылок нужно до 99%, и сколько базовых ресурсов уйдёт на нужное число предметов.',
        URL + 'kalkulyator-krafta/', 'Калькулятор крафта «Крушители подземелий»',
        crumb([('Каталог', '../../'), ('Крушители подземелий', '../'), ('Калькулятор крафта', None)]), calc_body,
        [{'@context': 'https://schema.org', '@type': 'WebApplication', 'name': 'Калькулятор крафта «Крушители подземелий»',
          'applicationCategory': 'GameApplication', 'operatingSystem': 'Браузер', 'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'RUB'}}],
        extra=calc_js))

    # ---------- осада ----------
    S = D.get('siege') or {}
    if S.get('bosses'):
        def num(x):
            return x.replace(',', ' ').replace('.', ' ')
        rows = ''.join('<tr><td class="n">%s</td><td class="n">%s</td><td class="n">%s</td><td class="n">%s</td><td class="n">%s</td><td>%s</td></tr>' % (
            num(b['hp']), num(b['players']), num(b['total']), num(b['track']), num(b['mvp']), 'горн + тройник' if b['triple'] else 'горн') for b in S['bosses'])
        cn = ''.join('<tr><td>%s</td><td><b>%s</b></td></tr>' % (E(a), E(b)) for a, b in S['cannons'])
        body = '''<p class="lead">Осада — еженедельное событие «Крушителей подземелий»: игроки выслеживают боссов, бьют их вместе с кланом и получают очки осады, а за очки — рог демона, тройники, бутылки и осадных героев. Здесь — как устроена осада, расписание больших боссов, осадные пушки по неделям и таблица очков за каждого босса.</p>
<div class="toc"><a href="#kak">Как устроена</a><a href="#vremya">Время больших боссов</a><a href="#pushki">Пушки по неделям</a><a href="#ochki">Очки за боссов</a><a href="#sovety">Советы</a></div>
<h2 id="kak">Как устроена осада</h2>
<ul>
<li>На каждый бой собирается колода: <b>6 основных героев</b> и <b>4 запасных</b>, которые выходят на место погибших.</li>
<li>Атака тратит энергию: обычная — 1 энергия, усиленная ×5 — 3 энергии (характеристики героев ×5). Энергия восстанавливается по одной в час, ещё её дают горны.</li>
<li>Найденный босс живёт <b>30 минут</b>. Не успели убить — очков не получит никто.</li>
<li>Очки за босса делятся так: тот, кто выследил, — 5%; кто нанёс последний удар — 5%; кто нанёс больше всех урона (MVP) — 30%; остальные 60% поровну между всеми, кто нанёс хоть какой-то урон. Каждая из трёх ролей ещё приносит горн (с больших боссов — тройник).</li>
<li>Сила найденных боссов зависит от накопленных рангов. Начиная с 11 500 рангов слабые боссы перестают попадаться; сбросить ранги можно на алтаре.</li>
<li>Клановых боссов призывают за рог демона или 400 магических бутылок. Их видит только призвавший, но он может позвать клан.</li>
</ul>
<h2 id="vremya">Время больших боссов</h2>
<p>Пять раз в день в течение часа можно выследить «большого босса» — героя текущей недели осады (500 млн, 2 млрд и 5 млрд здоровья). Время по Москве:</p>
<p style="font-size:22px;font-weight:700;letter-spacing:.5px">04:00 · 09:00 · 14:00 · 19:00 · 00:00</p>
<h2 id="pushki">Осадные пушки по неделям</h2>
<p>У каждой недели осады своя пушка: против кланового босса <b>своей</b> недели она получает бонус ×100 к характеристикам и не погибает. Против других боссов бонуса нет. Пушку покупают в магазине за осколок пустоты; в отряде может быть до 8 пушек, но все разные.</p>
<div class="tbl-wrap"><table class="st"><tr><th>Неделя осады</th><th>Пушка недели</th></tr>{CN}</table></div>
<h2 id="ochki">Очки осады за боссов</h2>
<p>Сколько всего очков даёт босс и сколько из них достаётся за выслеживание или последний удар (по 5%) и за наибольший урон (30%).</p>
<div class="tbl-wrap"><table class="st"><tr><th>Здоровье босса</th><th>Макс. игроков</th><th>Всего очков</th><th>Выследил / добил</th><th>Больше всех урона</th><th>Награда</th></tr>{ROWS}</table></div>
<h2 id="sovety">Советы</h2>
<ul>
<li>Выслеживайте боссов сами: 5% очков и горн достаются за находку, даже если бьёт весь клан.</li>
<li>Приглашайте клан на крупных боссов — одному не успеть за 30 минут, а 60% очков делятся на всех участников.</li>
<li>Копите рога демона к неделе, пушка которой у вас есть: с ней клановый босс умирает намного быстрее.</li>
<li>Следите за рангами: если перестали попадаться удобные боссы — загляните на алтарь.</li>
</ul>'''.replace('{CN}', cn).replace('{ROWS}', rows)
        body += cta('../../') + '<p><a href="../">← Рецепты крафта и поиск</a></p>'
        extra_css = '<style>.tbl-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--card);margin:10px 0 18px}table.st{border-collapse:collapse;width:100%%;font-size:15px}table.st th,table.st td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left}table.st th{background:var(--bg);font-size:13px;color:var(--muted)}table.st td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}</style>'
        write('%s/osada/index.html' % OUT, page(
            'Осада в «Крушителях подземелий»: боссы, очки, пушки по неделям',
            'Гид по осаде «Крушителей подземелий»: как делятся очки осады, время больших боссов, осадные пушки по неделям и таблица очков за каждого босса.',
            URL + 'osada/', 'Осада в «Крушителях подземелий»',
            crumb([('Каталог', '../../'), ('Крушители подземелий', '../'), ('Осада', None)]), body,
            [{'@context': 'https://schema.org', '@type': 'Article', 'headline': 'Осада в «Крушителях подземелий»', 'inLanguage': 'ru',
              'author': {'@type': 'Organization', 'name': 'Digital World'}}], extra=extra_css))

    # ---------- герои ----------
    H = D.get('heroes') or []
    TYPES = [('Осадные герои', 'Осадные'), ('Скрытые герои', 'Скрытые'), ('Событийные герои', 'Событийные'),
             ('Магазин - Донатные герои', 'Донатные'), ('Осколочные герои', 'Осколочные'), ('Базовые герои', 'Базовые')]
    RORD = ['Обычный', 'Необычный', 'Редкий', 'Редчайший', 'Эпический', 'Легендарный', 'Мифический', 'Божественный']
    RCLS = {'Обычный': 'обычный', 'Необычный': 'необычный', 'Редкий': 'редкий', 'Редчайший': 'редкий', 'Эпический': 'эпический',
            'Легендарный': 'легендарный', 'Мифический': 'мифический', 'Божественный': 'мифический'}

    def hcard(h, hpre=''):
        types = [t for c, t in TYPES if c in h['cats']]
        how = h['how'] if not re.fullmatch(r'[\d\s.,]*', h['how'] or '') else ''
        st = ' · '.join('%s <b>%s</b>' % (k, h[v]) for k, v in (('HP', 'hp'), ('ATK', 'atk'), ('DEF', 'def'), ('WIS', 'wis'), ('AGI', 'agi'), ('Сумма', 'sum')) if h[v])
        sk = ''.join('<li>%s%s</li>' % (('<b>%s%s:</b> ' % (E(x['type']), (' ' + E(x['chance'])) if x['chance'] else '')) if x['type'] else '', E(x['text'])) for x in h['skills'])
        meta = ' · '.join(x for x in [E(h['race']), E(h['cls']), ('<span class="r-%s">%s</span>' % (RCLS.get(h['rar'], ''), E(h['rar']))) if h['rar'] else '',
                                      ', '.join(types), ('особенность: ' + E(h['feat'])) if h['feat'] else ''] if x)
        extra = ''
        if h['siege']:
            extra += '<div class="use">Бонус в осаде: <b>%s</b></div>' % E(h['siege'])
        if h['dislike']:
            extra += '<div class="use">Неприязнь: %s</div>' % E(h['dislike'])
        if how:
            extra += '<div class="use">Как получить: %s</div>' % E(how)
        return ('<div class="rc hc" id="%s" data-race="%s" data-cls="%s" data-rar="%s" data-types="%s" data-name="%s"><h3>%s</h3><div class="meta">%s</div>'
                '<div class="meta">%s</div>%s%s</div>') % (slug(h['name']), E(h['race']), E(h['cls']), E(h['rar']), E('|'.join(types)), E(h['name'].lower()),
                                                           '<a href="%s%s/">%s</a>' % (hpre, slug(h['name']), E(h['name'])), meta, st, ('<ul style="columns:1">%s</ul>' % sk) if sk else '', extra)

    if H:
        opt = lambda vals: ''.join('<option>%s</option>' % E(v) for v in vals)
        races = sorted({h['race'] for h in H if h['race']})
        clss = sorted({h['cls'] for h in H if h['cls']})
        rars = [r for r in RORD if any(h['rar'] == r for h in H)]
        filt = ('<div class="calc" style="max-width:none;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">'
                '<input id="hq" class="find" style="font-size:16px" type="search" placeholder="Имя героя">'
                '<select id="hr"><option value="">Любая раса</option>%s</select><select id="hc"><option value="">Любой класс</option>%s</select>'
                '<select id="hy"><option value="">Любая редкость</option>%s</select><select id="ht"><option value="">Любой тип</option>%s</select></div>'
                '<p id="hn" style="color:var(--muted)"></p>') % (opt(races), opt(clss), opt(rars), opt([t for _, t in TYPES]))
        body = ('<p class="lead">Все герои «Крушителей подземелий»: %d героев с расой, классом, начальной редкостью, характеристиками, способностями, '
                'бонусом в осаде и тем, как их получить. Отфильтруйте по расе, классу, редкости или типу — осадные, скрытые, событийные, донатные.</p>' % len(H)) +             filt + '<div id="hl">' + ''.join(hcard(h) for h in H) + '</div>' + cta('../../') +             '<p><a href="../skrytye-geroi/">Скрытые герои и как их открыть</a> · <a href="../osada/">Осада</a> · <a href="../">Рецепты крафта</a></p>'
        hjs = '''<script>(function(){var q=document.getElementById('hq'),r=document.getElementById('hr'),c=document.getElementById('hc'),y=document.getElementById('hy'),t=document.getElementById('ht'),n=document.getElementById('hn');
var cards=[].slice.call(document.querySelectorAll('.hc'));function f(){var v=q.value.trim().toLowerCase().replace(/ё/g,'е'),k=0;cards.forEach(function(e){var ok=(!v||e.dataset.name.replace(/ё/g,'е').indexOf(v)>=0)&&(!r.value||e.dataset.race===r.value)&&(!c.value||e.dataset.cls===c.value)&&(!y.value||e.dataset.rar===y.value)&&(!t.value||e.dataset.types.split('|').indexOf(t.value)>=0);e.style.display=ok?'':'none';if(ok)k++;});n.textContent='Показано героев: '+k;}
[q,r,c,y,t].forEach(function(e){e.addEventListener('input',f);e.addEventListener('change',f);});f();})();</script>'''
        write('%s/geroi/index.html' % OUT, page(
            'Герои «Крушителей подземелий»: список всех героев, способности, как получить',
            'Список всех %d героев «Крушителей подземелий»: раса, класс, редкость, характеристики, способности, бонус в осаде и как получить. Фильтр по расе, классу и типу.' % len(H),
            URL + 'geroi/', 'Герои «Крушителей подземелий»', crumb([('Каталог', '../../'), ('Крушители подземелий', '../'), ('Герои', None)]), body,
            [{'@context': 'https://schema.org', '@type': 'ItemList', 'name': 'Герои «Крушителей подземелий»', 'numberOfItems': len(H),
              'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'name': h['name'], 'url': URL + 'geroi/#' + slug(h['name'])} for i, h in enumerate(H)]}],
            extra=hjs))
        # ---------- страница каждого героя ----------
        for h in H:
            sl = slug(h['name'])
            same = [x for x in H if x is not h and x['race'] == h['race'] and h['race']][:6]
            samec = [x for x in H if x is not h and x['cls'] == h['cls'] and h['cls'] and x not in same][:6]
            types = [t for c, t in TYPES if c in h['cats']]
            how = h['how'] if not re.fullmatch(r'[\d\s.,]*', h['how'] or '') else ''
            facts = [('Раса', h['race']), ('Класс', h['cls']), ('Начальная редкость', h['rar']), ('Тип', ', '.join(types)),
                     ('Особенность', h['feat']), ('Неприязнь', h['dislike']), ('Бонус в осаде', h['siege'])]
            rows = ''.join('<tr><th>%s</th><td>%s</td></tr>' % (E(a), E(b)) for a, b in facts if b)
            st = ''.join('<tr><th>%s</th><td class="n">%s</td></tr>' % (a, h[k]) for a, k in (('HP (здоровье)', 'hp'), ('ATK (атака)', 'atk'), ('DEF (защита)', 'def'), ('WIS (мудрость)', 'wis'), ('AGI (ловкость)', 'agi'), ('Сумма', 'sum')) if h[k])
            sk = ''.join('<li>%s%s</li>' % (('<b>%s%s:</b> ' % (E(x['type']), (' ' + E(x['chance'])) if x['chance'] else '')) if x['type'] else '', E(x['text'])) for x in h['skills'])
            rel = lambda xs: ', '.join('<a href="../%s/">%s</a>' % (slug(x['name']), E(x['name'])) for x in xs)
            desc_bits = ', '.join(x for x in [h['race'], h['cls'], ('редкость — ' + h['rar'].lower()) if h['rar'] else ''] if x)
            body = ('<p class="lead">%s — герой «Крушителей подземелий» (Dungeon Crusher)%s. Характеристики, способности%s и как получить героя.</p>' % (
                        E(h['name']), (': ' + E(desc_bits)) if desc_bits else '', ', бонус в осаде' if h['siege'] else '') +
                    '<div class="tbl-wrap"><table class="st">%s</table></div>' % rows +
                    ('<h2>Характеристики</h2><div class="tbl-wrap"><table class="st">%s</table></div>' % st if st else '') +
                    ('<h2>Способности</h2><ul>%s</ul>' % sk if sk else '') +
                    ('<h2>Как получить</h2><p>%s</p>' % E(how) if how else '') +
                    ('<h2>Герои той же расы</h2><p>%s</p>' % rel(same) if same else '') +
                    ('<h2>Герои того же класса</h2><p>%s</p>' % rel(samec) if samec else '') +
                    cta('../../../') + '<p><a href="../">← Все герои</a> · <a href="../../osada/">Осада</a> · <a href="../../">Рецепты крафта</a></p>')
            extra_css = '<style>.tbl-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--card);margin:10px 0 18px;max-width:640px}table.st{border-collapse:collapse;width:100%;font-size:15px}table.st th,table.st td{padding:8px 12px;border-bottom:1px solid var(--line);text-align:left}table.st th{color:var(--muted);font-weight:600;width:45%}table.st td.n{font-variant-numeric:tabular-nums;font-weight:700}</style>'
            write('%s/geroi/%s/index.html' % (OUT, sl), page(
                '%s — герой «Крушителей подземелий»: способности, характеристики, как получить' % h['name'],
                '%s в «Крушителях подземелий»: %s, характеристики, способности%s и как получить.' % (h['name'], desc_bits or 'описание героя', ', бонус в осаде' if h['siege'] else ''),
                URL + 'geroi/' + sl + '/', h['name'],
                crumb([('Каталог', '../../../'), ('Крушители подземелий', '../../'), ('Герои', '../'), (h['name'], None)]), body,
                [{'@context': 'https://schema.org', '@type': 'Article', 'headline': h['name'] + ' — герой «Крушителей подземелий»', 'inLanguage': 'ru'}],
                extra=extra_css))

        hid = [h for h in H if 'Скрытые герои' in h['cats']]
        if hid:
            body = ('<p class="lead">Скрытые герои в «Крушителях подземелий» не продаются в магазине и не выпадают из сундуков: каждый открывается своим способом. '
                    'Здесь — все %d известных скрытых героев, их характеристики, способности и условия получения.</p>' % len(hid)) +                 ''.join(hcard(h, '../geroi/') for h in hid) + cta('../../') + '<p><a href="../geroi/">Все герои</a> · <a href="../">Рецепты крафта</a></p>'
            write('%s/skrytye-geroi/index.html' % OUT, page(
                'Скрытые герои «Крушителей подземелий»: как получить',
                'Все скрытые герои «Крушителей подземелий»: как открыть каждого, характеристики и способности.',
                URL + 'skrytye-geroi/', 'Скрытые герои «Крушителей подземелий»',
                crumb([('Каталог', '../../'), ('Крушители подземелий', '../'), ('Скрытые герои', None)]), body,
                [{'@context': 'https://schema.org', '@type': 'Article', 'headline': 'Скрытые герои «Крушителей подземелий»', 'inLanguage': 'ru'}]))

    # ---------- артефакты ----------
    AR = D.get('artifacts') or []
    if AR:
        TIER = [('S', 'Покупать первыми', ['Жнец душ', 'Лампа призраков'], 'ускоряют прокачку всего остального: Лампу качайте до максимума, Жнеца — пока тёмный ритуал позволяет добавлять уровни.'),
                ('A', 'Урон по клику (арена, последние уровни перед ритуалом)', ['Львиное сердце', 'Катар', 'Крепкая рука', 'Талисман силы', 'Изящный кинжал', 'Кровавая секира', 'Кровавый катар', 'Кровавая перчатка'],
                 'Катар, Крепкую руку и Изящный кинжал — сразу до максимума; Львиное сердце и Талисман силы — постепенно, на остаток после S. Кровавые — по принципу «что дешевле».'),
                ('B', 'Больше боёв на арене', ['Исказитель времени', 'Талисман - Дождь из стрел', 'Талисман - Зов войны', 'Талисман - Покушение', 'Талисман - Первобытное бешенство'],
                 'берите и качайте до максимума, когда их цена станет небольшой на фоне A.'),
                ('C', 'Прогресс в свёрнутой игре', ['Рунный топор', 'Горшок золота', 'Амулет Мидаса', 'Кровавый горшок', 'Кровавая кукла', 'Кроличья лапка', 'Кристалл времени', 'Проклятая кукла', 'Песок времени'],
                 'качайте по остаточному принципу; Рунный топор держите не выше Талисмана силы.'),
                ('D', 'Удобство после тёмного ритуала', ['Волшебная сумка', 'Пространственный портал', 'Кровавый топор'], 'по желанию.'),
                ('E–F', 'Сомнительная польза', ['Рука Мидаса', 'Золотой клевер', 'Проклятый амулет', 'Устрашающий барабан'], 'большинство игроков их не берут.'),
                ('Z', 'Вредные — не покупать', ['Ключ демонов', 'Мимик'], 'ухудшают игру (например, Ключ демонов добавляет здоровье сундукам).')]
        byn = {a['name']: a for a in AR}
        tiers = ''
        for g, title, names, tip in TIER:
            items = ', '.join('<a href="#%s">%s</a>' % (slug(n), E(n)) if n in byn else E(n) for n in names)
            tiers += '<div class="rc"><h3>%s — %s</h3><div class="meta">%s</div><p style="margin:6px 0 0">%s</p></div>' % (g, E(title), items, E(tip[0].upper() + tip[1:]))
        rows = ''
        for sec in OrderedDict.fromkeys(a['sec'] for a in AR):
            rows += '<tr><th colspan="4" style="background:var(--bg)">%s</th></tr>' % E(sec)
            for a in AR:
                if a['sec'] == sec:
                    rows += '<tr id="%s"><td><b>%s</b></td><td>%s</td><td>%s</td><td>%s</td></tr>' % (slug(a['name']), E(a['name']), E(a['levels']), E(a['effect']), E(a['use'] if a['use'] not in ('.', '-') else ''))
        body = ('<p class="lead">Какие артефакты в «Крушителях подземелий» покупать первыми, а какие лучше не брать вовсе: тир-лист от S до Z и таблица всех %d артефактов — за души, за кровавые сердца и особых.</p>' % len(AR) +
                '<div class="toc"><a href="#tier">Тир-лист</a><a href="#pravila">Как прокачивать</a><a href="#vse">Все артефакты</a></div>' +
                '<h2 id="tier">Тир-лист артефактов</h2>' + tiers +
                '<h2 id="pravila">Как прокачивать</h2><ul>'
                '<li>Артефакты остаются у вас навсегда — даже после тёмного ритуала.</li>'
                '<li>Есть три вида: за души, за кровавые сердца и особые (за эпизоды, события и донат).</li>'
                '<li>В начале игры выгоднее качать по одному уровню: покупка пачкой ×25 и больше обходится на пару процентов дороже.</li>'
                '<li>Не обновляйте магазин артефактов без нужды — каждое обновление поднимает цену следующей покупки.</li></ul>' +
                cta('../../') +
                '<h2 id="vse">Все артефакты</h2><div class="tbl-wrap"><table class="st"><tr><th>Артефакт</th><th>Уровней</th><th>Эффект</th><th>Полезность</th></tr>' + rows + '</table></div>' +
                '<p><a href="../">← Рецепты крафта</a> · <a href="../geroi/">Герои</a> · <a href="../osada/">Осада</a></p>')
        extra_css = '<style>.tbl-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--card);margin:10px 0 18px}table.st{border-collapse:collapse;width:100%;font-size:14.5px;min-width:760px}table.st th,table.st td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}table.st th{color:var(--muted);font-size:13px}tr:target td{background:#fff7d6}</style>'
        write('%s/artefakty/index.html' % OUT, page(
            'Артефакты в «Крушителях подземелий»: тир-лист и что качать первым',
            'Тир-лист артефактов «Крушителей подземелий»: что покупать первым (Жнец душ, Лампа призраков), что качать потом и какие артефакты не брать. Таблица всех %d артефактов.' % len(AR),
            URL + 'artefakty/', 'Артефакты: тир-лист и что качать первым',
            crumb([('Каталог', '../../'), ('Крушители подземелий', '../'), ('Артефакты', None)]), body,
            [{'@context': 'https://schema.org', '@type': 'Article', 'headline': 'Артефакты в «Крушителях подземелий»: тир-лист', 'inLanguage': 'ru'}], extra=extra_css))

    # ---------- главная гида ----------
    tiles = ''.join('<a href="%s/">%s<small>%d рецептов</small></a>' % (cid, E(c[0]), counts[cid]) for cid, c in CATS.items() if counts.get(cid))
    tiles += '<a href="kalkulyator-krafta/">Калькулятор крафта<small>катализаторы и ресурсы</small></a>'
    tiles += '<a href="osada/">Осада<small>боссы, очки, пушки по неделям</small></a>'
    if D.get('heroes'):
        tiles += '<a href="geroi/">Герои<small>%d героев, способности, как получить</small></a>' % len(D['heroes'])
        tiles += '<a href="skrytye-geroi/">Скрытые герои<small>как открыть</small></a>'
    if D.get('artifacts'):
        tiles += '<a href="artefakty/">Артефакты<small>тир-лист, что качать первым</small></a>'
    body = ('<p class="lead">Все известные рецепты крафта «Крушителей подземелий» (Dungeon Crusher) на одной странице: %d рецептов оружия, брони, '
            'мифических предметов, рун, осколков героев и материалов. Ищите по названию предмета или ингредиента — например, «шлем», «руна атаки» или «золотой слиток».</p>' % total) + \
        '<input class="find" id="q" type="search" placeholder="Поиск: предмет или ингредиент" autocomplete="off"><div id="res"></div>' + \
        '<h2 style="margin-top:26px">Разделы</h2><div class="types">' + tiles + '</div>' + cta('../') + \
        '''<h2>Как работает крафт</h2>
<p>Крафт в «Крушителях подземелий» — это смешивание ингредиентов по рецепту. У каждого рецепта есть базовый шанс успеха; его поднимают катализаторами — эссенциями удачи (+2,5% за штуку) и магическими бутылками (+1,5%). Одновременно можно положить только один вид катализатора, до 100 штук. Шанс ниже 95% поднимается максимум до 99%, а 95% и выше — до 100%.</p>
<p>Рецепты в игре никто не объявляет: их открывают сами игроки методом проб и ошибок. Если нужного предмета здесь нет — скорее всего, его рецепт ещё не нашли. Нашли рецепт или ошибку — напишите нам, добавим.</p>
<h2>Частые вопросы</h2>
<p><b>Сколько эссенций удачи класть в крафт?</b> Столько, чтобы дойти до 99%: (99 − базовый шанс) ÷ 2,5, с округлением вверх. Для шанса 80% — 8 эссенций, для 60% — 16. Проще — в <a href="kalkulyator-krafta/">калькуляторе</a>.</p>
<p><b>Как сделать эссенцию удачи?</b> Фиолетовая — из 10 глубокополоха или 5 контрафактной воды, шанс 100%. Остальные цвета — в разделе <a href="esencii/">«Эссенции и зелья»</a>.</p>
<p><b>Как скрафтить осколки героя?</b> Рецепты осколков — в разделе <a href="oskolki/">«Осколки героев»</a>.</p>'''
    search_js = '''<script src="data.js"></script>
<script>
(function(){var q=document.getElementById('q'),res=document.getElementById('res');
function norm(s){return s.toLowerCase().replace(/ё/g,'е');}
q.addEventListener('input',function(){var v=norm(q.value.trim());res.innerHTML='';if(v.length<2)return;
var out=[];DC.forEach(function(r){var hit=norm(r[0]).indexOf(v)>=0;var ing=r[4].filter(function(i){return norm(i[0]).indexOf(v)>=0});
if(hit||ing.length)out.push([hit?0:1,r,ing]);});
out.sort(function(a,b){return a[0]-b[0]}).slice(0,40).forEach(function(o){var r=o[1],a=document.createElement('a');a.href=r[1]+'/#'+r[2];
a.innerHTML=r[0]+(r[5]?' <small>· вариант '+r[5]+'</small>':'')+(r[3]!=null?' <small>· шанс '+r[3]+'%</small>':'')+(o[0]?' <small>· нужен: '+o[2].map(function(i){return i[0]+' ×'+i[1]}).join(', ')+'</small>':'');res.appendChild(a);});
if(!out.length)res.innerHTML='<p>Ничего не нашлось. Попробуйте часть слова.</p>';});})();
</script>'''
    ld = [{'@context': 'https://schema.org', '@type': 'WebPage', 'name': 'Рецепты крафта «Крушители подземелий»', 'url': URL,
           'description': 'Все известные рецепты крафта «Крушителей подземелий» с поиском и калькулятором.'}]
    write('%s/index.html' % OUT, page(
        'Крушители подземелий: все рецепты крафта, поиск и калькулятор',
        'Рецепты крафта «Крушителей подземелий»: %d рецептов оружия, брони, мифических предметов, рун и осколков героев. Поиск по ингредиентам и калькулятор эссенций удачи.' % total,
        URL, 'Крушители подземелий: рецепты крафта', crumb([('Каталог', '../'), ('Крушители подземелий', None)]), body, ld, extra=search_js))
    print('Рецептов:', total, counts)


if __name__ == '__main__':
    main()
