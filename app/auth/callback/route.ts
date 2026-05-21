import { createServerClient, type CookieOptions } from '@supabase/ssr'
import type { EmailOtpType } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

type CookieToSet = {
  name: string
  value: string
  options?: CookieOptions
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const origin = requestUrl.origin

  const code = requestUrl.searchParams.get('code')
  const tokenHash = requestUrl.searchParams.get('token_hash')
  const type = (requestUrl.searchParams.get('type') ?? 'email') as EmailOtpType

  const nextParam = requestUrl.searchParams.get('next') ?? '/catalog'
  const next = nextParam.startsWith('/') ? nextParam : '/catalog'

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )

  let authError: string | null = null

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      authError = error.message
      console.error('Supabase exchangeCodeForSession error:', error.message)
    }
  } else if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })

    if (error) {
      authError = error.message
      console.error('Supabase verifyOtp error:', error.message)
    }
  } else {
    authError = 'No code or token_hash found in callback URL'
    console.error('Supabase callback error:', authError)
  }

  if (!authError) {
    return NextResponse.redirect(new URL(next, origin))
  }

  const loginUrl = new URL('/login', origin)
  loginUrl.searchParams.set('error', 'auth_failed')
  loginUrl.searchParams.set('description', authError)

  return NextResponse.redirect(loginUrl)
}