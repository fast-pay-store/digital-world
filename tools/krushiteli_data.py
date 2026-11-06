"""Скачивает рецепты «Крушителей подземелий» с вики сообщества (dungeoncrusher.fandom.com/ru, лицензия CC BY-SA)
и сохраняет в krushiteli/data.json. Запуск: python3 tools/krushiteli_data.py (нужен интернет).
Если в контейнере нужен сертификат прокси: SSL_CERT_FILE=~/.ccr/ca-bundle.crt python3 tools/krushiteli_data.py
"""
import json, os, re, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = 'https://dungeoncrusher.fandom.com/ru/api.php'
UA = {'User-Agent': 'digital-world-guide/1.0'}


def get(params):
    params['format'] = 'json'
    data = urllib.parse.urlencode(params).encode()
    for _ in range(4):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(A, data=data, headers=UA), timeout=40))
        except Exception:
            time.sleep(2)
    raise SystemExit('Вики не отвечает')


def allpages(ns):
    out, cont = [], {}
    while True:
        d = get(dict(action='query', list='allpages', apnamespace=ns, aplimit=500, **cont))
        out += [p['title'] for p in d['query']['allpages']]
        if 'continue' not in d:
            return out
        cont = {'apcontinue': d['continue']['apcontinue']}


def contents(titles):
    res = {}
    for i in range(0, len(titles), 50):
        d = get(dict(action='query', prop='revisions', rvprop='content|timestamp', rvslots='main', titles='|'.join(titles[i:i + 50])))
        for p in d['query']['pages'].values():
            if 'revisions' in p:
                r = p['revisions'][0]
                res[p['title']] = {'text': r['slots']['main']['*'], 'ts': r['timestamp']}
    return res


ICON = re.compile(r'\{\{\s*Иконка[ _]предмета\s*\|([^}]*)\}\}')


def qty(parts):
    q = next((x for x in parts if re.fullmatch(r'[xх]\s*\d+', x)), None)
    return int(re.sub(r'\D', '', q)) if q else 1


def parse(T):
    out, seen = [], set()
    for title, v in T.items():
        for tbl in re.findall(r'\{\|(.*?)\n\|\}', v['text'], re.S):
            if 'Ингредиенты' not in tbl:
                continue
            head, _, ing = tbl.partition('Ингредиенты')
            sh = re.search(r'Осколки\s*\[\[([^\]|#]+)', head)
            m = re.search(r'\[\[(?!Файл:)([^\]|#]+)', head)
            if sh:
                res = 'Осколки героя: ' + sh.group(1).strip()
            elif m:
                res = m.group(1).strip()
            else:
                continue
            ch = re.search(r'\|\s*(\d{1,3})\s*%', head)
            cat = None
            if 'Катализатор' in head:
                cm = ICON.search(head.split('Катализатор')[-1])
                if cm:
                    p = [x.strip() for x in cm.group(1).split('|')]
                    cat = qty(p)
            ings = []
            for im in ICON.finditer(ing):
                p = [x.strip() for x in im.group(1).split('|')]
                ings.append([p[-1].replace('_', ' ').strip(), qty(p), (p[2].lower() if len(p) > 2 else '')])
            if not ings:
                continue
            key = (res, ch and ch.group(1), tuple((a, b) for a, b, _ in ings))
            if key in seen:
                continue
            seen.add(key)
            out.append({'r': res, 'c': int(ch.group(1)) if ch else None, 'k': cat, 'i': ings, 'd': v['ts'][:10]})
    return out


def clean(x):
    x = re.sub(r'<nowiki>|</nowiki>|\{\{[^}]*\}\}|\[\[[^\]]*\]\]', '', x)
    return re.sub(r'\s+', ' ', x).strip(' |')


def siege(T, M):
    t = T.get('Шаблон:Боссы осады', {}).get('text', '')
    rows = []
    for block in t.split('|-')[1:]:
        cells = [clean(c) for c in re.split(r'\n[!|]', '\n' + block.strip()) if c.strip()]
        cells = [c.split('|')[-1].strip() for c in cells]
        if len(cells) >= 5 and re.match(r'[\d.,]+$', cells[0]):
            rows.append({'hp': cells[0], 'players': cells[1], 'total': cells[2], 'track': cells[3], 'mvp': cells[4],
                         'triple': '{{иконка|тройник' in block or 'Карта' in block})
    cannons = re.findall(r'!\s*style="text-align: center;"\s*\|([^\n]+)\n\|[^\n]*\n\|\s*style="text-align: center;"\s*\|([^\n]+)',
                         M.get('Осадные пушки', {}).get('text', ''))
    return {'bosses': rows, 'cannons': [[a.strip(), b.strip().strip('"')] for a, b in cannons],
            'updated': M.get('Осады', {}).get('ts', '')[:10]}


WEEKS = {'дроу': 'Королевство дроу', 'пещеры': 'Пещеры гоблинов', 'логово': 'Логово некроманта', 'пустош': 'Ледяная пустошь',
         'джунгли': 'Шаманы джунглей', 'грин': 'Фиддлерс Грин', 'пойма': 'Зловещая пойма', 'пески': 'Пески времени', 'король': 'Чёрный король'}
