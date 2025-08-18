"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Target,
  Calendar,
  Settings,
  LogOut,
  CreditCard,
  FileUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { useLanguage } from "../contexts/LanguageContext";
import { LanguageSelector } from "./LanguageSelector";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, labelKey: "navigation.dashboard" },
  { href: "/import", icon: FileUp, labelKey: "navigation.import" },
  { href: "/transactions", icon: ArrowLeftRight, labelKey: "navigation.transactions" },
  { href: "/installments", icon: CreditCard, labelKey: "navigation.installments" },
  { href: "/credit-cards", icon: CreditCard, labelKey: "navigation.creditCards" },
  { href: "/goals", icon: Target, labelKey: "navigation.goals" },
  { href: "/fixed-costs", icon: Calendar, labelKey: "navigation.fixedCosts" },
  { href: "/chat", icon: Settings, labelKey: "navigation.chat" },
  { href: "/settings", icon: Settings, labelKey: "navigation.settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const { t } = useLanguage();

  return (
    <div className="hidden border-r bg-muted/40 md:block fixed left-0 top-0 z-40 w-[280px]">
      <div className="flex h-screen max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <Target className="h-6 w-6 text-primary" />
            <span className="">FinanceAI</span>
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary ${
                  pathname === item.href ? "bg-muted text-primary" : ""
                }`}
              >
                <item.icon className="h-4 w-4" />
                {t(item.labelKey)}
              </Link>
            ))}
          </nav>
        </div>
        <div className="sticky bottom-0 bg-muted/40 border-t p-4 space-y-2">
          <LanguageSelector />
          <Button size="sm" className="w-full" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            {t('navigation.logout')}
          </Button>
        </div>
      </div>
    </div>
  );
}
