"""Собирает справочник Shop Titans из shoptitans/data.json (его скачивает tools/shoptitans_fetch.py):
  shoptitans-spravochnik/index.html           — главная справочника: поиск по всем предметам, разделы, объяснения
  shoptitans-spravochnik/<тип>/index.html     — страница типа (мечи, топоры…): таблица цен, рынка и крафта
  shoptitans-spravochnik/search.json          — данные для поиска
  shoptitans-spravochnik/shoptitans-ceny.csv  — все цены одним файлом (для Excel и ботов)
Только стандартная библиотека Python.
"""
import csv
import html
import io
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
OUT = 'shoptitans-spravochnik'
BASE = 'https://fast-pay-store.github.io/digital-world/'
URL = BASE + OUT + '/'
BOT = 'shoptitans-bot/'
QUAL = ['Обычное', 'Превосходное', 'Безупречное', 'Эпическое', 'Легендарное']
MULT = [1, 1.25, 2, 3, 5]
E = lambda s: html.escape(str(s), quote=True)
TR = dict(zip('абвгдеёжзийклмнопрстуфхцчшщъыьэюя', ['a', 'b', 'v', 'g', 'd', 'e', 'e', 'zh', 'z', 'i', 'y', 'k', 'l', 'm', 'n', 'o', 'p', 'r',
                                                 's', 't', 'u', 'f', 'h', 'ts', 'ch', 'sh', 'sch', '', 'y', '', 'e', 'yu', 'ya']))
ICON = ('<link rel="icon" href="%sassets/favicon.svg" type="image/svg+xml">\n<link rel="icon" href="%sassets/favicon-120.png" sizes="120x120" type="image/png">\n'
        '<link rel="apple-touch-icon" href="%sassets/apple-touch-icon.png">' % (BASE, BASE, BASE))


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', ''.join(TR.get(c, c) for c in s.lower())).strip('-')


def money(v):
    v = int(v or 0)
    for d, s in ((1_000_000_000, ' млрд'), (1_000_000, ' млн'), (1_000, ' тыс.')):
        if v >= d:
            x = v / d
            return ('%.2f' % x).rstrip('0').rstrip('.').replace('.', ',') + s
    return str(v)


def dur(sec):
    sec = int(sec or 0)
    d, r = divmod(sec, 86400)
    h, r = divmod(r, 3600)
    m = r // 60
    parts = (['%d д' % d] if d else []) + (['%d ч' % h] if h else []) + (['%d мин' % m] if m and not d else [])
    return ' '.join(parts) or '—'


