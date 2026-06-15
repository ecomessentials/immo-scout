import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import './globals.css'
import AuthGuard from '@/components/AuthGuard'
import AppShell from '@/components/AppShell'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ImmobilienKrieger – Dein automatischer Immobilien-Scout',
  description: 'Automatisches Monitoring für Eigentumswohnungen – renovierungsbedürftig, bis 195.000 €',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className={`${inter.className} bg-[#F8FAFC] dark:bg-[#0F172A] min-h-screen`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthGuard>
            <AppShell>{children}</AppShell>
          </AuthGuard>
        </ThemeProvider>
      </body>
    </html>
  )
}
