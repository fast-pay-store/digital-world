"""Раздел «Коды для игр» из kody-data/data.json. Адреса плоские, без промежуточных папок:
  kody-roblox/index.html      — общая страница: коды Роблокс, куда вводить коды, список всех игр
  kody-<slug>/index.html      — коды одной игры (поле platform: roblox | mobile)
Обновление: правится data.json (коды, checked), затем python3 tools/roblox_kody.py && python3 tools/build_site.py.
Реклама РСЯ: если в site.json задан rsya_block (например "R-A-1234567-1"), на каждую страницу ставится один баннер (не всплывающий).
"""
import html, json, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
OUT = 'kody-roblox'          # общая страница «Коды Роблокс + куда вводить»
GP = 'kody-'                 # страницы игр лежат сразу в корне: kody-<slug>/
BASE = 'https://fast-pay-store.github.io/digital-world/'
E = lambda s: html.escape(str(s), quote=True)
MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
MON1 = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']
D = json.load(open('kody-data/data.json', encoding='utf-8'))
CFG = json.load(open('site.json', encoding='utf-8'))
y, m, dd = map(int, D['checked'].split('-'))
DATE = '%d %s %d' % (dd, MON[m - 1], y)
MONTH = '%s %d' % (MON1[m - 1], y)
MY_GAMES = [('pereigray-ii', 'Переиграй ИИ: Битва крепостей'), ('tanki-bitva-s-ii', 'Танки: Битва с ИИ'), ('nauchi-skaynet-strelyat', 'Научи Скайнет стрелять!')]
ICON = ('<link rel="icon" href="%sassets/favicon.svg" type="image/svg+xml">\n<link rel="apple-touch-icon" href="%sassets/apple-touch-icon.png">' % (BASE, BASE))
CSS = '''<style>
.codes{display:grid;gap:8px;margin:12px 0 18px}
.code{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 14px}
.code b{font-family:ui-monospace,Consolas,monospace;font-size:18px;letter-spacing:.3px}
.code span{flex:1;min-width:200px;color:var(--muted)}
.code button{border:1px solid var(--line);background:var(--bg);color:var(--ink);border-radius:8px;padding:6px 12px;cursor:pointer;font-size:14px}
.maybe .code{border-style:dashed}
.exp{color:var(--muted);line-height:1.9}
.exp s{margin-right:10px;white-space:nowrap}
.upd{display:inline-block;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:3px 12px;font-size:14px;margin-bottom:8px}
.gl{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;margin:12px 0 20px}
.gl a{display:block;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;text-decoration:none;color:var(--ink)}
.gl a small{display:block;color:var(--muted);margin-top:4px}
.note{background:var(--card);border-left:4px solid var(--accent2);border-radius:10px;padding:12px 14px;margin:14px 0}
.ad{margin:18px 0;min-height:90px}
</style>'''
JS = '''<script>document.addEventListener('click',function(e){var b=e.target.closest('button[data-c]');if(!b)return;var t=b.getAttribute('data-c');
try{navigator.clipboard.writeText(t);b.textContent='Скопировано';setTimeout(function(){b.textContent='Копировать'},1500)}catch(x){}});</script>'''


_AD = {'n': 0}


def ad(first=False):
    # один баннер на страницу (одинаковый renderTo дважды на странице РСЯ не допускает)
    blk = str(CFG.get('rsya_block') or '').strip()
    if not blk or not first:
        return ''
    i = 'yandex_rtb_' + blk
    return ('<div class="ad"><div id="%s"></div></div>\n<script>window.yaContextCb=window.yaContextCb||[];window.yaContextCb.push(function(){Ya.Context.AdvManager.render({"blockId":"%s","renderTo":"%s"})})</script>' % (i, blk, i))


def ad_head():
    return '<!-- Yandex.RTB -->\n<script>window.yaContextCb=window.yaContextCb||[]</script>\n<script src="https://yandex.ru/ads/system/context.js" async></script>' if CFG.get('rsya_block') else ''


def page(title, desc, url, h1, crumbs, body, ld):
    home = '../' * url.replace(BASE, '').count('/')
    return '''<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{t}</title>
<meta name="description" content="{d}">
<link rel="canonical" href="{u}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Digital World">
<meta property="og:title" content="{t}">
<meta property="og:description" content="{d}">
<meta property="og:url" content="{u}">
<meta property="og:locale" content="ru_RU">
<link rel="stylesheet" href="{home}assets/site.css">
{icon}
<script type="application/ld+json">{ld}</script>
<!-- Файл создаётся автоматически (tools/roblox_kody.py) из kody-data/data.json. Руками не править. -->
{css}
{adh}
</head>
<body>
<header class="top"><div class="wrap"><a href="{home}">Digital World</a><span class="sp"></span><a class="all" href="{home}{OUT}/">Коды для игр</a></div></header>
<main><div class="wrap">
<nav class="crumbs" aria-label="Навигация"><ol>{crumbs}</ol></nav>
<h1 style="font-size:clamp(28px,4vw,40px);line-height:1.15;margin:14px 0 10px">{h1}</h1>
{body}
</div></main>
<footer class="f"><div class="wrap">
<div class="row"><span>Нашли новый код или код не работает?</span><a href="https://vk.com/board215704478" target="_blank" rel="noopener">Напишите во ВКонтакте</a><a href="https://t.me/konctantin777" target="_blank" rel="noopener">Telegram</a></div>
<div class="disclaimer">Неофициальный сайт. Коды выпускают разработчики игр; список сверяется по нескольким трекерам кодов и официальным страницам игр. Roblox — товарный знак Roblox Corporation, названия игр принадлежат их авторам.</div>
</div></footer>
{js}
</body>
</html>
'''.format(t=E(title), d=E(desc), u=E(url), h1=E(h1), body=body, ld=json.dumps(ld, ensure_ascii=False), icon=ICON, css=CSS, adh=ad_head(),
           crumbs=''.join(crumbs), home=home, OUT=OUT, js=JS)


