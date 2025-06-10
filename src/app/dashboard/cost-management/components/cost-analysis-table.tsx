
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2, FileText, Loader2, CalendarDays } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, getDaysInMonth as dfnsGetDaysInMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import type { CostEntry, DailyCoefficientEntry } from '../types';
import { months, years, currentYear } from '../types';
import { ScrollArea } from '@/components/ui/scroll-area'; // Added ScrollArea

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
  
  const [costData, setCostData] = useState<CostEntry[]>([]); 
  const [dailyCoeffData, setDailyCoeffData] = useState<DailyCoefficientEntry[]>([]); 
  
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const getLocalStorageKeySuppliers = useCallback(() => `cost_analysis_suppliers_v7_${selectedYear}_${selectedMonth}`, [selectedYear, selectedMonth]);
  const getLocalStorageKeyDailyCoeffs = useCallback(() => `cost_analysis_daily_coeffs_v7_${selectedYear}_${selectedMonth}`, [selectedYear, selectedMonth]);

  useEffect(() => {
    setIsLoading(true);
    try {
      const storedSuppliers = localStorage.getItem(getLocalStorageKeySuppliers());
      setCostData(storedSuppliers ? JSON.parse(storedSuppliers) : [initialSupplierRow() as CostEntry]);

      const storedDailyCoeffs = localStorage.getItem(getLocalStorageKeyDailyCoeffs());
      const daysInMonth = dfnsGetDaysInMonth(new Date(parseInt(selectedYear), parseInt(selectedMonth)));
      
      if (storedDailyCoeffs) {
        const parsedCoeffs: DailyCoefficientEntry[] = JSON.parse(storedDailyCoeffs);
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
      setCostData([initialSupplierRow() as CostEntry]);
      const daysInMonth = dfnsGetDaysInMonth(new Date(parseInt(selectedYear), parseInt(selectedMonth)));
      setDailyCoeffData(Array.from({ length: daysInMonth }, (_, i) => initialDailyCoefficientEntry(i + 1)));
      toast({ title: "Erreur de chargement", description: "Données corrompues, réinitialisation.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [selectedMonth, selectedYear, getLocalStorageKeySuppliers, getLocalStorageKeyDailyCoeffs, toast]);

  useEffect(() => {
    if (!isLoading && costData.length > 0) {
      localStorage.setItem(getLocalStorageKeySuppliers(), JSON.stringify(costData));
    } else if (!isLoading && costData.length === 0) {
       localStorage.removeItem(getLocalStorageKeySuppliers());
    }
  }, [costData, getLocalStorageKeySuppliers, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(getLocalStorageKeyDailyCoeffs(), JSON.stringify(dailyCoeffData));
    }
  }, [dailyCoeffData, getLocalStorageKeyDailyCoeffs, isLoading]);

  const handleSupplierInputChange = (rowIndex: number, fieldName: keyof CostEntry, value: string | number) => {
    setCostData(prevData =>
      prevData.map((row, index) => {
        if (index === rowIndex) {
          let processedValue = typeof (initialSupplierRow() as any)[fieldName] === 'number'
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
    if (costData.length <= 1) {
        toast({ title: "Action impossible", description: "Au moins une ligne fournisseur doit être conservée.", variant: "default" });
        return;
    }
    setCostData(prevData => prevData.filter(row => row.id !== rowId));
    toast({ title: "Ligne Fournisseur Supprimée" });
  };

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
    toast({ title: "PDF Non Fonctionnel", description: "La génération PDF pour cette structure de coût de revient n'est pas encore implémentée.", variant: "default" });
  };

  const daysInMonthArray = useMemo(() => {
    const year = parseInt(selectedYear, 10);
    const monthIndex = parseInt(selectedMonth, 10);
    const numDays = dfnsGetDaysInMonth(new Date(year, monthIndex));
    return Array.from({ length: numDays }, (_, i) => {
      const date = new Date(year, monthIndex, i + 1);
      return {
        dayNumber: i + 1,
        dayName: format(date, 'EEEE', { locale: fr }),
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
      };
    });
  }, [selectedYear, selectedMonth]);

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
            Générer PDF Coût Revient (Obsolète)
        </Button>
      </div>

      {/* Tableau des Fournisseurs */}
      <Card>
        <CardHeader>
          <CardTitle>Données Fournisseurs</CardTitle>
          <CardDescription>Entrez les informations financières pour chaque fournisseur.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="min-w-[200px]">Fournisseur</TableHead>
                <TableHead className="min-w-[100px] text-right">HT (€)</TableHead>
                <TableHead className="min-w-[100px] text-right">TVA (€)</TableHead>
                <TableHead className="min-w-[100px] text-right">Avoir (€)</TableHead>
                <TableHead className="min-w-[100px] text-center">Action</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {costData.map((row, rowIndex) => (
                  <TableRow key={row.id || `supplier_new_${rowIndex}`}>
                    <TableCell className="p-1"><Input type="text" value={row.fournisseur} onChange={e => handleSupplierInputChange(rowIndex, 'fournisseur', e.target.value)} className="text-xs p-1 h-8" /></TableCell>
                    <TableCell className="p-1"><Input type="number" value={row.ht} onChange={e => handleSupplierInputChange(rowIndex, 'ht', e.target.value)} className="text-xs p-1 h-8 text-right" /></TableCell>
                    <TableCell className="p-1"><Input type="number" value={row.tva} onChange={e => handleSupplierInputChange(rowIndex, 'tva', e.target.value)} className="text-xs p-1 h-8 text-right" /></TableCell>
                    <TableCell className="p-1"><Input type="number" value={row.avoir} onChange={e => handleSupplierInputChange(rowIndex, 'avoir', e.target.value)} className="text-xs p-1 h-8 text-right" /></TableCell>
                    <TableCell className="text-center p-1">
                      <Button variant="destructive" size="icon" onClick={() => handleDeleteSupplierRow(row.id)} className="h-8 w-8" disabled={costData.length <= 1}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter><TableRow className="font-bold bg-muted/80">
                <TableCell>Total Fournisseurs</TableCell>
                <TableCell className="text-right">{supplierTotals.totalHt.toFixed(2)}</TableCell>
                <TableCell className="text-right">{supplierTotals.totalTva.toFixed(2)}</TableCell>
                <TableCell className="text-right">{supplierTotals.totalAvoir.toFixed(2)}</TableCell>
                <TableCell></TableCell>
              </TableRow></TableFooter>
            </Table>
          </div>
          <Button onClick={handleAddSupplierRow} className="mt-4"><PlusCircle className="mr-2 h-4 w-4" /> Ajouter Ligne Fournisseur</Button>
        </CardContent>
      </Card>


      {/* Tableau des Coefficients Journaliers */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Coefficients Journaliers (IMP, SAJ, PN, etc.)</CardTitle>
          <CardDescription>Saisissez les coefficients pour chaque jour du mois.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto border rounded-md">
            <Table className="min-w-[1200px]">
              <TableHeader><TableRow>
                <TableHead className="w-[60px]">Jour</TableHead>
                <TableHead className="min-w-[70px] text-center">IMP</TableHead>
                <TableHead className="min-w-[70px] text-center">SAJ</TableHead>
                <TableHead className="min-w-[70px] text-center">IME</TableHead>
                <TableHead className="min-w-[70px] text-center">ESAT</TableHead>
                <TableHead className="min-w-[70px] text-center">Repas ++</TableHead>
                <TableHead className="min-w-[70px] text-center">Nous</TableHead>
                <TableHead className="min-w-[80px] text-center font-semibold bg-blue-100 dark:bg-blue-800/30">Total (Coeff)</TableHead>
                <TableHead className="min-w-[70px] text-center">PN</TableHead>
                <TableHead className="min-w-[70px] text-center">PN ESAT</TableHead>
                <TableHead className="min-w-[80px] text-center font-semibold bg-green-100 dark:bg-green-800/30">Total (PN)</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {dailyCoeffData.map((entry, dayIndex) => (
                  <TableRow key={entry.day}>
                    <TableCell className="font-medium text-center">{entry.day}</TableCell>
                    {(['imp', 'saj', 'ime', 'esat', 'repasPlus', 'nous', 'pn', 'pnEsat'] as const).map(field => (
                      <TableCell key={field} className="p-1">
                        <Input type="number" value={entry[field]} onChange={e => handleDailyCoeffInputChange(dayIndex, field, e.target.value)} className="text-xs p-1 h-8 text-center" placeholder="0" />
                      </TableCell>
                    ))}
                    <TableCell className="text-center font-semibold bg-blue-100 dark:bg-blue-800/30">{dailyCoeffTotals.totalCoeffJour[dayIndex].toFixed(2)}</TableCell>
                    <TableCell className="text-center font-semibold bg-green-100 dark:bg-green-800/30">{dailyCoeffTotals.totalPnJour[dayIndex].toFixed(0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter><TableRow className="font-bold bg-muted/80">
                <TableCell>Total Mois</TableCell>
                {(['imp', 'saj', 'ime', 'esat', 'repasPlus', 'nous'] as const).map(field => (
                  <TableCell key={`total-${field}`} className="text-center">
                    {dailyCoeffTotals[field].toFixed(2)}
                  </TableCell>
                ))}
                <TableCell className="text-center font-semibold bg-blue-100 dark:bg-blue-800/30">
                  {(dailyCoeffTotals.imp + dailyCoeffTotals.saj + dailyCoeffTotals.ime + dailyCoeffTotals.esat + dailyCoeffTotals.repasPlus + dailyCoeffTotals.nous).toFixed(2)}
                </TableCell>
                {(['pn', 'pnEsat'] as const).map(field => (
                  <TableCell key={`total-${field}`} className="text-center">
                    {dailyCoeffTotals[field].toFixed(0)}
                  </TableCell>
                ))}
                 <TableCell className="text-center font-semibold bg-green-100 dark:bg-green-800/30">
                  {(dailyCoeffTotals.pn + dailyCoeffTotals.pnEsat).toFixed(0)}
                </TableCell>
              </TableRow></TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Prix de Revient du Mois */}
      <Card className="mt-8">
        <CardHeader>
            <CardTitle>Calcul du Prix de Revient Mensuel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div><span className="font-medium">Coût Matière Première (Total HT - Total Avoir):</span> <span className="font-semibold">{(supplierTotals.totalHt - supplierTotals.totalAvoir).toFixed(2)} €</span></div>
                <div><span className="font-medium">Total Coûts Variables Directs (Σ IMP à Nous):</span> <span className="font-semibold">{(dailyCoeffTotals.imp + dailyCoeffTotals.saj + dailyCoeffTotals.ime + dailyCoeffTotals.esat + dailyCoeffTotals.repasPlus + dailyCoeffTotals.nous).toFixed(2)}</span></div>
                <div><span className="font-medium">Quantité Totale (Σ PN + PN ESAT):</span> <span className="font-semibold">{(dailyCoeffTotals.pn + dailyCoeffTotals.pnEsat).toFixed(0)}</span></div>
            </div>
            <div className="mt-4 pt-4 border-t">
                <Label className="text-lg font-semibold">Prix de Revient du Mois :</Label>
                <span className="text-2xl font-bold ml-2 text-primary">{prixDeRevientMensuel.toFixed(2)} €</span>
                <p className="text-xs text-muted-foreground mt-1">
                    Calculé comme : (Coût Matière Première + Total Coûts Variables Directs) / Quantité Totale.
                </p>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}

    
    
