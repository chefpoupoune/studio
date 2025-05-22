
"use client"; 

import Link from 'next/link';
import { Settings as SettingsIcon, FileCog, Settings2 as AppSettingsIcon, ShieldAlert, Users, ShieldX } from 'lucide-react'; 
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CurrentDate } from '@/components/current-date';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PdfLayoutManager from './components/pdf-layout-manager';
import ApplicationSettingsManager from './components/application-settings-manager';
import PmsConfigManager from './components/pms-config-manager';
import UserManagement from './components/user-management';
import React, { useState, useEffect } from 'react'; 
import type { RubricId } from './components/user-management'; 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useIsMobile } from '@/hooks/use-mobile';

const settingsTabsConfig = [
  { value: "pdf-layout", label: "Mises en Page PDF", Icon: FileCog, component: <PdfLayoutManager /> },
  { value: "app-settings", label: "Paramètres Application", Icon: AppSettingsIcon, component: <ApplicationSettingsManager /> },
  { value: "pms-config", label: "Paramètres PMS", Icon: ShieldAlert, component: <PmsConfigManager /> },
  { value: "user-management", label: "Gestion Utilisateurs", Icon: Users, component: <UserManagement /> },
];

export default function SettingsPage() {
  const [isClient, setIsClient] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState(settingsTabsConfig[0].value);
  
  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
      const username = localStorage.getItem('loggedInUsername');
      const permissionsRaw = localStorage.getItem('loggedInUserPermissions');
      
      if (username?.toLowerCase() === 'chef') {
        setHasAccess(true);
      } else if (permissionsRaw) {
        try {
          const permissions = JSON.parse(permissionsRaw) as Partial<Record<RubricId, boolean>>;
          if (permissions.settings === true) {
            setHasAccess(true);
          } else {
            setHasAccess(false);
          }
        } catch (e) {
          console.error("Error parsing permissions for settings access", e);
          setHasAccess(false);
        }
      } else {
        setHasAccess(false);
      }
    }
  }, []);

  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Chargement des paramètres...</p>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="container mx-auto p-4 md:p-6 lg:p-8 min-h-[calc(100vh-10rem)] flex flex-col items-center justify-center text-center">
        <ShieldX className="w-24 h-24 text-destructive mb-6" />
        <h1 className="text-3xl font-bold text-destructive mb-4">Accès Refusé</h1>
        <p className="text-lg text-muted-foreground mb-6">
          Vous n'avez pas les permissions nécessaires pour accéder à la section des paramètres.
        </p>
        <Link href="/dashboard" passHref>
          <Button variant="outline">
            Retour au Tableau de Bord
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 min-h-screen">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <div className="flex items-center space-x-3">
          <SettingsIcon className="w-10 h-10 text-accent" />
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-foreground title-glow text-center sm:text-left">
            Paramètres de l'Application
          </h1>
        </div>
      </div>
      <div className="mb-6 text-center sm:text-left">
        <CurrentDate />
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {isMobile ? (
          <div className="mb-4">
            <Label htmlFor="mobile-settings-nav-select" className="text-sm font-medium">Naviguer vers :</Label>
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger id="mobile-settings-nav-select" className="w-full mt-1">
                <SelectValue placeholder="Choisir une section..." />
              </SelectTrigger>
              <SelectContent>
                {settingsTabsConfig.map(tab => (
                  <SelectItem key={tab.value} value={tab.value} className="text-sm">
                    <span className="flex items-center">
                      <tab.Icon className="mr-2 h-4 w-4" />
                      {tab.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-4 mb-6 bg-card p-1 rounded-lg">
            {settingsTabsConfig.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-2 py-1">
                <tab.Icon className="mr-1 sm:mr-2 h-4 w-4" /> {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        )}

        {settingsTabsConfig.map(tab => (
          <TabsContent key={tab.value} value={tab.value}>
            {tab.component}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
