
"use client";

import * as React from "react";
import Link from "next/link";
import Image from 'next/image';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  Archive,
  Settings,
  FileSpreadsheet,
  Users,
  ClipboardList,
  DollarSign,
  BookOpenText,
  ShieldCheck,
  PanelLeft,
  LogOut,
  Clock,
  ShoppingBasket,
  FileClock 
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { RubricId } from '@/app/dashboard/settings/components/user-management';
import { RUBRICS as BASE_RUBRICS, TIME_TRACKING_SUB_RUBRICS } from '@/app/dashboard/settings/components/user-management';
import { applyThemeMode, applyAccentColor, THEME_STORAGE_KEY, ACCENT_COLOR_STORAGE_KEY } from '@/lib/theme-utils';
import { DEFAULT_APP_PRIMARY_COLOR } from '@/config/colors';

const APP_LOGO_STORAGE_KEY = "app_config_app_logo_url_v1";
type ThemeMode = 'light' | 'dark' | 'system';


interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  rubricId: RubricId | 'timeTracking_parent' | 'picnic' | 'declarationHeure'; 
}

const allNavItems: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Tableau de Bord", rubricId: "dashboard" },
  { href: "/dashboard/inventory", icon: Archive, label: "Gestion Stocks", rubricId: "inventory" },
  { href: "/dashboard/benefits", icon: FileSpreadsheet, label: "Avantages Nature", rubricId: "benefits" },
  { href: "/dashboard/time-tracking", icon: Clock, label: "Suivi Heures", rubricId: "timeTracking_parent" },
  { href: "/dashboard/declaration-heure", icon: FileClock, label: "Déclaration d'Heures", rubricId: "declarationHeure" },
  { href: "/dashboard/task-management", icon: ClipboardList, label: "Gestion Tâches", rubricId: "taskManagement" },
  { href: "/dashboard/cost-management", icon: DollarSign, label: "Gestion Coûts", rubricId: "costManagement" },
  { href: "/dashboard/menu-planning", icon: BookOpenText, label: "Planification Menus", rubricId: "menuPlanning" },
  { href: "/dashboard/picnic", icon: ShoppingBasket, label: "Pique Nique", rubricId: "picnic" },
  { href: "/dashboard/pms", icon: ShieldCheck, label: "PMS", rubricId: "pms" },
  { href: "/dashboard/settings", icon: Settings, label: "Paramètres", rubricId: "settings" },
];

