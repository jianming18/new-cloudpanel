import { useState, type ReactNode } from 'react'

import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

export function AppLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f5fa]">
      <div className="hidden h-full lg:block">
        <Sidebar />
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full shadow-xl">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenSidebar={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-7">
          <div className="mx-auto w-full max-w-[1560px] space-y-5">{children}</div>
        </main>
      </div>
    </div>
  )
}
