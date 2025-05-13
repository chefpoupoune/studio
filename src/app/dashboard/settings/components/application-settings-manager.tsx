
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Cog, Palette, Globe, Bell, Database, Download, Upload, BellRing, ListChecks, Package } from 'lucide-react'; // Replaced PackageWarning with Package
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ApplicationSettingsManager() {
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
            <Cog className="h-5 w-5 text-primary" />
            <AlertTitle className="text-primary font-semibold">Section en Cours de Développement</AlertTitle>
            <AlertDescription>
                Cette section est en cours de construction. Bientôt, vous pourrez personnaliser ici divers aspects de votre application. Les options ci-dessous sont des exemples de ce qui pourrait être disponible.
            </AlertDescription>
        </Alert>

        {/* Theme Settings Placeholder */}
        <div className="p-6 border rounded-lg shadow-sm bg-card/50">
            <div className="flex items-center gap-3 mb-4">
                <Palette className="w-5 h-5 text-accent" />
                <h3 className="text-lg font-semibold text-foreground">Thème de l'Application</h3>
            </div>
            <div className="space-y-4">
                <div>
                    <Label htmlFor="theme-select">Mode d'affichage</Label>
                    <Select defaultValue="system" disabled>
                        <SelectTrigger id="theme-select" className="mt-1">
                            <SelectValue placeholder="Choisir un mode" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="light">Clair</SelectItem>
                            <SelectItem value="dark">Sombre</SelectItem>
                            <SelectItem value="system">Système</SelectItem>
                        </SelectContent>
                    </Select>
                     <p className="text-xs text-muted-foreground mt-1">Fonctionnalité à venir.</p>
                </div>
                <div>
                    <Label htmlFor="accent-color-picker">Couleur d'Accentuation</Label>
                    <div className="flex items-center gap-2 mt-1">
                        <input type="color" id="accent-color-picker" defaultValue="#FFD700" className="h-8 w-10 rounded border bg-background p-0.5 cursor-not-allowed" disabled />
                        <span className="text-sm text-muted-foreground">(Ex: Doré)</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Fonctionnalité à venir.</p>
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
                            <SelectItem value="fr">Français</SelectItem>
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
                            <SelectItem value="dd/MM/yyyy">JJ/MM/AAAA</SelectItem>
                            <SelectItem value="MM/dd/yyyy">MM/JJ/AAAA (Fonctionnalité à venir)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <div>
                    <Label htmlFor="currency-select">Devise</Label>
                    <Select defaultValue="EUR" disabled>
                        <SelectTrigger id="currency-select" className="mt-1">
                            <SelectValue placeholder="Choisir une devise" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="EUR">Euro (€)</SelectItem>
                            <SelectItem value="USD">Dollar US ($) (Fonctionnalité à venir)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
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
                    <Label htmlFor="email-notifications" className="flex-grow cursor-not-allowed">Notifications par e-mail</Label>
                    <Switch id="email-notifications" disabled />
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="inapp-notifications" className="flex-grow cursor-not-allowed">Notifications générales dans l'application</Label>
                    <Switch id="inapp-notifications" checked disabled />
                </div>

                <div className="pl-6 mt-3 space-y-2 border-l-2 border-muted/30">
                    <p className="text-sm text-muted-foreground mb-2 font-medium">Notifications spécifiques (dans l'app) :</p>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="inapp-new-task" className="text-sm flex items-center gap-1.5 flex-grow cursor-not-allowed">
                            <ListChecks className="w-4 h-4 text-muted-foreground/70"/> Nouvelle tâche/problème signalé
                        </Label>
                        <Switch id="inapp-new-task" disabled />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="inapp-status-update" className="text-sm flex items-center gap-1.5 flex-grow cursor-not-allowed">
                             <ListChecks className="w-4 h-4 text-muted-foreground/70"/> Mise à jour de statut d'une tâche
                        </Label>
                        <Switch id="inapp-status-update" disabled />
                    </div>
                     <div className="flex items-center justify-between">
                        <Label htmlFor="inapp-inventory-low" className="text-sm flex items-center gap-1.5 flex-grow cursor-not-allowed">
                            <Package className="w-4 h-4 text-muted-foreground/70"/> Alerte stock bas (Inventaire)
                        </Label>
                        <Switch id="inapp-inventory-low" disabled />
                    </div>
                </div>
                
                <div className="flex items-center justify-between pt-2">
                    <Label htmlFor="sound-notifications" className="flex-grow cursor-not-allowed flex items-center gap-1.5">
                        <BellRing className="w-4 h-4 text-muted-foreground/70"/> Activer les sons de notification
                    </Label>
                    <Switch id="sound-notifications" disabled />
                </div>

                <div className="mt-2">
                    <Label htmlFor="notification-sound-select">Son de notification</Label>
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
                <p className="text-xs text-muted-foreground pt-1">Gestion des alertes et notifications (Fonctionnalité à venir).</p>
            </div>
        </div>

        {/* Data Management Placeholder */}
        <div className="p-6 border rounded-lg shadow-sm bg-card/50">
            <div className="flex items-center gap-3 mb-4">
                <Database className="w-5 h-5 text-accent" />
                <h3 className="text-lg font-semibold text-foreground">Gestion des Données</h3>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" disabled className="w-full sm:w-auto">
                    <Download className="mr-2 h-4 w-4" />
                    Exporter les données
                </Button>
                <Button variant="outline" disabled className="w-full sm:w-auto">
                    <Upload className="mr-2 h-4 w-4" />
                    Importer des données
                </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
                Options pour sauvegarder ou restaurer les données de l'application (Fonctionnalité à venir).
            </p>
        </div>
      </CardContent>
    </Card>
  );
}

    
