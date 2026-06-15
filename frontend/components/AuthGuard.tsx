'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const ok = localStorage.getItem('authenticated') === 'true'
    if (!ok && pathname !== '/login') {
      router.replace('/login')
    }
  }, [router, pathname])

  return <>{children}</>
}
