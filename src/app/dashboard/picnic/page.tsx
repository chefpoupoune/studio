"use client";

import Link from 'next/link';
import { ShoppingBasket, Calculator, BookOpenText, ScrollText, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import NumberOfPicnics from './components/NumberOfPicnics';
import PicnicMenu from './components/PicnicMenu';
import PicnicRecap from './components/PicnicRecap';
import React, { useState, useEffect, useMemo } from 'react';
import { CurrentDate } from '@/components/current-date';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import useIsMobile from '@/hooks/use-mobile';
import { useUser } from '@/hooks/use-user';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface PicnicTab {
  value: string;
  label: string;
  Icon: React.ElementType;
  component: React.ReactNode;
  permissionId?: string;
}

const allPicnicTabs: PicnicTab[] = [
  { value: "recapPn", label: "Recap", Icon: ScrollText, component: <PicnicRecap />, permissionId: 'picnic_recapPn' },
  { value: "nbPn", label: "NB PN", Icon: Calculator, component: <NumberOfPicnics /> },
  { value: "menuPn", label: "Menu", Icon: BookOpenText, component: <PicnicMenu /> },
];

export default function PicnicPage() {
  const [isClient, setIsClient] = useState(false);
  const { user, isLoading: isLoadingUser } = useUser();
  const isMobile = useIsMobile();

  const visibleTabs = useMemo(() => {
    if (!user) return [];
    const { permissions } = user;
    return allPicnicTabs.filter(tab => {
      if (tab.permissionId) {
        return !!permissions[tab.permissionId as keyof typeof permissions];
      }
      // Fallback for tabs without a specific permission: only show if the user has general access
      return !!permissions.canAccessPicnic;
    });
  }, [user]);

  const [activeTab, setActiveTab] = useState('');

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (visibleTabs.length > 0) {
      const currentTabIsVisible = visibleTabs.some(tab => tab.value === activeTab);
      if (!currentTabIsVisible) {
        setActiveTab(visibleTabs[0].value);
      }
    } else {
      setActiveTab('');
    }
  }, [visibleTabs, activeTab]);

  if (!isClient || isLoadingUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Chargement de la section Pique Nique...</p>
      </div>
    );
  }
  
  if (visibleTabs.length === 0) {
     return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8 flex-grow flex items-center justify-center">
            <Alert variant="destructive" className="max-w-lg">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Accès non autorisé</AlertTitle>
                <AlertDescription>
                    Vous n'avez pas les permissions nécessaires pour accéder à la section Pique-Nique. Veuillez contacter un administrateur.
                </AlertDescription>
            </Alert>
        </div>
    );
  }


  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 min-h-screen">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <div className="flex items-center space-x-3">
           <ShoppingBasket className="w-10 h-10 text-accent" />
           <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-foreground title-glow text-center sm:text-left">
             Gestion des Pique-Niques
           </h1>
        </div>
      </div>
      <div className="mb-6 text-center sm:text-left">
        <CurrentDate />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {isMobile ? (
          <div className="mb-4">
            <Label htmlFor="mobile-picnic-nav-select" className="text-sm font-medium">Naviguer vers :</Label>
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger id="mobile-picnic-nav-select" className="w-full mt-1">
                <SelectValue placeholder="Choisir une section..." />
              </SelectTrigger>
              <SelectContent>
                {visibleTabs.map(tab => (
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
          <TabsList className={`grid w-full grid-cols-1 sm:grid-cols-${visibleTabs.length} mb-6 bg-card p-1 rounded-lg`}>
            {visibleTabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-2 py-1">
                <tab.Icon className="mr-1 sm:mr-2 h-4 w-4" /> {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        )}
        
        {visibleTabs.map(tab => (
          <TabsContent key={tab.value} value={tab.value}>
            {tab.component}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
