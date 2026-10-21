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
| Сборка сайта | при каждом изменении | главная со списком страниц, sitemap.xml, 404.html; сообщает Яндексу об обновлении (IndexNow) |
| Проверка сайта и ссылок | каждый день в 08:23 МСК и после сборки | открываются ли страницы, живы ли ссылки (в т.ч. программа в Google), нет ли запрета индексации и других SEO-ошибок; при проблеме — сообщение в Telegram и письмо от GitHub |
| Generate Page from VK Link | вручную | страница из ссылки ВК + обновление главной |

## Уведомления в Telegram (один раз)

1. В Telegram откройте **@BotFather** → `/newbot` → придумайте имя → получите **токен** бота.
2. Напишите своему боту любое сообщение (например «привет»).
3. Откройте в браузере `https://api.telegram.org/bot<ТОКЕН>/getUpdates` — найдите `"chat":{"id":123456789` — это **ID чата**.
4. В репозитории: **Settings → Secrets and variables → Actions → New repository secret**:
   * `TG_BOT_TOKEN` — токен бота
   * `TG_CHAT_ID` — ID чата
5. Проверка: **Actions → «Проверка сайта и ссылок» → Run workflow** (галочка «Прислать отчёт» включена) — бот пришлёт отчёт.

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
