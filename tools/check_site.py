"""Проверка сайта: все ли страницы открываются, живы ли ссылки, нет ли SEO-ошибок.

При проблемах шлёт сообщение в Telegram (если заданы секреты TG_BOT_TOKEN и TG_CHAT_ID)
и завершает проверку с ошибкой — тогда GitHub ещё и пришлёт письмо.
Запуск вручную: python tools/check_site.py   (только стандартная библиотека Python)
"""
import concurrent.futures as cf
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
CTX = ssl.create_default_context()
# Сайты, которые часто отвечают роботам 403/429, хотя для людей работают
SOFT_HOSTS = ('vk.com', 'vk.ru', 'm.vk.com', 'ok.ru', 'instagram.com', 'facebook.com', 'x.com', 'twitter.com')
SKIP_HOSTS = ('fonts.googleapis.com', 'fonts.gstatic.com', 'schema.org', 'www.w3.org', 'www.sitemaps.org')


def fetch(url, method='GET', read=True, timeout=25):
    req = urllib.request.Request(url, method=method, headers={'User-Agent': UA, 'Accept-Language': 'ru,en;q=0.8'})
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=CTX) as r:
            return r.status, (r.read() if read else b''), r.geturl()
    except urllib.error.HTTPError as e:
        return e.code, b'', url
    except Exception as e:  # DNS, таймаут, SSL
        return 0, str(e).encode()[:200], url


def check_link(url):
    host = urllib.parse.urlsplit(url).hostname or ''
    code = 0
    for attempt in range(2):  # вторая попытка — на случай случайного сбоя сети
        code, _, _ = fetch(url, read=False)
        if 200 <= code < 400:
            return url, code, 'ok'
        if code in (401, 403, 429) or (code == 0 and host.endswith(SOFT_HOSTS)):
            return url, code, 'warn'
        time.sleep(3)
    return url, code, 'broken'


def page_urls(base):
    """Страницы из sitemap.xml (локального — его делает build_site.py)."""
    sm = open('sitemap.xml', encoding='utf-8').read()
    return re.findall(r'<loc>([^<]+)</loc>', sm)


def links_in(html_text, page_url):
    out = set()
    for m in re.finditer(r'<a\b[^>]*?\shref\s*=\s*("([^"]*)"|\'([^\']*)\'|([^\s>]+))', html_text, re.I):
        href = (m.group(2) or m.group(3) or m.group(4) or '').strip()
        href = href.replace('&amp;', '&')
        if not href or href.startswith(('#', 'mailto:', 'tel:', 'javascript:', 'data:')):
            continue
        u = urllib.parse.urljoin(page_url, href).split('#')[0]
        if u.startswith(('http://', 'https://')) and not (urllib.parse.urlsplit(u).hostname or '').endswith(SKIP_HOSTS):
            out.add(u)
    return out


def seo_issues(html_text, url):
    head = html_text[:400_000]
    issues = []
    if not re.search(r'<title[^>]*>\s*[^<\s]', head, re.I):
        issues.append('нет заголовка <title>')
    if not re.search(r'<meta[^>]+name\s*=\s*"?description', head, re.I) and \
       not re.search(r'name\s*=\s*"?description"?[^>]*>', head, re.I):
        issues.append('нет описания (meta description)')
    if re.search(r'<meta[^>]+robots[^>]+noindex', head, re.I) and not url.endswith('404.html'):
        issues.append('стоит запрет индексации (noindex)')
    if 'rel="icon"' not in head and "rel=icon" not in head:
        issues.append('нет значка сайта (favicon)')
    c = re.search(r'<link[^>]+rel\s*=\s*"?canonical"?[^>]+href\s*=\s*"?([^"\s>]+)', head, re.I)
    if c and urllib.parse.unquote(c.group(1)).rstrip('/') != urllib.parse.unquote(url).rstrip('/'):
        issues.append('canonical указывает на другой адрес: ' + c.group(1))
    return issues


def telegram(text):
    token, chat = os.environ.get('TG_BOT_TOKEN'), os.environ.get('TG_CHAT_ID')
    if not token or not chat:
        print('(Telegram не настроен: нет секретов TG_BOT_TOKEN / TG_CHAT_ID)')
        return False
    data = urllib.parse.urlencode({'chat_id': chat, 'text': text[:4000], 'disable_web_page_preview': 'true'}).encode()
    try:
        with urllib.request.urlopen('https://api.telegram.org/bot%s/sendMessage' % token, data=data, timeout=20) as r:
            ok = json.load(r).get('ok')
            print('Telegram:', 'отправлено' if ok else 'ошибка')
            return bool(ok)
    except Exception as e:
        print('Telegram: ошибка', e)
        return False


def main():
    cfg = json.load(open('site.json', encoding='utf-8'))
    base = cfg['base_url'].rstrip('/') + '/'
    extra = cfg.get('check_also', [])
    pages = page_urls(base)
    broken, warns, seo = [], [], []
    all_links = {}

    print('Проверяю страниц: %d' % len(pages))
    for url in pages:
        code, body, _ = fetch(url, timeout=60)
        if not (200 <= code < 300):
            broken.append('СТРАНИЦА %s → %s' % (urllib.parse.unquote(url), code or body.decode(errors='ignore')))
            continue
        text = body.decode('utf-8', errors='ignore')
        for i in seo_issues(text, url):
            seo.append('%s: %s' % (urllib.parse.unquote(url), i))
        size_mb = len(body) / 1e6
        if size_mb > 5:
            warns.append('%s: тяжёлая страница %.1f МБ — медленно открывается с телефона' % (urllib.parse.unquote(url), size_mb))
        for l in links_in(text, url):
            all_links.setdefault(l, url)
    for u in extra:
        all_links.setdefault(u, 'site.json')

    print('Проверяю ссылок: %d' % len(all_links))
    with cf.ThreadPoolExecutor(max_workers=8) as ex:
        for url, code, state in ex.map(check_link, sorted(all_links)):
            where = urllib.parse.unquote(all_links[url])
            if state == 'broken':
                broken.append('ССЫЛКА %s → %s (на странице %s)' % (urllib.parse.unquote(url), code or 'нет ответа', where))
            elif state == 'warn':
                warns.append('ссылка %s ответила %s (возможно, защита от роботов)' % (urllib.parse.unquote(url), code))

    report = []
    if broken:
        report += ['❌ Не работает:'] + ['• ' + b for b in broken]
    if seo:
        report += ['', '⚠️ Поисковики:'] + ['• ' + s for s in seo]
    if warns:
        report += ['', 'ℹ️ Замечания:'] + ['• ' + w for w in warns]
    text = '\n'.join(report) if report else '✅ Всё в порядке'
    print('\n' + text)

    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a', encoding='utf-8') as f:
            f.write('## Проверка сайта\n\nСтраниц: %d, ссылок: %d\n\n```\n%s\n```\n' % (len(pages), len(all_links), text))

    problem = bool(broken or seo)
    if problem or os.environ.get('SEND_ALWAYS') == 'true':
        head = '🔎 Проверка сайта %s\n' % base
        telegram(head + text)
    return 1 if problem else 0


if __name__ == '__main__':
    sys.exit(main())
