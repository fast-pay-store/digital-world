# Digital World

Сайт: **https://fast-pay-store.github.io/digital-world/**

Каталог: боты для игр, игры ВКонтакте, игры Roblox, другие игры, сервисы и гайды. Каждая страница — отдельная папка с `index.html`.

Страницы товаров собираются из `<папка>/page.json` (`tools/render_pages.py`), поле `category`: `boty`, `igry-vk`, `igry-roblox`, `igry-drugie`, `servisy` (список — в `site.json`). Обложка для страницы без своих картинок: `python tools/make_cover.py <папка> "Название" "подпись"`.

## Как добавить страницу

* **Из ВКонтакте:** вкладка **Actions** → «Generate Page from VK Link» → **Run workflow** → вставить ссылку на тему/пост.
  ВК часто не отдаёт текст поста без входа — тогда откройте созданную страницу и допишите описание вручную.
* **Вручную:** создать папку (латиницей, например `moy-bot`) и положить в неё `index.html`.
  В странице должны быть `<title>` и `<meta name="description" content="...">` — из них берутся название и описание на главной.

Главная страница, `sitemap.xml` и `404.html` пересобираются **сами** после каждого изменения — руками их не правьте.
Порядок карточек на главной и исключения — в `site.json` (`order`, `exclude`).

## Что работает автоматически (вкладка Actions)

| Workflow | Когда | Что делает |
|---|---|---|
| Сборка сайта | при каждом изменении | сжимает новые картинки в WebP, собирает страницы из page.json, главную, sitemap, 404, Метрику; сообщает Яндексу (IndexNow) |
| Проверка сайта и ссылок | каждый день 08:23 МСК и после сборки | страницы, все ссылки (в т.ч. Google Drive), товар на Plati.Market, SEO; проблемы → Telegram |
| Обсуждения ВК | каждый день 09:41 МСК | новая тема → черновик страницы (noindex) + Telegram; изменённый пост и мёртвые ссылки → Telegram. Нужен секрет `VK_TOKEN` |
| Скорость и SEO (Lighthouse) | понедельник 10:17 МСК | оценки каждой страницы с телефона → сводка в Telegram |
| Отчёт Яндекс.Вебмастера | только вручную | API Вебмастера закрыт для серверов GitHub — еженедельный отчёт идёт с ПК владельца: `D:\GD\AI_clod\Сайт digital-world\Отчёт Вебмастера` |
| Generate Page from VK Link | вручную | страница из ссылки ВК + обновление главной |

Секреты (Settings → Secrets and variables → Actions): `TG_BOT_TOKEN`, `TG_CHAT_ID` (заданы), `VK_TOKEN`, `YANDEX_WEBMASTER_TOKEN`.
Яндекс.Метрика 113717630: номер — в `site.json` → `metrika_id`; код вставляется во все страницы сам. Цели в Метрике: `download`, `checkout`, `play`, `contact` (JS-события) и «Открыл страницу оплаты из бота» (URL содержит widget.html).
Оплата: на страницах **нет** ссылок на оплату — ключ покупается/продлевается кнопкой «Продлить» в самом боте (бот формирует ссылку widget.html?id=5959089&lang=ru&name=...&key=...). На сайте — только ссылка на тему ВК.
Картинки: положите .png/.jpg в `<папка>/img/` — при сборке станут `<имя>-640.webp` и `<имя>-1200.webp`; в page.json указывайте `"name": "<имя>"`.

## Поисковики

* Добавьте сайт в **Яндекс.Вебмастер** и **Google Search Console**, укажите sitemap:
  `https://fast-pay-store.github.io/digital-world/sitemap.xml`
* `robots.txt` и переадресация старых адресов (`fast-pay-store.github.io/bot-dungeon-crusher` и др.) — в репозитории
  [fast-pay-store.github.io](https://github.com/fast-pay-store/fast-pay-store.github.io).

## Файлы

* `tools/build_site.py` — сборка главной/sitemap/404 (шаблоны: `tools/index_template.html`, `tools/404_template.html`)
* `tools/check_site.py` — проверка сайта и ссылок
* `tools/indexnow.py` — уведомление Яндекса; ключ в `site.json` и файле `<ключ>.txt` (не удалять)
* `generate.py`, `template.html`, `registry.json` — генератор страниц из ВК
* `widget.html` — виджет оплаты Digiseller (служебный, на главной не показывается)
