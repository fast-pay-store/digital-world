"""Недельный отчёт Яндекс.Вебмастера в Telegram: индекс сайта (ИКС), страницы в поиске, проблемы,
топ запросов, по которым сайт показывают (показы, клики, средняя позиция).
Нужен секрет YANDEX_WEBMASTER_TOKEN (OAuth-токен с правом webmaster:hostinfo). Без него — тихо пропускает.
Только стандартная библиотека Python.
"""
import datetime
import json
import os
import sys
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from check_site import telegram  # noqa: E402

API = 'https://api.webmaster.yandex.net/v4'
HOST_PART = 'fast-pay-store.github.io'
PROBLEMS = {'FATAL': 'фатальные', 'CRITICAL': 'критичные', 'POSSIBLE_PROBLEM': 'возможные', 'RECOMMENDATION': 'рекомендации'}


def get(path, **params):
    url = API + path + ('?' + urllib.parse.urlencode(params, doseq=True) if params else '')
    req = urllib.request.Request(url, headers={'Authorization': 'OAuth ' + os.environ['YANDEX_WEBMASTER_TOKEN']})
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.load(r)


def main():
    if not os.environ.get('YANDEX_WEBMASTER_TOKEN'):
        print('YANDEX_WEBMASTER_TOKEN не задан — пропуск')
        return 0
    uid = get('/user')['user_id']
    hosts = [h for h in get('/user/%s/hosts' % uid).get('hosts', []) if HOST_PART in h.get('ascii_host_url', '')]
    if not hosts:
        telegram('Вебмастер: сайт %s не найден в аккаунте — добавьте его в Яндекс.Вебмастер.' % HOST_PART)
        return 1
    out = ['📈 Яндекс.Вебмастер — неделя']
    to = datetime.date.today()
    fr = to - datetime.timedelta(days=7)
    for h in hosts:
        hid = urllib.parse.quote(h['host_id'], safe='')
        s = get('/user/%s/hosts/%s/summary' % (uid, hid))
        probs = s.get('site_problems', {}) or {}
        out.append('%s\nИКС: %s · в поиске страниц: %s · исключено: %s' % (
            h.get('ascii_host_url'), s.get('sqi', '—'), s.get('searchable_pages_count', '—'), s.get('excluded_pages_count', '—')))
        p = ', '.join('%s %s' % (PROBLEMS.get(k, k), v) for k, v in probs.items() if v)
        if p:
            out.append('Проблемы: ' + p)
        try:
            q = get('/user/%s/hosts/%s/search-queries/popular' % (uid, hid), order_by='TOTAL_SHOWS',
                    query_indicator=['TOTAL_SHOWS', 'TOTAL_CLICKS', 'AVG_SHOW_POSITION'],
                    date_from=fr.isoformat(), date_to=to.isoformat())
            rows = q.get('queries', [])[:15]
            if rows:
                out.append('\nТоп запросов (показы / клики / позиция):')
                for r in rows:
                    i = r.get('indicators', {})
                    out.append('• %s — %s / %s / %.1f' % (r.get('query_text'), int(i.get('TOTAL_SHOWS') or 0),
                                                         int(i.get('TOTAL_CLICKS') or 0), float(i.get('AVG_SHOW_POSITION') or 0)))
            else:
                out.append('Запросов с показами пока нет — сайт ещё набирает индекс.')
        except Exception as e:
            out.append('Запросы: нет данных (%s)' % e)
    msg = '\n'.join(out)
    print(msg)
    telegram(msg)
    return 0


if __name__ == '__main__':
    sys.exit(main())