def crumb(items):
    return ['<li aria-current="page">%s</li>' % E(t) if h is None else '<li><a href="%s">%s</a></li>' % (h, E(t)) for t, h in items]


def codes(lst):
    return '<div class="codes">' + ''.join('<div class="code"><b>%s</b><span>%s</span><button type="button" data-c="%s">Копировать</button></div>' % (E(c), E(r), E(c)) for c, r in lst) + '</div>'


def my_games(prefix):
    return ('<h2>Наши игры в Роблоксе</h2><p>Пока ждёте новых кодов — попробуйте наши игры, где соперник — нейросеть, которая учится на каждом бою:</p><div class="gl">' +
            ''.join('<a href="%s%s/">%s<small>Игра Roblox против ИИ</small></a>' % (prefix, s, E(t)) for s, t in MY_GAMES) + '</div>')


def faq_html(faq):
    return '<div class="faq">' + ''.join('<details><summary>%s</summary><p>%s</p></details>' % (E(q), a) for q, a in faq) + '</div>'


def write(path, s):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w', encoding='utf-8', newline='\n').write(s)


HOW_FAQ = [
    ('Куда вводить коды в Роблокс?', 'Коды игр вводятся <b>внутри самой игры</b> — обычно через кнопку «Codes», значок птички Twitter или меню магазина. Промокоды самого Роблокса (на вещи для аватара) вводятся на сайте roblox.com/promocodes, а подарочные карты — на roblox.com/redeem.'),
    ('Бывают ли коды на робуксы?', 'Нет. Бесплатных кодов на робуксы не существует: робуксы дают только подарочные карты, которые покупают за деньги. Сайты «генераторы робуксов» крадут аккаунты.'),
    ('Почему код не работает?', 'Код истёк, вы уже вводили его на этом аккаунте, ошиблись в регистре или вставили лишний пробел. Иногда помогает перезайти на новый сервер.'),
    ('Можно ли вводить коды с телефона?', 'Да. Коды игр вводятся так же, как на ПК — кнопкой в самой игре. Промокоды Роблокса на телефоне вводятся через браузер на roblox.com/promocodes.'),
]


