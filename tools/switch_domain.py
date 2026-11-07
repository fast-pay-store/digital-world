"""Перевод сайта на свой домен (одна команда).
Запуск: python3 tools/switch_domain.py https://digitalworld-games.ru/
Что делает: меняет старый адрес https://fast-pay-store.github.io/digital-world/ на новый во ВСЕХ текстовых файлах
репозитория (site.json, page.json, генераторы, шаблоны, готовые страницы), создаёт CNAME и robots.txt,
пересобирает генерируемые разделы и главную/sitemap. После — commit + push.
ВАЖНО: запускать только когда домен уже открывается (DNS указывает на GitHub Pages), иначе ссылки будут вести в никуда.
"""
import os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
OLD = 'https://fast-pay-store.github.io/digital-world/'
NEW = (sys.argv[1] if len(sys.argv) > 1 else 'https://digitalworld-games.ru/').rstrip('/') + '/'
EXT = ('.html', '.json', '.py', '.xml', '.txt', '.js', '.md', '.css', '.yml')
n = 0
for dp, dn, fn in os.walk('.'):
    if '.git' in dp.split(os.sep):
        continue
    for f in fn:
        if not f.endswith(EXT) or f == 'switch_domain.py':
            continue
        p = os.path.join(dp, f)
        try:
            s = open(p, encoding='utf-8').read()
        except Exception:
            continue
        s2 = s.replace(OLD, NEW).replace(OLD.rstrip('/'), NEW.rstrip('/'))
        if s2 != s:
            open(p, 'w', encoding='utf-8', newline='\n').write(s2)
            n += 1
host = NEW.split('//', 1)[1].strip('/')
open('CNAME', 'w').write(host + '\n')
open('robots.txt', 'w').write('User-agent: *\nAllow: /\n\nSitemap: %ssitemap.xml\n' % NEW)
print('Заменено в файлах:', n, '| CNAME =', host)
for cmd in (['python3', 'tools/render_pages.py'], ['python3', 'tools/roblox_kody.py'], ['python3', 'tools/krushiteli_pages.py'],
            ['python3', 'tools/shoptitans_pages.py'], ['python3', 'tools/build_site.py']):
    if os.path.exists(cmd[1]):
        r = subprocess.run(cmd, capture_output=True, text=True)
        print(cmd[1], 'OK' if r.returncode == 0 else 'ОШИБКА: ' + r.stderr[-300:])
