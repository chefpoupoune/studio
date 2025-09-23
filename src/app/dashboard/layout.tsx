'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  LayoutGrid, Box, FileText, Timer, GanttChartSquare, ClipboardCheck, DollarSign,
  CookingPot, ShoppingBasket, Sheet, Settings, LogOut, Package, PanelLeft,
  MegaphoneIcon
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem,
  SidebarMenuButton, SidebarProvider, SidebarInset, SidebarFooter, SidebarTrigger
} from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/toaster';
import { LOGGED_IN_USER_PERMISSIONS_KEY } from '@/app/dashboard/settings/components/user-management';
import { firestore } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { applyThemeMode as applyThemeModeUtil, applyAccentColor as applyAccentColorUtil } from '@/lib/theme-utils';
import { DEFAULT_APP_PRIMARY_COLOR } from '@/config/colors';

const APP_SETTINGS_COLLECTION = "appSettings";
const GLOBAL_APP_SETTINGS_DOC_ID = "globalAppSettings";
type ThemeMode = 'light' | 'dark' | 'system';
const DEFAULT_THEME_MODE: ThemeMode = 'dark';
const DEFAULT_ACCENT_COLOR_FS = DEFAULT_APP_PRIMARY_COLOR;
const DEFAULT_APP_LOGO_URL_FS: string | null = null;

const menuItems = [
  { href: "/dashboard", icon: LayoutGrid, label: "Tableau de Bord", permission: "canAccessDashboard" },
  { href: "/dashboard/inventory", icon: Box, label: "Gestion Stocks", permission: "canAccessInventory" },
  { href: "/dashboard/benefits", icon: FileText, label: "Avantages Nature", permission: "canAccessBenefits" },
  { href: "/dashboard/time-tracking", icon: Timer, label: "Suivi Heures", permission: "canAccessTimeTracking" },
  { href: "/dashboard/declaration-heure", icon: GanttChartSquare, label: "Déclaration d'Heures", permission: "canAccessDeclarationHeure" },
  { href: "/dashboard/task-management", icon: ClipboardCheck, label: "Gestion des Problèmes", permission: "canAccessTaskManagement" },
  { href: "/dashboard/cost-management", icon: DollarSign, label: "Gestion Budget", permission: "canAccessCostManagement" },
  { href: "/dashboard/menu-planning", icon: CookingPot, label: "Planification Menus", permission: "canAccessMenuPlanning" },
  { href: "/dashboard/picnic", icon: ShoppingBasket, label: "Pique Nique", permission: "canAccessPicnic" },
  { href: "/dashboard/pms", icon: Sheet, label: "PMS", permission: "canAccessPms" },
  { href: "/dashboard/settings", icon: Settings, label: "Paramètres", permission: "canAccessSettings" },
  { href: "/dashboard/fin-du-mois", icon: MegaphoneIcon, label: "Fin du Mois !", permission: "canAccessFinDuMois" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [authLoading, setAuthLoading] = React.useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const [appLogoUrl, setAppLogoUrl] = React.useState<string | null>(DEFAULT_APP_LOGO_URL_FS);
  const [themeMode, setThemeMode] = React.useState<ThemeMode>(DEFAULT_THEME_MODE);
  const [accentColor, setAccentColor] = React.useState<string>(DEFAULT_ACCENT_COLOR_FS);
  const [isSettingsLoading, setIsSettingsLoading] = React.useState(true);
  const [userPermissions, setUserPermissions] = React.useState<any>({});

  React.useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (!isLoggedIn) {
      router.push('/login');
    } else {
      const permissions = JSON.parse(localStorage.getItem(LOGGED_IN_USER_PERMISSIONS_KEY) || '{}');
      setUserPermissions(permissions);
      setAuthLoading(false);
    }
  }, [router]);

  React.useEffect(() => {
    const loadGlobalSettings = async () => {
      const docRef = doc(firestore, APP_SETTINGS_COLLECTION, GLOBAL_APP_SETTINGS_DOC_ID);
      try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setAppLogoUrl(data.appLogoUrl || DEFAULT_APP_LOGO_URL_FS);
          setThemeMode(data.themeMode || DEFAULT_THEME_MODE);
          setAccentColor(data.accentColor || DEFAULT_ACCENT_COLOR_FS);
        }
      } catch (error) {
        console.error("[Layout] Error loading global settings:", error);
      } finally {
        setIsSettingsLoading(false);
      }
    };

    loadGlobalSettings();

    const handleStorageChange = (event: StorageEvent) => {
        if (event.key === 'app_settings_updated') {
            loadGlobalSettings();
        }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
        window.removeEventListener('storage', handleStorageChange);
    };

  }, []);

  React.useEffect(() => {
    if (!isSettingsLoading) {
      applyThemeModeUtil(themeMode);
      applyAccentColorUtil(accentColor);
    }
  }, [isSettingsLoading, themeMode, accentColor]);

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('loggedInUsername');
    localStorage.removeItem(LOGGED_IN_USER_PERMISSIONS_KEY);
    localStorage.removeItem('LOGGED_IN_USER_HOUR_VIEW_CONFIG_KEY');
    router.push('/login');
  };

  if (authLoading || isSettingsLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <p>Chargement de l'application...</p>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarContent className="flex flex-col">
          <SidebarHeader>
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {appLogoUrl ? (
                    <Image
                      src={appLogoUrl}
                      alt="Logo de l'application"
                      width={40}
                      height={40}
                      className="rounded-md object-contain"
                      unoptimized
                    />
                  ) : (
                    <div className="h-10 w-10 bg-muted rounded-md flex items-center justify-center text-muted-foreground">
                      <Package className="h-6 w-6" />
                    </div>
                  )}
                  <div className="group-data-[state=collapsed]:hidden">
                    <h1 className="text-md font-semibold text-white">Gestion par</h1>
                    <h1 className="text-md font-bold text-white">L'excellence</h1>
                  </div>
                </div>
                <SidebarTrigger className="hidden md:flex" />
              </div>
          </SidebarHeader>

          <SidebarMenu className="flex-1">
            {menuItems.map((item) =>
              userPermissions[item.permission] ? (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton href={item.href} isActive={pathname === item.href || (item.href.length > 10 && pathname.startsWith(item.href))} asChild>
                    <Link href={item.href}><item.icon />{item.label}</Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null
            )}
          </SidebarMenu>

          <SidebarFooter className="mt-auto">
             <div className="border-t border-sidebar-border my-2"></div>
             <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton onClick={handleLogout} asChild>
                        <Button variant="ghost" className="w-full justify-start">
                            <LogOut className="mr-2 h-4 w-4" />
                            Déconnexion
                        </Button>
                    </SidebarMenuButton>
                </SidebarMenuItem>
             </SidebarMenu>
             <div className="p-4 text-xs text-muted-foreground text-center">
                <p>Créé par Julien Dernoncourt</p>
                <p>Version 3</p>
             </div>
          </SidebarFooter>
        </SidebarContent>
      </Sidebar>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 md:hidden">
            <SidebarTrigger />
        </header>
        <SidebarInset>
            <main className="flex-1 overflow-auto p-4 sm:p-6">
            {children}
            </main>
        </SidebarInset>
      </div>

      <Toaster />
    </SidebarProvider>
  );
}
