"""Раздел «Пасьянсы онлайн» из pasyansy-data/data.json. Адреса плоские:
  pasyans-<slug>/index.html — один пасьянс: игра прямо на странице (iframe на pasyans-app/?g=<id>) + правила, советы, вопросы
  pasyansy-onlayn/index.html — список всех пасьянсов + ссылка на игру «Пасьянсы» во ВКонтакте (13 в одном меню)
Сама игра — pasyans-app/ (копия игры из RuStore/ВК, noindex). Запуск: python3 tools/pasyansy_pages.py && python3 tools/build_site.py
"""
import html, json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
BASE = 'https://digitalworld-games.ru/'
HUB = 'pasyansy-onlayn'
E = lambda s: html.escape(str(s), quote=True)
D = json.load(open('pasyansy-data/data.json', encoding='utf-8'))
RULES = {}
for f in os.listdir('pasyans-app/src/games'):
    t = open('pasyans-app/src/games/' + f, encoding='utf-8').read()
    m = re.search(r"id: '(\w+)'", t)
    r = re.search(r"rules: \[(.*?)\],\n", t, re.S)
    if m and r:
        RULES[m.group(1)] = re.findall(r"'((?:[^'\\]|\\.)*)'", r.group(1))
ICON = ('<link rel="icon" href="%sassets/favicon.svg" type="image/svg+xml">\n<link rel="apple-touch-icon" href="%sassets/apple-touch-icon.png">' % (BASE, BASE))
CSS = '''<style>
.gamebox{position:relative;background:#14532d;border-radius:14px;overflow:hidden;margin:10px 0 8px;height:min(80vh,760px);min-height:460px;box-shadow:0 6px 24px rgba(0,0,0,.18)}
.gamebox iframe{display:block;width:100%;height:100%;border:0}
.gbar{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin:0 0 18px;color:var(--muted);font-size:14px}
.gbar button{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:8px;padding:7px 14px;cursor:pointer;font-size:14px}
.gl{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin:12px 0 20px}
.gl a{display:block;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;text-decoration:none;color:var(--ink)}
.gl a small{display:block;color:var(--muted);margin-top:4px}
.note{background:var(--card);border-left:4px solid var(--accent2);border-radius:10px;padding:12px 14px;margin:14px 0}
</style>'''
JS = '''<script>(function(){var b=document.getElementById('fs'),f=document.getElementById('gf');if(!b||!f)return;
b.onclick=function(){var r=f.requestFullscreen||f.webkitRequestFullscreen;if(r){r.call(f)}else{location.href=f.src}};})();</script>'''
DIFF = {1: 'лёгкий', 2: 'средний', 3: 'сложный'}


