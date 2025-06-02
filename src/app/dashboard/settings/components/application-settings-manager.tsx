
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Cog, Palette, Bell, Database, Download, Upload, BellRing, ListChecks, PackageIcon, Info, RotateCcw, AlertTriangle, Image as ImageIcon, Trash2 as ImageIconTrash, Save } from 'lucide-react';
import Image from 'next/image';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
import { 
  applyThemeMode as applyThemeModeUtil, 
  applyAccentColor as applyAccentColorUtil, 
  hexToHsl,
  THEME_STORAGE_KEY, 
  ACCENT_COLOR_STORAGE_KEY 
} from '@/lib/theme-utils';


const APP_LOGO_STORAGE_KEY = "app_config_app_logo_url_v1";

// Notification settings keys
const NOTIFICATIONS_EMAIL_KEY = "app_settings_notifications_email_v1";
const NOTIFICATIONS_IN_APP_GENERAL_KEY = "app_settings_notifications_in_app_general_v1";
const NOTIFICATIONS_IN_APP_NEW_TASK_KEY = "app_settings_notifications_in_app_new_task_v1";
const NOTIFICATIONS_IN_APP_STATUS_UPDATE_KEY = "app_settings_notifications_in_app_status_update_v1";
const NOTIFICATIONS_IN_APP_INVENTORY_LOW_KEY = "app_settings_notifications_in_app_inventory_low_v1";
const NOTIFICATIONS_SOUND_ENABLED_KEY = "app_settings_notifications_sound_enabled_v1";
const NOTIFICATIONS_SOUND_CHOICE_KEY = "app_settings_notifications_sound_choice_v1";

// Default notification values
const DEFAULT_NOTIFICATIONS_EMAIL = false;
const DEFAULT_NOTIFICATIONS_IN_APP_GENERAL = true;
const DEFAULT_NOTIFICATIONS_IN_APP_NEW_TASK = true;
const DEFAULT_NOTIFICATIONS_IN_APP_STATUS_UPDATE = true;
const DEFAULT_NOTIFICATIONS_IN_APP_INVENTORY_LOW = true;
const DEFAULT_NOTIFICATIONS_SOUND_ENABLED = false;
const DEFAULT_NOTIFICATIONS_SOUND_CHOICE = 'default';


export type ThemeMode = 'light' | 'dark' | 'system';

// Keys for data specific to this application that are stored in localStorage and should be included in export/import.
// Keys for data migrated to Firestore should be REMOVED from here.
const APP_SPECIFIC_KEYS = [
  // Settings managed by ApplicationSettingsManager
  THEME_STORAGE_KEY,
  ACCENT_COLOR_STORAGE_KEY,
  APP_LOGO_STORAGE_KEY,
  NOTIFICATIONS_EMAIL_KEY,
  NOTIFICATIONS_IN_APP_GENERAL_KEY,
  NOTIFICATIONS_IN_APP_NEW_TASK_KEY,
  NOTIFICATIONS_IN_APP_STATUS_UPDATE_KEY,
  NOTIFICATIONS_IN_APP_INVENTORY_LOW_KEY,
  NOTIFICATIONS_SOUND_ENABLED_KEY,
  NOTIFICATIONS_SOUND_CHOICE_KEY,
  // Settings managed by PdfLayoutManager
  PDF_LAYOUT_CONFIGS_KEY,
  // Login related info (not full user data, which is in Firestore)
  'loggedInUsername', // Username for display or quick access
  'isLoggedIn',       // Flag to indicate login status
  LOGGED_IN_USER_PERMISSIONS_KEY, // User's specific permissions for UI control
  LOGGED_IN_USER_HOUR_VIEW_CONFIG_KEY, // User's hour view config
];

// Prefixes for dynamically generated localStorage keys that are app-specific.
// Keys for data migrated to Firestore should be REMOVED from here.
const APP_SPECIFIC_PREFIXES: string[] = [
  // Example: If some dynamic local settings were to be kept:
  // 'user_dashboard_widget_order_', 
  // Currently, most dynamic data has been migrated. This list might be empty or very short.
];


