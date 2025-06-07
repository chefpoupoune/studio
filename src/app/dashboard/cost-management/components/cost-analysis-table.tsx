
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2, FileText, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, getDaysInMonth as dfnsGetDaysInMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import type { CostEntry, DailyCoefficientEntry } from '../types';
import { months, years, currentYear } from '../types';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const initialSupplierRow = (): Omit<CostEntry, 'id'> => ({
  fournisseur: '', ht: 0, tva: 0, avoir: 0,
});

const initialDailyCoefficientEntry = (day: number): DailyCoefficientEntry => ({
  day, imp: "", saj: "", ime: "", esat: "", repasPlus: "", nous: "", pn: "", pnEsat: ""
});

export default function CostAnalysisTable() {
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  
  const [costData, setCostData] = useState<CostEntry[]>([]); // For suppliers
  const [dailyCoeffData, setDailyCoeffData] = useState<DailyCoefficientEntry[]>([]); // For daily IMP, SAJ etc.
  
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const getLocalStorageKeySuppliers = useCallback(() => `cost_analysis_suppliers_v6_${selectedYear}_${selectedMonth}`, [selectedYear, selectedMonth]);
  const getLocalStorageKeyDailyCoeffs = useCallback(() => `cost_analysis_daily_coeffs_v2_${selectedYear}_${selectedMonth}`, [selectedYear, selectedMonth]);

  // Initialize or load data for selected month/year
  useEffect(() => {
    setIsLoading(true);
    try {
      // Load supplier data
      const storedSuppliers = localStorage.getItem(getLocalStorageKeySuppliers());
      setCostData(storedSuppliers ? JSON.parse(storedSuppliers) : []);

      // Load or initialize daily coefficient data
      const storedDailyCoeffs = localStorage.getItem(getLocalStorageKeyDailyCoeffs());
      const daysInMonth = dfnsGetDaysInMonth(new Date(parseInt(selectedYear), parseInt(selectedMonth)));
      
      if (storedDailyCoeffs) {
        const parsedCoeffs: DailyCoefficientEntry[] = JSON.parse(storedDailyCoeffs);
        // Ensure data matches the current month length, re-initialize if not
        if (parsedCoeffs.length === daysInMonth && parsedCoeffs.every((entry, i) => entry.day === i + 1)) {
          setDailyCoeffData(parsedCoeffs);
        } else {
          setDailyCoeffData(Array.from({ length: daysInMonth }, (_, i) => initialDailyCoefficientEntry(i + 1)));
        }
      } else {
        setDailyCoeffData(Array.from({ length: daysInMonth }, (_, i) => initialDailyCoefficientEntry(i + 1)));
      }
    } catch (error) {
      console.error("Error loading data from localStorage:", error);
      setCostData([]);
      const daysInMonth = dfnsGetDaysInMonth(new Date(parseInt(selectedYear), parseInt(selectedMonth)));
      setDailyCoeffData(Array.from({ length: daysInMonth }, (_, i) => initialDailyCoefficientEntry(i + 1)));
      toast({ title: "Erreur de chargement", description: "Données corrompues, réinitialisation.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [selectedMonth, selectedYear, getLocalStorageKeySuppliers, getLocalStorageKeyDailyCoeffs, toast]);

  // Save supplier data to localStorage
  useEffect(() => {
    if (!isLoading && costData.length > 0) { // Avoid saving initial empty array if nothing was loaded
      localStorage.setItem(getLocalStorageKeySuppliers(), JSON.stringify(costData));
    } else if (!isLoading && costData.length === 0) {
       localStorage.removeItem(getLocalStorageKeySuppliers()); // Clean up if empty
    }
  }, [costData, getLocalStorageKeySuppliers, isLoading]);

  // Save daily coefficient data to localStorage
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(getLocalStorageKeyDailyCoeffs(), JSON.stringify(dailyCoeffData));
    }
  }, [dailyCoeffData, getLocalStorageKeyDailyCoeffs, isLoading]);

  const handleSupplierInputChange = (rowIndex: number, fieldName: keyof CostEntry, value: string | number) => {
    setCostData(prevData =>
      prevData.map((row, index) => {
        if (index === rowIndex) {
          let processedValue = typeof initialSupplierRow()[fieldName as keyof Omit<CostEntry, 'id'>] === 'number'
            ? parseFloat(value as string) || 0
            : value;
          return { ...row, [fieldName]: processedValue };
        }
        return row;
      })
    );
  };
  
  const handleDailyCoeffInputChange = (dayIndex: number, fieldName: keyof Omit<DailyCoefficientEntry, 'day'>, value: string) => {
    const numericValue = value === "" ? "" : parseFloat(value);
    if (value === "" || (!isNaN(numericValue) && numericValue >= 0)) {
        setDailyCoeffData(prevData =>
            prevData.map((entry, index) => {
                if (index === dayIndex) {
                    return { ...entry, [fieldName]: numericValue };
                }
                return entry;
            })
        );
    }
  };

  const handleAddSupplierRow = () => {
    setCostData(prevData => [...prevData, { ...initialSupplierRow(), id: `supplier_${Date.now()}` }]);
  };

  const handleDeleteSupplierRow = (rowId: string) => {
    setCostData(prevData => prevData.filter(row => row.id !== rowId));
    toast({ title: "Ligne Fournisseur Supprimée" });
  };

  const supplierTotals = useMemo(() => {
    let totalHt = 0, totalTva = 0, totalAvoir = 0;
    costData.forEach(row => {
      totalHt += row.ht || 0;
      totalTva += row.tva || 0;
      totalAvoir += row.avoir || 0;
    });
    return { totalHt, totalTva, totalAvoir };
  }, [costData]);

  const dailyCoeffTotals = useMemo(() => {
    const totals: Record<keyof Omit<DailyCoefficientEntry, 'day'>, number> & { totalCoeffJour: number[], totalPnJour: number[] } = {
      imp: 0, saj: 0, ime: 0, esat: 0, repasPlus: 0, nous: 0, pn: 0, pnEsat: 0,
      totalCoeffJour: Array(dailyCoeffData.length).fill(0),
      totalPnJour: Array(dailyCoeffData.length).fill(0),
    };
    dailyCoeffData.forEach((dayEntry, dayIndex) => {
      let currentDayTotalCoeff = 0;
      let currentDayTotalPn = 0;
      (Object.keys(totals) as Array<keyof Omit<DailyCoefficientEntry, 'day'>>).forEach(key => {
        if (key !== 'totalCoeffJour' && key !== 'totalPnJour') {
            const val = Number(dayEntry[key]) || 0;
            totals[key] += val;
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
    });
    return totals;
  }, [dailyCoeffData]);

  const prixDeRevientMensuel = useMemo(() => {
    const coutMatierePremiere = supplierTotals.totalHt - supplierTotals.totalAvoir;
    const coutsVariablesDirects = dailyCoeffTotals.imp + dailyCoeffTotals.saj + dailyCoeffTotals.ime + dailyCoeffTotals.esat + dailyCoeffTotals.repasPlus + dailyCoeffTotals.nous;
    const quantiteTotale = dailyCoeffTotals.pn + dailyCoeffTotals.pnEsat;
    
    if (quantiteTotale === 0) return 0;
    return (coutMatierePremiere + coutsVariablesDirects) / quantiteTotale;
  }, [supplierTotals, dailyCoeffTotals]);

  const generatePdf = () => {
    toast({ title: "PDF Obsolète", description: "La génération PDF pour cette nouvelle structure n'est pas encore implémentée.", variant: "default" });
    // Placeholder for actual PDF generation
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end">
        <div>
          <Label htmlFor="month-select-cost">Mois</Label>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger id="month-select-cost"><SelectValue /></SelectTrigger>
            <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="year-select-cost">Année</Label>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger id="year-select-cost"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
         <Button onClick={generatePdf} disabled={isLoading} className="sm:col-start-3 justify-self-end">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            Générer PDF (Non Fonctionnel)
        </Button>
      </div>

      {/* Tableau des Fournisseurs */}
      <div className="overflow-x-auto border rounded-md">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="min-w-[150px]">Fournisseur</TableHead>
            <TableHead className="min-w-[80px] text-right">HT (€)</TableHead>
            <TableHead className="min-w-[80px] text-right">TVA (€)</TableHead>
            <TableHead className="min-w-[80px] text-right">Avoir (€)</TableHead>
            <TableHead className="min-w-[80px] text-center">Action</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {costData.map((row, rowIndex) => (
              <TableRow key={row.id}>
                <TableCell className="p-1"><Input type="text" value={row.fournisseur} onChange={e => handleSupplierInputChange(rowIndex, 'fournisseur', e.target.value)} className="text-xs p-1 h-7" /></TableCell>
                <TableCell className="p-1"><Input type="number" value={row.ht} onChange={e => handleSupplierInputChange(rowIndex, 'ht', e.target.value)} className="text-xs p-1 h-7 text-right" /></TableCell>
                <TableCell className="p-1"><Input type="number" value={row.tva} onChange={e => handleSupplierInputChange(rowIndex, 'tva', e.target.value)} className="text-xs p-1 h-7 text-right" /></TableCell>
                <TableCell className="p-1"><Input type="number" value={row.avoir} onChange={e => handleSupplierInputChange(rowIndex, 'avoir', e.target.value)} className="text-xs p-1 h-7 text-right" /></TableCell>
                <TableCell className="text-center p-1">
                  <Button variant="destructive" size="icon" onClick={() => handleDeleteSupplierRow(row.id)} className="h-7 w-7"><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter><TableRow className="font-bold bg-muted/80">
            <TableCell>Total</TableCell>
            <TableCell className="text-right">{supplierTotals.totalHt.toFixed(2)}</TableCell>
            <TableCell className="text-right">{supplierTotals.totalTva.toFixed(2)}</TableCell>
            <TableCell className="text-right">{supplierTotals.totalAvoir.toFixed(2)}</TableCell>
            <TableCell></TableCell>
          </TableRow></TableFooter>
        </Table>
      </div>
      <Button onClick={handleAddSupplierRow}><PlusCircle className="mr-2 h-4 w-4" /> Ajouter Fournisseur</Button>

      {/* Tableau des Coefficients Journaliers */}
      <div className="overflow-x-auto border rounded-md mt-8">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-[60px]">Jour</TableHead>
            <TableHead className="min-w-[70px] text-center">IMP</TableHead>
            <TableHead className="min-w-[70px] text-center">SAJ</TableHead>
            <TableHead className="min-w-[70px] text-center">IME</TableHead>
            <TableHead className="min-w-[70px] text-center">ESAT</TableHead>
            <TableHead className="min-w-[70px] text-center">Repas ++</TableHead>
            <TableHead className="min-w-[70px] text-center">Nous</TableHead>
            <TableHead className="min-w-[80px] text-center font-semibold">Total (Coeff)</TableHead>
            <TableHead className="min-w-[70px] text-center">PN</TableHead>
            <TableHead className="min-w-[70px] text-center">PN ESAT</TableHead>
            <TableHead className="min-w-[80px] text-center font-semibold">Total (PN)</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {dailyCoeffData.map((entry, dayIndex) => (
              <TableRow key={entry.day}>
                <TableCell className="font-medium">{entry.day}</TableCell>
                {(['imp', 'saj', 'ime', 'esat', 'repasPlus', 'nous', 'pn', 'pnEsat'] as const).map(field => (
                  <TableCell key={field} className="p-1">
                    <Input type="number" value={entry[field]} onChange={e => handleDailyCoeffInputChange(dayIndex, field, e.target.value)} className="text-xs p-1 h-7 text-center" placeholder="0" />
                  </TableCell>
                ))}
                <TableCell className="text-center font-semibold">{dailyCoeffTotals.totalCoeffJour[dayIndex].toFixed(2)}</TableCell>
                <TableCell className="text-center font-semibold">{dailyCoeffTotals.totalPnJour[dayIndex].toFixed(0)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter><TableRow className="font-bold bg-muted/80">
            <TableCell>Total</TableCell>
            {(['imp', 'saj', 'ime', 'esat', 'repasPlus', 'nous', 'pn', 'pnEsat'] as const).map(field => (
              <TableCell key={`total-${field}`} className="text-center">
                { field === 'pn' || field === 'pnEsat' ? dailyCoeffTotals[field].toFixed(0) : dailyCoeffTotals[field].toFixed(2) }
              </TableCell>
            ))}
             <TableCell className="text-center">{(dailyCoeffTotals.imp + dailyCoeffTotals.saj + dailyCoeffTotals.ime + dailyCoeffTotals.esat + dailyCoeffTotals.repasPlus + dailyCoeffTotals.nous).toFixed(2)}</TableCell>
             <TableCell className="text-center">{(dailyCoeffTotals.pn + dailyCoeffTotals.pnEsat).toFixed(0)}</TableCell>
          </TableRow></TableFooter>
        </Table>
      </div>

      {/* Prix de Revient du Mois */}
      <div className="mt-8 p-4 border rounded-md bg-card shadow">
        <Label className="text-lg font-semibold">Prix de Revient du Mois :</Label>
        <span className="text-2xl font-bold ml-2 text-primary">{prixDeRevientMensuel.toFixed(2)} €</span>
        <p className="text-xs text-muted-foreground mt-1">
            Calculé comme : (Total HT Fournisseurs - Total Avoir Fournisseurs + Total Coûts Journaliers (IMP à Nous)) / Total Quantités Journalières (PN + PN ESAT).
        </p>
      </div>
    </div>
  );
}
