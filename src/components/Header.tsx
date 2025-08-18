"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  Target,
  LayoutDashboard,
  ArrowLeftRight,
  Calendar,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useLanguage } from "../contexts/LanguageContext";
import { LanguageSelector } from "./LanguageSelector";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, labelKey: "navigation.dashboard" },
  { href: "/transactions", icon: ArrowLeftRight, labelKey: "navigation.transactions" },
  { href: "/goals", icon: Target, labelKey: "navigation.goals" },
  { href: "/fixed-costs", icon: Calendar, labelKey: "navigation.fixedCosts" },
  { href: "/chat", icon: Settings, labelKey: "navigation.chat" },
  { href: "/settings", icon: Settings, labelKey: "navigation.settings" },
];

export function Header() {
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0 md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex flex-col">
          <nav className="grid gap-2 text-lg font-medium">
            <Link
              href="#"
              className="flex items-center gap-2 text-lg font-semibold mb-4"
            >
              <Target className="h-6 w-6 text-primary" />
              <span className="">FinanceAI</span>
            </Link>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground ${
                  pathname === item.href ? "bg-muted text-foreground" : ""
                }`}
              >
                <item.icon className="h-5 w-5" />
                {t(item.labelKey)}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
      <div className="ml-auto md:hidden">
        <LanguageSelector />
      </div>
    </header>
  );
}
