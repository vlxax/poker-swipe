# PokerSwipe V32 — GitHub-ready build

Это облегчённая production-сборка PokerSwipe V32 для GitHub Pages. В ней только активный runtime, используемые приложением rank-ассеты, тест и release notes. Старые HTML-сборки, Figma-исходник, превью и неиспользуемые изображения исключены; на работу приложения это не влияет.

## Как загрузить через сайт GitHub

1. Распакуйте `PokerSwipe_V32_GITHUB_READY.zip`.
2. Откройте репозиторий `poker-swipe` → **Add file** → **Upload files**.
3. Откройте распакованную папку, выделите всё внутри (`⌘A`) и перетащите файлы в окно GitHub.
4. Не загружайте сам ZIP: GitHub Pages не распаковывает архивы.
5. Дождитесь списка файлов, затем нажмите **Commit changes**.

Главная точка входа — `index.html`. Все файлы сборки меньше браузерного лимита GitHub.

## Локальная проверка

```bash
python3 -m http.server 8080
```

Откройте `http://localhost:8080/`.

Автотест:

```bash
npm install
npm test
```

Публичная синхронизация профилей отключена до появления backend-проверки Telegram и RLS. Kataly в эту сборку не входит.
