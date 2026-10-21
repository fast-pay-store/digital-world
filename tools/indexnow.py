"""Сообщает Яндексу (и Bing) через IndexNow, что страницы сайта обновились — так их быстрее переобходят.
Берёт адреса из sitemap.xml. Ключ — в site.json (indexnow_key) и в файле <ключ>.txt в корне.
Запуск: python tools/indexnow.py   (только стандартная библиотека)
"""
import json, os, re, sys, urllib.request, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
cfg = json.load(open('site.json', encoding='utf-8'))
key = cfg.get('indexnow_key')
if not key or not os.path.exists(key + '.txt'):
    print('IndexNow: нет ключа — пропуск'); sys.exit(0)
base = cfg['base_url'].rstrip('/') + '/'
urls = re.findall(r'<loc>([^<]+)</loc>', open('sitemap.xml', encoding='utf-8').read())
body = json.dumps({'host': urllib.parse.urlsplit(base).hostname, 'key': key,
                   'keyLocation': base + key + '.txt', 'urlList': urls}).encode()
for endpoint in ('https://yandex.com/indexnow', 'https://api.indexnow.org/indexnow'):
    req = urllib.request.Request(endpoint, data=body, headers={'Content-Type': 'application/json; charset=utf-8'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print('IndexNow', endpoint, '→', r.status, '(адресов: %d)' % len(urls))
    except urllib.error.HTTPError as e:
        print('IndexNow', endpoint, '→', e.code, e.read()[:200])
    except Exception as e:
        print('IndexNow', endpoint, '→ ошибка', e)
