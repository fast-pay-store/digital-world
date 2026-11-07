"use strict";
/* Настройки игры.
   NET — сервер для игры между людьми: Firebase Realtime Database (проект tower-defense-vk-chat в Google-аккаунте владельца,
   у этой игры своя ветка /sb). key — публичный Web API Key, его можно держать в коде: защиту дают правила базы (firebase-rules.json).
   APP_ID — номер игры во ВКонтакте (для ссылки-приглашения другу). Внутри ВК берётся сам из адреса. */
window.CFG = {
  NET: {
    db: 'https://tower-defense-vk-chat-default-rtdb.europe-west1.firebasedatabase.app',
    key: 'AIzaSyCHyyzhFGuAJVu-J7EA8KH67EohlMQVbIk',
    root: 'sb',
  },
  APP_ID: 54828670,
  WEB_URL: 'https://digitalworld-games.ru/morskoy-boy-onlayn/', // версия на сайте: ссылка-приглашение ведёт сюда
  TURN_SEC: 30,        // время на ход; потом выстрел делается сам, в случайную клетку
  LOST_SEC: 40,        // соперник молчит столько секунд в свой ход — ему засчитывается поражение
  SEARCH_BOT_SEC: 20,  // через столько секунд поиска предлагаем сыграть с компьютером
  ELO_K: 32,
  START_RATING: 1000,
  LB_SINCE: 1792247787547,   // таблица рейтинга показывает только записи после запуска (раньше были тестовые игроки)
  COINS: { win: 40, lose: 10, botWin: 20, botLose: 5, ad: 60, daily: [50, 70, 90, 110, 130, 160, 200] },
};
