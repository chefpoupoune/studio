
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Cog, Palette, Globe, Bell, Database, Download, Upload, BellRing, ListChecks, Package, ShieldCheck, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const THEME_STORAGE_KEY = "app_settings_theme_mode";
const ACCENT_COLOR_STORAGE_KEY = "app_settings_accent_color";
const DEFAULT_ACCENT_COLOR = "#FFD700"; // Default gold

type ThemeMode = 'light' | 'dark' | 'system';

export default function ApplicationSettingsManager() {
  const [selectedThemeMode, setSelectedThemeMode] = useState<ThemeMode>('system');
  const [selectedAccentColor, setSelectedAccentColor] = useState<string>(DEFAULT_ACCENT_COLOR);
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const applyTheme = useCallback((theme: ThemeMode) => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else { // system
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, []);

  useEffect(() => {
    if (isClient) {
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
      if (storedTheme && ['light', 'dark', 'system'].includes(storedTheme)) {
        setSelectedThemeMode(storedTheme);
        applyTheme(storedTheme);
      } else {
        applyTheme('system'); // Apply system theme by default if nothing stored
      }

      const storedAccentColor = localStorage.getItem(ACCENT_COLOR_STORAGE_KEY);
      if (storedAccentColor) {
        setSelectedAccentColor(storedAccentColor);
      }
    }
  }, [isClient, applyTheme]);

  const handleThemeModeChange = (newMode: ThemeMode) => {
    setSelectedThemeMode(newMode);
    if (isClient) {
      localStorage.setItem(THEME_STORAGE_KEY, newMode);
      applyTheme(newMode);
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
      // Note: Actual application of accent color to CSS variables is not implemented in this step.
      // This would typically involve updating CSS custom properties.
      document.documentElement.style.setProperty('--accent-manual', newColor); // Example, not tied to globals.css yet
      toast({
        title: "Couleur d'Accentuation Mise à Jour",
        description: `La couleur d'accentuation est maintenant ${newColor}. L'application visuelle complète de cette couleur est une fonctionnalité en cours de développement.`,
      });
    }
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
            <AlertTitle className="text-primary font-semibold">Développement en Cours</AlertTitle>
            <AlertDescription>
                Certaines fonctionnalités de cette section sont en cours de construction ou sont des démonstrations. Les paramètres sauvegardés sont stockés localement dans votre navigateur.
            </AlertDescription>
        </Alert>

        {/* Theme Settings */}
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
                    <Label htmlFor="accent-color-picker">Couleur d'Accentuation (Globale)</Label>
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
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        La couleur d'accentuation est sauvegardée. L'application visuelle complète (mise à jour du fichier de thème global) est une fonctionnalité avancée en cours de développement.
                    </p>
                </div>
            </div>
        </div>

        {/* Language & Region Settings Placeholder */}
        <div className="p-6 border rounded-lg shadow-sm bg-card/50">
            <div className="flex items-center gap-3 mb-4">
                <Globe className="w-5 h-5 text-accent" />
                <h3 className="text-lg font-semibold text-foreground">Langue et Région</h3>
            </div>
            <div className="space-y-4">
                <div>
                    <Label htmlFor="language-select">Langue de l'application</Label>
                    <Select defaultValue="fr" disabled>
                        <SelectTrigger id="language-select" className="mt-1">
                            <SelectValue placeholder="Choisir une langue" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="fr">Français (par défaut)</SelectItem>
                            <SelectItem value="en">English (Fonctionnalité à venir)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label htmlFor="date-format-select">Format de Date</Label>
                    <Select defaultValue="dd/MM/yyyy" disabled>
                        <SelectTrigger id="date-format-select" className="mt-1">
                            <SelectValue placeholder="Choisir un format de date" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="dd/MM/yyyy">JJ/MM/AAAA (par défaut)</SelectItem>
                            <SelectItem value="MM/dd/yyyy">MM/JJ/AAAA (Fonctionnalité à venir)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <div>
                    <Label htmlFor="currency-select">Devise Principale</Label>
                    <Select defaultValue="EUR" disabled>
                        <SelectTrigger id="currency-select" className="mt-1">
                            <SelectValue placeholder="Choisir une devise" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="EUR">Euro (€) (par défaut)</SelectItem>
                            <SelectItem value="USD">Dollar US ($) (Fonctionnalité à venir)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <p className="text-xs text-muted-foreground pt-1">Les paramètres de langue, format de date et devise sont prévus pour des versions futures.</p>
            </div>
        </div>

        {/* Notification Preferences Placeholder */}
        <div className="p-6 border rounded-lg shadow-sm bg-card/50">
            <div className="flex items-center gap-3 mb-4">
                <Bell className="w-5 h-5 text-accent" />
                <h3 className="text-lg font-semibold text-foreground">Préférences de Notification</h3>
            </div>
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <Label htmlFor="email-notifications" className="flex-grow cursor-not-allowed text-muted-foreground/80">Notifications par e-mail</Label>
                    <Switch id="email-notifications" disabled />
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="inapp-notifications" className="flex-grow text-muted-foreground/80">Notifications générales dans l'application</Label>
                    <Switch id="inapp-notifications" checked disabled />
                </div>

                <div className="pl-6 mt-3 space-y-2 border-l-2 border-muted/30">
                    <p className="text-sm text-muted-foreground mb-2 font-medium">Alertes spécifiques (dans l'app) :</p>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="inapp-new-task" className="text-sm flex items-center gap-1.5 flex-grow cursor-not-allowed text-muted-foreground/80">
                            <ListChecks className="w-4 h-4 text-muted-foreground/70"/> Nouvelle tâche/problème signalé
                        </Label>
                        <Switch id="inapp-new-task" disabled />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="inapp-status-update" className="text-sm flex items-center gap-1.5 flex-grow cursor-not-allowed text-muted-foreground/80">
                             <ListChecks className="w-4 h-4 text-muted-foreground/70"/> Mise à jour de statut d'une tâche
                        </Label>
                        <Switch id="inapp-status-update" disabled />
                    </div>
                     <div className="flex items-center justify-between">
                        <Label htmlFor="inapp-inventory-low" className="text-sm flex items-center gap-1.5 flex-grow cursor-not-allowed text-muted-foreground/80">
                            <Package className="w-4 h-4 text-muted-foreground/70"/> Alerte stock bas (Inventaire)
                        </Label>
                        <Switch id="inapp-inventory-low" disabled />
                    </div>
                </div>
                
                <div className="flex items-center justify-between pt-2">
                    <Label htmlFor="sound-notifications" className="flex-grow cursor-not-allowed flex items-center gap-1.5 text-muted-foreground/80">
                        <BellRing className="w-4 h-4 text-muted-foreground/70"/> Activer les sons de notification
                    </Label>
                    <Switch id="sound-notifications" disabled />
                </div>

                <div className="mt-2">
                    <Label htmlFor="notification-sound-select" className="text-muted-foreground/80">Son de notification</Label>
                    <Select defaultValue="default" disabled>
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
                <p className="text-xs text-muted-foreground pt-1">Gestion détaillée des alertes et notifications (Fonctionnalité à venir).</p>
            </div>
        </div>

        {/* Privacy Settings Placeholder */}
        <div className="p-6 border rounded-lg shadow-sm bg-card/50">
            <div className="flex items-center gap-3 mb-4">
                <ShieldCheck className="w-5 h-5 text-accent" />
                <h3 className="text-lg font-semibold text-foreground">Confidentialité et Données</h3>
            </div>
            <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <Label htmlFor="anonymize-usage-reports" className="flex-grow cursor-not-allowed text-muted-foreground/80">Anonymiser les rapports d'utilisation (si applicable)</Label>
                    <Switch id="anonymize-usage-reports" disabled />
                </div>
                <div>
                    <Label htmlFor="log-retention-period" className="text-muted-foreground/80">Durée de conservation des données de log</Label>
                    <Select defaultValue="90days" disabled>
                        <SelectTrigger id="log-retention-period" className="mt-1">
                            <SelectValue placeholder="Choisir une durée" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="30days">30 jours</SelectItem>
                            <SelectItem value="90days">90 jours (recommandé)</SelectItem>
                            <SelectItem value="1year">1 an</SelectItem>
                            <SelectItem value="forever">Indéfiniment (non recommandé)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <p className="text-xs text-muted-foreground pt-1">Les préférences de confidentialité et la gestion des logs sont prévues pour des versions futures.</p>
            </div>
        </div>


        {/* Data Management Placeholder */}
        <div className="p-6 border rounded-lg shadow-sm bg-card/50">
            <div className="flex items-center gap-3 mb-4">
                <Database className="w-5 h-5 text-accent" />
                <h3 className="text-lg font-semibold text-foreground">Gestion des Données</h3>
            </div>
             <p className="text-sm text-muted-foreground mb-3">
                Options pour sauvegarder ou restaurer les données de l'application stockées localement. Utile pour les migrations ou la récupération après incident.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" disabled className="w-full sm:w-auto">
                    <Download className="mr-2 h-4 w-4" />
                    Exporter Toutes les Données Locales
                </Button>
                <Button variant="outline" disabled className="w-full sm:w-auto">
                    <Upload className="mr-2 h-4 w-4" />
                    Importer des Données Locales
                </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
                Fonctionnalité à venir. Cela permettra de télécharger un fichier JSON contenant toutes vos configurations et données saisies (sauf mots de passe), ou de restaurer l'application à partir d'un tel fichier.
            </p>
        </div>
      </CardContent>
    </Card>
  );
}
    

