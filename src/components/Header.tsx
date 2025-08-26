"use client";

import { Target } from "lucide-react";

export function Header() {
  return (
    <>
      {/* Spacer for the fixed mobile top bar */}
      <div className="block md:hidden h-12" />
      <header className="hidden md:flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
        <div className="flex items-center gap-2">
          <Target className="h-6 w-6 text-primary" />
          <span className="font-semibold">FinanceAI</span>
        </div>
      </header>
    </>
  );
}
