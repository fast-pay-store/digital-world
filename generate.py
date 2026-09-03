import os
import re
import json
import requests
from bs4 import BeautifulSoup

def slugify(text):
    text = re.sub(r'[^\w\s-]', '', text.lower())
    return re.sub(r'[-\s]+', '-', text).strip('-')[:50] or 'product'

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
    
    html_content = template.replace('{{title}}', title)\
                           .replace('{{description}}', description)\
                           .replace('{{vk_url}}', url)
    
    folder_name = slugify(title)
    os.makedirs(folder_name, exist_ok=True)
    
    with open(f'{folder_name}/index.html', 'w', encoding='utf-8') as f:
        f.write(html_content)

    # 4. Обновление реестра
    registry['processed_urls'].append(url)
    with open('registry.json', 'w', encoding='utf-8') as f:
        json.dump(registry, f, indent=2, ensure_ascii=False)
    
    print(f"Успех: Создана папка '{folder_name}'")

if __name__ == "__main__":
    main()