ELITE = ['дроу', 'пещеры', 'логово', 'пустош', 'джунгли', 'грин', 'пойма', 'пески', 'король']


def strip(x):
    x = re.sub(r'<!--.*?-->', '', x, flags=re.S)
    x = re.sub(r'\{\{\s*Гл пар\s*\|([^}]*)\}\}', r'\1', x)
    x = re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]*)\]\]', r'\1', x)
    x = re.sub(r'\{\{[^{}]*\}\}', '', x)
    x = re.sub(r'<br\s*/?>', ' ', x)
    x = re.sub(r'<[^>]+>', '', x)
    return re.sub(r'\s+', ' ', x).strip()


def field(t, name):
    m = re.search(r'\|\s*' + re.escape(name) + r'\s*=([^\n]*)', t)
    return strip(m.group(1)) if m else ''


def heroes(M):
    out = []
    for title, v in M.items():
        t = v['text']
        if 'Infobox_Hero' not in t and 'Infobox Hero' not in t:
            continue
        if 'Список всех героев' not in t and 'Категория:Герои' not in t:
            continue
        sk = []
        for i in range(1, 5):
            f = field(t, 'способность%d' % i)
            if f:
                parts = f.split('/', 3)
                if len(parts) == 4:
                    sk.append({'type': parts[1], 'chance': parts[2], 'text': parts[3]})
                elif f:
                    sk.append({'type': '', 'chance': '', 'text': f})
        bonus = field(t, 'бонус осады')
        bw = ''
        m = re.match(r'(?:элита(\d)_|([а-я]+))(\d+)', bonus)
        if m:
            key = ELITE[int(m.group(1)) - 1] if m.group(1) else m.group(2)
            bw = '%s +%s%%' % (WEEKS.get(key, key), m.group(3))
        how = re.search(r'\|\s*Информация\s*=([^\n]*)', t)
        cats = re.findall(r'\[\[Категория:([^\]|]+)', t)
        def stat(n):
            m = re.search(r'\|\s*' + n + r'\s*=([^\n]*)', t)
            d = re.search(r'\d[\d\s]*', re.sub(r'<!--.*?-->', '', m.group(1))) if m else None
            return re.sub(r'\s', '', d.group(0)) if d else ''
        RAR = [('бож', 'Божественный'), ('миф', 'Мифический'), ('лег', 'Легендарный'), ('эпи', 'Эпический'),
               ('редч', 'Редчайший'), ('редк', 'Редкий'), ('необ', 'Необычный'), ('обыч', 'Обычный')]
        r0 = field(t, 'начальная редкость').lower()
        rar = next((v for k, v in RAR if r0.startswith(k)), '')
        out.append({'name': title, 'race': field(t, 'раса'), 'cls': field(t, 'класс'), 'rar': rar,
                    'feat': field(t, 'особенность'), 'hp': stat('HP'), 'atk': stat('ATK'), 'def': stat('DEF'), 'wis': stat('WIS'),
                    'agi': stat('AGI'), 'sum': stat('SUM'), 'skills': sk, 'dislike': field(t, 'неприязнь'), 'siege': bw,
                    'how': strip(how.group(1)) if how else '', 'cats': [c.strip() for c in cats], 'd': v['ts'][:10]})
    return sorted(out, key=lambda h: h['name'])


def artifacts(M):
    t = re.sub(r'<!--.*?-->', '', M.get('Артефакты', {}).get('text', ''), flags=re.S)
    secs = re.split(r'\n==([^=\n]+)==\n', t)
    out = []
    for i in range(1, len(secs), 2):
        sec = re.sub(r'\{\{[^}]*\}\}', '', secs[i]).strip()
        if 'Стоимость' in sec:
            continue
        for tbl in re.findall(r'\{\|(.*?)\n\|\}', secs[i + 1], re.S):
            for r in tbl.split('\n|-')[1:]:
                cells = [c.strip() for c in re.split(r'\n\s*\|', '\n' + r.strip()) if c.strip() != '']
                if not cells or cells[0].startswith('!'):
                    continue
                cells = [strip(re.sub(r'\[\[(?:Файл|File):[^\]]*\]\]', '', re.sub(r'^style="[^"]*"\s*\|', '', c))) for c in cells]
                cells = [c for c in cells if c != '']
                if len(cells) >= 5:
                    out.append({'sec': sec, 'name': cells[0], 'type': cells[1], 'levels': cells[2],
                                'effect': cells[-2], 'use': cells[-1]})
    return out


def main():
    T = contents(allpages(10))
    M = contents(allpages(0))
    R = parse(T)
    os.makedirs(os.path.join(ROOT, 'krushiteli'), exist_ok=True)
    json.dump({'source': 'https://dungeoncrusher.fandom.com/ru/wiki/Рецепты', 'license': 'CC BY-SA 3.0',
               'fetched': time.strftime('%Y-%m-%d'), 'recipes': R, 'siege': siege(T, M), 'heroes': heroes(M), 'artifacts': artifacts(M)},
              open(os.path.join(ROOT, 'krushiteli', 'data.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print('Рецептов:', len(R))


if __name__ == '__main__':
    main()
