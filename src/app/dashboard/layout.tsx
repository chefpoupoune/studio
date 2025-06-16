
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
  FileClock,
  Loader2 
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { RubricId } from '@/app/dashboard/settings/components/user-management';
import { RUBRICS as BASE_RUBRICS, TIME_TRACKING_SUB_RUBRICS, LOGGED_IN_USER_PERMISSIONS_KEY } from '@/app/dashboard/settings/components/user-management';
import { applyThemeMode, applyAccentColor } from '@/lib/theme-utils';
import { DEFAULT_APP_PRIMARY_COLOR } from '@/config/colors';
import { firestore } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { ThemeMode } from '@/app/dashboard/settings/components/application-settings-manager';

const APP_SETTINGS_COLLECTION = "appSettings";
const GLOBAL_APP_SETTINGS_DOC_ID = "globalAppSettings";

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

function AppSidebar({ appLogoUrl }: { appLogoUrl: string | null }) {
  const pathname = usePathname();
  const { openMobile, setOpenMobile } = useSidebar();
  const router = useRouter();
  const [visibleNavItems, setVisibleNavItems] = React.useState<NavItem[]>(allNavItems);
  const [loggedInUsername, setLoggedInUsername] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedPermissionsRaw = localStorage.getItem(LOGGED_IN_USER_PERMISSIONS_KEY);
      const username = localStorage.getItem('loggedInUsername');
      setLoggedInUsername(username);

      if (username?.toLowerCase() === 'chef' || username?.toLowerCase() === 'chef de service') { // Updated to include Chef de service
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
      // setOpenMobile(false); 
    }
  }, [pathname, setOpenMobile, openMobile]); 

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('loggedInUsername');
      localStorage.removeItem(LOGGED_IN_USER_PERMISSIONS_KEY);
      localStorage.removeItem('loggedInUserHourViewConfig'); // Ensure this is also cleared
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
           {visibleNavItems.length === 0 && typeof window !== 'undefined' && loggedInUsername?.toLowerCase() !== 'chef' && loggedInUsername?.toLowerCase() !== 'chef de service' && (
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
  const [settingsLoading, setSettingsLoading] = React.useState(true);
  const [appLogoUrl, setAppLogoUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
        console.log("[DashboardLayout EFFECT 1] Running initial setup (Auth & Settings).");
        
        // Auth Check
        if (localStorage.getItem('isLoggedIn') !== 'true') {
            console.log("[DashboardLayout EFFECT 1] Not logged in, redirecting to /login.");
            router.replace('/login');
            return; // Stop further execution in this effect if not logged in
        } else {
            console.log("[DashboardLayout EFFECT 1] Logged in, proceeding with settings load.");
            setAuthChecked(true);
        }

        // Load Global App Settings from Firestore
        const loadGlobalSettings = async () => {
            setSettingsLoading(true);
            const docRef = doc(firestore, APP_SETTINGS_COLLECTION, GLOBAL_APP_SETTINGS_DOC_ID);
            try {
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const settings = docSnap.data();
                    const themeMode = (settings.themeMode || 'system') as ThemeMode;
                    const accentColor = settings.accentColor || DEFAULT_APP_PRIMARY_COLOR;
                    setAppLogoUrl(settings.appLogoUrl || null);

                    applyThemeMode(themeMode);
                    applyAccentColor(accentColor);
                    console.log("[DashboardLayout EFFECT 1] Firestore settings applied:", { themeMode, accentColor, appLogoSet: !!settings.appLogoUrl });
                } else {
                    console.log("[DashboardLayout EFFECT 1] No global settings in Firestore, applying defaults.");
                    applyThemeMode('system');
                    applyAccentColor(DEFAULT_APP_PRIMARY_COLOR);
                    setAppLogoUrl(null);
                    // Optionally create the default settings doc here if it's critical
                }
            } catch (error) {
                console.error("[DashboardLayout EFFECT 1] Error loading global settings from Firestore:", error);
                applyThemeMode('system'); // Fallback
                applyAccentColor(DEFAULT_APP_PRIMARY_COLOR); // Fallback
            } finally {
                setSettingsLoading(false);
            }
        };
        
        if (localStorage.getItem('isLoggedIn') === 'true') { // Ensure we only load settings if authenticated
            loadGlobalSettings();
        }

        // System theme change listener
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = async () => { // Make async if settings load is needed
          const docRef = doc(firestore, APP_SETTINGS_COLLECTION, GLOBAL_APP_SETTINGS_DOC_ID);
          const docSnap = await getDoc(docRef);
          let currentThemeSetting: ThemeMode = 'system';
          if (docSnap.exists()) {
            currentThemeSetting = (docSnap.data().themeMode || 'system') as ThemeMode;
          }
          if (currentThemeSetting === 'system') {
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
  }, [isClient, router]); 

  React.useEffect(() => {
    if (isClient && authChecked && !settingsLoading) { // Ensure auth and settings are done
      console.log("[DashboardLayout EFFECT Permissions] Auth & settings checked, verifying route access for pathname:", pathname);
      const username = localStorage.getItem('loggedInUsername');
      if (username?.toLowerCase() === 'chef' || username?.toLowerCase() === 'chef de service') { // Updated to include Chef de service
        console.log("[DashboardLayout EFFECT Permissions] User is Admin (Chef or Chef de service), access granted.");
        return; 
      }

      const storedPermissionsRaw = localStorage.getItem(LOGGED_IN_USER_PERMISSIONS_KEY);
      let userPermissions: Partial<Record<RubricId, boolean>> = {};
      if (storedPermissionsRaw) {
        try {
          userPermissions = JSON.parse(storedPermissionsRaw);
        } catch (e) {
          console.error("[DashboardLayout EFFECT Permissions] Error parsing permissions:", e);
          router.replace('/dashboard'); 
          return;
        }
      }
      
      if (pathname === '/dashboard' || pathname === '/dashboard/') {
         console.log("[DashboardLayout EFFECT Permissions] Accessing main dashboard page, allowed.");
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
          } else {
            hasAccessToSection = !!userPermissions[navItem.rubricId as RubricId];
          }

          if (!hasAccessToSection) {
            console.log(`[DashboardLayout EFFECT Permissions] Access denied to ${pathname}. Redirecting.`);
            router.replace('/dashboard');
          }
        }
      }
    }
  }, [isClient, authChecked, settingsLoading, pathname, router]);


  if (!isClient || !authChecked || settingsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-3"/>
        <p className="text-muted-foreground">Vérification et chargement...</p>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar appLogoUrl={appLogoUrl} />
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

