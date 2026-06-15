import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import AuthGuard from '@/components/AuthGuard'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Immo Scout – Wohnungssuche',
  description: 'Automatisches Immobilien-Monitoring für Eigentumswohnungen',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  )
}
