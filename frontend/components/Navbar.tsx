'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { LogOut, Settings, LayoutDashboard } from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import ScanButton from './ScanButton'

function IKLogo() {
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="ImmobilienKrieger">
      <rect width="34" height="34" rx="9" fill="#1B4FD8" />
      <rect x="9" y="9" width="4" height="16" rx="1.5" fill="white" />
      <path d="M16 17L23 9h4L20 17l7 8h-4l-7-8z" fill="#F59E0B" />
    </svg>
  )
}

function NavLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  const pathname = usePathname()
  const active = pathname === href
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all duration-200 ${
        active
          ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-blue-400'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white'
      }`}
    >
      {icon}
      <span className="hidden md:block">{label}</span>
    </Link>
  )
}

export default function Navbar() {
  const router = useRouter()

  const handleLogout = () => {
    localStorage.removeItem('authenticated')
    router.replace('/login')
  }

  return (
    <nav className="sticky top-0 z-30 glass border-b border-gray-200/60 dark:border-slate-700/60 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <IKLogo />
          <span className="hidden sm:block font-bold text-gray-900 dark:text-white text-base tracking-tight group-hover:text-primary transition-colors">
            ImmobilienKrieger
          </span>
        </Link>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          <NavLink href="/" label="Dashboard" icon={<LayoutDashboard size={15} />} />
          <NavLink href="/settings" label="Einstellungen" icon={<Settings size={15} />} />

          <div className="w-px h-5 bg-gray-200 dark:bg-slate-600 mx-1" />

          <ThemeToggle />

          <button
            onClick={handleLogout}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-all duration-200"
            title="Abmelden"
          >
            <LogOut size={16} />
          </button>

          <div className="ml-1">
            <ScanButton />
          </div>
        </div>
      </div>
    </nav>
  )
}
