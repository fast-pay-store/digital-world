"""Следит за обсуждениями группы ВК «Бот помощник» (https://vk.com/board215704478).

Каждый день:
  • новая тема → сообщение в Telegram и черновик страницы <папка>/page.json (скрыт от поисковиков, noindex),
    который потом дописывает Claude («доделай страницу …») — после этого noindex снимается;
  • изменился первый пост темы → сообщение «проверьте страницу»;
  • ссылка на Google Drive / Яндекс.Диск в первом посте не открывается → сообщение.
Нужен секрет VK_TOKEN (сервисный ключ приложения ВК). Без него — тихо пропускает.
Реестр тем: vk_topics.json.  Только стандартная библиотека Python (+ Pillow для обложки, если установлен).
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from check_site import telegram, check_link  # noqa: E402

GROUP = 215704478
TOPIC_URL = 'https://vk.com/topic-%d_%d'
TR = dict(zip('абвгдеёжзийклмнопрстуфхцчшщъыьэюя',
              ['a', 'b', 'v', 'g', 'd', 'e', 'e', 'zh', 'z', 'i', 'y', 'k', 'l', 'm', 'n', 'o', 'p', 'r', 's', 't', 'u', 'f',
               'h', 'ts', 'ch', 'sh', 'sch', '', 'y', '', 'e', 'yu', 'ya']))


def vk(method, **params):
    params.update(access_token=os.environ['VK_TOKEN'], v='5.199')
    url = 'https://api.vk.com/method/%s?%s' % (method, urllib.parse.urlencode(params))
    with urllib.request.urlopen(url, timeout=30) as r:
        d = json.load(r)
    if 'error' in d:
        raise RuntimeError('VK %s: %s' % (method, d['error'].get('error_msg')))
    return d['response']


def slugify(title):
    t = re.split(r'\s*[-—–]\s*бот', title.lower())[0]
    t = ''.join(TR.get(c, c) for c in t)
    t = re.sub(r'[^a-z0-9]+', '-', t).strip('-')[:40].strip('-') or 'stranitsa'
    return t + '-bot'


def draft(topic, text):
    title = topic['title']
    game = re.split(r'\s*[-—–]\s*бот', title)[0].strip()
    folder = slugify(title)
    while os.path.exists(folder):
        folder += '-2'
    clean = re.sub(r'https?://\S+', '', text).strip()
    paras = [p.strip() for p in re.split(r'\n\s*\n', clean) if len(p.strip()) > 3][:6] or ['Описание — в теме во ВКонтакте.']
    url = TOPIC_URL % (GROUP, topic['id'])
    d = {
        "noindex": True, "category": "boty",
        "title": "%s — скачать демо" % title, "h1": title,
        "description": ("%s. Скачать демо-версию и обсудить — в теме ВКонтакте." % title)[:170],
        "app_name": title, "lead": "Черновик страницы — описание будет дополнено.",
        "hero_image": {"name": folder + "-oblozhka", "alt": title},
        "hero_buttons": [{"text": "Скачать в теме ВКонтакте", "href": url}],
        "hero_note": "Пароль на архив: <b>1234</b>" if '1234' in text else "",
        "sections": [{"id": "about", "kicker": "О боте", "h2": "Описание из темы ВКонтакте",
                      "paras": [p.replace('\n', '<br>') for p in paras],
                      "buttons": [{"text": "Открыть тему ВКонтакте", "href": url}]}],
        "contacts": [{"text": "Telegram", "href": "https://t.me/+c6TUEr4cOjtiYmIy"},
                     {"text": "ВКонтакте", "href": "https://vk.com/board215704478"},
                     {"text": "Разработчик: @konctantin777", "href": "https://t.me/konctantin777"}],
        "disclaimer": "Бот — неофициальная программа и не связан с разработчиками игры «%s»." % game,
    }
    os.makedirs(folder, exist_ok=True)
    json.dump(d, open(os.path.join(folder, 'page.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    try:
        subprocess.run([sys.executable, 'tools/make_cover.py', folder, 'Бот для ' + game, 'Бот-кликер · демо бесплатно'], check=True)
    except Exception as e:
        print('обложка не сделана:', e)
    return folder


def main():
    if not os.environ.get('VK_TOKEN'):
        print('VK_TOKEN не задан — пропуск')
        return 0
    reg = json.load(open('vk_topics.json', encoding='utf-8')) if os.path.exists('vk_topics.json') else {}
    res = vk('board.getTopics', group_id=GROUP, count=100, preview=1, preview_length=0)
    msgs = []
    for t in res.get('items', []):
        tid = str(t['id'])
        text = t.get('first_comment', '') or ''
        h = hashlib.md5(text.encode()).hexdigest()
        url = TOPIC_URL % (GROUP, t['id'])
        old = reg.get(tid)
        if old is None:
            folder = draft(t, text)
            reg[tid] = {'title': t['title'], 'page': folder, 'hash': h}
            msgs.append('🆕 Новая тема «%s»\n%s\nЧерновик страницы: %s (скрыт от поисковиков). Напишите Claude: «доделай страницу %s».'
                        % (t['title'], url, folder, folder))
        else:
            if old.get('hash') and old['hash'] != h:
                msgs.append('✏️ Изменился пост в теме «%s» — проверьте страницу %s\n%s' % (t['title'], old.get('page') or '(нет)', url))
            old.update(title=t['title'], hash=h)
        for link in set(re.findall(r'https?://(?:drive\.google\.com|disk\.yandex\.\w+)/\S+', text)):
            link = link.rstrip('.,)')
            _, code, state = check_link(link)
            if state == 'broken':
                msgs.append('❌ Не открывается ссылка в теме «%s»: %s (ответ %s)\n%s' % (t['title'], link, code, url))
    json.dump(reg, open('vk_topics.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    if msgs:
        telegram('📣 Обсуждения ВК\n\n' + '\n\n'.join(msgs))
    print('\n\n'.join(msgs) or 'Без изменений')
    return 0


if __name__ == '__main__':
    sys.exit(main())
