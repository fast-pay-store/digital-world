"""Собирает главную страницу (список страниц сайта), sitemap.xml и 404.html.

Страница сайта = любая папка в корне репозитория, где есть index.html.
Название и описание берутся из <title> и <meta name="description"> этой страницы.
Порядок и исключения — в site.json. Запуск: python tools/build_site.py
Только стандартная библиотека Python — ничего устанавливать не нужно.
"""
import glob
import html
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.parse import quote

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)


class HeadParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title, self.desc, self.robots, self.first_p = '', '', '', ''
        self._in_title = self._in_p = False

    def handle_starttag(self, tag, attrs):
        a = {k.lower(): (v or '') for k, v in attrs}
        if tag == 'title' and not self.title:
            self._in_title = True
        elif tag == 'meta':
            name = (a.get('name') or a.get('property') or '').lower()
            if name == 'description' and not self.desc:
                self.desc = a.get('content', '')
            elif name == 'og:description' and not self.desc:
                self.desc = a.get('content', '')
            elif name == 'robots':
                self.robots = a.get('content', '')
        elif tag == 'p' and not self.first_p:
            self._in_p = True

    def handle_endtag(self, tag):
        if tag == 'title':
            self._in_title = False
        if tag == 'p':
            self._in_p = False

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        elif self._in_p and len(self.first_p) < 400:
            self.first_p += data


def short(text, limit=170):
    text = re.sub(r'\s+', ' ', text or '').strip()
    if len(text) <= limit:
        return text
    cut = text[:limit]
    dot = max(cut.rfind('. '), cut.rfind('! '), cut.rfind('? '))
    return (cut[:dot + 1] if dot > 60 else cut.rsplit(' ', 1)[0] + '…')


def git_date(path):
    try:
        out = subprocess.run(['git', 'log', '-1', '--format=%cI', '--', path],
                             capture_output=True, text=True, timeout=20).stdout.strip()
        if out:
            return datetime.fromisoformat(out)
    except Exception:
        pass
    return datetime.fromtimestamp(os.path.getmtime(path), tz=timezone.utc)


def read_page(folder):
    path = os.path.join(folder, 'index.html')
    with open(path, encoding='utf-8', errors='ignore') as f:
        head = f.read(400_000)  # большие сохранённые страницы — читаем только начало
    p = HeadParser()
    try:
        p.feed(head)
    except Exception:
        pass
    title = re.sub(r'\s+', ' ', p.title).strip() or folder
    desc = short(p.desc or p.first_p)
    if desc.lower().startswith('подробности в источнике'):
        desc = ''
    cat = ''
    pj = os.path.join(folder, 'page.json')
    if os.path.exists(pj):
        try:
            cat = json.load(open(pj, encoding='utf-8')).get('category', '')
        except Exception:
            pass
    return {
        'category': cat,
        'folder': folder,
        'url_path': quote(folder) + '/',
        'title': title,
        'desc': desc,
        'noindex': 'noindex' in p.robots.lower(),
        'date': git_date(path),
    }


