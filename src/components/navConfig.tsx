"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Target,
  Calendar,
  Settings,
  CreditCard,
  ListOrdered,
  ReceiptText,
  Wallet,
} from "lucide-react";

export type NavItem = { href: string; icon: any; label: string };
export type NavGroup = { title: string; items: NavItem[] };

// Shared nav groups used by both Sidebar (desktop) and Mobile menu
export function useNavGroups(): NavGroup[] {
  const { t } = useLanguage();
  return [
    {
      title: t("navGroup.overview") || "Visão geral",
      items: [
        { href: "/dashboard", icon: LayoutDashboard, label: t("navigation.dashboard") },
      ],
    },
    {
      title: t("navGroup.accounts") || "Contas",
      items: [
        { href: "/accounts", icon: Wallet, label: t("settings.accounts") },
        { href: "/credit-cards", icon: CreditCard, label: t("navigation.creditCards") },
      ],
    },
    {
      title: t("navGroup.operations") || "Operações",
      items: [
        { href: "/transactions", icon: ArrowLeftRight, label: t("navigation.transactions") },
        { href: "/installments", icon: ListOrdered, label: t("navigation.installments") },
        { href: "/categories", icon: ListOrdered, label: t("navigation.categories") },
      ],
    },
    {
      title: t("navGroup.documents") || "Documentos",
      items: [
        { href: "/receipts", icon: ReceiptText, label: t("navigation.receipts") || "Recibos" },
      ],
    },
    {
      title: t("navGroup.planning") || "Planejamento",
      items: [
        { href: "/goals", icon: Target, label: t("navigation.goals") },
        { href: "/fixed-costs", icon: Calendar, label: t("navigation.fixedCosts") },
        { href: "/budgets", icon: Calendar, label: t("navigation.budgets") || "Orçamentos" },
        { href: "/fixed-incomes", icon: Calendar, label: t("navigation.fixedIncomes") },
      ],
    },
    {
      title: t("navGroup.settings") || "Configurações",
      items: [
        { href: "/settings", icon: Settings, label: t("navigation.settings") },
      ],
    },
  ];
}
