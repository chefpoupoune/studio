'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  LayoutGrid, Box, FileText, Timer, GanttChartSquare, ClipboardCheck, DollarSign,
  CookingPot, ShoppingBasket, Sheet, Settings, LogOut, Package, PanelLeft,
  MegaphoneIcon,
  Truck,
  Refrigerator,
  PackagePlus,
  Users,
  CalculatorIcon,
  Home,
  Briefcase,
  ChevronDown,
  CalendarCheck,
  Trash2,
  List,
  PackageMinus,
  Thermometer,
  ChefHat, 
  ConciergeBell,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem,
  SidebarMenuButton, SidebarProvider, SidebarFooter, SidebarTrigger,
  SidebarGroup, SidebarGroupLabel, SidebarGroupContent
} from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/toaster';
import { LOGGED_IN_USER_PERMISSIONS_KEY } from '@/app/dashboard/settings/components/user-management';
import { firestore } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { applyThemeMode as applyThemeModeUtil, applyAccentColor as applyAccentColorUtil } from '@/lib/theme-utils';
import { DEFAULT_APP_PRIMARY_COLOR } from '@/config/colors';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calculator } from '@/components/ui/calculator';
import NewPicnicDepartureForm from '@/app/dashboard/components/NewPicnicDepartureForm';
import NewDeliveryForm from '@/app/dashboard/components/NewDeliveryForm';
import GlobalStockMovement from './components/GlobalStockMovement';
import { UpdateHandler } from './components/UpdateHandler'; // Ajout de l'importation

const APP_SETTINGS_COLLECTION = "appSettings";
const GLOBAL_APP_SETTINGS_DOC_ID = "globalAppSettings";
type ThemeMode = 'light' | 'dark' | 'system';
const DEFAULT_THEME_MODE: ThemeMode = 'dark';
const DEFAULT_ACCENT_COLOR_FS = DEFAULT_APP_PRIMARY_COLOR;
const DEFAULT_APP_LOGO_URL_FS: string | null = null;

const menuItems = [
  { href: "/dashboard", icon: LayoutGrid, label: "Tableau de Bord", permission: "canAccessDashboard" },
  { href: "/dashboard/organization", icon: Briefcase, label: "Organisation", permission: "isChefOnly" },
  { href: "/dashboard/inventory", icon: Box, label: "Gestion Stocks", permission: "canAccessInventory" },
  { href: "/dashboard/benefits", icon: FileText, label: "Avantages Nature", permission: "canAccessBenefits" },
  { href: "/dashboard/time-tracking", icon: Timer, label: "Suivi Heures", permission: "canAccessTimeTracking", subPermissions: ['timeTracking_personnel', 'timeTracking_recording', 'timeTracking_summary', 'timeTracking_schedules'] },
  { href: "/dashboard/declaration-heure", icon: GanttChartSquare, label: "Déclaration d'Heures", permission: "canAccessDeclarationHeure" },
  { href: "/dashboard/task-management", icon: ClipboardCheck, label: "Gestion des Problèmes", permission: "canAccessTaskManagement" },
  { href: "/dashboard/cost-management", icon: DollarSign, label: "Gestion Budget", permission: "canAccessCostManagement" },
  { href: "/dashboard/menu-planning", icon: CookingPot, label: "Planification Menus", permission: "canAccessMenuPlanning", subPermissions: ['menuPlanning_temperatureSheet'] },
  { href: "/dashboard/picnic", icon: ShoppingBasket, label: "Pique Nique", permission: "canAccessPicnic", subPermissions: ['picnic_recapPn'] },
  { href: "/dashboard/pms", icon: Sheet, label: "PMS", permission: "canAccessPms" },
  { href: "/dashboard/cleaning", icon: ClipboardCheck, label: "Planning Nettoyage", permission: "canAccessPms" },
  { href: "/dashboard/effectifs", icon: Users, label: "Effectifs", permission: "view_effectifs" },
  { href: "/dashboard/settings", icon: Settings, label: "Paramètres", permission: "canAccessSettings" },
  { href: "/dashboard/fin-du-mois", icon: MegaphoneIcon, label: "Fin du Mois !", permission: "canAccessFinDuMois" },
  { href: "/dashboard/fin-de-semaine", icon: CalendarCheck, label: "Fin de Semaine", permission: "canAccessFinDeSemaine" },
  { href: "/dashboard/food-waste", icon: Trash2, label: "Gaspillage", permission: "isChefOnly" },
];

