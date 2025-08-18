import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import { LanguageProvider } from "../contexts/LanguageContext";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Finance AI",
  description: "Gestão financeira multi-regional com IA",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-PT" suppressHydrationWarning>
      <body className={inter.className}>
        <LanguageProvider>
          <AuthProvider>
            <div className="min-h-screen bg-gray-50">
              <Sidebar />
              <div className="lg:ml-[280px]">
                <Header />
                <main className="p-4 sm:p-6 lg:p-8">
                  {children}
                </main>
              </div>
            </div>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}