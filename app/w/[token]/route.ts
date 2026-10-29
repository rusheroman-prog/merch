import { NextResponse, type NextRequest } from 'next/server'
import { WELCOME_COOKIE } from '@/lib/welcome'

/**
 * Спецссылка на welcome pack: /w/<token>. Запоминаем токен и ведём на /welcome —
 * если новичок ещё не вошёл, он пройдёт регистрацию и вернётся через каталог.
 */
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params
  const response = NextResponse.redirect(new URL('/welcome', request.url))

  if (/^[a-z0-9]{16,64}$/i.test(token)) {
    response.cookies.set(WELCOME_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    })
  }

  return response
}