const menuGroupsForChef = [
    {
        label: "Général",
        items: [
            { href: "/dashboard/organization", icon: Briefcase, label: "Organisation", permission: "isChefOnly" },
        ]
    },
    {
        label: "Heures",
        items: [
            { href: "/dashboard/time-tracking", icon: Timer, label: "Suivi Heures", permission: "canAccessTimeTracking", subPermissions: ['timeTracking_personnel', 'timeTracking_recording', 'timeTracking_summary', 'timeTracking_schedules'] },
            { href: "/dashboard/declaration-heure", icon: GanttChartSquare, label: "Déclaration d'Heures", permission: "canAccessDeclarationHeure" },
        ]
    },
    {
        label: "Gestion",
        items: [
            { href: "/dashboard/inventory", icon: Box, label: "Gestion Stocks", permission: "canAccessInventory" },
            { href: "/dashboard/cost-management", icon: DollarSign, label: "Gestion Budget", permission: "canAccessCostManagement" },
            { href: "/dashboard/task-management", icon: ClipboardCheck, label: "Gestion des Problèmes", permission: "canAccessTaskManagement" },
        ]
    },
    {
        label: "Personnel",
        items: [
            { href: "/dashboard/benefits", icon: FileText, label: "Avantages Nature", permission: "canAccessBenefits" },
            { href: "/dashboard/effectifs", icon: Users, label: "Effectifs", permission: "view_effectifs" },
        ]
    },
    {
        label: "Restauration",
        items: [
            { href: "/dashboard/menu-planning", icon: CookingPot, label: "Planification Menus", permission: "canAccessMenuPlanning", subPermissions: ['menuPlanning_temperatureSheet'] },
            { href: "/dashboard/picnic", icon: ShoppingBasket, label: "Pique Nique", permission: "canAccessPicnic", subPermissions: ['picnic_recapPn'] },
            { href: "/dashboard/pms", icon: Sheet, label: "PMS", permission: "canAccessPms" },
            { href: "/dashboard/cleaning", icon: ClipboardCheck, label: "Planning Nettoyage", permission: "canAccessPms" },
            { href: "/dashboard/food-waste", icon: Trash2, label: "Gaspillage", permission: "isChefOnly" },
        ]
    },
    {
        label: "Cloture",
        items: [
            { href: "/dashboard/fin-du-mois", icon: MegaphoneIcon, label: "Fin du Mois !", permission: "canAccessFinDuMois" },
            { href: "/dashboard/fin-de-semaine", icon: CalendarCheck, label: "Fin de Semaine", permission: "canAccessFinDeSemaine" },
        ]
    },
    {
        label: "Paramètres",
        items: [
            { href: "/dashboard/settings", icon: Settings, label: "Paramètres", permission: "canAccessSettings" },
        ]
    }
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
  const [username, setUsername] = React.useState<string | null>(null);
  const [isPicnicFormOpen, setIsPicnicFormOpen] = React.useState(false);
  const [isDeliveryFormOpen, setIsDeliveryFormOpen] = React.useState(false);
  const [isStockMovementFormOpen, setIsStockMovementFormOpen] = React.useState(false);
  
  const [openGroups, setOpenGroups] = React.useState<string[]>(menuGroupsForChef.map(g => g.label));

  const toggleGroup = (groupLabel: string) => {
      setOpenGroups(prev =>
          prev.includes(groupLabel)
              ? prev.filter(label => label !== groupLabel)
              : [...prev, groupLabel]
      );
  };

  React.useEffect(() => {
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (!isLoggedIn) {
      router.push('/login');
    } else {
      const permissions = JSON.parse(localStorage.getItem(LOGGED_IN_USER_PERMISSIONS_KEY) || '{}');
      setUsername(localStorage.getItem('loggedInUsername'));
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
  
  const handleReceptionSuiviClick = () => {
    router.push('/dashboard/pms#reception-monitoring');
  };

  const handleMouvementStockClick = () => {
    router.push('/dashboard/inventory#movements');
  };

  const handleTemperatureSheetClick = () => {
    router.push('/dashboard/menu-planning#temperature-sheets');
  };

  const handleTemperatureSuiviClick = () => {
    router.push('/dashboard/pms#temperature-monitoring');
  };
  
  const handleCleaningKitchenClick = () => {
    router.push('/dashboard/pms#kitchen-cleaning');
  };

  const handleCleaningRestaurantClick = () => {
    router.push('/dashboard/pms#restaurant-cleaning');
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

            <div className="flex-1 overflow-y-auto">
                {username === 'Chef' ? (
                <>
                    {menuGroupsForChef.map((group) => {
                    const visibleItems = group.items.filter(item => {
                        if (item.permission === 'isChefOnly') {
                        return username === 'Chef';
                        } else if (item.permission === 'view_effectifs') {
                        return username === 'Chef' || username === 'Marie Legrand';
                        } else {
                        const hasMainPermission = userPermissions[(item as any).permission];
                        const hasSubPermission = item.subPermissions?.some(p => userPermissions[p]);
                        return hasMainPermission || hasSubPermission;
                        }
                    });

                    if (visibleItems.length === 0) return null;

                    const isOpen = openGroups.includes(group.label);

                    return (
                        <SidebarGroup key={group.label}>
                        <SidebarGroupLabel
                            onClick={() => toggleGroup(group.label)}
                            className="cursor-pointer flex justify-between items-center"
                        >
                            <span>{group.label}</span>
                            <ChevronDown
                            className={`h-4 w-4 transition-transform duration-200 ${isOpen ? '' : '-rotate-90'}`}
                            />
                        </SidebarGroupLabel>
                        
                        {isOpen && (
                            <SidebarGroupContent>
                            <SidebarMenu>
                                {visibleItems.map(item => (
                                <SidebarMenuItem key={item.href}>
                                    <SidebarMenuButton href={item.href} isActive={pathname === item.href || (pathname.startsWith(item.href) && item.href.length > 10) } asChild>
                                    <Link href={item.href}><item.icon />{item.label}</Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                            </SidebarGroupContent>
                        )}
                        </SidebarGroup>
                    );
                    })}
                </>
                ) : (
                <SidebarMenu>
                    {menuItems.map((item) => {
                    let showItem = false;
                    if (item.permission === 'isChefOnly') {
                        showItem = username === 'Chef';
                    } else if (item.permission === 'view_effectifs') {
                        showItem = username === 'Chef' || username === 'Marie Legrand';
                    } else {
                        const hasMainPermission = userPermissions[(item as any).permission];
                        const hasSubPermission = item.subPermissions?.some(p => userPermissions[p]);
                        showItem = hasMainPermission || hasSubPermission;
                    }

                    if (showItem) {
                        return (
                        <SidebarMenuItem key={item.href}>
                            <SidebarMenuButton href={item.href} isActive={pathname === item.href || (item.href.length > 10 && pathname.startsWith(item.href))} asChild>
                            <Link href={item.href}><item.icon />{item.label}</Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        )
                    }
                    return null;
                    })}
                </SidebarMenu>
                )}
            </div>

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
                    <p>Version def.1</p>
                </div>
            </SidebarFooter>
            </SidebarContent>
        </Sidebar>

        <div className="flex flex-1 flex-col min-w-0">
             <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
                <div className="flex flex-1 items-center gap-2 min-w-0">
                    <SidebarTrigger />
                    <div className="flex items-center gap-2 overflow-x-auto">
                        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard')}>
                            <Home className="h-6 w-6" />
                        </Button>
                        {username === 'Chef' && (
                            <Dialog modal={false}>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <CalculatorIcon className="h-6 w-6" />
                                    </Button>
                                </DialogTrigger>
                                <DialogContent nonModal>
                                    <DialogHeader>
                                        <DialogTitle>Calculatrice</DialogTitle>
                                    </DialogHeader>
                                    <Calculator />
                                </DialogContent>
                            </Dialog>
                        )}
                        {(username === 'Chef'|| username === 'Marie Legrand') && (
                            <Dialog open={isDeliveryFormOpen} onOpenChange={setIsDeliveryFormOpen}>
                                <DialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <Truck className="h-6 w-6" />
                                </Button>
                                </DialogTrigger>
                                <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Ajouter une Réception</DialogTitle>
                                </DialogHeader>
                                <NewDeliveryForm onFormSubmit={() => setIsDeliveryFormOpen(false)} />
                                </DialogContent>
                            </Dialog>
                        )}
                        {(username === 'Chef' || username === 'Marie Legrand'|| username === 'Marjorie Desfrançois') && (
                            <Dialog open={isStockMovementFormOpen} onOpenChange={setIsStockMovementFormOpen}>
                                 <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <PackageMinus className="h-6 w-6" />
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Nouveau Mouvement de Stock</DialogTitle>
                                    </DialogHeader>
                                    <GlobalStockMovement onFormSubmit={() => setIsStockMovementFormOpen(false)} />
                                </DialogContent>
                            </Dialog>
                        )}
                        {(username === 'Chef' || username === 'Marie Legrand'|| username === 'Marjorie Desfrançois') && (
                            <Button variant="ghost" size="icon" onClick={handleCleaningKitchenClick}>
                                <ChefHat className="h-6 w-6" />
                            </Button>
                        )}
                        {(username === 'Chef' || username === 'Myriam Masclef'|| username === 'Sandrine Hulot'|| username === 'Reinata Desmazières') && (
                            <Button variant="ghost" size="icon" onClick={handleCleaningRestaurantClick}>
                                <ConciergeBell className="h-6 w-6" />
                            </Button>
                        )}
                        {(username === 'Chef'|| username === 'Marie Legrand'|| username === 'Marjorie Desfrançois') && (
                            <Button variant="ghost" size="icon" onClick={handleTemperatureSheetClick}>
                                <Thermometer className="h-6 w-6" />
                            </Button>
                        )}
                        {(username === 'Chef'|| username === 'Marie Legrand') && (
                            <Button variant="ghost" size="icon" onClick={handleTemperatureSuiviClick}>
                                <Refrigerator className="h-6 w-6" />
                            </Button>
                        )}
                        {(username === 'Chef' || username === 'Marie Legrand'|| username === 'Marjorie Desfrançois') && (
                            <Dialog open={isPicnicFormOpen} onOpenChange={setIsPicnicFormOpen}>
                                <DialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <ShoppingBasket className="h-6 w-6" />
                                </Button>
                                </DialogTrigger>
                                <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Ajouter un Départ Pique-Nique</DialogTitle>
                                </DialogHeader>
                                <NewPicnicDepartureForm onFormSubmit={() => setIsPicnicFormOpen(false)} />
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                </div>
                <div>
                    {username === 'Chef' && (
                        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/improvements')}>
                            <List className="h-6 w-6" />
                        </Button>
                    )}
                </div>
            </header>
            <main className="flex-1 overflow-auto p-4 sm:p-6">
              {children}
            </main>
        </div>

        {/* Floating Action Buttons */}
        {username === '' && (
            <>
            <Button
                variant="ghost"
                onClick={handleReceptionSuiviClick}
                className="fixed bottom-8 right-8 h-16 w-16 rounded-full shadow-lg z-50 flex items-center justify-center"
            >
                <Truck className="h-8 w-8" />
            </Button>
            <Button
                variant="ghost"
                onClick={handleMouvementStockClick}
                className="fixed bottom-28 right-8 h-16 w-16 rounded-full shadow-lg z-50 flex items-center justify-center"
            >
                <PackagePlus className="h-8 w-8" />
            </Button>
            </>
        )}
        {username === '' && (
            <Button
            variant="ghost"
            onClick={handleTemperatureSheetClick}
            className="fixed bottom-48 right-8 h-16 w-16 rounded-full shadow-lg z-50 flex items-center justify-center"
            >
            <Thermometer className="h-8 w-8" />
            </Button>
        )}

        <Toaster />
        <UpdateHandler />
    </SidebarProvider>
  );
}
