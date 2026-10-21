import os
import re
import json
import requests
from bs4 import BeautifulSoup

TRANSLIT = dict(zip('абвгдеёжзийклмнопрстуфхцчшщъыьэюя',
                    ['a','b','v','g','d','e','e','zh','z','i','y','k','l','m','n','o','p','r','s','t','u','f','h','ts','ch','sh','sch','','y','','e','yu','ya']))

def slugify(text):
    # латиница в адресе: такие ссылки не ломаются в мессенджерах и лучше читаются поисковиками
    text = ''.join(TRANSLIT.get(c, c) for c in text.lower())
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    return re.sub(r'[-\s]+', '-', text).strip('-')[:50].strip('-') or 'product'

def main():
    url = os.environ.get('INPUT_URL')
    if not url:
        print("Ошибка: URL не передан")
        return

    # 1. Проверка уникальности
    with open('registry.json', 'r', encoding='utf-8') as f:
        registry = json.load(f)
    
    if url in registry['processed_urls']:
        print(f"Уникальность: URL уже обработан. Пропуск.")
        return

    # 2. Парсинг
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    response = requests.get(url, headers=headers, timeout=15)
    soup = BeautifulSoup(response.text, 'html.parser')
    
    title = soup.title.string.split(' | ')[0].strip() if soup.title else "Цифровой товар"
    desc_blocks = soup.find_all(class_=re.compile(r'wall_post_text|post_text|_post_text'))
    description = "\n\n".join([b.get_text(" ", strip=True) for b in desc_blocks if len(b.get_text(strip=True)) > 50])
    if not description:
        description = "Подробности в источнике."

    # 3. Генерация страницы
    with open('template.html', 'r', encoding='utf-8') as f:
        template = f.read()
    
    folder_name = slugify(title)
    if os.path.exists(os.path.join(folder_name, 'index.html')):
        folder_name = (folder_name + '-' + str(len(registry['processed_urls']) + 1))[:60]
    os.makedirs(folder_name, exist_ok=True)

    import html as _html
    short = re.sub(r'\s+', ' ', description).strip()[:160]
    page_url = 'https://fast-pay-store.github.io/digital-world/' + folder_name + '/'
    html_content = template.replace('{{title}}', _html.escape(title))\
                           .replace('{{description}}', _html.escape(description).replace('\n\n', '</p><p>'))\
                           .replace('{{description_short}}', _html.escape(short, quote=True))\
                           .replace('{{page_url}}', page_url)\
                           .replace('{{vk_url}}', _html.escape(url, quote=True))
    
    with open(f'{folder_name}/index.html', 'w', encoding='utf-8') as f:
        f.write(html_content)

    # 4. Обновление реестра
    registry['processed_urls'].append(url)
    with open('registry.json', 'w', encoding='utf-8') as f:
        json.dump(registry, f, indent=2, ensure_ascii=False)
    
    print(f"Успех: Создана папка '{folder_name}'")

if __name__ == "__main__":
    main()
