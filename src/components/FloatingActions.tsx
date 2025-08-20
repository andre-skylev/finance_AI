"use client"

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { LogOut, Settings as SettingsIcon, Globe, ChevronUp, FileText } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { useLanguage } from '../contexts/LanguageContext';
import Link from 'next/link';

export function FloatingActions() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const pathname = usePathname();

  // Não mostrar o botão na página de login
  if (pathname === '/login' || !user) {
    return null;
  }

  const handleLanguageChange = (newLanguage: 'pt' | 'en') => {
    setLanguage(newLanguage);
    setIsOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    setIsOpen(false);
  };

  return (
    <div
      className="fixed right-6 z-50"
      style={{ bottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}
    >
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            size="lg"
            className="h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 border-2 border-primary-foreground/20 hover:scale-105 transition-all duration-200"
          >
            <ChevronUp className={`h-6 w-6 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          className="w-56 mb-2 shadow-xl border-2"
          sideOffset={8}
        >
          {/* Language Selector */}
          <div className="px-2 py-1.5">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
              <Globe className="h-4 w-4" />
              {t('navigation.language')}
            </div>
            <div className="grid grid-cols-2 gap-1">
              <Button
                variant={language === 'pt' ? 'default' : 'outline'}
                size="sm"
                className="h-8 text-xs"
                onClick={() => handleLanguageChange('pt')}
              >
                PT
              </Button>
              <Button
                variant={language === 'en' ? 'default' : 'outline'}
                size="sm"
                className="h-8 text-xs"
                onClick={() => handleLanguageChange('en')}
              >
                EN
              </Button>
            </div>
          </div>

          <DropdownMenuSeparator />

          {/* PDF Import */}
          <DropdownMenuItem asChild>
            <Link href="/import" className="flex items-center cursor-pointer">
              <FileText className="h-4 w-4 mr-2" />
              Import PDF
            </Link>
          </DropdownMenuItem>

          {/* Settings */}
          <DropdownMenuItem asChild>
            <Link href="/settings" className="flex items-center cursor-pointer">
              <SettingsIcon className="h-4 w-4 mr-2" />
              {t('navigation.settings')}
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Sign Out */}
          <DropdownMenuItem 
            onClick={handleSignOut}
            className="flex items-center cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
          >
            <LogOut className="h-4 w-4 mr-2" />
            {t('navigation.logout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
