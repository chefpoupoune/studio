
"use client";

import Link from 'next/link';
import { FileSpreadsheet, Users, Loader2 } from 'lucide-react'; // Added Loader2
import { Button } from '@/components/ui/button';
import BenefitTrackingTable from './components/excel-benefit-manager';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CurrentDate } from '@/components/current-date';
import React, { useState, useEffect, useCallback } from 'react'; 
import type { BenefitEmployee } from './types'; 
import type { BrigadeMember } from '@/app/dashboard/time-tracking/types'; 
import { useToast } from '@/hooks/use-toast'; 
import { firestore } from '@/lib/firebase'; // Firestore import
import { collection, query, orderBy, getDocs } from 'firebase/firestore'; // Firestore query imports

// BRIGADE_MEMBERS_STORAGE_KEY removed

export default function BenefitsPage() {
  const [employeesForBenefits, setEmployeesForBenefits] = useState<BenefitEmployee[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true); // New loading state
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const fetchBrigadeMembersForBenefits = useCallback(async () => {
    if (!isClient) return;
    setIsLoadingEmployees(true);
    try {
      const membersCollectionRef = collection(firestore, 'brigadeMembers'); // Firestore collection
      const q = query(membersCollectionRef, orderBy("name"));
      const querySnapshot = await getDocs(q);
      const membersList = querySnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        name: docSnap.data().name,
        // role: docSnap.data().role // if BenefitEmployee had a role
      } as BenefitEmployee));
      setEmployeesForBenefits(membersList.sort((a,b) => a.name.localeCompare(b.name)));
    } catch (e) {
      console.error("Error loading brigade members for benefits from Firestore", e);
      setEmployeesForBenefits([]);
      toast({ title: "Erreur de chargement des employés", description: "Les données des membres de la brigade n'ont pu être chargées.", variant: "destructive" });
    } finally {
      setIsLoadingEmployees(false);
    }
  }, [isClient, toast]);

  useEffect(() => {
    if (isClient) {
      fetchBrigadeMembersForBenefits();
    }
  }, [isClient, fetchBrigadeMembersForBenefits]);


  if (!isClient || isLoadingEmployees) { // Check new loading state
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
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
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Suivi Mensuel des Avantages en Nature</CardTitle>
            <CardDescription>
              Sélectionnez un mois et une année, puis remplissez le tableau de suivi pour les employés de la brigade. Les données sont sauvegardées automatiquement dans Firestore.
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

    