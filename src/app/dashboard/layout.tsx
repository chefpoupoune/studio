
"use client";

import * as React from "react";
import Link from "next/link";
import Image from 'next/image'; // Added for App Logo
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
  Home,
  LogOut,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { RubricId } from '@/app/dashboard/settings/components/user-management'; 

const APP_LOGO_STORAGE_KEY = "app_config_app_logo_url_v1"; // Key for app logo

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  rubricId: RubricId; 
}

const allNavItems: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Tableau de Bord", rubricId: "dashboard" },
  { href: "/dashboard/inventory", icon: Archive, label: "Gestion Stocks", rubricId: "inventory" },
  { href: "/dashboard/benefits", icon: FileSpreadsheet, label: "Avantages Nature", rubricId: "benefits" },
  { href: "/dashboard/time-tracking", icon: Users, label: "Suivi Heures", rubricId: "timeTracking" },
  { href: "/dashboard/task-management", icon: ClipboardList, label: "Gestion Tâches", rubricId: "taskManagement" },
  { href: "/dashboard/cost-management", icon: DollarSign, label: "Gestion Coûts", rubricId: "costManagement" },
  { href: "/dashboard/menu-planning", icon: BookOpenText, label: "Planification Menus", rubricId: "menuPlanning" },
  { href: "/dashboard/pms", icon: ShieldCheck, label: "PMS", rubricId: "pms" },
  { href: "/dashboard/settings", icon: Settings, label: "Paramètres", rubricId: "settings" },
];

function AppSidebar() {
  const pathname = usePathname();
  const { openMobile, setOpenMobile } = useSidebar();
  const router = useRouter();
  const [visibleNavItems, setVisibleNavItems] = React.useState<NavItem[]>(allNavItems);
  const [appLogoUrl, setAppLogoUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedPermissionsRaw = localStorage.getItem('loggedInUserPermissions');
      const loggedInUsername = localStorage.getItem('loggedInUsername');
      const storedAppLogo = localStorage.getItem(APP_LOGO_STORAGE_KEY);
      if (storedAppLogo) {
        setAppLogoUrl(storedAppLogo);
      }


      if (loggedInUsername?.toLowerCase() === 'chef') {
        setVisibleNavItems(allNavItems);
      } else if (storedPermissionsRaw) {
        try {
          const storedPermissions = JSON.parse(storedPermissionsRaw) as Partial<Record<RubricId, boolean>>;
          const filteredItems = allNavItems.filter(item => storedPermissions[item.rubricId] === true);
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
    if (openMobile) {
      setOpenMobile(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, openMobile]);

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
              <Image src={appLogoUrl} alt="App Logo" width={32} height={32} className="rounded-sm object-contain" data-ai-hint="application logo" unoptimized/>
            ) : (
              <div className="w-8 h-8 bg-muted rounded-sm flex items-center justify-center text-muted-foreground text-xs" data-ai-hint="generic logo placeholder">Logo</div>
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
                isActive={pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/dashboard")}
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
           {visibleNavItems.length === 0 && typeof window !== 'undefined' && localStorage.getItem('loggedInUsername')?.toLowerCase() !== 'chef' && (
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
  const [appLogoUrl, setAppLogoUrl] = React.useState<string | null>(null); // For mobile header logo

  React.useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
        const storedAppLogo = localStorage.getItem(APP_LOGO_STORAGE_KEY);
        if (storedAppLogo) {
            setAppLogoUrl(storedAppLogo);
        }
    }
  }, []);

  React.useEffect(() => {
    if (isClient) {
      if (localStorage.getItem('isLoggedIn') !== 'true') {
        router.replace('/login');
      } else {
        setAuthChecked(true); 
      }
    }
  }, [isClient, router]);

  React.useEffect(() => {
    if (isClient && authChecked) {
      const username = localStorage.getItem('loggedInUsername');
      if (username?.toLowerCase() === 'chef') {
        return; // Chef has access to everything
      }

      const storedPermissionsRaw = localStorage.getItem('loggedInUserPermissions');
      let userPermissions: Partial<Record<RubricId, boolean>> = {};
      if (storedPermissionsRaw) {
        try {
          userPermissions = JSON.parse(storedPermissionsRaw);
        } catch (e) {
          console.error("Error parsing permissions for route access control:", e);
          router.replace('/dashboard'); // Fallback to dashboard on permission error
          return;
        }
      }

      if (pathname === '/dashboard' || pathname === '/dashboard/') {
        if (!userPermissions.dashboard && username?.toLowerCase() !== 'chef') {
          // This scenario implies a user is logged in but explicitly has no dashboard permission.
          // This should ideally be handled by redirecting to login or a "no access" page
        }
        return;
      }
      
      const pathSegments = pathname.split('/');
      if (pathSegments.length > 2 && pathSegments[1] === 'dashboard') {
        const currentTopLevelPath = pathSegments[2];
        const navItem = allNavItems.find(item => item.href === `/dashboard/${currentTopLevelPath}`);
        
        if (navItem) {
          const requiredPermission = navItem.rubricId;
          if (!userPermissions[requiredPermission]) {
            router.replace('/dashboard'); 
          }
        } else {
           if (currentTopLevelPath) { 
            // router.replace('/dashboard'); // Optionally redirect unknown dashboard paths
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
                  <Image src={appLogoUrl} alt="App Logo" width={32} height={32} className="rounded-sm object-contain" data-ai-hint="application logo" unoptimized/>
                ) : (
                  <div className="w-8 h-8 bg-muted rounded-sm flex items-center justify-center text-muted-foreground text-xs" data-ai-hint="generic logo placeholder">Logo</div>
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

