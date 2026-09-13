PokerSwipe Auth Hotfix
=======================

Что заменять в репозитории:
1) js/pokerswipe-auth.js
2) js/pokerswipe-auth-bootstrap.js

Эти файлы сделаны для ТЕКУЩЕГО стандартного Supabase Magic Link шаблона.
Менять email-шаблон на 6-значный OTP для этого hotfix НЕ нужно.

Что исправлено:
- вход теперь понимает Supabase callback и в #hash, и в ?query;
- access_token/refresh_token удаляются из адресной строки сразу после сохранения;
- JWT декодируется как base64url (а не обычный base64);
- если expires_at отсутствует/строка/миллисекунды, сессия не умирает сразу;
- refresh token rotation сохраняется;
- magic link явно получает redirect_to на корень текущего PokerSwipe;
- исправлен случай, когда profile ещё не успел создаться и bootstrap мог упасть;
- email не вставляется в HTML небезопасной строкой.

Важно:
- Supabase Site URL должен оставаться: https://vlxax.github.io/poker-swipe/
- Этот ZIP не меняет настройки Supabase на сервере.
- После загрузки файлов дождись GitHub Pages deploy и открой приложение заново в Safari.
