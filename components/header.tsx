'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Map, User, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const PRIMARY = '#90BEDE'

// ─── Nav items ────────────────────────────────────────────────────────────────
// Add, remove, or reorder entries here to update the navigation menu.

interface NavItem {
  label: string
  href: string
}

const NAV_ITEMS: NavItem[] = [
  { label: '대시보드', href: '/' },
  { label: '지점 관리', href: '/branches' },
  { label: '대피소 관리', href: '/shelters' },
]

// ─── Header ───────────────────────────────────────────────────────────────────

export function Header() {
  const pathname = usePathname()

  return (
    <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 z-50 flex-shrink-0">
      {/* Left: logo + nav */}
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2">
          <Map className="w-7 h-7" style={{ color: PRIMARY }} />
          <h1 className="text-white text-lg font-bold tracking-tight">관리자 대시보드</h1>
        </div>

        <nav className="hidden md:flex items-center gap-6">
          {NAV_ITEMS.map(item => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'text-sm font-medium transition-colors pb-1',
                  isActive
                    ? 'text-slate-300 border-b-2'
                    : 'text-slate-400 hover:text-[#90BEDE]',
                )}
                style={isActive ? { borderColor: PRIMARY } : undefined}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Right: user info + logout */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 px-3 py-1 bg-slate-800 rounded-lg">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: `${PRIMARY}33` }}
          >
            <User className="w-4 h-4" style={{ color: PRIMARY }} />
          </div>
          <span className="text-xs text-slate-300 font-medium">관리자 님</span>
        </div>

        <Button
          size="sm"
          className="font-bold gap-2 text-slate-900 hover:opacity-90"
          style={{ background: PRIMARY }}
        >
          <span>로그아웃</span>
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  )
}
