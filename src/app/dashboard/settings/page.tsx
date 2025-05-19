"use client"; 

import Link from 'next/link';
import { Settings as SettingsIcon, FileCog, Settings2 as AppSettingsIcon, ShieldAlert, Users, ShieldX } from 'lucide-react'; // Removed ArrowLeft
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

export default function SettingsPage() {
  const [isClient, setIsClient] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  
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
            {/* <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard button removed from here as well */}
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
        {/* Back to Dashboard button removed */}
      </div>
      <div className="mb-6 text-center sm:text-left">
        <CurrentDate />
      </div>
      
      <Tabs defaultValue="pdf-layout" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-4 mb-6 bg-card p-1 rounded-lg">
          <TabsTrigger value="pdf-layout" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <FileCog className="mr-1 sm:mr-2 h-4 w-4" /> Mises en Page PDF
          </TabsTrigger>
          <TabsTrigger value="app-settings" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <AppSettingsIcon className="mr-1 sm:mr-2 h-4 w-4" /> Paramètres Application
          </TabsTrigger>
          <TabsTrigger value="pms-config" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <ShieldAlert className="mr-1 sm:mr-2 h-4 w-4" /> Paramètres PMS
          </TabsTrigger>
          <TabsTrigger value="user-management" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Users className="mr-1 sm:mr-2 h-4 w-4" /> Gestion Utilisateurs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pdf-layout">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Gestion des Mises en Page PDF</CardTitle>
              <CardDescription>
                Personnalisez l'apparence de vos documents PDF, ajoutez des logos et ajustez les mises en page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PdfLayoutManager />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="app-settings">
          <ApplicationSettingsManager />
        </TabsContent>

        <TabsContent value="pms-config">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Configuration du Plan de Maîtrise Sanitaire (PMS)</CardTitle>
              <CardDescription>
                Définissez les zones, les tâches et les critères pour les différents modules de suivi du PMS.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PmsConfigManager />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="user-management">
          <UserManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
