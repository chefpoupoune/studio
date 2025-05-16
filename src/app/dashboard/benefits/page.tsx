
"use client";

import Link from 'next/link';
import { ArrowLeft, FileSpreadsheet, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BenefitTrackingTable from './components/excel-benefit-manager';
import ManageBenefitEmployees from './components/ManageBenefitEmployees'; // New component
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CurrentDate } from '@/components/current-date';
import React, { useState, useEffect, useCallback } from 'react'; // Added React imports
import type { BenefitEmployee } from './types'; // Import BenefitEmployee type
import { useToast } from '@/hooks/use-toast'; // Import useToast

const BENEFITS_EMPLOYEES_STORAGE_KEY = 'benefits_employees_list_v1';

export default function BenefitsPage() {
  const [benefitEmployees, setBenefitEmployees] = useState<BenefitEmployee[]>([]);
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      try {
        const storedEmployees = localStorage.getItem(BENEFITS_EMPLOYEES_STORAGE_KEY);
        if (storedEmployees) {
          setBenefitEmployees(JSON.parse(storedEmployees));
        } else {
          setBenefitEmployees([]); // Start with an empty list if nothing in storage
        }
      } catch (e) {
        console.error("Error loading benefit employees from localStorage", e);
        setBenefitEmployees([]);
        toast({ title: "Erreur de chargement", description: "Les données des employés pour les avantages n'ont pu être chargées.", variant: "destructive" });
      }
    }
  }, [isClient, toast]);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem(BENEFITS_EMPLOYEES_STORAGE_KEY, JSON.stringify(benefitEmployees));
    }
  }, [benefitEmployees, isClient]);

  const handleAddEmployee = useCallback((employeeName: string) => {
    if (!employeeName.trim()) {
      toast({ title: "Nom Invalide", description: "Le nom de l'employé ne peut pas être vide.", variant: "destructive" });
      return;
    }
    const newEmployee: BenefitEmployee = {
      id: `benefit_emp_${Date.now()}`,
      name: employeeName,
    };
    setBenefitEmployees(prev => [...prev, newEmployee].sort((a,b) => a.name.localeCompare(b.name)));
    toast({ title: "Employé Ajouté", description: `${employeeName} a été ajouté à la liste.` });
  }, [toast]);

  const handleUpdateEmployee = useCallback((updatedEmployee: BenefitEmployee) => {
    if (!updatedEmployee.name.trim()) {
      toast({ title: "Nom Invalide", description: "Le nom de l'employé ne peut pas être vide.", variant: "destructive" });
      return;
    }
    setBenefitEmployees(prev => prev.map(emp => emp.id === updatedEmployee.id ? updatedEmployee : emp).sort((a,b) => a.name.localeCompare(b.name)));
    toast({ title: "Employé Modifié", description: `${updatedEmployee.name} a été mis à jour.` });
  }, [toast]);

  const handleDeleteEmployee = useCallback((employeeId: string) => {
    const employeeName = benefitEmployees.find(e => e.id === employeeId)?.name || "L'employé";
     // Also clear their benefit data for all months if needed - for now, just remove employee
    setBenefitEmployees(prev => prev.filter(emp => emp.id !== employeeId));
    toast({ title: "Employé Supprimé", description: `${employeeName} a été supprimé de la liste.`, variant: "destructive" });
  }, [benefitEmployees, toast]);


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
        <Link href="/dashboard" passHref>
          <Button variant="outline" size="sm" className="group w-full sm:w-auto">
            <ArrowLeft className="mr-2 h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
            Retour au Tableau de Bord
          </Button>
        </Link>
      </div>
      <div className="mb-6 text-center sm:text-left">
        <CurrentDate />
      </div>
      
      <div className="space-y-8">
        <ManageBenefitEmployees 
            employees={benefitEmployees}
            onAddEmployee={handleAddEmployee}
            onUpdateEmployee={handleUpdateEmployee}
            onDeleteEmployee={handleDeleteEmployee}
        />
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Suivi Mensuel des Avantages en Nature</CardTitle>
            <CardDescription>
              Sélectionnez un mois et une année, puis remplissez le tableau de suivi pour les employés. Les données sont sauvegardées automatiquement.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BenefitTrackingTable employees={benefitEmployees} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
    
