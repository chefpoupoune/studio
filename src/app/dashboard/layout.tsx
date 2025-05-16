
"use client";

import * as React from "react";
import Link from "next/link";
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
import type { RubricId } from '@/app/dashboard/settings/components/user-management'; // Import RubricId

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  rubricId: RubricId; // Added rubricId for permission checking
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
  const { state, openMobile, setOpenMobile } = useSidebar();
  const router = useRouter();
  const [visibleNavItems, setVisibleNavItems] = React.useState<NavItem[]>(allNavItems);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedPermissionsRaw = localStorage.getItem('loggedInUserPermissions');
      const loggedInUsername = localStorage.getItem('loggedInUsername');

      if (loggedInUsername?.toLowerCase() === 'chef') {
        setVisibleNavItems(allNavItems);
      } else if (storedPermissionsRaw) {
        try {
          const storedPermissions = JSON.parse(storedPermissionsRaw) as Partial<Record<RubricId, boolean>>;
          const filteredItems = allNavItems.filter(item => storedPermissions[item.rubricId] === true);
          setVisibleNavItems(filteredItems);
        } catch (e) {
          console.error("Error parsing stored permissions", e);
          setVisibleNavItems([]); // Default to no items if permissions are corrupted
        }
      } else {
        setVisibleNavItems([]); // No permissions found, show no items
      }
    }
  }, [pathname]); // Re-check on pathname change if needed, or on login state change

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
      localStorage.removeItem('loggedInUserPermissions'); // Clear permissions on logout
    }
    router.push('/login');
  };


  return (
    <Sidebar collapsible="icon" variant="sidebar" side="left">
      <SidebarHeader className="flex items-center justify-between">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
          <Link href="/dashboard" className="flex items-center gap-2">
            {/* <div className="w-8 h-8 bg-primary rounded-sm flex items-center justify-center text-primary-foreground font-bold text-lg" data-ai-hint="chef hat">E</div> */}
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
                asChild
                tooltip={{
                  children: "Retour à l'accueil",
                  className: "group-data-[collapsible=icon]:block hidden",
                }}
              >
              <Link href="/">
                <Home />
                <span>Accueil Principal</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
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
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  React.useEffect(() => {
    if (isClient && typeof window !== 'undefined') {
      if (localStorage.getItem('isLoggedIn') !== 'true') {
        router.replace('/login');
      }
    }
  }, [isClient, router]);

  if (!isClient || (typeof window !== 'undefined' && localStorage.getItem('isLoggedIn') !== 'true')) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Vérification de l'authentification...</p>
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
                {/* <div className="w-7 h-7 bg-primary rounded-sm flex items-center justify-center text-primary-foreground font-bold" data-ai-hint="chef hat">E</div> */}
                <span className="font-semibold text-md">Gestion par L'excellence</span>
            </Link>
          </header>
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