function AppSidebar() {
  const pathname = usePathname();
  const { openMobile, setOpenMobile } = useSidebar();
  const router = useRouter();
  const [visibleNavItems, setVisibleNavItems] = React.useState<NavItem[]>(allNavItems);
  const [appLogoUrl, setAppLogoUrl] = React.useState<string | null>(null);
  const [loggedInUsername, setLoggedInUsername] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedPermissionsRaw = localStorage.getItem('loggedInUserPermissions');
      const username = localStorage.getItem('loggedInUsername');
      setLoggedInUsername(username);
      const storedAppLogo = localStorage.getItem(APP_LOGO_STORAGE_KEY);
      if (storedAppLogo) {
        setAppLogoUrl(storedAppLogo);
      }

      if (username?.toLowerCase() === 'chef') {
        setVisibleNavItems(allNavItems);
      } else if (storedPermissionsRaw) {
        try {
          const storedPermissions = JSON.parse(storedPermissionsRaw) as Partial<Record<RubricId, boolean>>;
          const filteredItems = allNavItems.filter(item => {
            if (item.rubricId === 'timeTracking_parent') {
              return TIME_TRACKING_SUB_RUBRICS.some(sub => storedPermissions[sub.id]);
            }
            return storedPermissions[item.rubricId as RubricId] === true;
          });
          setVisibleNavItems(filteredItems);
        } catch (e) {
          console.error("Error parsing stored permissions for sidebar", e);
          setVisibleNavItems([]);
        }
      } else {
        setVisibleNavItems([]);
      }
    }
  }, [pathname]); 

  React.useEffect(() => {
    if (openMobile && pathname) { 
      // setOpenMobile(false); // Commented out to prevent auto-closing issues
    }
  }, [pathname, setOpenMobile, openMobile]); 

  const { isMobile } = useSidebar(); 

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('loggedInUsername');
      localStorage.removeItem('loggedInUserPermissions');
      localStorage.removeItem('loggedInUserHourViewConfig');
    }
    router.push('/login');
  };

  return (
    <Sidebar collapsible="icon" variant="sidebar" side="left">
      <SidebarHeader className="flex items-center justify-between">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
          <Link href="/dashboard" className="flex items-center gap-2">
            {appLogoUrl ? (
              <Image src={appLogoUrl} alt="App Logo" width={32} height={32} className="rounded-sm object-contain" data-ai-hint="chef hat" unoptimized/>
            ) : (
              <div className="w-8 h-8 bg-muted rounded-sm flex items-center justify-center text-muted-foreground text-xs" data-ai-hint="application logo">Logo</div>
            )}
            <span className="font-semibold text-lg text-sidebar-primary">Gestion par L'excellence</span>
          </Link>
        </div>
        <SidebarTrigger className="md:hidden" />
      </SidebarHeader>
      <Separator className="my-1 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:my-2 group-data-[collapsible=icon]:w-6" />
      <SidebarContent>
        <SidebarMenu>
          {visibleNavItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/dashboard" && item.href !== "/dashboard/")}
                tooltip={{
                  children: item.label,
                  className: "group-data-[collapsible=icon]:block hidden",
                }}
              >
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
           {visibleNavItems.length === 0 && typeof window !== 'undefined' && loggedInUsername?.toLowerCase() !== 'chef' && (
            <SidebarMenuItem>
                <div className="p-2 text-xs text-sidebar-foreground/60 text-center">
                    Aucune rubrique accessible. Contactez un administrateur.
                </div>
            </SidebarMenuItem>
           )}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="mt-auto">
        <Separator className="my-1 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:my-2 group-data-[collapsible=icon]:w-6" />
        <SidebarMenu>
          <SidebarMenuItem>
             <SidebarMenuButton
                onClick={handleLogout}
                tooltip={{
                  children: "Déconnexion",
                  className: "group-data-[collapsible=icon]:block hidden",
                }}
              >
                <LogOut />
                <span>Déconnexion</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
            <div className="p-2 text-xs text-sidebar-foreground/60">
              Créé par Julien Dernoncourt
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
            <div className="p-2 text-xs text-sidebar-foreground/60">
              Version 1.0.0
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isClient, setIsClient] = React.useState(false);
  const [authChecked, setAuthChecked] = React.useState(false);
  const [appLogoUrl, setAppLogoUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
        console.log("[DashboardLayout EFFECT 1] Running initial setup.");
        const storedAppLogo = localStorage.getItem(APP_LOGO_STORAGE_KEY);
        if (storedAppLogo) {
            setAppLogoUrl(storedAppLogo);
            console.log("[DashboardLayout EFFECT 1] App logo loaded from localStorage.");
        } else {
            console.log("[DashboardLayout EFFECT 1] No app logo in localStorage.");
        }

        const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
        const initialThemeMode = storedTheme && ['light', 'dark', 'system'].includes(storedTheme) ? storedTheme : 'system';
        applyThemeMode(initialThemeMode);
        console.log("[DashboardLayout EFFECT 1] Applied theme:", initialThemeMode);

        const storedAccentColor = localStorage.getItem(ACCENT_COLOR_STORAGE_KEY);
        const initialAccentColor = storedAccentColor || DEFAULT_APP_PRIMARY_COLOR;
        applyAccentColor(initialAccentColor);
        console.log("[DashboardLayout EFFECT 1] Applied accent color:", initialAccentColor);


        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
          const currentThemeSetting = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
          if (currentThemeSetting === 'system' || !currentThemeSetting) {
             console.log("[DashboardLayout Media Query Change] System theme changed, re-applying.");
             applyThemeMode('system');
          }
        };
        mediaQuery.addEventListener('change', handleChange);
        console.log("[DashboardLayout EFFECT 1] System theme change listener added.");
        return () => {
            mediaQuery.removeEventListener('change', handleChange);
            console.log("[DashboardLayout EFFECT 1 Cleanup] System theme change listener removed.");
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient]); 

  React.useEffect(() => {
    if (isClient) {
      console.log("[DashboardLayout EFFECT 2] Checking auth status.");
      if (localStorage.getItem('isLoggedIn') !== 'true') {
        console.log("[DashboardLayout EFFECT 2] Not logged in, redirecting to /login.");
        router.replace('/login');
      } else {
        console.log("[DashboardLayout EFFECT 2] Logged in, setting authChecked to true.");
        setAuthChecked(true);
      }
    }
  }, [isClient, router]);

  React.useEffect(() => {
    if (isClient && authChecked) {
      console.log("[DashboardLayout EFFECT 3] Auth checked, verifying route access for pathname:", pathname);
      const username = localStorage.getItem('loggedInUsername');
      if (username?.toLowerCase() === 'chef') {
        console.log("[DashboardLayout EFFECT 3] User is Chef, access granted.");
        return; 
      }

      const storedPermissionsRaw = localStorage.getItem('loggedInUserPermissions');
      let userPermissions: Partial<Record<RubricId, boolean>> = {};
      if (storedPermissionsRaw) {
        try {
          userPermissions = JSON.parse(storedPermissionsRaw);
          console.log("[DashboardLayout EFFECT 3] User permissions loaded:", userPermissions);
        } catch (e) {
          console.error("[DashboardLayout EFFECT 3] Error parsing permissions for route access control:", e);
          router.replace('/dashboard'); 
          return;
        }
      } else {
        console.log("[DashboardLayout EFFECT 3] No user permissions found in localStorage.");
      }
      
      if (pathname === '/dashboard' || pathname === '/dashboard/') {
         console.log("[DashboardLayout EFFECT 3] Accessing main dashboard page, allowed.");
         return;
      }
      
      const pathSegments = pathname.split('/');
      if (pathSegments.length > 2 && pathSegments[1] === 'dashboard') {
        const currentTopLevelPath = pathSegments[2];
        const navItem = allNavItems.find(item => item.href === `/dashboard/${currentTopLevelPath}`);

        if (navItem) {
          let hasAccessToSection = false;
          if (navItem.rubricId === 'timeTracking_parent') {
            hasAccessToSection = TIME_TRACKING_SUB_RUBRICS.some(sub => userPermissions[sub.id]);
            console.log(`[DashboardLayout EFFECT 3] Checking timeTracking_parent access, result: ${hasAccessToSection}`);
          } else {
            hasAccessToSection = !!userPermissions[navItem.rubricId as RubricId];
            console.log(`[DashboardLayout EFFECT 3] Checking access to ${navItem.rubricId}, result: ${hasAccessToSection}`);
          }

          if (!hasAccessToSection) {
            console.log(`[DashboardLayout EFFECT 3] Access denied to ${pathname}. Redirecting to /dashboard.`);
            router.replace('/dashboard');
          } else {
            console.log(`[DashboardLayout EFFECT 3] Access granted to ${pathname}.`);
          }
        } else {
           if (currentTopLevelPath) {
             // console.log(`[DashboardLayout EFFECT 3] Accessing potentially non-sidebar path: /dashboard/${currentTopLevelPath}`);
           }
        }
      }
    }
  }, [isClient, authChecked, pathname, router]);


  if (!isClient || !authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Vérification de l'authentification et des permissions...</p>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      <SidebarInset>
        <div className="min-h-screen w-full">
          <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4 md:hidden">
            <SidebarTrigger />
            <Link href="/dashboard" className="flex items-center gap-2">
                {appLogoUrl ? (
                  <Image src={appLogoUrl} alt="App Logo" width={32} height={32} className="rounded-sm object-contain" data-ai-hint="chef hat" unoptimized/>
                ) : (
                  <div className="w-8 h-8 bg-muted rounded-sm flex items-center justify-center text-muted-foreground text-xs" data-ai-hint="application logo">Logo</div>
                )}
                <span className="font-semibold text-md">Gestion par L'excellence</span>
            </Link>
          </header>
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