export default function ApplicationSettingsManager() {
  const [isClient, setIsClient] = useState(false);
  
  const [selectedThemeMode, setSelectedThemeMode] = useState<ThemeMode>('system');
  const [selectedAccentColor, setSelectedAccentColor] = useState<string>(DEFAULT_APP_PRIMARY_COLOR);

  const [emailNotifications, setEmailNotifications] = useState<boolean>(DEFAULT_NOTIFICATIONS_EMAIL);
  const [inAppGeneralNotifications, setInAppGeneralNotifications] = useState<boolean>(DEFAULT_NOTIFICATIONS_IN_APP_GENERAL);
  const [inAppNewTaskNotifications, setInAppNewTaskNotifications] = useState<boolean>(DEFAULT_NOTIFICATIONS_IN_APP_NEW_TASK);
  const [inAppStatusUpdateNotifications, setInAppStatusUpdateNotifications] = useState<boolean>(DEFAULT_NOTIFICATIONS_IN_APP_STATUS_UPDATE);
  const [inAppInventoryLowNotifications, setInAppInventoryLowNotifications] = useState<boolean>(DEFAULT_NOTIFICATIONS_IN_APP_INVENTORY_LOW);
  const [soundNotificationsEnabled, setSoundNotificationsEnabled] = useState<boolean>(DEFAULT_NOTIFICATIONS_SOUND_ENABLED);
  const [notificationSoundChoice, setNotificationSoundChoice] = useState<string>(DEFAULT_NOTIFICATIONS_SOUND_CHOICE);

  const [appLogoDataUrl, setAppLogoDataUrl] = useState<string | null>(null);
  const appLogoFileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImportAlertOpen, setIsImportAlertOpen] = useState(false);

  const applyThemeMode = useCallback(applyThemeModeUtil, []);
  const applyAccentColor = useCallback(applyAccentColorUtil, []);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Effect for loading all settings from localStorage on initial client mount
  useEffect(() => {
    if (!isClient) return;
    console.log("[Settings EFFECT Load Settings] Initializing settings from localStorage.");

    // Theme Mode
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    const initialThemeMode = storedTheme && ['light', 'dark', 'system'].includes(storedTheme) ? storedTheme : 'system';
    setSelectedThemeMode(initialThemeMode);
    console.log(`[Settings Load] Theme mode loaded: ${initialThemeMode} (localStorage: ${storedTheme})`);

    // Accent Color
    const storedAccentColor = localStorage.getItem(ACCENT_COLOR_STORAGE_KEY);
    const initialAccentColor = storedAccentColor || DEFAULT_APP_PRIMARY_COLOR;
    setSelectedAccentColor(initialAccentColor);
    console.log(`[Settings Load] Accent color loaded: ${initialAccentColor} (localStorage: ${storedAccentColor})`);
    
    // App Logo
    const storedAppLogo = localStorage.getItem(APP_LOGO_STORAGE_KEY);
    setAppLogoDataUrl(storedAppLogo || null);
    console.log(`[Settings Load] App logo URL loaded: ${storedAppLogo ? 'found' : 'not found'}`);

    // Notification Settings
    console.log("[Settings Load] Loading Notification Preferences...");
    const loadBoolSetting = (key: string, defaultValue: boolean, name: string) => {
      const storedValue = localStorage.getItem(key);
      const value = storedValue !== null ? storedValue === 'true' : defaultValue;
      console.log(`[Settings Load] ${name}: ${value} (localStorage: ${storedValue}, default: ${defaultValue})`);
      return value;
    };

    setEmailNotifications(loadBoolSetting(NOTIFICATIONS_EMAIL_KEY, DEFAULT_NOTIFICATIONS_EMAIL, "Email Notifications"));
    setInAppGeneralNotifications(loadBoolSetting(NOTIFICATIONS_IN_APP_GENERAL_KEY, DEFAULT_NOTIFICATIONS_IN_APP_GENERAL, "In-App General"));
    setInAppNewTaskNotifications(loadBoolSetting(NOTIFICATIONS_IN_APP_NEW_TASK_KEY, DEFAULT_NOTIFICATIONS_IN_APP_NEW_TASK, "In-App New Task"));
    setInAppStatusUpdateNotifications(loadBoolSetting(NOTIFICATIONS_IN_APP_STATUS_UPDATE_KEY, DEFAULT_NOTIFICATIONS_IN_APP_STATUS_UPDATE, "In-App Status Update"));
    setInAppInventoryLowNotifications(loadBoolSetting(NOTIFICATIONS_IN_APP_INVENTORY_LOW_KEY, DEFAULT_NOTIFICATIONS_IN_APP_INVENTORY_LOW, "In-App Inventory Low"));
    setSoundNotificationsEnabled(loadBoolSetting(NOTIFICATIONS_SOUND_ENABLED_KEY, DEFAULT_NOTIFICATIONS_SOUND_ENABLED, "Sound Enabled"));
    
    const storedSoundChoice = localStorage.getItem(NOTIFICATIONS_SOUND_CHOICE_KEY);
    const initialSoundChoice = storedSoundChoice || DEFAULT_NOTIFICATIONS_SOUND_CHOICE;
    setNotificationSoundChoice(initialSoundChoice);
    console.log(`[Settings Load] Sound Choice: ${initialSoundChoice} (localStorage: ${storedSoundChoice}, default: ${DEFAULT_NOTIFICATIONS_SOUND_CHOICE})`);
    
    console.log("[Settings EFFECT Load Settings] All settings loading routines complete.");

  }, [isClient]);


  // Effect for applying visual styles (theme & accent color) when states change or on load
  useEffect(() => {
    if (isClient) {
      console.log(`[Settings EFFECT Apply Styles] Applying theme: ${selectedThemeMode}, Accent: ${selectedAccentColor}`);
      applyThemeMode(selectedThemeMode);
      applyAccentColor(selectedAccentColor);
    }
  }, [isClient, selectedThemeMode, selectedAccentColor, applyThemeMode, applyAccentColor]);


  const handleThemeModeChange = (newMode: ThemeMode) => {
    setSelectedThemeMode(newMode);
    if (isClient) {
      localStorage.setItem(THEME_STORAGE_KEY, newMode);
      toast({
        title: "Thème Mis à Jour",
        description: `Le mode d'affichage est maintenant réglé sur "${newMode === 'light' ? 'Clair' : newMode === 'dark' ? 'Sombre' : 'Système'}".`,
      });
    }
  };

  const handleAccentColorInputChange = (newColor: string) => {
    setSelectedAccentColor(newColor);
  };
  
  const handleSaveAccentColor = () => {
    if (isClient) {
      let colorToSave = selectedAccentColor;
      if (!hexToHsl(colorToSave)) { 
        colorToSave = DEFAULT_APP_PRIMARY_COLOR;
        setSelectedAccentColor(colorToSave);
        toast({
            title: "Couleur Invalide",
            description: `La couleur saisie n'est pas valide. Utilisation de la couleur par défaut (${DEFAULT_APP_PRIMARY_COLOR}).`,
            variant: "destructive",
        });
      }
      localStorage.setItem(ACCENT_COLOR_STORAGE_KEY, colorToSave);
      applyAccentColor(colorToSave); // Ensure immediate visual update
      toast({
        title: "Couleur d'Accentuation Enregistrée",
        description: `La couleur d'accentuation est maintenant ${colorToSave}.`,
      });
    }
  };
  
  const handleResetAccentColor = () => {
    setSelectedAccentColor(DEFAULT_APP_PRIMARY_COLOR);
    if (isClient) {
      localStorage.setItem(ACCENT_COLOR_STORAGE_KEY, DEFAULT_APP_PRIMARY_COLOR);
      applyAccentColor(DEFAULT_APP_PRIMARY_COLOR); // Ensure immediate visual update
      toast({
        title: "Couleur d'Accentuation Réinitialisée",
        description: `La couleur d'accentuation a été réinitialisée à la valeur par défaut (${DEFAULT_APP_PRIMARY_COLOR}).`,
      });
    }
  };

  const handleAppLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 1 * 1024 * 1024) { // 1MB limit
        toast({
          title: "Fichier trop volumineux",
          description: "La taille du logo de l'application ne doit pas dépasser 1Mo.",
          variant: "destructive",
        });
        if (appLogoFileInputRef.current) appLogoFileInputRef.current.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAppLogoDataUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveAppLogo = () => {
    if (isClient) {
      if (appLogoDataUrl) {
        localStorage.setItem(APP_LOGO_STORAGE_KEY, appLogoDataUrl);
        toast({ title: "Logo de l'Application Enregistré" });
      } else { // If appLogoDataUrl is null/empty, it means we want to remove it
        localStorage.removeItem(APP_LOGO_STORAGE_KEY);
        toast({ title: "Logo de l'Application Supprimé" });
      }
      window.location.reload(); 
    }
  };

  const handleDeleteAppLogo = () => {
    setAppLogoDataUrl(null);
    if (isClient) {
      localStorage.removeItem(APP_LOGO_STORAGE_KEY);
      toast({ title: "Logo de l'Application Supprimé", variant: "destructive" });
    }
    if (appLogoFileInputRef.current) appLogoFileInputRef.current.value = "";
    window.location.reload();
  };

  const handleEmailNotificationsChange = (checked: boolean) => {
    console.log(`[UI Change] Email Notifications set to: ${checked}`);
    setEmailNotifications(checked);
  }
  const handleInAppGeneralNotificationsChange = (checked: boolean) => {
    console.log(`[UI Change] In-App General set to: ${checked}`);
    setInAppGeneralNotifications(checked);
  }
  const handleInAppNewTaskNotificationsChange = (checked: boolean) => {
    console.log(`[UI Change] In-App New Task set to: ${checked}`);
    setInAppNewTaskNotifications(checked);
  }
  const handleInAppStatusUpdateNotificationsChange = (checked: boolean) => {
    console.log(`[UI Change] In-App Status Update set to: ${checked}`);
    setInAppStatusUpdateNotifications(checked);
  }
  const handleInAppInventoryLowNotificationsChange = (checked: boolean) => {
    console.log(`[UI Change] In-App Inventory Low set to: ${checked}`);
    setInAppInventoryLowNotifications(checked);
  }
  const handleSoundNotificationsEnabledChange = (checked: boolean) => {
    console.log(`[UI Change] Sound Enabled set to: ${checked}`);
    setSoundNotificationsEnabled(checked);
  }
  
  const handleNotificationSoundChoiceChange = (value: string) => {
    console.log(`[UI Change] Sound Choice set to: ${value}`);
    setNotificationSoundChoice(value);
    if (soundNotificationsEnabled && value !== 'none' && isClient) {
        console.log(`[Notification Sound Preview] Playing sound: ${value}`); 
    }
  };

  const handleSaveNotificationPreferences = () => {
    if (!isClient) return;
    console.log("[SavePrefs] Attempting to Save Notification Preferences...");
    
    localStorage.setItem(NOTIFICATIONS_EMAIL_KEY, String(emailNotifications));
    console.log(`[SavePrefs] Saved ${NOTIFICATIONS_EMAIL_KEY}: ${emailNotifications}`);
    
    localStorage.setItem(NOTIFICATIONS_IN_APP_GENERAL_KEY, String(inAppGeneralNotifications));
    console.log(`[SavePrefs] Saved ${NOTIFICATIONS_IN_APP_GENERAL_KEY}: ${inAppGeneralNotifications}`);
    
    localStorage.setItem(NOTIFICATIONS_IN_APP_NEW_TASK_KEY, String(inAppNewTaskNotifications));
    console.log(`[SavePrefs] Saved ${NOTIFICATIONS_IN_APP_NEW_TASK_KEY}: ${inAppNewTaskNotifications}`);

    localStorage.setItem(NOTIFICATIONS_IN_APP_STATUS_UPDATE_KEY, String(inAppStatusUpdateNotifications));
    console.log(`[SavePrefs] Saved ${NOTIFICATIONS_IN_APP_STATUS_UPDATE_KEY}: ${inAppStatusUpdateNotifications}`);

    localStorage.setItem(NOTIFICATIONS_IN_APP_INVENTORY_LOW_KEY, String(inAppInventoryLowNotifications));
    console.log(`[SavePrefs] Saved ${NOTIFICATIONS_IN_APP_INVENTORY_LOW_KEY}: ${inAppInventoryLowNotifications}`);

    localStorage.setItem(NOTIFICATIONS_SOUND_ENABLED_KEY, String(soundNotificationsEnabled));
    console.log(`[SavePrefs] Saved ${NOTIFICATIONS_SOUND_ENABLED_KEY}: ${soundNotificationsEnabled}`);

    localStorage.setItem(NOTIFICATIONS_SOUND_CHOICE_KEY, notificationSoundChoice);
    console.log(`[SavePrefs] Saved ${NOTIFICATIONS_SOUND_CHOICE_KEY}: ${notificationSoundChoice}`);

    toast({
      title: "Préférences de Notification Enregistrées",
      description: "Vos choix de notification ont été sauvegardés avec succès.",
    });
    console.log("[SavePrefs] Notification Preferences Save Complete.");
  };

  const handleExportData = () => {
    if (!isClient) return;
    const dataToExport: Record<string, string | null> = {};
    let keysFound = 0;
    console.log("[Export Data] Starting export. APP_SPECIFIC_KEYS:", APP_SPECIFIC_KEYS, "APP_SPECIFIC_PREFIXES:", APP_SPECIFIC_PREFIXES);

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const isAppKey = APP_SPECIFIC_KEYS.includes(key) || 
                         APP_SPECIFIC_PREFIXES.some(prefix => key.startsWith(prefix));
        if (isAppKey) {
          dataToExport[key] = localStorage.getItem(key);
          keysFound++;
          console.log(`[Export Data] Exporting key: ${key}`);
        } else {
          console.log(`[Export Data] Skipping key (not app specific): ${key}`);
        }
      }
    }
    console.log(`[Export Data] Total app-specific keys found for export: ${keysFound}`);

    if (Object.keys(dataToExport).length === 0) {
      toast({ title: "Aucune donnée à exporter", description: "Aucune donnée spécifique à l'application n'a été trouvée dans le stockage local.", variant: "default" });
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
    toast({ title: "Données Exportées", description: `Toutes les ${keysFound} données locales de l'application ont été exportées.` });
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
        console.log("[Import Data] File parsed. Data to import:", importedData);

        let importedCount = 0;
        for (const key in importedData) {
          if (Object.prototype.hasOwnProperty.call(importedData, key)) {
            const isRecognizedKey = APP_SPECIFIC_KEYS.includes(key) || APP_SPECIFIC_PREFIXES.some(prefix => key.startsWith(prefix));
            if (isRecognizedKey) {
                const valueToStore = importedData[key];
                if (valueToStore === null) { 
                    localStorage.removeItem(key);
                    console.log(`[Import Data] Removed key: ${key} (was null in backup)`);
                } else if (typeof valueToStore === 'object') { 
                    localStorage.setItem(key, JSON.stringify(valueToStore));
                     console.log(`[Import Data] Imported key (object): ${key}`);
                } else { 
                    localStorage.setItem(key, String(valueToStore));
                    console.log(`[Import Data] Imported key (primitive): ${key}`);
                }
                 importedCount++;
            } else {
                console.log(`[Import Data] Skipping key (not recognized app specific): ${key}`);
            }
          }
        }
        
        if (importedCount > 0) {
          toast({
            title: "Données Importées avec Succès",
            description: `${importedCount} éléments de données ont été importés. Veuillez recharger la page pour appliquer tous les changements.`,
          });
           console.log("[Import Data] Import successful. Reloading page in 2 seconds...");
           setTimeout(() => window.location.reload(), 2000);

        } else {
            toast({ title: "Importation Vide", description: "Aucune donnée pertinente trouvée dans le fichier pour cette application.", variant: "default" });
            console.log("[Import Data] No relevant data found in file.");
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
                <ImageIcon className="w-5 h-5 text-accent" />
                <h3 className="text-lg font-semibold text-foreground">Logo de l'Application</h3>
            </div>
            <div className="space-y-3">
                <div>
                    <Label htmlFor="app-logo-file-input">Télécharger un logo (max 1Mo)</Label>
                    <Input
                        id="app-logo-file-input"
                        type="file"
                        accept="image/png, image/jpeg, image/svg+xml"
                        ref={appLogoFileInputRef}
                        onChange={handleAppLogoUpload}
                        className="mt-1 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                    />
                </div>
                {appLogoDataUrl && (
                  <div className="mt-2 p-2 border rounded-md inline-block bg-muted">
                    <p className="text-xs text-muted-foreground mb-1">Aperçu du logo actuel :</p>
                    <Image 
                      src={appLogoDataUrl} 
                      alt="Aperçu du logo de l'application" 
                      width={100} 
                      height={50} 
                      className="object-contain rounded max-h-[50px]"
                      unoptimized
                    />
                  </div>
                )}
                <div className="flex gap-2">
                    <Button onClick={handleSaveAppLogo} disabled={!isClient}>
                        <Save className="mr-2 h-4 w-4"/> Enregistrer Logo
                    </Button>
                    {appLogoDataUrl && (
                        <Button variant="destructive" onClick={handleDeleteAppLogo} disabled={!isClient}>
                            <ImageIconTrash className="mr-2 h-4 w-4"/> Supprimer Logo
                        </Button>
                    )}
                </div>
            </div>
        </div>

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
                            onChange={(e) => handleAccentColorInputChange(e.target.value)}
                            className="h-8 w-10 rounded border-input bg-background p-0.5 cursor-pointer"
                            disabled={!isClient}
                        />
                        <span className="text-sm text-muted-foreground font-mono">{selectedAccentColor}</span>
                         <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleSaveAccentColor} 
                            disabled={!isClient}
                            className="ml-auto"
                         >
                            <Save className="mr-1.5 h-3.5 w-3.5" />
                            Enregistrer Couleur
                        </Button>
                         <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleResetAccentColor} 
                            disabled={!isClient || selectedAccentColor === DEFAULT_APP_PRIMARY_COLOR}
                         >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                            Réinitialiser
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        Changez la couleur et cliquez sur "Enregistrer Couleur" pour appliquer.
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
                            <PackageIcon className="w-4 h-4 text-muted-foreground/90"/> Alerte stock bas (Inventaire)
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
                <Button onClick={handleSaveNotificationPreferences} disabled={!isClient} className="w-full mt-4">
                    <Save className="mr-2 h-4 w-4" /> Sauvegarder Préférences de Notification
                </Button>
                <p className="text-xs text-muted-foreground pt-1">Les notifications réelles et les sons ne sont pas implémentés, seuls les paramètres sont sauvegardés.</p>
            </div>
        </div>

        <div className="p-6 border rounded-lg shadow-sm bg-card/50">
            <div className="flex items-center gap-3 mb-4">
                <Database className="w-5 h-5 text-accent" />
                <h3 className="text-lg font-semibold text-foreground">Gestion des Données</h3>
            </div>
             <p className="text-sm text-muted-foreground mb-3">
                Options pour sauvegarder ou restaurer les données de l'application stockées localement (paramètres d'affichage, préférences, etc.). Les données métier (stocks, menus, etc.) sont sur Firestore.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  variant="outline" 
                  onClick={handleExportData} 
                  disabled={!isClient}
                  className="w-full sm:w-auto"
                >
                    <Download className="mr-2 h-4 w-4" />
                    Exporter Données Locales
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
                        Importer Données Locales
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="text-destructive" /> Confirmer l'Importation
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        L'importation de données écrasera toutes les données locales existantes spécifiques à l'application qui portent le même nom. 
                        Êtes-vous sûr de vouloir continuer ? Il est recommandé d'exporter vos données locales actuelles avant d'importer.
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
                L'importation écrasera les données locales existantes avec le même nom. Sauvegardez vos données locales actuelles avant d'importer si nécessaire.
            </p>
        </div>
      </CardContent>
    </Card>
  );
}

    
