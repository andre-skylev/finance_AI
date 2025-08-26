"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Target } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavGroups } from "@/components/navConfig";

export function Sidebar() {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const navGroups = useNavGroups();
  const { t } = useLanguage();

  return (
    <div className="hidden md:block">
      <div className="sticky top-0 h-screen border-r bg-muted/40 flex max-h-screen flex-col gap-2 overflow-y-auto">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Target className="h-6 w-6 text-primary" />
            <span className="">FinanceAI</span>
          </Link>
        </div>
        <div className="flex-1">
          <nav className="px-2 text-sm font-medium lg:px-4 space-y-4">
            {navGroups.map((group) => (
              <div key={group.title}>
                <div className="px-3 py-2 text-xs uppercase tracking-wide text-gray-500">
                  {group.title}
                </div>
                <div className="grid items-start">
                  {group.items.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
                          isActive ? "bg-muted text-primary" : ""
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
          </nav>
        </div>
        <div className="mt-auto p-4">
          <div className="flex items-center justify-between gap-2">
            <LanguageSelector />
            <button
              onClick={signOut}
              title={t("navigation.logout")}
              aria-label={t("navigation.logout")}
              className="inline-flex items-center justify-center rounded-md p-2 text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