def game_page(g, idx):
    url = BASE + GP + g['slug'] + '/'
    n = len(g['active'])
    same = g['en'].rstrip('!').lower() in g['ru'].lower()
    title = 'Коды %s — %s' % (g['ru'], MONTH) if same else 'Коды %s (%s) — %s' % (g['ru'], g['en'], MONTH)
    rb = g.get('platform', 'roblox') == 'roblox'
    where = ' в Роблоксе' if rb else ''
    if n:
        desc = 'Рабочие коды %s%s на %s: %s. Как ввести код, что дают и список истёкших. Проверено %s.' % (
            g['ru'], where, MONTH, ', '.join(c for c, _ in g['active'][:4]), DATE)
    else:
        desc = 'Есть ли коды %s%s на %s: честный ответ, где их вводить и как получить награды бесплатно. Проверено %s.' % (g['ru'], where, MONTH, DATE)
    b = ['<div class="upd">Проверено: %s</div>' % DATE, '<p>%s</p>' % g['about'], ad(True)]
    b.append('<h2 id="active">Рабочие коды %s</h2>' % E(g['ru']))
    if n:
        b.append('<p>Эти коды работают по данным большинства трекеров на %s:</p>' % DATE + codes(g['active']))
    else:
        b.append('<p><b>Рабочих кодов сейчас нет.</b> Как только разработчик выпустит новый код, он появится здесь.</p>')
    if g['maybe']:
        b.append('<h3>Могут работать — попробуйте</h3><p>По этим кодам трекеры расходятся: одни пишут, что работают, другие — что истекли.</p><div class="maybe">' + codes(g['maybe']) + '</div>')
    b.append('<div class="note">%s</div>' % g['note'])
    b.append('<h2 id="how">Как ввести код в %s</h2><ol class="steps">%s</ol>' % (E(g['ru']), ''.join('<li>%s</li>' % x for x in g['how'])))
    if g['expired']:
        b.append('<h2>Истёкшие коды</h2><p class="exp">%s</p>' % ''.join('<s>%s</s>' % E(c) for c in g['expired']))
    faq = g['faq'] + (HOW_FAQ[1:3] if rb else [])
    b.append('<h2>Вопросы</h2>' + faq_html(faq))
    b.append(ad())
    others = [x for x in D['games'] if x['slug'] != g['slug']]
    b.append('<h2>Коды других игр</h2><div class="gl">' + ''.join('<a href="../%s%s/">Коды %s<small>%s</small></a>' % (GP, x['slug'], E(x['ru']), E(x['en'])) for x in others) +
             '<a href="../%s/">Все коды для игр<small>и куда их вводить</small></a></div>' % OUT)
    b.append(my_games('../'))
    ld = [{'@context': 'https://schema.org', '@type': 'Article', 'headline': title, 'description': desc, 'url': url, 'inLanguage': 'ru',
           'dateModified': D['checked'], 'datePublished': '2026-11-06', 'author': {'@type': 'Organization', 'name': 'Digital World'}},
          {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [
              {'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': html.unescape(__import__('re').sub('<[^>]+>', '', a))}} for q, a in faq]},
          {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
              {'@type': 'ListItem', 'position': 1, 'name': 'Digital World', 'item': BASE},
              {'@type': 'ListItem', 'position': 2, 'name': 'Коды для игр', 'item': BASE + OUT + '/'},
              {'@type': 'ListItem', 'position': 3, 'name': 'Коды ' + g['ru'], 'item': url}]}]
    h1 = ('Коды %s в Роблоксе — %s' if g.get('platform', 'roblox') == 'roblox' else 'Коды %s — %s') % (g['ru'], MONTH)
    write(GP + g['slug'] + '/index.html', page(title, desc, url, h1, crumb([('Главная', '../'), ('Коды для игр', '../' + OUT + '/'), ('Коды ' + g['ru'], None)]), '\n'.join(b), ld))


def hub():
    url = BASE + OUT + '/'
    title = 'Коды Роблокс (%s) — рабочие коды игр и куда их вводить' % MONTH
    desc = 'Рабочие коды для игр Роблокс и мобильных игр на %s: 99 ночей в лесу, Найди иглу, бокс, волейбол, Построй пирамиду, ММ2, Tiles Survive. Куда вводить коды в Роблокс. Проверено %s.' % (MONTH, DATE)
    def tiles(lst):
        return '<div class="gl">' + ''.join('<a href="../' + GP + '%s/">Коды %s<small>%s · %s</small></a>' % (g['slug'], E(g['ru']), E(g['en']),
                ('рабочих: %d' % len(g['active'])) if g['active'] else 'кодов нет') for g in lst) + '</div>'
    rbx = [g for g in D['games'] if g.get('platform', 'roblox') == 'roblox']
    mob = [g for g in D['games'] if g.get('platform', 'roblox') != 'roblox']
    b = ['<div class="upd">Проверено: %s</div>' % DATE,
         '<p>Здесь собраны коды популярных игр Роблокса и мобильных игр на русском. Мы сверяем каждый код по нескольким трекерам и честно отмечаем, какие точно работают, а какие — под вопросом. Без «кодов на робуксы» и прочего обмана.</p>', ad(True),
         '<h2>Коды для игр Роблокс</h2>' + tiles(rbx),
         ('<h2>Коды для мобильных игр</h2>' + tiles(mob)) if mob else '',
         '<h2 id="kuda">Куда вводить коды в Роблокс</h2>',
         '<p>В Роблоксе три разных вида кодов, и вводятся они в разных местах:</p><ol class="steps">'
         '<li><b>Коды игр</b> (как на этом сайте) — внутри конкретной игры. Ищите кнопку «Codes», значок птички Twitter, книжку или пункт в магазине. Код одной игры в другой не работает.</li>'
         '<li><b>Промокоды Роблокса</b> на бесплатные вещи для аватара — на сайте roblox.com/promocodes (в браузере, и с телефона тоже).</li>'
         '<li><b>Подарочные карты</b> на робуксы и Premium — на roblox.com/redeem. Такие карты продаются в магазинах за деньги.</li></ol>',
         '<h2>Вопросы</h2>' + faq_html(HOW_FAQ), ad(), my_games('../')]
    ld = [{'@context': 'https://schema.org', '@type': 'CollectionPage', 'name': title, 'description': desc, 'url': url, 'inLanguage': 'ru', 'dateModified': D['checked']},
          {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [
              {'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': __import__('re').sub('<[^>]+>', '', a)}} for q, a in HOW_FAQ]}]
    write(OUT + '/index.html', page(title, desc, url, 'Коды Роблокс и других игр — %s' % MONTH, crumb([('Главная', '../'), ('Коды для игр', None)]), '\n'.join(b), ld))


if __name__ == '__main__':
    for i, g in enumerate(D['games']):
        game_page(g, i)
    hub()
    print('Коды Роблокс: страниц', len(D['games']) + 1)
