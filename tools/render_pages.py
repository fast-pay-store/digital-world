"""Собирает страницы товаров из файлов содержания: <папка>/page.json → <папка>/index.html.

Зачем так: текст хранится отдельно от оформления. Править текст — в page.json,
оформление — в assets/site.css и здесь. Каждая страница получает всё, что нужно поисковикам:
title, description, canonical, Open Graph, хлебные крошки, разметку schema.org (программа, FAQ),
настоящие заголовки H1/H2/H3, картинки WebP с подписями (alt) и ленивой загрузкой,
блок ссылок на другие страницы сайта.
Запуск: python tools/render_pages.py   (только стандартная библиотека Python)
"""
import glob
import html
import json
import os
import re
import struct
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from build_site import read_page  # noqa: E402

E = lambda s: html.escape(str(s), quote=True)


def webp_size(path):
    with open(path, 'rb') as f:
        d = f.read(40)
    if d[12:16] == b'VP8 ':
        w, h = struct.unpack('<HH', d[26:30])
        return w & 0x3fff, h & 0x3fff
    if d[12:16] == b'VP8L':
        b = struct.unpack('<I', d[21:25])[0]
        return (b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1
    if d[12:16] == b'VP8X':
        return int.from_bytes(d[24:27], 'little') + 1, int.from_bytes(d[27:30], 'little') + 1
    return None, None


def img_tag(folder, name, alt, eager=False, sizes='(max-width: 860px) 100vw, 520px'):
    files = sorted(glob.glob(os.path.join(folder, 'img', name + '-*.webp')),
                   key=lambda p: int(re.search(r'-(\d+)\.webp$', p).group(1)))
    if not files:
        raise SystemExit('Нет картинки %s/img/%s-*.webp' % (folder, name))
    big = files[-1]
    w, h = webp_size(big)
    srcset = ', '.join('img/%s %sw' % (os.path.basename(p), re.search(r'-(\d+)\.webp$', p).group(1)) for p in files)
    attrs = 'fetchpriority="high"' if eager else 'loading="lazy" decoding="async"'
    return '<img src="img/%s" srcset="%s" sizes="%s" width="%d" height="%d" alt="%s" %s>' % (
        os.path.basename(big), srcset, sizes, w, h, E(alt), attrs), 'img/' + os.path.basename(big)


def buttons(items):
    out = []
    for b in items or []:
        cls = 'btn' + ({'ghost': ' ghost', 'green': ' green'}.get(b.get('kind', ''), ''))
        ext = '' if b['href'].startswith(('#', '../', '/')) else ' target="_blank" rel="noopener"'
        out.append('<a class="%s" href="%s"%s>%s</a>' % (cls, E(b['href']), ext, E(b['text'])))
    return '<div class="btns">%s</div>' % ''.join(out) if out else ''


def section(folder, s, alt):
    body = []
    for p in s.get('paras', []):
        body.append('<p>%s</p>' % p)  # абзацы могут содержать <b>, <a> — пишутся вручную
    if s.get('cards'):
        body.append('<div class="cards">' + ''.join(
            '<div class="card">%s<h3>%s</h3><p>%s</p></div>' % (
                ('<div class="ic" aria-hidden="true">%s</div>' % c['icon']) if c.get('icon') else '',
                E(c['h3']), c['text']) for c in s['cards']) + '</div>')
    if s.get('steps'):
        body.append('<ol class="steps">' + ''.join('<li>%s</li>' % x for x in s['steps']) + '</ol>')
    if s.get('ticks'):
        if s.get('ticks_title'):
            body.append('<h3>%s</h3>' % E(s['ticks_title']))
        body.append('<ul class="ticks">' + ''.join('<li>%s</li>' % x for x in s['ticks']) + '</ul>')
    for p in s.get('after', []):
        body.append('<p>%s</p>' % p)
    if s.get('callout'):
        body.append('<div class="callout">%s</div>' % s['callout'])
    if s.get('faq'):
        body.append('<div class="faq">' + ''.join(
            '<details><summary>%s</summary><p>%s</p></details>' % (E(q['q']), q['a']) for q in s['faq']) + '</div>')
    body.append(buttons(s.get('buttons')))
    text = ('<span class="kicker">%s</span>' % E(s['kicker']) if s.get('kicker') else '') + \
           '<h2>%s</h2>' % E(s['h2']) + ''.join(body)
    if s.get('image'):
        im, _ = img_tag(folder, s['image']['name'], s['image']['alt'])
        cap = '<figcaption>%s</figcaption>' % E(s['image']['caption']) if s['image'].get('caption') else ''
        inner = '<div class="split%s"><div>%s</div><figure>%s%s</figure></div>' % (
            ' rev' if s['image'].get('left') else '', text, im, cap)
    else:
        inner = text
    return '<section class="s%s" id="%s"><div class="wrap">%s</div></section>' % (
        ' alt' if alt else '', E(s.get('id', '')), inner)


def render(folder, cfg, all_pages):
    d = json.load(open(os.path.join(folder, 'page.json'), encoding='utf-8'))
    base = cfg['base_url'].rstrip('/') + '/'
    url = base + folder + '/'
    hero_img, hero_src = img_tag(folder, d['hero_image']['name'], d['hero_image']['alt'], eager=True)

    faq = [q for s in d['sections'] for q in s.get('faq', [])]
    cats = {c['id']: c['name'] for c in cfg.get('categories', [])}
    cat_id = d.get('category', '')
    cat_name = cats.get(cat_id, 'Каталог')
    app = {
        '@context': 'https://schema.org', '@type': d.get('schema_type', 'SoftwareApplication'),
        'name': d['app_name'], 'description': d['description'], 'url': url,
        'applicationCategory': d.get('app_category', 'GameApplication'),
        'operatingSystem': d.get('os', 'Windows'), 'inLanguage': 'ru',
        'image': url + hero_src,
        'publisher': {'@type': 'Organization', 'name': 'Digital World', 'url': base},
    }
    if d.get('game_platform'):
        app['gamePlatform'] = d['game_platform']
    if d.get('offers_free'):
        app['offers'] = {'@type': 'Offer', 'price': '0', 'priceCurrency': 'RUB'}
    ld = [app, {
        '@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
            {'@type': 'ListItem', 'position': 1, 'name': 'Каталог', 'item': base},
            {'@type': 'ListItem', 'position': 2, 'name': cat_name, 'item': base + '#' + cat_id},
            {'@type': 'ListItem', 'position': 3, 'name': d['h1'], 'item': url}]
    }]
    if faq:
        ld.append({'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [
            {'@type': 'Question', 'name': q['q'],
             'acceptedAnswer': {'@type': 'Answer', 'text': re.sub('<[^>]+>', '', q['a'])}} for q in faq]})

    others = [p for p in all_pages if p['folder'] != folder and not p['noindex']]
    same = [p for p in others if p.get('category') == cat_id]
    others = (same + [p for p in others if p not in same])[:9]
    others_html = ''.join('<a href="../%s">%s<small>%s</small></a>' % (
        E(p['url_path']), E(p['title']), E(p['desc'][:110] + ('…' if len(p['desc']) > 110 else ''))) for p in others)

    sections = ''.join(section(folder, s, i % 2 == 0) for i, s in enumerate(d['sections']))
    pass_note = '<div class="note-pass">%s</div>' % d['hero_note'] if d.get('hero_note') else ''

    page = '''<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Digital World">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{img}">
<meta property="og:locale" content="ru_RU">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="../assets/site.css">
<link rel="icon" href="https://fast-pay-store.github.io/digital-world/assets/favicon.svg" type="image/svg+xml">
<link rel="icon" href="https://fast-pay-store.github.io/digital-world/assets/favicon-120.png" sizes="120x120" type="image/png">
<link rel="apple-touch-icon" href="https://fast-pay-store.github.io/digital-world/assets/apple-touch-icon.png">
<script type="application/ld+json">{ld}</script>
<!-- Файл создаётся автоматически из page.json (tools/render_pages.py). Текст правьте в page.json. -->
</head>
<body>
<header class="top"><div class="wrap"><a href="../">Digital World</a><span class="sp"></span><a class="all" href="../">Все программы</a></div></header>
<main>
<div class="wrap">
<nav class="crumbs" aria-label="Навигация"><ol><li><a href="../">Каталог</a></li><li><a href="../#{cat_id}">{cat_name}</a></li><li aria-current="page">{h1}</li></ol></nav>
<div class="hero">
<div><h1>{h1}</h1><p class="lead">{lead}</p>{cta}{note}</div>
<div>{hero_img}</div>
</div>
</div>
{sections}
<section class="s"><div class="wrap"><h2>{others_h}</h2><div class="others">{others}</div></div></section>
</main>
<footer class="f"><div class="wrap">
<div class="row"><span>Вопросы, активация, помощь:</span>{contacts}</div>
<div class="disclaimer">{disclaimer}</div>
</div></footer>
</body>
</html>
'''.format(title=E(d['title']), desc=E(d['description']), url=E(url), img=E(url + hero_src),
           ld=json.dumps(ld, ensure_ascii=False), h1=E(d['h1']), cat_id=E(cat_id), cat_name=E(cat_name), lead=d['lead'], cta=buttons(d.get('hero_buttons')),
           note=pass_note, hero_img=hero_img, sections=sections, others=others_html, others_h=E(d.get('others_title', 'Другие программы и игры')),
           contacts=''.join('<a href="%s" target="_blank" rel="noopener">%s</a>' % (E(c['href']), E(c['text'])) for c in d.get('contacts', [])),
           disclaimer=d.get('disclaimer', ''))
    with open(os.path.join(folder, 'index.html'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(page)
    return len(page)


def main():
    cfg = json.load(open('site.json', encoding='utf-8'))
    folders = sorted(os.path.dirname(p) for p in glob.glob('*/page.json'))
    # для блока «Другие программы» нужны названия всех страниц сайта
    all_pages = [read_page(n) for n in sorted(os.listdir('.'))
                 if os.path.isdir(n) and not n.startswith(('.', '_')) and n not in cfg.get('exclude', [])
                 and os.path.isfile(os.path.join(n, 'index.html'))]
    cat_of = cfg.get('category_of', {})
    for p in all_pages:
        p['category'] = p['category'] or cat_of.get(p['folder'], 'servisy')
    for folder in folders:
        n = render(folder, cfg, all_pages)
        print('Собрана страница %s (%d КБ)' % (folder, n // 1024))


if __name__ == '__main__':
    main()
