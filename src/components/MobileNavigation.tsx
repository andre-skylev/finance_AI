"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LogOut } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/components/AuthProvider";
import { useState } from "react";
import { useNavGroups } from "@/components/navConfig";

export function MobileNavigation() {
  const pathname = usePathname();
  const { t, language, setLanguage } = useLanguage();
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const navGroups = useNavGroups();

  // Hide on auth pages
  if (pathname?.includes("/login") || pathname?.includes("/register")) {
    return null;
  }

  return (
    <>
      {/* Top fixed bar with hamburger on mobile */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur border-b">
        <div className="h-12 flex items-center justify-between px-3">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="p-2 rounded-md border hover:bg-gray-50"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/" className="text-sm font-semibold">FinanceAI</Link>
          <div className="w-9" />
        </div>
      </div>

      {/* Off-canvas overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute top-0 left-0 right-0 bg-white h-full overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <span className="font-semibold">{t('navigation.menu') || (language==='pt'?'Menu':'Menu')}</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="p-2 rounded-md border hover:bg-gray-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 space-y-6">
              {navGroups.map((group) => (
                <div key={group.title}>
                  <div className="px-1 py-2 text-xs uppercase tracking-wide text-gray-500">
                    {group.title}
                  </div>
                  <div className="grid">
                    {group.items.map((item) => {
                      const isActive = pathname === item.href;
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                            isActive ? 'bg-gray-100 text-primary' : 'hover:bg-gray-50'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Language and logout */}
              <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => { setLanguage('pt'); setOpen(false); }}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium ${language==='pt' ? 'bg-primary text-white' : 'bg-gray-100'}`}
                  >
                    PT
                  </button>
                  <button
                    onClick={() => { setLanguage('en'); setOpen(false); }}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium ${language==='en' ? 'bg-primary text-white' : 'bg-gray-100'}`}
                  >
                    EN
                  </button>
                </div>
                <button
                  onClick={() => { setOpen(false); signOut(); }}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{t('navigation.logout')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}