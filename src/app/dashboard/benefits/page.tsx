
"use client";

import Link from 'next/link';
import { FileSpreadsheet, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BenefitTrackingTable from './components/excel-benefit-manager';
// ManageBenefitEmployees component is removed
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CurrentDate } from '@/components/current-date';
import React, { useState, useEffect, useCallback } from 'react'; 
import type { BenefitEmployee } from './types'; 
import type { BrigadeMember } from '@/app/dashboard/time-tracking/types'; // Import BrigadeMember
import { useToast } from '@/hooks/use-toast'; 

const BRIGADE_MEMBERS_STORAGE_KEY = 'time_tracking_members_v2'; // Use the key from Time Tracking

export default function BenefitsPage() {
  const [employeesForBenefits, setEmployeesForBenefits] = useState<BenefitEmployee[]>([]);
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      try {
        const storedBrigadeMembers = localStorage.getItem(BRIGADE_MEMBERS_STORAGE_KEY);
        if (storedBrigadeMembers) {
          const parsedMembers: BrigadeMember[] = JSON.parse(storedBrigadeMembers);
          // Map BrigadeMember to BenefitEmployee (if needed, current structure is compatible)
          setEmployeesForBenefits(parsedMembers.map(member => ({
            id: member.id,
            name: member.name,
            // role: member.role // if BenefitEmployee had a role
          })).sort((a,b) => a.name.localeCompare(b.name)));
        } else {
          setEmployeesForBenefits([]); 
        }
      } catch (e) {
        console.error("Error loading brigade members for benefits from localStorage", e);
        setEmployeesForBenefits([]);
        toast({ title: "Erreur de chargement", description: "Les données des membres de la brigade n'ont pu être chargées.", variant: "destructive" });
      }
    }
  }, [isClient, toast]);

  // Employee management functions (add, update, delete) are removed from here.
  // They are now centralized in the Time Tracking module.

  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Chargement des avantages en nature...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 min-h-screen">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <div className="flex items-center space-x-3">
          <FileSpreadsheet className="w-10 h-10 text-accent" />
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-foreground title-glow text-center sm:text-left">
            Gestion des Avantages en Nature
          </h1>
        </div>
      </div>
      <div className="mb-6 text-center sm:text-left">
        <CurrentDate />
      </div>
      
      <div className="space-y-8">
        {/* ManageBenefitEmployees component is removed */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Suivi Mensuel des Avantages en Nature</CardTitle>
            <CardDescription>
              Sélectionnez un mois et une année, puis remplissez le tableau de suivi pour les employés de la brigade. Les données sont sauvegardées automatiquement.
              Les employés sont gérés dans la section "Suivi des Heures" &gt; "Gestion Personnel".
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BenefitTrackingTable employees={employeesForBenefits} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
