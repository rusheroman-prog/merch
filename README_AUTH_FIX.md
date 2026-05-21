# Исправление перехода по magic link Supabase

## 1. Правильное размещение файлов в Next.js App Router

Файлы должны лежать так:

```text
app/login/page.tsx
app/auth/callback/route.ts
lib/supabase/client.ts
lib/supabase/server.ts
lib/supabase/types.ts
middleware.ts
```

Если `route.ts` лежит в корне проекта, маршрут `/auth/callback` не создается.
Если `page.tsx` лежит в корне проекта, страница `/login` не создается.

## 2. Supabase URL Configuration

В Supabase Dashboard откройте:

Authentication → URL Configuration

Укажите:

```text
Site URL:
https://ВАШ-ДОМЕН

Redirect URLs:
https://ВАШ-ДОМЕН/auth/callback
http://localhost:3000/auth/callback
```

Для Cloudflare Pages/Vercel нужно добавить именно текущий опубликованный домен.

## 3. Переменные окружения

В `.env.local` и в настройках хостинга должны быть:

```text
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ваш_anon_key
NEXT_PUBLIC_APP_URL=https://ВАШ-ДОМЕН
```

## 4. Проверка

После отправки письма ссылка должна после клика привести на:

```text
https://ВАШ-ДОМЕН/auth/callback?code=...
```

После успешного обмена code на session пользователь должен перейти на:

```text
https://ВАШ-ДОМЕН/catalog
```

Если страницы `/catalog` еще нет, создайте ее или временно поменяйте fallback в `app/auth/callback/route.ts` с `/catalog` на `/`.
