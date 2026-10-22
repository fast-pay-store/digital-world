"""Скачивает справочник предметов Shop Titans с официального сайта playshoptitans.com.

Как это работает (официальный сайт — Next.js, данные отдаются JSON-ом):
  1) берём buildId из страницы https://playshoptitans.com/ru/blueprints/weapons/ws (тег __NEXT_DATA__);
  2) для каждого раздела запрашиваем
     https://playshoptitans.com/_next/data/<buildId>/ru/blueprints/<категория>/<тип>.json?category=<категория>&type=<тип>
     → pageProps.items (предметы) + pageProps.texts (русские названия: <uid>_name, item_type_<тип>).
Результат: shoptitans/data.json. Только стандартная библиотека Python.
"""
import json
import os
import re
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = 'https://playshoptitans.com'
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36'}
SECTIONS = {
    'weapons': ['ws', 'wa', 'wd', 'wm', 'wp', 'wb', 'wc', 'wg', 'wt', 'ww', 'wh', 'wi', 'wy', 'w2'],
    'armor': ['ah', 'am', 'al', 'hh', 'hm', 'hl', 'hk', 'gh', 'gl', 'bh', 'bl'],
    'accessories': ['xs', 'xr', 'xa', 'xc', 'xf', 'xq', 'xx', 'xi', 'fd', 'fm', 'uh', 'up', 'us'],
    'stones': ['xu', 'xm'],
}
CAT_RU = {'weapons': 'Оружие', 'armor': 'Броня', 'accessories': 'Аксессуары', 'stones': 'Камни'}
TYPE_KEY = {'ws': 'sword', 'wa': 'axe', 'wd': 'dagger', 'wm': 'mace', 'wp': 'spear', 'wb': 'bow', 'wc': 'crossbow', 'wg': 'gun',
            'wt': 'staff', 'ww': 'wand', 'wh': 'scythe', 'wi': 'instrument', 'wy': 'catalyst', 'w2': 'dualwield',
            'ah': 'armorheavy', 'am': 'armormedium', 'al': 'armorlight', 'hh': 'helmet', 'hm': 'roguehat', 'hl': 'hat', 'hk': 'mask',
            'gh': 'gauntlets', 'gl': 'bracers', 'bh': 'boots', 'bl': 'shoes', 'xs': 'shield', 'xr': 'ring', 'xa': 'amulet',
            'xc': 'cloak', 'xf': 'familiar', 'xq': 'quiver', 'xx': 'aurastone', 'xi': 'idol', 'fd': 'dessert', 'fm': 'meal',
            'uh': 'herb', 'up': 'potion', 'us': 'scrolls', 'xu': 'rune', 'xm': 'moonstone'}
RES_RU = {'iron': 'Железо', 'wood': 'Дерево', 'leather': 'Кожа', 'herbs': 'Травы', 'steel': 'Сталь', 'ironwood': 'Железное дерево',
          'fabric': 'Ткань', 'oils': 'Масла', 'mana': 'Мана', 'essence': 'Эссенция', 'stardust': 'Звёздная пыль', 'gems': 'Самоцветы'}
KEEP = ['uid', 'level', 'type', 'tier', 'value', 'tradeMinMaxValue', 'time', 'xp', 'favor', 'atk', 'def', 'hp', 'eva', 'crit',
        'worker1', 'worker2', 'worker3', 'resource1', 'r1Qty', 'resource2', 'r2Qty', 'resource3', 'r3Qty',
        'component1', 'c1Qty', 'component2', 'c2Qty', 'elementAffinity', 'spiritAffinity', 'excl']


def get(url):
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
                return r.read().decode('utf-8')
        except Exception as e:
            if i == 2:
                raise
            time.sleep(3)


def main():
    html = get(BASE + '/ru/blueprints/weapons/ws')
    build = json.loads(re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', html, re.S).group(1))['buildId']
    items, names, types = {}, {}, {}
    for cat, tps in SECTIONS.items():
        for tp in tps:
            url = '%s/_next/data/%s/ru/blueprints/%s/%s.json?category=%s&type=%s' % (BASE, build, cat, tp, cat, tp)
            d = json.loads(get(url))['pageProps']
            t = d.get('texts', {})
            for it in d.get('items', []):
                row = {k: it.get(k) for k in KEEP}
                row['cat'] = cat
                items[it['uid']] = row
                names[it['uid']] = t.get(it['uid'] + '_name', it['uid'])
                for k in ('resource1', 'resource2', 'resource3', 'component1', 'component2', 'worker1', 'worker2', 'worker3'):
                    v = it.get(k)
                    if v and v not in names:
                        names[v] = t.get(v + '_name') or t.get('worker_' + v) or t.get(v) or v
            key = TYPE_KEY.get(tp, tp)
            types[tp] = {'cat': cat, 'key': key, 'name': t.get('item_type_' + key, tp), 'plural': t.get('item_type_plural_' + key, '')}
            print('%s/%s: %d' % (cat, tp, len(d.get('items', []))))
            time.sleep(0.5)
    for k, v in RES_RU.items():
        if names.get(k, k) == k:
            names[k] = v
    os.makedirs(os.path.join(ROOT, 'shoptitans'), exist_ok=True)
    out = {'source': BASE, 'buildId': build, 'updated': time.strftime('%Y-%m-%d'), 'categories': CAT_RU,
           'types': types, 'names': names, 'items': list(items.values())}
    json.dump(out, open(os.path.join(ROOT, 'shoptitans', 'data.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    print('Всего предметов:', len(items))


if __name__ == '__main__':
    sys.exit(main())
