"""Еженедельная проверка скорости и SEO всех страниц (Lighthouse — тот же движок, что у Google PageSpeed).
Читает отчёты lh/*.json (их делает workflow site-speed.yml), шлёт сводку в Telegram.
Оценки 0–100: Скорость (телефон), SEO, Доступность, Качество кода.
"""
import glob
import json
import os
import sys
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from check_site import telegram  # noqa: E402

NAMES = {'performance': 'Скорость', 'seo': 'SEO', 'accessibility': 'Доступн.', 'best-practices': 'Код'}
LIMIT = {'performance': 70, 'seo': 90, 'accessibility': 80, 'best-practices': 80}


def main():
    rows, bad = [], []
    for f in sorted(glob.glob('lh/*.json')):
        try:
            d = json.load(open(f, encoding='utf-8'))
        except Exception:
            continue
        url = d.get('finalDisplayedUrl') or d.get('requestedUrl', f)
        short = urllib.parse.unquote(url).split('/digital-world/')[-1].strip('/') or 'главная'
        sc = {k: round((d['categories'][k]['score'] or 0) * 100) for k in NAMES if k in d.get('categories', {})}
        lcp = d.get('audits', {}).get('largest-contentful-paint', {}).get('displayValue', '')
        rows.append((short, sc, lcp))
        low = [NAMES[k] + ' ' + str(v) for k, v in sc.items() if v < LIMIT[k]]
        if low:
            # главная причина по SEO/скорости — самые «дорогие» проваленные проверки
            fails = [a['title'] for a in d.get('audits', {}).values()
                     if a.get('score') is not None and a['score'] < 0.5 and a.get('scoreDisplayMode') == 'binary'][:3]
            bad.append('• %s: %s%s' % (short, ', '.join(low), (' — ' + '; '.join(fails)) if fails else ''))
    if not rows:
        print('Нет отчётов Lighthouse')
        return 1
    avg = {k: round(sum(r[1].get(k, 0) for r in rows) / len(rows)) for k in NAMES}
    text = ['📊 Скорость и SEO сайта — %d страниц (телефон)' % len(rows),
            'Среднее: ' + ', '.join('%s %d' % (NAMES[k], avg[k]) for k in NAMES)]
    text += (['', '⚠️ Ниже нормы:'] + bad) if bad else ['', '✅ Все страницы в норме']
    msg = '\n'.join(text)
    print(msg)
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a', encoding='utf-8') as f:
            f.write('## Lighthouse\n\n| Страница | ' + ' | '.join(NAMES.values()) + ' | LCP |\n|' + '---|' * (len(NAMES) + 2) + '\n')
            for short, sc, lcp in rows:
                f.write('| %s | %s | %s |\n' % (short, ' | '.join(str(sc.get(k, '')) for k in NAMES), lcp))
    telegram(msg)
    return 0


if __name__ == '__main__':
    sys.exit(main())
