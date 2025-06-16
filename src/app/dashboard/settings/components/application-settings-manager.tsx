
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Cog, Palette, Bell, Database, Download, Upload, BellRing, ListChecks, PackageIcon, Info, RotateCcw, AlertTriangle, Image as ImageIcon, Trash2 as ImageIconTrash, Save, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_APP_PRIMARY_COLOR } from '@/config/colors';
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
  hexToHsl
} from '@/lib/theme-utils';
import { LOGGED_IN_USER_PERMISSIONS_KEY, LOGGED_IN_USER_HOUR_VIEW_CONFIG_KEY } from '@/app/dashboard/settings/components/user-management'; 
import { firestore } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const APP_SETTINGS_COLLECTION = "appSettings";
const GLOBAL_APP_SETTINGS_DOC_ID = "globalAppSettings";

export type ThemeMode = 'light' | 'dark' | 'system';

const DEFAULT_THEME_MODE: ThemeMode = 'system';
const DEFAULT_ACCENT_COLOR_FS = DEFAULT_APP_PRIMARY_COLOR;
const DEFAULT_APP_LOGO_URL_FS = null;
const DEFAULT_NOTIFICATIONS_EMAIL_FS = false;
const DEFAULT_NOTIFICATIONS_IN_APP_GENERAL_FS = true;
const DEFAULT_NOTIFICATIONS_IN_APP_NEW_TASK_FS = true;
const DEFAULT_NOTIFICATIONS_IN_APP_STATUS_UPDATE_FS = true;
const DEFAULT_NOTIFICATIONS_IN_APP_INVENTORY_LOW_FS = true;
const DEFAULT_NOTIFICATIONS_SOUND_ENABLED_FS = false;
const DEFAULT_NOTIFICATIONS_SOUND_CHOICE_FS = 'default';

const LOCAL_ONLY_APP_SPECIFIC_KEYS = [
  'loggedInUsername', 
  'isLoggedIn',       
  LOGGED_IN_USER_PERMISSIONS_KEY, 
  LOGGED_IN_USER_HOUR_VIEW_CONFIG_KEY,
  // Legacy keys that might still be around and safe to export/import if needed
  'time_tracking_members_v2',    
  'time_tracking_entries',
  'picnic_nb_pn_data_v1', // Note: this is for a single week, might not be ideal for generic export
  'picnic_client_orders_data_v3', // Same as above
  'picnic_base_bread_number_v1', // Same as above
];
// Prefixes for keys that are dynamic (e.g., date-based) but still local
const LOCAL_ONLY_APP_SPECIFIC_PREFIXES: string[] = [
    'cost_analysis_', // For monthly cost analysis suppliers & daily coeffs
    'menu_planning_', // For monthly menu data
    // Note: PMS module data (pms_cooldown_log_, pms_delivery_log_, etc.)
    // are now Firestore-based and should NOT be included in local-only export/import.
    // The PdfLayoutManager uses 'pdf_layout_configurations_v2' which is also local.
    'pdf_layout_configurations_v2',
    // Benefit tracking data is now Firestore based: monthlyBenefitData/benefit_tracking_YYYY_MM
];


