"use client"

import React from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { Header } from '@/components/Header'
import { MobileNavigation } from '@/components/MobileNavigation'
import { useAuth } from '@/components/AuthProvider'

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLogin = pathname === '/login'
  const { user } = useAuth()
  // Public landing page: hide chrome if not authenticated
  // We rely on AuthProvider to set user in context; if absent, home is public
  // But LayoutShell does not know user directly. Keep chrome on for other routes.

  if (isLogin || (pathname === '/' && !user)) {
    // No chrome (menus/header) on the login page
    return <>{children}</>
  }

  return (
    <>
      <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
        <Sidebar />
        <div className="flex flex-col">
          <Header />
          <main className="flex flex-1 flex-col gap-4 p-4 pb-safe-tabbar md:pb-4 lg:gap-6 lg:p-6">
            {children}
          </main>
        </div>
      </div>
      <MobileNavigation />
    </>
  )
}
