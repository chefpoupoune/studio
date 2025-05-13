
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Cog, Palette, Bell, Database, Download, Upload, BellRing, ListChecks, Package, Info, RotateCcw, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_APP_PRIMARY_COLOR } from '@/config/colors';
import { PDF_LAYOUT_CONFIGS_KEY } from '@/lib/pdf-settings';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const THEME_STORAGE_KEY = "app_settings_theme_mode";
const ACCENT_COLOR_STORAGE_KEY = "app_settings_accent_color";

// Notification settings keys
const NOTIFICATIONS_EMAIL_KEY = "app_settings_notifications_email";
const NOTIFICATIONS_IN_APP_GENERAL_KEY = "app_settings_notifications_in_app_general";
const NOTIFICATIONS_IN_APP_NEW_TASK_KEY = "app_settings_notifications_in_app_new_task";
const NOTIFICATIONS_IN_APP_STATUS_UPDATE_KEY = "app_settings_notifications_in_app_status_update";
const NOTIFICATIONS_IN_APP_INVENTORY_LOW_KEY = "app_settings_notifications_in_app_inventory_low";
const NOTIFICATIONS_SOUND_ENABLED_KEY = "app_settings_notifications_sound_enabled";
const NOTIFICATIONS_SOUND_CHOICE_KEY = "app_settings_notifications_sound_choice";

// Default notification values
const DEFAULT_NOTIFICATIONS_EMAIL = false;
const DEFAULT_NOTIFICATIONS_IN_APP_GENERAL = true;
const DEFAULT_NOTIFICATIONS_IN_APP_NEW_TASK = true;
const DEFAULT_NOTIFICATIONS_IN_APP_STATUS_UPDATE = true;
const DEFAULT_NOTIFICATIONS_IN_APP_INVENTORY_LOW = true;
const DEFAULT_NOTIFICATIONS_SOUND_ENABLED = false;
const DEFAULT_NOTIFICATIONS_SOUND_CHOICE = 'default';


type ThemeMode = 'light' | 'dark' | 'system';

// Helper function to convert HEX to HSL
function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0; 
  let l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
      default: h = 0; 
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

// List of specific keys and prefixes for app data
const APP_SPECIFIC_KEYS = [
  'inventory_products',
  'inventory_stock_movements',
  'inventory_purchase_orders',
  'occasional_meal_starter_ingredients',
  'occasional_meal_main_ingredients',
  'occasional_meal_dessert_ingredients',
  'occasional_meal_num_people',
  'cost_pn_picnic_ingredients',
  'cost_pn_salad_ingredients',
  'time_tracking_members',
  'time_tracking_entries',
  'task_management_tasks',
  THEME_STORAGE_KEY,
  ACCENT_COLOR_STORAGE_KEY,
  PDF_LAYOUT_CONFIGS_KEY,
  NOTIFICATIONS_EMAIL_KEY,
  NOTIFICATIONS_IN_APP_GENERAL_KEY,
  NOTIFICATIONS_IN_APP_NEW_TASK_KEY,
  NOTIFICATIONS_IN_APP_STATUS_UPDATE_KEY,
  NOTIFICATIONS_IN_APP_INVENTORY_LOW_KEY,
  NOTIFICATIONS_SOUND_ENABLED_KEY,
  NOTIFICATIONS_SOUND_CHOICE_KEY,
];

const APP_SPECIFIC_PREFIXES = [
  'cost_analysis_',
  'menu_planning_',
  'temperature_sheet_meal_item_temps_',
  'temperature_sheet_daily_log_data_',
];


