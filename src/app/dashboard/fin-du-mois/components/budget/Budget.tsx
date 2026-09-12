
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, FileText } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { getDaysInMonth as dfnsGetDaysInMonth } from 'date-fns';
import { generateMonthlyCostPdf } from '../../../cost-management/utils/pdfGenerator';
import { getMonthDays } from '../../../pms/utils';
import { months } from '../../../cost-management/types';
import type { CostEntry, DailyCoefficientEntry } from '../../../cost-management/types';

interface BudgetProps {
  selectedDate: Date;
}

const initialSupplierRow = (): Omit<CostEntry, 'id'> => ({
  fournisseur: '', ht: 0, tva: 0, avoir: 0,
});

const initialDailyCoefficientEntry = (day: number): DailyCoefficientEntry => ({
  day, imp: "", saj: "", ime: "", esat: "", repasPlus: "", nous: "", pn: "", pnEsat: ""
});

const Budget: React.FC<BudgetProps> = ({ selectedDate }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [costData, setCostData] = useState<CostEntry[]>([]);
  const [dailyCoeffData, setDailyCoeffData] = useState<DailyCoefficientEntry[]>([]);
  const { toast } = useToast();

  const selectedMonth = selectedDate.getMonth().toString();
  const selectedYear = selectedDate.getFullYear().toString();

  const getFirestoreDocId = useCallback(() => `entry_${selectedYear}_${selectedMonth}`, [selectedYear, selectedMonth]);

  useEffect(() => {
    const docId = getFirestoreDocId();
    if (!docId) return;

    const loadData = async () => {
      setIsLoading(true);
      const docRef = doc(firestore, "costAnalysisMonthlyEntries", docId);
      try {
        const docSnap = await getDoc(docRef);
        const daysInMonth = dfnsGetDaysInMonth(new Date(parseInt(selectedYear), parseInt(selectedMonth)));

        if (docSnap.exists()) {
          const data = docSnap.data();
          const suppliers = data.suppliers && data.suppliers.length > 0 ? data.suppliers : [{ ...initialSupplierRow(), id: `supplier_init_${Date.now()}` }];
          setCostData(suppliers.map((s: any, index: number) => ({ ...initialSupplierRow(), ...s, id: s.id || `supplier_${Date.now()}_${index}` })));
          
          const dailyCoeffs = data.dailyCoefficients || Array.from({ length: daysInMonth }, (_, i) => initialDailyCoefficientEntry(i + 1));
          setDailyCoeffData(dailyCoeffs.length !== daysInMonth ? Array.from({ length: daysInMonth }, (_, i) => initialDailyCoefficientEntry(i + 1)) : dailyCoeffs);
        } else {
          // If no data exists, we can't generate a PDF, but we shouldn't block the UI.
          setCostData([]);
          setDailyCoeffData([]);
          toast({ title: "Données non trouvées", description: "Aucune donnée de coût de revient n'a été trouvée pour cette période.", variant: "default" });
        }
      } catch (error) {
        console.error("Error loading data from Firestore:", error);
        toast({ title: "Erreur de chargement", description: "Données mensuelles corrompues.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [selectedMonth, selectedYear, getFirestoreDocId, toast]);

  // All the calculation hooks copied from CostAnalysisTable
  const supplierTotals = useMemo(() => {
    let totalHt = 0, totalTva = 0, totalAvoir = 0;
    costData.forEach(row => {
      totalHt += Number(row.ht) || 0;
      totalTva += Number(row.tva) || 0;
      totalAvoir += Number(row.avoir) || 0;
    });
    return { totalHt, totalTva, totalAvoir };
  }, [costData]);

  const dailyCoeffTotals = useMemo(() => {
    const totals: { [K in keyof Omit<DailyCoefficientEntry, 'day'>]: number } & { totalCoeffJour: number[], totalPnJour: number[], totalGlobalJour: number[] } = {
      imp: 0, saj: 0, ime: 0, esat: 0, repasPlus: 0, nous: 0, pn: 0, pnEsat: 0,
      totalCoeffJour: Array(dailyCoeffData.length).fill(0),
      totalPnJour: Array(dailyCoeffData.length).fill(0),
      totalGlobalJour: Array(dailyCoeffData.length).fill(0),
    };

    dailyCoeffData.forEach((dayEntry, dayIndex) => {
      let currentDayTotalCoeff = 0;
      let currentDayTotalPn = 0;
      (Object.keys(dayEntry) as Array<keyof DailyCoefficientEntry>).forEach(key => {
        if (key !== 'day') {
          const val = Number(dayEntry[key]) || 0;
          (totals[key] as number) += val;
          if (['imp', 'saj', 'ime', 'esat', 'repasPlus', 'nous'].includes(key)) {
            currentDayTotalCoeff += val;
          }
          if (['pn', 'pnEsat'].includes(key)) {
            currentDayTotalPn += val;
          }
        }
      });
      totals.totalCoeffJour[dayIndex] = currentDayTotalCoeff;
      totals.totalPnJour[dayIndex] = currentDayTotalPn;
      totals.totalGlobalJour[dayIndex] = currentDayTotalCoeff + currentDayTotalPn;
    });
    return totals;
  }, [dailyCoeffData]);

  const grandTotalGlobalJourValue = useMemo(() => {
    return dailyCoeffTotals.totalGlobalJour.reduce((sum, val) => sum + val, 0);
  }, [dailyCoeffTotals.totalGlobalJour]);

  const prixDeRevientMensuel = useMemo(() => {
    const coutMatierePremiere = supplierTotals.totalHt - supplierTotals.totalAvoir;
    if (grandTotalGlobalJourValue === 0) return 0;
    return coutMatierePremiere / grandTotalGlobalJourValue;
  }, [supplierTotals, grandTotalGlobalJourValue]);

  const daysInMonthArray = useMemo(() => {
    const year = parseInt(selectedYear, 10);
    const monthIndex = parseInt(selectedMonth, 10);
    return getMonthDays(year, monthIndex);
  }, [selectedYear, selectedMonth]);

  const handleGeneratePdf = async () => {
    if (costData.length === 0) {
        toast({ title: "Génération impossible", description: "Il n'y a pas de données à exporter en PDF pour ce mois.", variant: "destructive"});
        return;
    }
    setIsLoading(true);
    const pdfData = {
      selectedMonth,
      selectedYear,
      costData,
      dailyCoeffData,
      supplierTotals,
      dailyCoeffTotals,
      grandTotalGlobalJourValue,
      prixDeRevientMensuel,
      daysInMonthArray,
      months,
    };

    try {
      await generateMonthlyCostPdf(pdfData);
      toast({ title: "PDF Généré", description: "Le PDF du coût de revient mensuel a été téléchargé." });
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      toast({ title: "Erreur PDF", description: `La génération du PDF a échoué: ${error.message || 'Erreur inconnue'}.`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rapport Budgétaire Mensuel</CardTitle>
        <CardDescription>
          Générez le rapport PDF du coût de revient pour le mois et l'année sélectionnés.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-start space-y-4">
          <p className="text-sm text-muted-foreground">
            Ce rapport est basé sur les données saisies dans la section "Gestion de Budget". 
            Assurez-vous que les données pour le mois de {months.find(m=>m.value === selectedMonth)?.label} {selectedYear} sont complètes.
          </p>
          <Button onClick={handleGeneratePdf} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            Générer le PDF du Mois
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default Budget;
