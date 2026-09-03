import { Toaster } from '@/components/ui/Toast'
import { Toast } from '@base-ui/react/toast'
import type { Metadata } from 'next'
import { ThemeProvider } from 'next-themes'
import { Inter, Montserrat } from 'next/font/google'
import type React from 'react'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

const montserrat = Montserrat({
  subsets: ['latin'],
  display: 'swap',
  weight: ['600', '700'],
  variable: '--font-montserrat',
})

export const metadata: Metadata = {
  title: 'Personal Finance Demo',
  description:
    'A sandbox demo of a personal finance app: net worth, accounts, transactions and holdings, wired to Plaid.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // `suppressHydrationWarning` is required, not incidental: next-themes' inline
    // script writes `class` and `style` on this element before React hydrates, so
    // the server's markup and the DOM legitimately differ by exactly that. It
    // suppresses one level deep only — nothing inside is affected.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${montserrat.variable}`}
    >
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Toast.Provider>
            {children}
            <Toaster />
          </Toast.Provider>
        </ThemeProvider>
      </body>
    </html>
  )
}