def page(title, desc, url, h1, crumbs, body, ld):
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
<link rel="stylesheet" href="../assets/site.css">
{icon}
<script type="application/ld+json">{ld}</script>
<!-- Файл создаётся автоматически (tools/pasyansy_pages.py) из pasyansy-data/data.json. Руками не править. -->
{css}
</head>
<body>
<header class="top"><div class="wrap"><a href="../">Digital World</a><span class="sp"></span><a class="all" href="../{hub}/">Все пасьянсы</a></div></header>
<main><div class="wrap">
<nav class="crumbs" aria-label="Навигация"><ol>{crumbs}</ol></nav>
<h1 style="font-size:clamp(26px,4vw,38px);line-height:1.15;margin:14px 0 10px">{h1}</h1>
{body}
</div></main>
<footer class="f"><div class="wrap">
<div class="row"><span>Нашли ошибку в пасьянсе?</span><a href="https://vk.com/board215704478" target="_blank" rel="noopener">Напишите во ВКонтакте</a><a href="https://t.me/konctantin777" target="_blank" rel="noopener">Telegram</a></div>
<div class="disclaimer">Пасьянсы бесплатны, без регистрации и без всплывающей рекламы. Прогресс сохраняется в вашем браузере.</div>
</div></footer>
{js}
</body>
</html>
'''.format(t=E(title), d=E(desc), u=E(url), h1=E(h1), body=body, ld=json.dumps(ld, ensure_ascii=False), icon=ICON, css=CSS,
           crumbs=''.join(crumbs), hub=HUB, js=JS)


def crumb(items):
    return ''.join('<li aria-current="page">%s</li>' % E(t) if h is None else '<li><a href="%s">%s</a></li>' % (h, E(t)) for t, h in items)


def faq_html(faq):
    return '<div class="faq">' + ''.join('<details><summary>%s</summary><p>%s</p></details>' % (E(q), E(a)) for q, a in faq) + '</div>'


def vk_box():
    return ('<div class="note"><b>Все 13 пасьянсов в одной игре</b> — с «пасьянсом дня», коллекцией рубашек и столов и пасьянсом на желание: '
            '<a href="%s" target="_blank" rel="noopener">игра «Пасьянсы» во ВКонтакте</a>. Играть можно и здесь — нажмите «К пасьянсам» в игре.</div>' % D['vk'])


def write(path, s):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w', encoding='utf-8', newline='\n').write(s)


def game_page(g, diff):
    url = BASE + g['slug'] + '/'
    b = ['<div class="gamebox"><iframe id="gf" src="../pasyans-app/?g=%s" title="%s — играть" allow="fullscreen" allowfullscreen></iframe></div>' % (g['id'], E(g['q'])),
         '<div class="gbar"><button type="button" id="fs">Во весь экран</button><span>Сложность: %s · бесплатно · без регистрации · отмена хода и подсказки</span></div>' % DIFF.get(diff, 'средний'),
         '<p>%s</p>' % E(g['intro'][0]),
         '<p>%s</p>' % E(g['intro'][1]),
         '<h2 id="pravila">Правила пасьянса «%s»</h2><ol class="steps">%s</ol>' % (E(g['name']), ''.join('<li>%s</li>' % E(r) for r in RULES.get(g['id'], []))),
         '<h2 id="sovety">Как чаще выигрывать</h2><ul>%s</ul>' % ''.join('<li>%s</li>' % E(t) for t in g['tips']),
         '<h2>Вопросы</h2>' + faq_html(g['faq']),
         vk_box(),
         '<h2>Другие пасьянсы онлайн</h2><div class="gl">' + ''.join('<a href="../%s/">%s<small>%s</small></a>' % (x['slug'], E(x['q']), E(DIFF.get(x['diff'], ''))) for x in D['games'] if x['slug'] != g['slug']) + '</div>']
    ld = [{'@context': 'https://schema.org', '@type': 'VideoGame', 'name': g['q'], 'description': g['desc'], 'url': url, 'inLanguage': 'ru',
           'genre': 'Пасьянс', 'gamePlatform': 'Браузер', 'applicationCategory': 'GameApplication', 'operatingSystem': 'Браузер',
           'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'RUB'}},
          {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [
              {'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in g['faq']]},
          {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
              {'@type': 'ListItem', 'position': 1, 'name': 'Digital World', 'item': BASE},
              {'@type': 'ListItem', 'position': 2, 'name': 'Пасьянсы онлайн', 'item': BASE + HUB + '/'},
              {'@type': 'ListItem', 'position': 3, 'name': g['q'], 'item': url}]}]
    write(g['slug'] + '/index.html', page(g['title'], g['desc'], url, g['q'] + ' онлайн — играть бесплатно',
          crumb([('Главная', '../'), ('Пасьянсы онлайн', '../%s/' % HUB), (g['name'], None)]), '\n'.join(b), ld))


def hub(diffs):
    url = BASE + HUB + '/'
    title = 'Пасьянсы онлайн бесплатно — Косынка, Паук, Свободная ячейка и ещё 10'
    desc = '13 пасьянсов онлайн бесплатно и без регистрации: Косынка, Паук, Свободная ячейка, Пирамида, Три пика, Юкон, Часы и другие. Играйте прямо в браузере.'
    groups = []
    for d in (1, 2, 3):
        lst = [g for g in D['games'] if diffs[g['id']] == d]
        groups.append('<h2>%s пасьянсы</h2><div class="gl">%s</div>' % ({1: 'Лёгкие', 2: 'Средние', 3: 'Сложные'}[d],
                      ''.join('<a href="../%s/">%s<small>%s</small></a>' % (g['slug'], E(g['q']), E(g['about'])) for g in lst)))
    b = ['<p>Здесь собраны 13 пасьянсов, в которые можно играть прямо в браузере — на компьютере и на телефоне. Без скачивания, регистрации и всплывающей рекламы. '
         'В каждом пасьянсе есть отмена хода, подсказки и сохранение партии: можно закрыть страницу и продолжить позже.</p>'] + groups + [
         vk_box(),
         '<h2>Какой пасьянс выбрать</h2><ul>'
         '<li><b>Для отдыха</b> — Три пика, Гольф, Монте-Карло: короткие партии и простые правила.</li>'
         '<li><b>Классика</b> — Косынка и Паук с одной мастью.</li>'
         '<li><b>Подумать</b> — Свободная ячейка и Калькулятор: почти любой расклад решается расчётом.</li>'
         '<li><b>Испытание</b> — Сорок разбойников, Паук на 4 масти, Гармошка в одну стопку.</li>'
         '<li><b>Погадать</b> — Часы: исход решает расклад, как в старинном гадании.</li></ul>']
    ld = [{'@context': 'https://schema.org', '@type': 'CollectionPage', 'name': title, 'description': desc, 'url': url, 'inLanguage': 'ru'},
          {'@context': 'https://schema.org', '@type': 'ItemList', 'itemListElement': [
              {'@type': 'ListItem', 'position': i + 1, 'url': BASE + g['slug'] + '/', 'name': g['q']} for i, g in enumerate(D['games'])]}]
    write(HUB + '/index.html', page(title, desc, url, 'Пасьянсы онлайн — 13 пасьянсов бесплатно', crumb([('Главная', '../'), ('Пасьянсы онлайн', None)]), '\n'.join(b), ld))


if __name__ == '__main__':
    diffs = {}
    for g in D['games']:
        t = open('pasyans-app/src/games/%s.js' % g['id'], encoding='utf-8').read()
        diffs[g['id']] = int(re.search(r'diff: (\d)', t).group(1))
        g['diff'] = diffs[g['id']]
        g['about'] = re.search(r"about: '([^']*)'", t).group(1)
    for g in D['games']:
        game_page(g, diffs[g['id']])
    hub(diffs)
    print('Пасьянсы: страниц', len(D['games']) + 1, '; правил найдено для', len(RULES))