export default function ApplicationSettingsManager() {
  const [isClient, setIsClient] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [selectedThemeMode, setSelectedThemeMode] = useState<ThemeMode>(DEFAULT_THEME_MODE);
  const [selectedAccentColor, setSelectedAccentColor] = useState<string>(DEFAULT_ACCENT_COLOR_FS);

  const [emailNotifications, setEmailNotifications] = useState<boolean>(DEFAULT_NOTIFICATIONS_EMAIL_FS);
  const [inAppGeneralNotifications, setInAppGeneralNotifications] = useState<boolean>(DEFAULT_NOTIFICATIONS_IN_APP_GENERAL_FS);
  const [inAppNewTaskNotifications, setInAppNewTaskNotifications] = useState<boolean>(DEFAULT_NOTIFICATIONS_IN_APP_NEW_TASK_FS);
  const [inAppStatusUpdateNotifications, setInAppStatusUpdateNotifications] = useState<boolean>(DEFAULT_NOTIFICATIONS_IN_APP_STATUS_UPDATE_FS);
  const [inAppInventoryLowNotifications, setInAppInventoryLowNotifications] = useState<boolean>(DEFAULT_NOTIFICATIONS_IN_APP_INVENTORY_LOW_FS);
  const [soundNotificationsEnabled, setSoundNotificationsEnabled] = useState<boolean>(DEFAULT_NOTIFICATIONS_SOUND_ENABLED_FS);
  const [notificationSoundChoice, setNotificationSoundChoice] = useState<string>(DEFAULT_NOTIFICATIONS_SOUND_CHOICE_FS);

  const [appLogoDataUrl, setAppLogoDataUrl] = useState<string | null>(DEFAULT_APP_LOGO_URL_FS);
  const appLogoFileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImportAlertOpen, setIsImportAlertOpen] = useState(false);

  const applyThemeMode = useCallback(applyThemeModeUtil, []);
  const applyAccentColor = useCallback(applyAccentColorUtil, []);

  const getAppSettingsDocRef = useCallback(() => {
    return doc(firestore, APP_SETTINGS_COLLECTION, GLOBAL_APP_SETTINGS_DOC_ID);
  }, []);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) {
      console.log("[ASM LoadEffect] Bypassed: !isClient.");
      return;
    }
    console.log("[ASM LoadEffect] Starting settings load from Firestore.");
    

    const loadSettingsFromFirestore = async () => {
      setIsLoadingSettings(true); 
      console.log("[ASM LoadEffect FN Start] setIsLoadingSettings(true) called.");
      const docRef = getAppSettingsDocRef();
      try {
        console.log("[ASM LoadEffect TRY] Attempting getDoc for appSettings/globalAppSettings");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          console.log("[ASM LoadEffect TRY] Document exists. Data:", data);
          setSelectedThemeMode(data.themeMode || DEFAULT_THEME_MODE);
          setSelectedAccentColor(data.accentColor || DEFAULT_ACCENT_COLOR_FS);
          setAppLogoDataUrl(data.appLogoUrl || DEFAULT_APP_LOGO_URL_FS);
          
          setEmailNotifications(data.notificationsEmailEnabled ?? DEFAULT_NOTIFICATIONS_EMAIL_FS);
          setInAppGeneralNotifications(data.notificationsInAppGeneralEnabled ?? DEFAULT_NOTIFICATIONS_IN_APP_GENERAL_FS);
          setInAppNewTaskNotifications(data.notificationsInAppNewTaskEnabled ?? DEFAULT_NOTIFICATIONS_IN_APP_NEW_TASK_FS);
          setInAppStatusUpdateNotifications(data.notificationsInAppStatusUpdateEnabled ?? DEFAULT_NOTIFICATIONS_IN_APP_STATUS_UPDATE_FS);
          setInAppInventoryLowNotifications(data.notificationsInAppInventoryLowEnabled ?? DEFAULT_NOTIFICATIONS_IN_APP_INVENTORY_LOW_FS);
          setSoundNotificationsEnabled(data.notificationsSoundEnabled ?? DEFAULT_NOTIFICATIONS_SOUND_ENABLED_FS);
          setNotificationSoundChoice(data.notificationsSoundChoice || DEFAULT_NOTIFICATIONS_SOUND_CHOICE_FS);
          
          console.log("[ASM LoadEffect TRY] States set from Firestore data.");
        } else {
          console.log("[ASM LoadEffect TRY] Document does NOT exist. Initializing with defaults and saving to Firestore.");
          const defaultSettingsBundle = {
            themeMode: DEFAULT_THEME_MODE,
            accentColor: DEFAULT_ACCENT_COLOR_FS,
            appLogoUrl: DEFAULT_APP_LOGO_URL_FS,
            notificationsEmailEnabled: DEFAULT_NOTIFICATIONS_EMAIL_FS,
            notificationsInAppGeneralEnabled: DEFAULT_NOTIFICATIONS_IN_APP_GENERAL_FS,
            notificationsInAppNewTaskEnabled: DEFAULT_NOTIFICATIONS_IN_APP_NEW_TASK_FS,
            notificationsInAppStatusUpdateEnabled: DEFAULT_NOTIFICATIONS_IN_APP_STATUS_UPDATE_FS,
            notificationsInAppInventoryLowEnabled: DEFAULT_NOTIFICATIONS_IN_APP_INVENTORY_LOW_FS,
            notificationsSoundEnabled: DEFAULT_NOTIFICATIONS_SOUND_ENABLED_FS,
            notificationsSoundChoice: DEFAULT_NOTIFICATIONS_SOUND_CHOICE_FS,
          };
          await setDoc(docRef, defaultSettingsBundle);
          console.log("[ASM LoadEffect TRY] Default settings bundle saved to Firestore.");
          // Set state to defaults as well
          setSelectedThemeMode(DEFAULT_THEME_MODE);
          setSelectedAccentColor(DEFAULT_ACCENT_COLOR_FS);
          setAppLogoDataUrl(DEFAULT_APP_LOGO_URL_FS);
          setEmailNotifications(DEFAULT_NOTIFICATIONS_EMAIL_FS);
          setInAppGeneralNotifications(DEFAULT_NOTIFICATIONS_IN_APP_GENERAL_FS);
          setInAppNewTaskNotifications(DEFAULT_NOTIFICATIONS_IN_APP_NEW_TASK_FS);
          setInAppStatusUpdateNotifications(DEFAULT_NOTIFICATIONS_IN_APP_STATUS_UPDATE_FS);
          setInAppInventoryLowNotifications(DEFAULT_NOTIFICATIONS_IN_APP_INVENTORY_LOW_FS);
          setSoundNotificationsEnabled(DEFAULT_NOTIFICATIONS_SOUND_ENABLED_FS);
          setNotificationSoundChoice(DEFAULT_NOTIFICATIONS_SOUND_CHOICE_FS);
          console.log("[ASM LoadEffect TRY] States set to default values after Firestore init.");
        }
      } catch (error) {
        console.error("[ASM LoadEffect CATCH] Error during Firestore operation or state update:", error);
        toast({ title: "Erreur de chargement des paramètres", variant: "destructive", description: String(error) });
        // Fallback to defaults in case of any error during load/init
        setSelectedThemeMode(DEFAULT_THEME_MODE);
        setSelectedAccentColor(DEFAULT_ACCENT_COLOR_FS);
        setAppLogoDataUrl(DEFAULT_APP_LOGO_URL_FS);
        setEmailNotifications(DEFAULT_NOTIFICATIONS_EMAIL_FS);
        setInAppGeneralNotifications(DEFAULT_NOTIFICATIONS_IN_APP_GENERAL_FS);
        setInAppNewTaskNotifications(DEFAULT_NOTIFICATIONS_IN_APP_NEW_TASK_FS);
        setInAppStatusUpdateNotifications(DEFAULT_NOTIFICATIONS_IN_APP_STATUS_UPDATE_FS);
        setInAppInventoryLowNotifications(DEFAULT_NOTIFICATIONS_IN_APP_INVENTORY_LOW_FS);
        setSoundNotificationsEnabled(DEFAULT_NOTIFICATIONS_SOUND_ENABLED_FS);
        setNotificationSoundChoice(DEFAULT_NOTIFICATIONS_SOUND_CHOICE_FS);
        console.log("[ASM LoadEffect CATCH] States reset to default values due to error.");
      } finally {
        console.log("[ASM LoadEffect FINALLY] Setting isLoadingSettings to false.");
        setIsLoadingSettings(false);
      }
    };

    loadSettingsFromFirestore();
  }, [isClient, getAppSettingsDocRef, toast]);


  useEffect(() => {
    if (isClient && !isLoadingSettings) { 
      console.log(`[Settings EFFECT Apply Styles] Applying theme: ${selectedThemeMode}, Accent: ${selectedAccentColor}`);
      applyThemeMode(selectedThemeMode);
      applyAccentColor(selectedAccentColor);
    }
  }, [isClient, isLoadingSettings, selectedThemeMode, selectedAccentColor, applyThemeMode, applyAccentColor]);

  const saveSettingToFirestore = async (key: string, value: any, successMessage: string) => {
    if (!isClient || isSaving) return;
    console.log(`[ASM SaveSetting] Attempting to save: ${key} =`, value);
    setIsSaving(true);
    const docRef = getAppSettingsDocRef();
    try {
      await setDoc(docRef, { [key]: value }, { merge: true });
      toast({ title: "Paramètre Enregistré", description: successMessage });
      console.log(`[ASM SaveSetting] Success for ${key}.`);
    } catch (error) {
      console.error(`[ASM SaveSetting] Error saving ${key} to Firestore:`, error);
      toast({ title: "Erreur de sauvegarde", variant: "destructive", description: String(error) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleThemeModeChange = (newMode: ThemeMode) => {
    setSelectedThemeMode(newMode);
    saveSettingToFirestore('themeMode', newMode, `Mode d'affichage réglé sur "${newMode === 'light' ? 'Clair' : newMode === 'dark' ? 'Sombre' : 'Système'}".`);
  };

  const handleAccentColorInputChange = (newColor: string) => {
    setSelectedAccentColor(newColor);
  };
  
  const handleSaveAccentColor = () => {
    let colorToSave = selectedAccentColor;
    if (!hexToHsl(colorToSave)) { 
      colorToSave = DEFAULT_ACCENT_COLOR_FS;
      setSelectedAccentColor(colorToSave);
      toast({ title: "Couleur Invalide", description: `Utilisation de la couleur par défaut (${DEFAULT_ACCENT_COLOR_FS}).`, variant: "destructive"});
    }
    saveSettingToFirestore('accentColor', colorToSave, `Couleur d'accentuation mise à jour à ${colorToSave}.`);
  };
  
  const handleResetAccentColor = () => {
    setSelectedAccentColor(DEFAULT_ACCENT_COLOR_FS);
    saveSettingToFirestore('accentColor', DEFAULT_ACCENT_COLOR_FS, `Couleur d'accentuation réinitialisée.`);
  };

  const handleAppLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 1 * 1024 * 1024) { 
        toast({ title: "Fichier trop volumineux", description: "Max 1Mo.", variant: "destructive" });
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
    saveSettingToFirestore('appLogoUrl', appLogoDataUrl, "Logo de l'application sauvegardé.");
  };

  const handleDeleteAppLogo = () => {
    setAppLogoDataUrl(null);
    saveSettingToFirestore('appLogoUrl', null, "Logo de l'application supprimé.");
    if (appLogoFileInputRef.current) appLogoFileInputRef.current.value = "";
  };

  const handleSaveNotificationPreferences = async () => {
    if (!isClient || isSaving) return;
    console.log("[ASM SaveNotifPrefs] Saving notification preferences.");
    setIsSaving(true);
    const docRef = getAppSettingsDocRef();
    const prefsToSave = {
      notificationsEmailEnabled: emailNotifications,
      notificationsInAppGeneralEnabled: inAppGeneralNotifications,
      notificationsInAppNewTaskEnabled: inAppNewTaskNotifications,
      notificationsInAppStatusUpdateEnabled: inAppStatusUpdateNotifications,
      notificationsInAppInventoryLowEnabled: inAppInventoryLowNotifications,
      notificationsSoundEnabled: soundNotificationsEnabled,
      notificationsSoundChoice: notificationSoundChoice,
    };
    try {
      await setDoc(docRef, prefsToSave, { merge: true });
      toast({ title: "Préférences de Notification Enregistrées", description: "Vos choix ont été sauvegardés." });
      console.log("[ASM SaveNotifPrefs] Success.");
    } catch (error) {
      console.error("[ASM SaveNotifPrefs] Error saving notification preferences to Firestore:", error);
      toast({ title: "Erreur de sauvegarde des notifications", variant: "destructive", description: String(error) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportData = () => {
    if (!isClient) return;
    const dataToExport: Record<string, string | null> = {};
    let keysFound = 0;
    console.log("[Export Data] Starting export of LOCAL-ONLY settings. Keys:", LOCAL_ONLY_APP_SPECIFIC_KEYS, "Prefixes:", LOCAL_ONLY_APP_SPECIFIC_PREFIXES);

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const isAppKey = LOCAL_ONLY_APP_SPECIFIC_KEYS.includes(key) || 
                         LOCAL_ONLY_APP_SPECIFIC_PREFIXES.some(prefix => key.startsWith(prefix));
        if (isAppKey) {
          dataToExport[key] = localStorage.getItem(key);
          keysFound++;
          console.log(`[Export Data] Exporting local key: ${key}`);
        }
      }
    }
    console.log(`[Export Data] Total local-only app-specific keys found for export: ${keysFound}`);

    if (Object.keys(dataToExport).length === 0) {
      toast({ title: "Aucune donnée locale à exporter", variant: "default" });
      return;
    }

    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gestion_excellence_local_settings_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Paramètres Locaux Exportés", description: `${keysFound} éléments ont été exportés.` });
  };

  const triggerFileInput = () => fileInputRef.current?.click();

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isClient) return;
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonString = e.target?.result as string;
        const importedData = JSON.parse(jsonString);
        
        if (typeof importedData !== 'object' || importedData === null) throw new Error("Format invalide.");
        console.log("[Import Data] File parsed. Data to import (local only):", importedData);

        let importedCount = 0;
        for (const key in importedData) {
          if (Object.prototype.hasOwnProperty.call(importedData, key)) {
            const isRecognizedLocalKey = LOCAL_ONLY_APP_SPECIFIC_KEYS.includes(key) || LOCAL_ONLY_APP_SPECIFIC_PREFIXES.some(prefix => key.startsWith(prefix));
            
            if (isRecognizedLocalKey) {
                const valueToStore = importedData[key];
                if (valueToStore === null) localStorage.removeItem(key);
                else localStorage.setItem(key, String(valueToStore)); 
                console.log(`[Import Data] Imported local key: ${key}`);
                importedCount++;
            } else {
                console.log(`[Import Data] Skipping key (not recognized for local-only import): ${key}`);
            }
          }
        }
        
        if (importedCount > 0) {
          toast({ title: "Paramètres Locaux Importés", description: `${importedCount} éléments importés. Rechargez pour appliquer.` });
           setTimeout(() => window.location.reload(), 2000);
        } else {
            toast({ title: "Importation Vide", description: "Aucun paramètre local pertinent trouvé.", variant: "default" });
        }
      } catch (error) {
        console.error("Error importing data:", error);
        toast({ title: "Erreur d'Importation", description: `Impossible d'importer. ${error instanceof Error ? error.message : 'Erreur inconnue.'}`, variant: "destructive" });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = ""; 
        setIsImportAlertOpen(false);
      }
    };
    reader.readAsText(file);
  };

  if (!isClient || isLoadingSettings) {
    return (
      <Card className="shadow-lg">
        <CardHeader><CardTitle>Paramètres Généraux</CardTitle></CardHeader>
        <CardContent className="flex justify-center items-center p-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-3"/> Chargement des paramètres...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cog className="w-6 h-6 text-primary"/>
          Paramètres Généraux de l'Application
        </CardTitle>
        <CardDescription>
          Configurez les options globales de l'application. Ces paramètres sont maintenant sauvegardés dans Firestore.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <Alert variant="default" className="border-primary/30 bg-primary/5">
            <Info className="h-5 w-5 text-primary" />
            <AlertTitle className="text-primary font-semibold">Information</AlertTitle>
            <AlertDescription>
                Les paramètres modifiés ici sont sauvegardés de manière centralisée et s'appliqueront à tous les utilisateurs de l'application.
                L'export/import ne concerne que les données de session locales (ex: utilisateur connecté).
            </AlertDescription>
        </Alert>

        {/* Section Logo */}
        <div className="p-6 border rounded-lg shadow-sm bg-card/50">
            <div className="flex items-center gap-3 mb-4">
                <ImageIcon className="w-5 h-5 text-accent" />
                <h3 className="text-lg font-semibold text-foreground">Logo de l'Application</h3>
            </div>
            <div className="space-y-3">
                <div>
                    <Label htmlFor="app-logo-file-input">Télécharger un logo (max 1Mo, format PNG, JPG, SVG)</Label>
                    <Input id="app-logo-file-input" type="file" accept="image/png, image/jpeg, image/svg+xml" ref={appLogoFileInputRef} onChange={handleAppLogoUpload} className="mt-1 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
                </div>
                {appLogoDataUrl && (
                  <div className="mt-2 p-2 border rounded-md inline-block bg-muted">
                    <p className="text-xs text-muted-foreground mb-1">Aperçu du logo :</p>
                    <Image src={appLogoDataUrl} alt="Aperçu du logo" width={100} height={50} className="object-contain rounded max-h-[50px]" unoptimized />
                  </div>
                )}
                <div className="flex gap-2">
                    <Button onClick={handleSaveAppLogo} disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}<Save className="mr-2 h-4 w-4"/> Enregistrer Logo</Button>
                    {appLogoDataUrl && (<Button variant="destructive" onClick={handleDeleteAppLogo} disabled={isSaving}><ImageIconTrash className="mr-2 h-4 w-4"/> Supprimer Logo</Button>)}
                </div>
            </div>
        </div>

        {/* Section Thème */}
        <div className="p-6 border rounded-lg shadow-sm bg-card/50">
            <div className="flex items-center gap-3 mb-4"> <Palette className="w-5 h-5 text-accent" /> <h3 className="text-lg font-semibold text-foreground">Thème de l'Application</h3> </div>
            <div className="space-y-4">
                <div>
                    <Label htmlFor="theme-select">Mode d'affichage</Label>
                    <Select value={selectedThemeMode} onValueChange={(value: ThemeMode) => handleThemeModeChange(value)} disabled={isSaving}>
                        <SelectTrigger id="theme-select" className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="light">Clair</SelectItem><SelectItem value="dark">Sombre</SelectItem><SelectItem value="system">Système</SelectItem></SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor="accent-color-picker">Couleur d'Accentuation (Hex)</Label>
                    <div className="flex items-center gap-2 mt-1">
                        <input type="color" id="accent-color-picker" value={selectedAccentColor} onChange={(e) => handleAccentColorInputChange(e.target.value)} className="h-8 w-10 rounded border-input bg-background p-0.5 cursor-pointer" disabled={isSaving}/>
                        <Input type="text" value={selectedAccentColor} onChange={(e) => handleAccentColorInputChange(e.target.value)} className="w-32 h-8" disabled={isSaving} />
                        <Button variant="outline" size="sm" onClick={handleSaveAccentColor} disabled={isSaving} className="ml-auto">{isSaving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}<Save className="mr-1.5 h-3.5 w-3.5" /> Enregistrer</Button>
                        <Button variant="outline" size="sm" onClick={handleResetAccentColor} disabled={isSaving || selectedAccentColor === DEFAULT_ACCENT_COLOR_FS}><RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Réinitialiser</Button>
                    </div>
                </div>
            </div>
        </div>

        {/* Section Notifications */}
        <div className="p-6 border rounded-lg shadow-sm bg-card/50">
            <div className="flex items-center gap-3 mb-4"><Bell className="w-5 h-5 text-accent" /><h3 className="text-lg font-semibold text-foreground">Préférences de Notification</h3></div>
            <div className="space-y-3">
                <div className="flex items-center justify-between"><Label htmlFor="email-notifications">Notifications par e-mail</Label><Switch id="email-notifications" checked={emailNotifications} onCheckedChange={setEmailNotifications} disabled={isSaving} /></div>
                <div className="flex items-center justify-between"><Label htmlFor="inapp-notifications">Notifications générales dans l'application</Label><Switch id="inapp-notifications" checked={inAppGeneralNotifications} onCheckedChange={setInAppGeneralNotifications} disabled={isSaving} /></div>
                <div className="pl-6 mt-3 space-y-2 border-l-2 border-muted/30">
                    <p className="text-sm text-muted-foreground mb-2 font-medium">Alertes spécifiques (dans l'app) :</p>
                    <div className="flex items-center justify-between"><Label htmlFor="inapp-new-task" className="text-sm flex items-center gap-1.5"><ListChecks className="w-4 h-4 text-muted-foreground/90"/> Nouvelle tâche/problème</Label><Switch id="inapp-new-task" checked={inAppNewTaskNotifications} onCheckedChange={setInAppNewTaskNotifications} disabled={isSaving} /></div>
                    <div className="flex items-center justify-between"><Label htmlFor="inapp-status-update" className="text-sm flex items-center gap-1.5"><ListChecks className="w-4 h-4 text-muted-foreground/90"/> MàJ statut tâche</Label><Switch id="inapp-status-update" checked={inAppStatusUpdateNotifications} onCheckedChange={setInAppStatusUpdateNotifications} disabled={isSaving} /></div>
                    <div className="flex items-center justify-between"><Label htmlFor="inapp-inventory-low" className="text-sm flex items-center gap-1.5"><PackageIcon className="w-4 h-4 text-muted-foreground/90"/> Stock bas (Inventaire)</Label><Switch id="inapp-inventory-low" checked={inAppInventoryLowNotifications} onCheckedChange={setInAppInventoryLowNotifications} disabled={isSaving} /></div>
                </div>
                <div className="flex items-center justify-between pt-2"><Label htmlFor="sound-notifications" className="flex items-center gap-1.5"><BellRing className="w-4 h-4 text-muted-foreground/90"/> Activer sons de notification</Label><Switch id="sound-notifications" checked={soundNotificationsEnabled} onCheckedChange={setSoundNotificationsEnabled} disabled={isSaving} /></div>
                <div>
                    <Label htmlFor="notification-sound-select">Son de notification</Label>
                    <Select value={notificationSoundChoice} onValueChange={setNotificationSoundChoice} disabled={isSaving || !soundNotificationsEnabled}>
                        <SelectTrigger id="notification-sound-select" className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="default">Défaut</SelectItem><SelectItem value="chime">Carillon</SelectItem><SelectItem value="alert_soft">Alerte Douce</SelectItem><SelectItem value="none">Aucun</SelectItem></SelectContent>
                    </Select>
                </div>
                <Button onClick={handleSaveNotificationPreferences} disabled={isSaving} className="w-full mt-4">{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}<Save className="mr-2 h-4 w-4" /> Sauvegarder Préférences Notification</Button>
            </div>
        </div>

        {/* Section Gestion des Données LOCALES */}
        <div className="p-6 border rounded-lg shadow-sm bg-card/50">
            <div className="flex items-center gap-3 mb-4"><Database className="w-5 h-5 text-accent" /><h3 className="text-lg font-semibold text-foreground">Gestion des Données Locales (Navigateur)</h3></div>
            <p className="text-sm text-muted-foreground mb-3">Options pour sauvegarder ou restaurer les paramètres de session (comme utilisateur connecté) stockés localement. Les configurations globales (thème, logo, etc.) sont gérées via Firestore.</p>
            <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" onClick={handleExportData} className="w-full sm:w-auto"><Download className="mr-2 h-4 w-4" /> Exporter Données Locales</Button>
                <AlertDialog open={isImportAlertOpen} onOpenChange={setIsImportAlertOpen}>
                  <AlertDialogTrigger asChild><Button variant="outline" className="w-full sm:w-auto" onClick={() => setIsImportAlertOpen(true)}><Upload className="mr-2 h-4 w-4" /> Importer Données Locales</Button></AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="text-destructive" /> Confirmer l'Importation</AlertDialogTitle><AlertDialogDescription>L'importation écrasera vos données locales actuelles (session utilisateur). Cette action est irréversible. Êtes-vous sûr ?</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={triggerFileInput}>Continuer</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileImport} />
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
    
