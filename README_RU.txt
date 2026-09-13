PokerSwipe — iOS PWA persistent auth fix

Заменить в GitHub только:
js/pokerswipe-auth.js

Что исправлено:
- полная Supabase-сессия по-прежнему хранится в localStorage;
- refresh_token дополнительно зеркалится в SameSite=Lax cookie;
- при установке PokerSwipe на Home Screen iOS может перенести cookie;
- если у PWA пустой localStorage, она обменивает bridge refresh token в Supabase и восстанавливает полноценную сессию;
- при ротации refresh token cookie обновляется;
- добавлена защита от параллельных refresh-запросов;
- signOut очищает и localStorage, и bridge cookie;
- OTP verify поддерживает оба формата ответа Supabase.

ВАЖНО ДЛЯ ТЕСТА:
После выкладки фикса:
1. Открыть PokerSwipe в Safari, где пользователь уже авторизован.
2. Один раз обновить страницу — это создаст bridge cookie из существующей сессии.
3. Удалить СТАРУЮ иконку PokerSwipe с Домашнего экрана.
4. Снова Safari → Поделиться → На экран «Домой».
5. Открыть новую иконку.
6. Второй OTP запрашиваться не должен.

Старую уже установленную иконку фикс задним числом не снабдит Safari-cookie:
cookie переносится при установке Home Screen web app.

Cookie:
name: pokerswipe_refresh_bridge
SameSite=Lax
Secure на HTTPS
Max-Age: 180 дней
Path: корень текущего GitHub Pages приложения

JS syntax: PASS
