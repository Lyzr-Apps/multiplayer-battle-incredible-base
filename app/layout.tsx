import type { Metadata } from 'next'
import { Nunito, Merriweather } from 'next/font/google'
import './globals.css'
import { IframeLoggerInit } from '@/components/IframeLoggerInit'

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-sans'
})

const merriweather = Merriweather({
  weight: ['300', '400', '700'],
  subsets: ['latin'],
  variable: '--font-serif'
})

export const metadata: Metadata = {
  title: 'Personal Diary AI Companion',
  description: 'Your safe, private space for reflection and emotional support',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${nunito.variable} ${merriweather.variable} font-sans`}>
        <IframeLoggerInit />
        {children}
      </body>
    </html>
  )
}
