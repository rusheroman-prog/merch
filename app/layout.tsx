import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Uzum Merch',
  description: 'Внутренний магазин корпоративного мерча',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}