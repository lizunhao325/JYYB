import { Analytics } from '@vercel/analytics/next'
import { Noto_Sans_SC } from 'next/font/google'
import type { Metadata, Viewport } from 'next'
import './globals.css'

const notoSansSC = Noto_Sans_SC({ subsets: ['latin'], variable: '--font-noto-sc' })

export const metadata: Metadata = {
  title: 'Trading Journal · 交易复盘',
  description: '极简交易统计与复盘工具，记录每一笔交易，理解自己的交易质量。',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" className={`bg-background ${notoSansSC.variable}`}>
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
