'use client'

import { usePathname } from 'next/navigation'
import Navbar from './Navbar'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showNav = pathname !== '/login'

  return (
    <>
      {showNav && <Navbar />}
      <main className={showNav ? 'min-h-[calc(100vh-4rem)]' : 'min-h-screen'}>
        {children}
      </main>
    </>
  )
}
