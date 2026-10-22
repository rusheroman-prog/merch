/**
 * Контакт поддержки мерч-портала (HR / команда мерча).
 * Задаётся переменными окружения в Vercel:
 *   NEXT_PUBLIC_SUPPORT_URL   — ссылка: https://t.me/..., mailto:merch@uzum.com и т.п.
 *   NEXT_PUBLIC_SUPPORT_LABEL — подпись под ссылкой (по умолчанию «Свяжитесь с нами»).
 * Без URL блок помощи показывается текстом, без ссылки.
 */
export const SUPPORT_URL = process.env.NEXT_PUBLIC_SUPPORT_URL?.trim() || null
export const SUPPORT_LABEL = process.env.NEXT_PUBLIC_SUPPORT_LABEL?.trim() || 'Свяжитесь с нами'