def main():
    cfg = json.load(open('site.json', encoding='utf-8'))
    base = cfg['base_url'].rstrip('/') + '/'
    exclude = set(cfg.get('exclude', []))
    pages = []
    for name in sorted(os.listdir('.')):
        if name.startswith(('.', '_')) or name in exclude or not os.path.isdir(name):
            continue
        if os.path.isfile(os.path.join(name, 'index.html')):
            pages.append(read_page(name))

    order = cfg.get('order', [])
    pages.sort(key=lambda p: (order.index(p['folder']) if p['folder'] in order else len(order),
                              -p['date'].timestamp()))
    listed = [p for p in pages if not p['noindex']]  # черновики (noindex) на главной не показываем

    # ---------- главная (по категориям) ----------
    cat_of = cfg.get('category_of', {})
    for p in pages:
        p['category'] = p['category'] or cat_of.get(p['folder'], 'servisy')
    groups = []
    for c in cfg.get('categories', [{'id': '', 'name': 'Страницы', 'about': ''}]):
        items = [p for p in listed if p['category'] == c['id'] or (not c['id'])]
        if not items:
            continue
        cards = ''.join(
            '<a class="card" href="{u}"><h3>{t}</h3>{d}<span class="go">Открыть →</span></a>'.format(
                u=html.escape(p['url_path']), t=html.escape(p['title']),
                d=('<p>' + html.escape(p['desc']) + '</p>') if p['desc'] else '') for p in items)
        groups.append('<section class="cat" id="{id}"><h2>{n} <span class="n">{k}</span></h2><p class="about">{a}</p>'
                      '<div class="grid">{c}</div></section>'.format(id=html.escape(c['id']), n=html.escape(c['name']),
                      k=len(items), a=html.escape(c.get('about', '')), c=cards))
    nav = ''.join('<a href="#{}">{}</a>'.format(html.escape(c['id']), html.escape(c['name']))
                  for c in cfg.get('categories', []) if any(p['category'] == c['id'] for p in listed))
    cards = groups
    items_ld = [{'@type': 'ListItem', 'position': i + 1, 'url': base + p['url_path'], 'name': p['title']}
                for i, p in enumerate(listed)]
    ld = json.dumps({'@context': 'https://schema.org', '@type': 'ItemList', 'itemListElement': items_ld},
                    ensure_ascii=False, indent=1)
    tpl = open(os.path.join('tools', 'index_template.html'), encoding='utf-8').read()
    out = (tpl.replace('{{TITLE}}', html.escape(cfg['title']))
              .replace('{{HEADING}}', html.escape(cfg['heading']))
              .replace('{{DESCRIPTION}}', html.escape(cfg['description']))
              .replace('{{BASE}}', html.escape(base))
              .replace('{{CONTACT_URL}}', html.escape(cfg['contact_url']))
              .replace('{{CONTACT_TEXT}}', html.escape(cfg['contact_text']))
              .replace('{{COUNT}}', str(len(listed)))
              .replace('{{CARDS}}', '\n'.join(cards)).replace('{{NAV}}', nav)
              .replace('{{JSONLD}}', ld))
    write('index.html', out)

    # ---------- 404 ----------
    t404 = open(os.path.join('tools', '404_template.html'), encoding='utf-8').read()
    write('404.html', t404.replace('{{BASE}}', html.escape(base))
                          .replace('{{CONTACT_URL}}', html.escape(cfg['contact_url'])))

    # ---------- sitemap ----------
    newest = max([p['date'] for p in pages] or [datetime.now(timezone.utc)])
    rows = ['  <url><loc>{}</loc><lastmod>{}</lastmod></url>'.format(base, newest.date().isoformat())]
    for p in pages:
        if p['noindex']:
            continue
        rows.append('  <url><loc>{}</loc><lastmod>{}</lastmod></url>'.format(
            html.escape(base + p['url_path']), p['date'].date().isoformat()))
    # вложенные страницы (например, справочник Shop Titans: папка/тип/index.html)
    for deep in cfg.get('deep', []):
        for f in sorted(glob.glob(os.path.join(deep, '*', 'index.html'))):
            rows.append('  <url><loc>{}</loc><lastmod>{}</lastmod></url>'.format(
                html.escape(base + quote(os.path.dirname(f).replace(os.sep, '/')) + '/'), git_date(f).date().isoformat()))
    write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n'
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + '\n'.join(rows) + '\n</urlset>\n')

    # без Jekyll: страницы отдаются как есть и сайт обновляется быстрее
    write('.nojekyll', '')

    # счётчик Яндекс.Метрики и цели на кнопках (если указан metrika_id в site.json)
    inject_metrika(cfg)

    print('Страниц: %d (в sitemap: %d)' % (len(pages), sum(1 for p in pages if not p['noindex'])))
    for p in listed:
        print('  %s %s — %s' % ('[noindex]' if p['noindex'] else '        ', p['folder'], p['title']))


METRIKA = '''<!-- metrika:start (вставляется автоматически tools/build_site.py, номер — site.json → metrika_id) -->
<script type="text/javascript">
(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();
for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
(window,document,'script','https://mc.yandex.ru/metrika/tag.js?id=%(id)s','ym');
ym(%(id)s,'init',{ssr:true,webvisor:true,clickmap:true,ecommerce:"dataLayer",referrer:document.referrer,url:location.href,accurateTrackBounce:true,trackLinks:true});
document.addEventListener("click",function(e){var el=e.target;if(!el||!el.closest)return;
if(el.closest(".digiseller-buy-standalone")&&el.closest("button,a,input[type=submit]")){ym(%(id)s,"reachGoal","checkout");return;}
var a=el.closest("a[href]");if(!a)return;var h=a.href;
var g=/widget\\.html|oplata-lko\\.html|oplata\\.info|digiseller|keys\\.shop|plati\\.market/.test(h)?"buy":/drive\\.google|disk\\.yandex|vk\\.(com|ru)\\/topic-/.test(h)?"download":/vk\\.(com|ru)\\/app\\d|roblox\\.com\\/games|script\\.google\\.com/.test(h)?"play":/t\\.me\\/|vk\\.(com|ru)\\/board/.test(h)?"contact":"";
if(g)ym(%(id)s,"reachGoal",g);},true);
</script>
<noscript><div><img src="https://mc.yandex.ru/watch/%(id)s" style="position:absolute;left:-9999px" alt=""></div></noscript>
<!-- metrika:end -->
'''


def inject_metrika(cfg):
    mid = str(cfg.get('metrika_id') or '').strip()
    files = ['index.html', '404.html', 'widget.html', 'oplata-lko.html'] + glob.glob('*/index.html') + glob.glob('*/*/index.html')
    n = 0
    for f in files:
        if not os.path.isfile(f):
            continue
        s = open(f, encoding='utf-8').read()
        s2 = re.sub(r'<!-- metrika:start.*?<!-- metrika:end -->\n?', '', s, flags=re.S)
        if mid.isdigit():
            s2 = s2.replace('</head>', METRIKA % {'id': mid} + '</head>', 1)
        if s2 != s:
            write(f, s2)
            n += 1
    if mid.isdigit():
        print('Метрика %s: обновлено страниц %d' % (mid, n))


def write(path, text):
    old = open(path, encoding='utf-8').read() if os.path.exists(path) else None
    if old != text:
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            f.write(text)


if __name__ == '__main__':
    sys.exit(main())
