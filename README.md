🔮 Oracle AI / Core Node v2.6 PRO (Prestige HQ)
<p align="center">
  <img src="https://img.shields.io/badge/Version-2.6%20PRO-7c3aed?style=for-the-badge&logo=code&logoColor=white" alt="Version 2.6 PRO">
  <img src="https://img.shields.io/badge/Release-20%20Sep%202026-02b6ed?style=for-the-badge" alt="Release">
  <img src="https://img.shields.io/badge/Design-Material%20You%20%7C%20Liquid%20Glass-e60ced?style=for-the-badge" alt="Design">
  <img src="https://img.shields.io/badge/HQ-LMSH-adc6ff?style=for-the-badge" alt="LMSH HQ">
</p>
> **Core Node PRO** — клиентский цифровой узел связи и управления (Штаб ЛМСХ).  
> Сборка **2.6 PRO** (релиз **20 сентября 2026**): Markdown и окна кода, сторонние API (Gemini **AQ.**), публичные ссылки, Split View, Notepad-проекты, матовый **True Black** и расширенная персонализация.
Демо / лендинг: `about.html` · Приложение: `index.html` · Монолит: `full.html`
---
🚀 Что нового в 2.6 PRO
ИИ и ответы
Markdown в ответах — заголовки, списки, ссылки, жирный / курсив, инлайн-`код`
Окна кода — JS, Python, HTML, CSS… с подписью языка и кнопкой Копировать
Просмотр фото — клик по картинке ИИ → полноэкранный viewer
Анимация думания — две орбитальные точки или обводка (Персонализация → Основные)
Ошибка API + Повторить — неверный ключ не роняет чат; карточка ошибки и повтор запроса
Сторонние API · НОВИНКА
Провайдеры: ChatGPT, Gemini, Claude, Grok, Другой
Gemini Auth Keys (`AQ.`) и legacy `AIza`
Ключ только в `localStorage`; чип API · ON над полем ввода
Импорт контекста из другого ИИ (готовый промпт + вставка ответа)
ZIP-импорт метаданных (до 2 ГБ)
При внешнем API лимиты Core Node не применяются — расход у провайдера
Чаты, шаринг, Split
Публичные ссылки — вкладка в настройках: перейти / копировать / удалить / удалить все
Временный чат — Ч/Б, без записи в историю; можно сохранить через ПКМ
Split View — Chat + Reader, Chat + Notepad, два чата, Side Notes; resizer, swap, vertical
Notepad Coding Projects в боковом меню, общие ключи с Oracle Notepad
Side Notes по чату (ПКМ → новинка)
Интерфейс и безопасность
True Black — `#000` / `#0a0a0a`, спокойный primary
Светлая / тёмная / True Black, акцентные цвета, компактная навигация (верх / низ / бок)
PIN, Pillow Mode, заставки, уведомления планов
Библиотека файлов, календарь/планы, лимиты 3ч / неделя / вложения
Редактор ввода (из 2.6)
Полноэкранный редактор длинных промптов
Панель B / I / U, размер, сброс форматирования
Голос и Live Chat (UI-заготовка)
---
🌟 Ключевые особенности
Модуль	Описание
Мультимодельный контур	Oracle Main, Worldpack AI, Fast — агенты и потоки
AI Ридер	Истории/книги, форматирование, localStorage
Плавающий архив	Чаты, истории, проекты Notepad, библиотека
Инженерный пульт	Персонализация, API, ссылки, лимиты, сон, безопасность
Liquid Glass	`backdrop-filter`, gooey-блобы, адаптив mobile/desktop
---
🏗️ Архитектура
Vanilla JS SPA, без тяжёлого фреймворка
localStorage ключи `oracle_*` (чаты, истории, shares, API, notepad)
Общий origin с Oracle Notepad для проектов
Service Worker `sw.js` — push/напоминания (по возможности браузера)
Дизайн: Material You + Liquid Glass
```
index.html      — точка входа PRO
style.css       — темы, glass, split, markdown, API UI
script.js       — ядро логики
full.html       — всё в одном файле
about.html      — обзор нововведений + True Black
index-20251022  — урезанный rollout-вариант
```
---
📦 Быстрый старт
Откройте `index.html` (или `full.html`) в современном браузере
Примите consent / cookies-окно
(Опционально) Настройки → Сторонние API — ключ Gemini `AQ.…` или другой провайдер
Обзор фич: `about.html`
> Прямые вызовы OpenAI / Claude / Grok из браузера могут блокироваться **CORS**. Gemini через `generativelanguage.googleapis.com` обычно доступен с ключом.
---
🔒 Данные
Чаты, настройки, файлы и ключи API хранятся только в браузере
Публичная ссылка живёт, пока чат в истории или пока вы не удалите share
Сброс PIN / полный сброс — с предупреждением о потере данных
---
📝 Changelog 2.6 PRO (кратко)
UI: матовые бабблы, glass-навигация, плавающий бар на телефонах
AI: Markdown, code windows, image viewer, thinking anim
API: custom keys, Gemini AQ., error + Retry, status chip
Share: public links manager
Split: Notepad / dual chat / Side Notes, project list
Theme: True Black polished
---
📄 Лицензия и права
© 2026 Проект Oracle Intelligence & Core Node · Prestige HQ / Штаб ЛМСХ.  
Все права защищены.
---
<p align="center">
  <b>Core Node 2.6 PRO</b> · 20 сентября 2026 · <i>ALL SYSTEMS OPERATIONAL</i>
</p>