export default function ApplicationSettingsManager() {
  const [selectedThemeMode, setSelectedThemeMode] = useState<ThemeMode>('system');
  const [selectedAccentColor, setSelectedAccentColor] = useState<string>(DEFAULT_APP_PRIMARY_COLOR);
  
  // Notification States
  const [emailNotifications, setEmailNotifications] = useState<boolean>(DEFAULT_NOTIFICATIONS_EMAIL);
  const [inAppGeneralNotifications, setInAppGeneralNotifications] = useState<boolean>(DEFAULT_NOTIFICATIONS_IN_APP_GENERAL);
  const [inAppNewTaskNotifications, setInAppNewTaskNotifications] = useState<boolean>(DEFAULT_NOTIFICATIONS_IN_APP_NEW_TASK);
  const [inAppStatusUpdateNotifications, setInAppStatusUpdateNotifications] = useState<boolean>(DEFAULT_NOTIFICATIONS_IN_APP_STATUS_UPDATE);
  const [inAppInventoryLowNotifications, setInAppInventoryLowNotifications] = useState<boolean>(DEFAULT_NOTIFICATIONS_IN_APP_INVENTORY_LOW);
  const [soundNotificationsEnabled, setSoundNotificationsEnabled] = useState<boolean>(DEFAULT_NOTIFICATIONS_SOUND_ENABLED);
  const [notificationSoundChoice, setNotificationSoundChoice] = useState<string>(DEFAULT_NOTIFICATIONS_SOUND_CHOICE);

  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImportAlertOpen, setIsImportAlertOpen] = useState(false);


  useEffect(() => {
    setIsClient(true);
  }, []);

  const applyThemeMode = useCallback((theme: ThemeMode) => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, []);
  
  const applyAccentColor = useCallback((color: string) => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    const hslColor = hexToHsl(color);

    if (hslColor) {
      root.style.setProperty('--primary-h', `${hslColor.h}`);
      root.style.setProperty('--primary-s', `${hslColor.s}%`);
      root.style.setProperty('--primary-l', `${hslColor.l}%`);
      
      root.style.setProperty('--accent-h', `${hslColor.h}`);
      root.style.setProperty('--accent-s', `${hslColor.s}%`);
      root.style.setProperty('--accent-l', `${hslColor.l}%`);

      root.style.setProperty('--ring-h', `${hslColor.h}`);
      root.style.setProperty('--ring-s', `${hslColor.s}%`);
      root.style.setProperty('--ring-l', `${hslColor.l}%`);

      const isLightAccent = hslColor.l > 60;

      if (isLightAccent) { 
        root.style.setProperty('--primary-foreground-h', `var(--default-primary-foreground-dark-h)`);
        root.style.setProperty('--primary-foreground-s', `var(--default-primary-foreground-dark-s)`);
        root.style.setProperty('--primary-foreground-l', `var(--default-primary-foreground-dark-l)`);
        root.style.setProperty('--accent-foreground-h', `var(--default-accent-foreground-dark-h)`);
        root.style.setProperty('--accent-foreground-s', `var(--default-accent-foreground-dark-s)`);
        root.style.setProperty('--accent-foreground-l', `var(--default-accent-foreground-dark-l)`);
      } else { 
        root.style.setProperty('--primary-foreground-h', `var(--default-primary-foreground-light-h)`);
        root.style.setProperty('--primary-foreground-s', `var(--default-primary-foreground-light-s)`);
        root.style.setProperty('--primary-foreground-l', `var(--default-primary-foreground-light-l)`);
        root.style.setProperty('--accent-foreground-h', `var(--default-accent-foreground-light-h)`);
        root.style.setProperty('--accent-foreground-s', `var(--default-accent-foreground-light-s)`);
        root.style.setProperty('--accent-foreground-l', `var(--default-accent-foreground-light-l)`);
      }
    }
  }, []);


  useEffect(() => {
    if (isClient) {
      // Theme and Accent
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
      const initialTheme = storedTheme && ['light', 'dark', 'system'].includes(storedTheme) ? storedTheme : 'system';
      setSelectedThemeMode(initialTheme);
      applyThemeMode(initialTheme);

      const storedAccentColor = localStorage.getItem(ACCENT_COLOR_STORAGE_KEY);
      const initialAccentColor = storedAccentColor || DEFAULT_APP_PRIMARY_COLOR;
      setSelectedAccentColor(initialAccentColor);
      applyAccentColor(initialAccentColor);
      
      // Notifications
      setEmailNotifications(localStorage.getItem(NOTIFICATIONS_EMAIL_KEY) === 'true' || DEFAULT_NOTIFICATIONS_EMAIL);
      setInAppGeneralNotifications(localStorage.getItem(NOTIFICATIONS_IN_APP_GENERAL_KEY) === 'true' || DEFAULT_NOTIFICATIONS_IN_APP_GENERAL);
      setInAppNewTaskNotifications(localStorage.getItem(NOTIFICATIONS_IN_APP_NEW_TASK_KEY) === 'true' || DEFAULT_NOTIFICATIONS_IN_APP_NEW_TASK);
      setInAppStatusUpdateNotifications(localStorage.getItem(NOTIFICATIONS_IN_APP_STATUS_UPDATE_KEY) === 'true' || DEFAULT_NOTIFICATIONS_IN_APP_STATUS_UPDATE);
      setInAppInventoryLowNotifications(localStorage.getItem(NOTIFICATIONS_IN_APP_INVENTORY_LOW_KEY) === 'true' || DEFAULT_NOTIFICATIONS_IN_APP_INVENTORY_LOW);
      setSoundNotificationsEnabled(localStorage.getItem(NOTIFICATIONS_SOUND_ENABLED_KEY) === 'true' || DEFAULT_NOTIFICATIONS_SOUND_ENABLED);
      setNotificationSoundChoice(localStorage.getItem(NOTIFICATIONS_SOUND_CHOICE_KEY) || DEFAULT_NOTIFICATIONS_SOUND_CHOICE);


      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        if (localStorage.getItem(THEME_STORAGE_KEY) === 'system' || !localStorage.getItem(THEME_STORAGE_KEY)) {
           applyThemeMode('system');
        }
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [isClient, applyThemeMode, applyAccentColor]);

  // Handlers for theme and accent
  const handleThemeModeChange = (newMode: ThemeMode) => {
    setSelectedThemeMode(newMode);
    if (isClient) {
      localStorage.setItem(THEME_STORAGE_KEY, newMode);
      applyThemeMode(newMode);
      toast({
        title: "Thème Mis à Jour",
        description: `Le mode d'affichage est maintenant réglé sur "${newMode === 'light' ? 'Clair' : newMode === 'dark' ? 'Sombre' : 'Système'}".`,
      });
    }
  };

  const handleAccentColorChange = (newColor: string) => {
    setSelectedAccentColor(newColor);
    if (isClient) {
      localStorage.setItem(ACCENT_COLOR_STORAGE_KEY, newColor);
      applyAccentColor(newColor);
      toast({
        title: "Couleur d'Accentuation Mise à Jour",
        description: `La couleur d'accentuation est maintenant ${newColor}.`,
      });
    }
  };
  
  const handleResetAccentColor = () => {
    handleAccentColorChange(DEFAULT_APP_PRIMARY_COLOR);
    toast({
      title: "Couleur d'Accentuation Réinitialisée",
      description: `La couleur d'accentuation a été réinitialisée à la valeur par défaut (${DEFAULT_APP_PRIMARY_COLOR}).`,
    });
  };

  // Handlers for notification preferences
  const createSwitchHandler = (
    setter: React.Dispatch<React.SetStateAction<boolean>>,
    key: string,
    settingName: string
  ) => (checked: boolean) => {
    setter(checked);
    if (isClient) {
      localStorage.setItem(key, String(checked));
      toast({
        title: "Préférences Mises à Jour",
        description: `${settingName} ${checked ? 'activées' : 'désactivées'}.`,
      });
    }
  };
  
  const handleEmailNotificationsChange = createSwitchHandler(setEmailNotifications, NOTIFICATIONS_EMAIL_KEY, "Notifications par e-mail");
  const handleInAppGeneralNotificationsChange = createSwitchHandler(setInAppGeneralNotifications, NOTIFICATIONS_IN_APP_GENERAL_KEY, "Notifications générales dans l'application");
  const handleInAppNewTaskNotificationsChange = createSwitchHandler(setInAppNewTaskNotifications, NOTIFICATIONS_IN_APP_NEW_TASK_KEY, "Alertes pour nouvelle tâche/problème");
  const handleInAppStatusUpdateNotificationsChange = createSwitchHandler(setInAppStatusUpdateNotifications, NOTIFICATIONS_IN_APP_STATUS_UPDATE_KEY, "Alertes pour mise à jour de statut de tâche");
  const handleInAppInventoryLowNotificationsChange = createSwitchHandler(setInAppInventoryLowNotifications, NOTIFICATIONS_IN_APP_INVENTORY_LOW_KEY, "Alertes pour stock bas");
  const handleSoundNotificationsEnabledChange = createSwitchHandler(setSoundNotificationsEnabled, NOTIFICATIONS_SOUND_ENABLED_KEY, "Sons de notification");

  const handleNotificationSoundChoiceChange = (value: string) => {
    setNotificationSoundChoice(value);
    if (isClient) {
      localStorage.setItem(NOTIFICATIONS_SOUND_CHOICE_KEY, value);
      toast({
        title: "Préférences Mises à Jour",
        description: `Son de notification réglé sur "${value}".`,
      });
    }
  };


  const handleExportData = () => {
    if (!isClient) return;
    const dataToExport: Record<string, string | null> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const isAppKey = APP_SPECIFIC_KEYS.includes(key) || 
                         APP_SPECIFIC_PREFIXES.some(prefix => key.startsWith(prefix));
        if (isAppKey) {
          dataToExport[key] = localStorage.getItem(key);
        }
      }
    }

    if (Object.keys(dataToExport).length === 0) {
      toast({ title: "Aucune donnée à exporter", description: "Aucune donnée spécifique à l'application n'a été trouvée.", variant: "default" });
      return;
    }

    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gestion_excellence_data_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Données Exportées", description: "Toutes les données locales de l'application ont été exportées." });
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isClient) return;
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonString = e.target?.result as string;
        const importedData = JSON.parse(jsonString);
        
        if (typeof importedData !== 'object' || importedData === null) {
          throw new Error("Format de fichier invalide.");
        }

        let importedCount = 0;
        for (const key in importedData) {
          if (Object.prototype.hasOwnProperty.call(importedData, key)) {
            const isRecognizedKey = APP_SPECIFIC_KEYS.includes(key) || APP_SPECIFIC_PREFIXES.some(prefix => key.startsWith(prefix));
            if (isRecognizedKey && typeof importedData[key] === 'string') {
                 localStorage.setItem(key, importedData[key]);
                 importedCount++;
            } else if (isRecognizedKey && importedData[key] !== null && typeof importedData[key] === 'object') { 
                 localStorage.setItem(key, JSON.stringify(importedData[key]));
                 importedCount++;
            } else if (isRecognizedKey) { 
                 localStorage.setItem(key, String(importedData[key]));
                 importedCount++;
            }
          }
        }
        
        if (importedCount > 0) {
          toast({
            title: "Données Importées",
            description: `${importedCount} éléments de données ont été importés. Veuillez recharger la page pour appliquer tous les changements.`,
          });
          // Re-apply theme and accent color after import
          const newTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
          if (newTheme && ['light', 'dark', 'system'].includes(newTheme)) {
            setSelectedThemeMode(newTheme); 
            applyThemeMode(newTheme); 
          } else {
            setSelectedThemeMode('system');
            applyThemeMode('system');
            localStorage.setItem(THEME_STORAGE_KEY, 'system');
          }
          const newAccent = localStorage.getItem(ACCENT_COLOR_STORAGE_KEY);
          if (newAccent) {
            setSelectedAccentColor(newAccent); 
            applyAccentColor(newAccent); 
          } else {
            setSelectedAccentColor(DEFAULT_APP_PRIMARY_COLOR);
            applyAccentColor(DEFAULT_APP_PRIMARY_COLOR);
            localStorage.setItem(ACCENT_COLOR_STORAGE_KEY, DEFAULT_APP_PRIMARY_COLOR);
          }
          
          setTimeout(() => window.location.reload(), 1000);

        } else {
            toast({ title: "Importation Partielle ou Vide", description: "Aucune donnée pertinente trouvée ou importée depuis le fichier.", variant: "default" });
        }

      } catch (error) {
        console.error("Error importing data:", error);
        toast({ title: "Erreur d'Importation", description: `Impossible d'importer les données. ${error instanceof Error ? error.message : 'Erreur inconnue.'}`, variant: "destructive" });
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = ""; 
        }
        setIsImportAlertOpen(false);
      }
    };
    reader.readAsText(file);
  };


  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cog className="w-6 h-6 text-primary"/>
          Paramètres Généraux de l'Application
        </CardTitle>
        <CardDescription>
          Configurez les options globales de l'application, telles que le thème, les notifications, et d'autres préférences utilisateur.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <Alert variant="default" className="border-primary/30 bg-primary/5">
            <Info className="h-5 w-5 text-primary" />
            <AlertTitle className="text-primary font-semibold">Information</AlertTitle>
            <AlertDescription>
                Les paramètres modifiés ici sont sauvegardés localement dans votre navigateur.
            </AlertDescription>
        </Alert>

        <div className="p-6 border rounded-lg shadow-sm bg-card/50">
            <div className="flex items-center gap-3 mb-4">
                <Palette className="w-5 h-5 text-accent" />
                <h3 className="text-lg font-semibold text-foreground">Thème de l'Application</h3>
            </div>
            <div className="space-y-4">
                <div>
                    <Label htmlFor="theme-select">Mode d'affichage</Label>
                    <Select 
                        value={selectedThemeMode} 
                        onValueChange={(value: ThemeMode) => handleThemeModeChange(value)}
                        disabled={!isClient}
                    >
                        <SelectTrigger id="theme-select" className="mt-1">
                            <SelectValue placeholder="Choisir un mode" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="light">Clair</SelectItem>
                            <SelectItem value="dark">Sombre</SelectItem>
                            <SelectItem value="system">Système</SelectItem>
                        </SelectContent>
                    </Select>
                     <p className="text-xs text-muted-foreground mt-1">
                        Le changement de thème est appliqué dynamiquement et sauvegardé localement.
                     </p>
                </div>
                <div>
                    <Label htmlFor="accent-color-picker">Couleur d'Accentuation (Primaire, Accent, Anneaux)</Label>
                    <div className="flex items-center gap-2 mt-1">
                        <input
                            type="color"
                            id="accent-color-picker"
                            value={selectedAccentColor}
                            onChange={(e) => handleAccentColorChange(e.target.value)}
                            className="h-8 w-10 rounded border-input bg-background p-0.5 cursor-pointer"
                            disabled={!isClient}
                        />
                        <span className="text-sm text-muted-foreground font-mono">{selectedAccentColor}</span>
                         <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleResetAccentColor} 
                            disabled={!isClient || selectedAccentColor === DEFAULT_APP_PRIMARY_COLOR}
                            className="ml-2"
                         >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                            Réinitialiser
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        La couleur d'accentuation est sauvegardée et appliquée dynamiquement à l'application.
                    </p>
                </div>
            </div>
        </div>

        <div className="p-6 border rounded-lg shadow-sm bg-card/50">
            <div className="flex items-center gap-3 mb-4">
                <Bell className="w-5 h-5 text-accent" />
                <h3 className="text-lg font-semibold text-foreground">Préférences de Notification</h3>
            </div>
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label htmlFor="email-notifications" className="flex-grow">Notifications par e-mail</Label>
                    <Switch id="email-notifications" checked={emailNotifications} onCheckedChange={handleEmailNotificationsChange} disabled={!isClient} />
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="inapp-notifications" className="flex-grow">Notifications générales dans l'application</Label>
                    <Switch id="inapp-notifications" checked={inAppGeneralNotifications} onCheckedChange={handleInAppGeneralNotificationsChange} disabled={!isClient} />
                </div>

                <div className="pl-6 mt-3 space-y-2 border-l-2 border-muted/30">
                    <p className="text-sm text-muted-foreground mb-2 font-medium">Alertes spécifiques (dans l'app) :</p>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="inapp-new-task" className="text-sm flex items-center gap-1.5 flex-grow">
                            <ListChecks className="w-4 h-4 text-muted-foreground/90"/> Nouvelle tâche/problème signalé
                        </Label>
                        <Switch id="inapp-new-task" checked={inAppNewTaskNotifications} onCheckedChange={handleInAppNewTaskNotificationsChange} disabled={!isClient} />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="inapp-status-update" className="text-sm flex items-center gap-1.5 flex-grow">
                             <ListChecks className="w-4 h-4 text-muted-foreground/90"/> Mise à jour de statut d'une tâche
                        </Label>
                        <Switch id="inapp-status-update" checked={inAppStatusUpdateNotifications} onCheckedChange={handleInAppStatusUpdateNotificationsChange} disabled={!isClient} />
                    </div>
                     <div className="flex items-center justify-between">
                        <Label htmlFor="inapp-inventory-low" className="text-sm flex items-center gap-1.5 flex-grow">
                            <Package className="w-4 h-4 text-muted-foreground/90"/> Alerte stock bas (Inventaire)
                        </Label>
                        <Switch id="inapp-inventory-low" checked={inAppInventoryLowNotifications} onCheckedChange={handleInAppInventoryLowNotificationsChange} disabled={!isClient} />
                    </div>
                </div>
                
                <div className="flex items-center justify-between pt-2">
                    <Label htmlFor="sound-notifications" className="flex-grow flex items-center gap-1.5">
                        <BellRing className="w-4 h-4 text-muted-foreground/90"/> Activer les sons de notification
                    </Label>
                    <Switch id="sound-notifications" checked={soundNotificationsEnabled} onCheckedChange={handleSoundNotificationsEnabledChange} disabled={!isClient} />
                </div>

                <div className="mt-2">
                    <Label htmlFor="notification-sound-select">Son de notification</Label>
                    <Select value={notificationSoundChoice} onValueChange={handleNotificationSoundChoiceChange} disabled={!isClient || !soundNotificationsEnabled}>
                        <SelectTrigger id="notification-sound-select" className="mt-1">
                            <SelectValue placeholder="Choisir un son" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="default">Défaut</SelectItem>
                            <SelectItem value="chime">Carillon</SelectItem>
                            <SelectItem value="alert_soft">Alerte Douce</SelectItem>
                            <SelectItem value="none">Aucun</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <p className="text-xs text-muted-foreground pt-1">Les notifications réelles et les sons ne sont pas implémentés, seuls les paramètres sont sauvegardés.</p>
            </div>
        </div>

        <div className="p-6 border rounded-lg shadow-sm bg-card/50">
            <div className="flex items-center gap-3 mb-4">
                <Database className="w-5 h-5 text-accent" />
                <h3 className="text-lg font-semibold text-foreground">Gestion des Données</h3>
            </div>
             <p className="text-sm text-muted-foreground mb-3">
                Options pour sauvegarder ou restaurer les données de l'application stockées localement. Utile pour les migrations ou la récupération après incident.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  variant="outline" 
                  onClick={handleExportData} 
                  disabled={!isClient}
                  className="w-full sm:w-auto"
                >
                    <Download className="mr-2 h-4 w-4" />
                    Exporter Toutes les Données Locales
                </Button>
                
                <AlertDialog open={isImportAlertOpen} onOpenChange={setIsImportAlertOpen}>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      disabled={!isClient}
                      className="w-full sm:w-auto"
                      onClick={() => setIsImportAlertOpen(true)}
                    >
                        <Upload className="mr-2 h-4 w-4" />
                        Importer des Données Locales
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="text-destructive" /> Confirmer l'Importation
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        L'importation de données écrasera toutes les données existantes spécifiques à l'application qui portent le même nom. 
                        Êtes-vous sûr de vouloir continuer ? Il est recommandé d'exporter vos données actuelles avant d'importer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={triggerFileInput}>
                        Continuer l'Importation
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".json" 
                    onChange={handleFileImport} 
                />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
                L'importation écrasera les données existantes avec le même nom. Sauvegardez vos données actuelles avant d'importer si nécessaire.
            </p>
        </div>
      </CardContent>
    </Card>
  );
}
    