def trade(s):
    try:
        lo, hi = s.split(';')
        return [int(x) for x in lo.split(',')], [int(x) for x in hi.split(',')]
    except Exception:
        return [0] * 5, [0] * 5


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
<link rel="stylesheet" href="{css}">
{icon}
<script type="application/ld+json">{ld}</script>
<!-- Файл создаётся автоматически (tools/shoptitans_pages.py) из данных официального сайта playshoptitans.com -->
<style>
.tbl-wrap{{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--card)}}
table.st{{border-collapse:collapse;width:100%;font-size:14.5px;min-width:900px}}
table.st th,table.st td{{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}}
table.st th{{position:sticky;top:0;background:var(--bg);font-size:13px;color:var(--muted);font-weight:600;cursor:pointer;white-space:nowrap}}
table.st td.n{{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}}
table.st td small{{color:var(--muted)}}
table.st tr:hover td{{background:var(--bg)}}
.types{{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;margin:12px 0 22px}}
.types a{{display:block;padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:var(--card);text-decoration:none;color:var(--ink);font-weight:600}}
.types a:hover{{border-color:var(--accent)}}
.types small{{display:block;color:var(--muted);font-weight:400}}
.find{{width:100%;max-width:560px;padding:12px 14px;font-size:17px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--ink)}}
#res{{margin-top:12px}}
.cta{{display:flex;flex-wrap:wrap;gap:12px;align-items:center;background:var(--card);border:1px solid var(--line);border-left:4px solid var(--accent2);border-radius:12px;padding:16px 18px;margin:22px 0}}
.cta p{{margin:0;flex:1;min-width:240px}}
</style>
</head>
<body>
<header class="top"><div class="wrap"><a href="{home}">Digital World</a><span class="sp"></span><a class="all" href="{home}">Все программы</a></div></header>
<main><div class="wrap">
<nav class="crumbs" aria-label="Навигация"><ol>{crumbs}</ol></nav>
<h1 style="font-size:clamp(28px,4vw,40px);line-height:1.15;margin:14px 0 10px">{h1}</h1>
{body}
</div></main>
<footer class="f"><div class="wrap">
<div class="row"><span>Вопросы:</span><a href="https://t.me/konctantin777" target="_blank" rel="noopener">Telegram @konctantin777</a><a href="https://vk.com/board215704478" target="_blank" rel="noopener">ВКонтакте</a></div>
<div class="disclaimer">Неофициальный справочник. Данные — с официального сайта <a href="https://playshoptitans.com/ru" target="_blank" rel="noopener">playshoptitans.com</a>, обновляются еженедельно. Shop Titans — товарный знак Kabam.</div>
</div></footer>
</body>
</html>
'''.format(t=E(title), d=E(desc), u=E(url), h1=E(h1), body=body, ld=json.dumps(ld, ensure_ascii=False), icon=ICON,
           crumbs=''.join(crumbs), css=('../' * url.replace(BASE, '').count('/')) + 'assets/site.css',
           home='../' * url.replace(BASE, '').count('/'))


def cta(prefix='../'):
    return ('<div class="cta"><p><b>Бот для Shop Titans</b> сам собирает ресурсы, производит товары и работает с рынком 24/7. '
            'Демо-версия бесплатно.</p><a class="btn" href="%s">Подробнее о боте</a></div>' % (prefix + BOT))


def main():
    d = json.load(open('shoptitans/data.json', encoding='utf-8'))
    N, T, items = d['names'], d['types'], d['items']
    for t in T.values():
        t['title'] = t['plural'] or t['name']
        t['slug'] = slug(t['title'])
    by = {}
    for it in items:
        by.setdefault(it['type'], []).append(it)
    os.makedirs(OUT, exist_ok=True)
    upd = d.get('updated', '')

    # ---------- страницы типов ----------
    order = [tp for tp in T if tp in by]
    for tp in order:
        t = T[tp]
        rows = sorted(by[tp], key=lambda x: (-int(x['level'] or 0), N.get(x['uid'], '')))
        top = max(rows, key=lambda x: x['value'])
        lv = [int(x['level'] or 0) for x in rows]
        tr = []
        for it in rows:
            lo, hi = trade(it['tradeMinMaxValue'])
            res = ', '.join('%s ×%s' % (E(N.get(it[r], it[r])), it[q]) for r, q in
                            (('resource1', 'r1Qty'), ('resource2', 'r2Qty'), ('resource3', 'r3Qty'),
                             ('component1', 'c1Qty'), ('component2', 'c2Qty')) if it.get(r))
            tr.append('<tr><td><b>{n}</b><br><small>тир {tier}</small></td><td class="n">{lv}</td><td class="n">{v0}</td><td class="n">{v4}</td>'
                      '<td class="n">{lo0} – {hi0}</td><td class="n">{lo4} – {hi4}</td><td class="n">{tm}</td><td>{res}</td></tr>'.format(
                          n=E(N.get(it['uid'], it['uid'])), tier=it['tier'], lv=it['level'], v0=money(it['value']),
                          v4=money(it['value'] * 5), lo0=money(lo[0]), hi0=money(hi[0]), lo4=money(lo[4]), hi4=money(hi[4]),
                          tm=dur(it['time']), res=res or '—'))
        others = ''.join('<a href="../%s/">%s</a> · ' % (T[o]['slug'], E(T[o]['title'])) for o in order if o != tp and T[o]['cat'] == t['cat'])
        title = '%s в Shop Titans — цены продажи, рынок и крафт (%d шт.)' % (t['title'], len(rows))
        desc = ('%s в Shop Titans (%d шт.): цена продажи по качествам, мин. и макс. цена на рынке, время крафта, '
                'ресурсы и компоненты. Уровни %d–%d. Данные с официального сайта.' % (t['title'], len(rows), min(lv), max(lv)))[:200]
        body = ('<p class="lead">В таблице — весь раздел «{title}» в Shop Titans: {cnt} шт., уровни {a}–{b}. Самый дорогой — <b>{top}</b> '
                '(цена продажи {tv} за обычное качество). Нажмите на заголовок столбца, чтобы отсортировать.</p>'
                '<div class="tbl-wrap"><table class="st" id="t"><thead><tr><th>Предмет</th><th>Ур.</th><th>Цена продажи<br>обычное</th>'
                '<th>Цена продажи<br>легендарное</th><th>Рынок, обычное<br>мин – макс</th><th>Рынок, легендарное<br>мин – макс</th>'
                '<th>Крафт</th><th>Ресурсы и компоненты</th></tr></thead><tbody>{rows}</tbody></table></div>'
                '<p class="note-pass" style="margin-top:10px">Цена продажи для других качеств: превосходное ×1,25, безупречное ×2, эпическое ×3, легендарное ×5 от обычного. '
                'Данные на {upd}. <a href="../">Поиск по всем предметам</a> · <a href="../shoptitans-ceny.csv">Скачать все цены (CSV)</a></p>'
                '{cta}<h2 style="font-size:22px;margin-top:26px">Другие разделы: {cat}</h2><p>{others}</p>').format(
            cnt=len(rows), title=E(t['title']), a=min(lv), b=max(lv), top=E(N.get(top['uid'], '')), tv=money(top['value']),
            rows=''.join(tr), upd=E(upd), cta=cta('../../'), cat=E(d['categories'][t['cat']]), others=others.rstrip(' · '))
        body += SORT_JS
        url = URL + t['slug'] + '/'
        ld = [{'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'Каталог', 'item': BASE},
            {'@type': 'ListItem', 'position': 2, 'name': 'Справочник Shop Titans', 'item': URL},
            {'@type': 'ListItem', 'position': 3, 'name': t['title'], 'item': url}]},
            {'@context': 'https://schema.org', '@type': 'Dataset', 'name': title, 'description': desc, 'url': url, 'inLanguage': 'ru',
             'isBasedOn': 'https://playshoptitans.com/ru/blueprints', 'dateModified': upd}]
        crumbs = ['<li><a href="../../">Каталог</a></li>', '<li><a href="../">Справочник Shop Titans</a></li>',
                  '<li aria-current="page">%s</li>' % E(t['title'])]
        os.makedirs(os.path.join(OUT, t['slug']), exist_ok=True)
        open(os.path.join(OUT, t['slug'], 'index.html'), 'w', encoding='utf-8', newline='\n').write(
            page(title, desc, url, '%s в Shop Titans: цены, рынок и крафт' % t['title'], crumbs, body, ld))

    # ---------- поиск и CSV ----------
    search = [[N.get(it['uid'], it['uid']), T[it['type']]['slug'], it['level'], it['value'], trade(it['tradeMinMaxValue'])[0][0],
               trade(it['tradeMinMaxValue'])[1][0], T[it['type']]['name']] for it in items]
    json.dump(search, open(os.path.join(OUT, 'search.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=';')
    w.writerow(['uid', 'Название', 'Тип', 'Уровень', 'Тир'] + ['Цена продажи: ' + q for q in QUAL] +
               ['Рынок мин: ' + q for q in QUAL] + ['Рынок макс: ' + q for q in QUAL] + ['Крафт, сек'])
    for it in sorted(items, key=lambda x: (x['type'], -int(x['level'] or 0))):
        lo, hi = trade(it['tradeMinMaxValue'])
        w.writerow([it['uid'], N.get(it['uid'], ''), T[it['type']]['name'], it['level'], it['tier']] +
                   [int(it['value'] * m) for m in MULT] + lo + hi + [it['time']])
    open(os.path.join(OUT, 'shoptitans-ceny.csv'), 'w', encoding='utf-8-sig', newline='').write(buf.getvalue())

    # ---------- главная справочника ----------
    blocks = ''
    for cat, cname in d['categories'].items():
        links = ''.join('<a href="%s/">%s<small>%d шт.</small></a>' % (T[tp]['slug'], E(T[tp]['title']), len(by[tp]))
                        for tp in order if T[tp]['cat'] == cat)
        blocks += '<h2 style="font-size:22px;margin:22px 0 4px">%s</h2><div class="types">%s</div>' % (E(cname), links)
    faq = [('Что такое цена продажи?', 'Это базовая стоимость предмета — за сколько его покупают посетители лавки (NPC) при обычном качестве. '
            'Для других качеств: превосходное ×1,25, безупречное ×2, эпическое ×3, легендарное ×5.'),
           ('Что значит «рынок мин – макс»?', 'Это пределы, в которых игра разрешает выставлять предмет на рынке для каждого качества. '
            'Купить на рынке дешевле цены продажи — выгодная сделка: предмет можно сразу продать посетителю дороже.'),
           ('Откуда данные и насколько они свежие?', 'С официального сайта playshoptitans.com. Справочник обновляется автоматически раз в неделю — дата обновления указана на странице.'),
           ('Можно скачать все цены?', 'Да — файл shoptitans-ceny.csv открывается в Excel и Google Таблицах.')]
    body = ('<p class="lead">Все {n} предметов Shop Titans на русском: цена продажи посетителям по качествам, допустимые цены на рынке, '
            'время крафта, ресурсы и компоненты. Данные с официального сайта, обновляются каждую неделю (последнее обновление: {upd}).</p>'
            '<input class="find" id="q" type="search" placeholder="Найти предмет: например, «меч» или «Кольцо Мидаса»" autocomplete="off">'
            '<div id="res"></div>{blocks}{cta}'
            '<section class="faq" style="margin-top:20px"><h2 style="font-size:22px">Частые вопросы</h2>{faq}</section>'
            '<p><a class="btn ghost" href="shoptitans-ceny.csv">Скачать все цены (CSV, {n} предметов)</a></p>').format(
        n=len(items), upd=E(upd), blocks=blocks, cta=cta('../'),
        faq=''.join('<details><summary>%s</summary><p>%s</p></details>' % (E(q), E(a)) for q, a in faq)) + SEARCH_JS
    title = 'Справочник Shop Titans: цены всех предметов, рынок и крафт (%d шт.)' % len(items)
    desc = 'Все %d предметов Shop Titans на русском: цена продажи по качествам, мин. и макс. цены на рынке, время крафта и ресурсы. Поиск, таблицы, скачать CSV.' % len(items)
    ld = [{'@context': 'https://schema.org', '@type': 'Dataset', 'name': title, 'description': desc, 'url': URL, 'inLanguage': 'ru',
           'isBasedOn': 'https://playshoptitans.com/ru/blueprints', 'dateModified': upd,
           'distribution': [{'@type': 'DataDownload', 'encodingFormat': 'text/csv', 'contentUrl': URL + 'shoptitans-ceny.csv'}]},
          {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [
              {'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in faq]}]
    crumbs = ['<li><a href="../">Каталог</a></li>', '<li><a href="../#servisy">Сервисы и гайды</a></li>',
              '<li aria-current="page">Справочник Shop Titans</li>']
    open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8', newline='\n').write(
        page(title, desc, URL, 'Справочник Shop Titans: цены предметов, рынок и крафт', crumbs, body, ld))
    print('Справочник Shop Titans: %d предметов, %d страниц типов' % (len(items), len(order)))


SORT_JS = '''<script>
(function(){var t=document.getElementById('t');if(!t)return;var num=function(s){s=s.replace(/\\s/g,'').replace(',', '.');var m=s.match(/([\\d.]+)(млрд|млн|тыс\\.)?/);if(!m)return NaN;var v=parseFloat(m[1]);return v*({'млрд':1e9,'млн':1e6,'тыс.':1e3}[m[2]]||1)};
t.querySelectorAll('th').forEach(function(th,i){th.title='Сортировать';th.addEventListener('click',function(){var b=t.tBodies[0],r=[].slice.call(b.rows),dir=th.dataset.d==='1'?-1:1;th.dataset.d=dir===1?'1':'0';
r.sort(function(a,c){var x=a.cells[i].innerText,y=c.cells[i].innerText,nx=num(x),ny=num(y);return(!isNaN(nx)&&!isNaN(ny)?nx-ny:x.localeCompare(y,'ru'))*dir});r.forEach(function(x){b.appendChild(x)})})})})();
</script>'''

SEARCH_JS = '''<script>
(function(){var q=document.getElementById('q'),res=document.getElementById('res'),data=null;
function money(v){v=+v;var u=[[1e9,' млрд'],[1e6,' млн'],[1e3,' тыс.']];for(var i=0;i<u.length;i++)if(v>=u[i][0])return (v/u[i][0]).toFixed(2).replace(/\\.?0+$/,'').replace('.',',')+u[i][1];return ''+v}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function show(){var s=q.value.trim().toLowerCase();if(s.length<2){res.innerHTML='';return}
var r=data.filter(function(x){return x[0].toLowerCase().indexOf(s)>=0||x[6].toLowerCase().indexOf(s)>=0}).slice(0,40);
res.innerHTML=r.length?'<div class="tbl-wrap"><table class="st" style="min-width:600px"><thead><tr><th>Предмет</th><th>Тип</th><th>Ур.</th><th>Цена продажи</th><th>Рынок (обычное)</th></tr></thead><tbody>'+r.map(function(x){return '<tr><td><a href="'+x[1]+'/">'+esc(x[0])+'</a></td><td>'+esc(x[6])+'</td><td class="n">'+x[2]+'</td><td class="n">'+money(x[3])+'</td><td class="n">'+money(x[4])+' – '+money(x[5])+'</td></tr>'}).join('')+'</tbody></table></div>':'<p>Ничего не найдено.</p>'}
q.addEventListener('input',function(){if(data)return show();fetch('search.json').then(function(r){return r.json()}).then(function(d){data=d;show()})});})();
</script>'''

if __name__ == '__main__':
    main()
