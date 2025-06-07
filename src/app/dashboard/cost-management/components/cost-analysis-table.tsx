
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2, FileText, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, getDaysInMonth as dfnsGetDaysInMonth, startOfMonth as dfnsStartOfMonth, addDays as dfnsAddDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import type { CostEntry } from '../types';
import { months, years, currentYear, calculateRowTotal, calculateRowEffectif } from '../types';
import { ScrollArea } from '@/components/ui/scroll-area';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const initialRowDataForSupplier = (): Omit<CostEntry, 'id'> => ({
  fournisseur: '', ht: 0, tva: 0, avoir: 0,
  imp: 0, saj: 0, ime: 0, esat: 0, repasPlus: 0, nous: 0,
  pn: 0, pnEsat: 0,
});

interface DayInfo {
  date: string; // YYYY-MM-DD
  dayOfMonth: number;
  dayName: string;
  isWeekend: boolean;
}

function getMonthDaysCalendar(year: number, month: number): DayInfo[] {
  const daysInMonth = dfnsGetDaysInMonth(new Date(year, month));
  const firstDay = dfnsStartOfMonth(new Date(year, month));
  const daysArray: DayInfo[] = [];

  for (let i = 0; i < daysInMonth; i++) {
    const currentDate = dfnsAddDays(firstDay, i);
    const dayOfWeek = currentDate.getDay();
    daysArray.push({
      date: format(currentDate, 'yyyy-MM-dd'),
      dayOfMonth: i + 1,
      dayName: format(currentDate, 'EEEE', { locale: fr }),
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    });
  }
  return daysArray;
}

interface DailyGlobalQuantity {
  day: number;
  quantity: number | "";
}

export default function CostAnalysisTable() {
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [costData, setCostData] = useState<CostEntry[]>([]);
  const [dailyGlobalQuantities, setDailyGlobalQuantities] = useState<DailyGlobalQuantity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [monthlyCalendarDays, setMonthlyCalendarDays] = useState<DayInfo[]>([]);

  const getLocalStorageKeySuppliers = useCallback(() => `cost_analysis_data_suppliers_v4_${selectedYear}_${selectedMonth}`, [selectedYear, selectedMonth]);
  const getLocalStorageKeyDailyQuantities = useCallback(() => `cost_analysis_daily_quantities_v1_${selectedYear}_${selectedMonth}`, [selectedYear, selectedMonth]);

  useEffect(() => {
    const yearNum = parseInt(selectedYear, 10);
    const monthNum = parseInt(selectedMonth, 10);
    const calendarDays = getMonthDaysCalendar(yearNum, monthNum);
    setMonthlyCalendarDays(calendarDays);

    // Initialize dailyGlobalQuantities for the new month/year
    const initialQuantities = calendarDays.map(day => ({
      day: day.dayOfMonth,
      quantity: "" as (number | ""),
    }));

    setIsLoading(true);
    try {
      const storedSuppliers = localStorage.getItem(getLocalStorageKeySuppliers());
      if (storedSuppliers) {
        setCostData(JSON.parse(storedSuppliers));
      } else {
        setCostData([]);
      }

      const storedDailyQuantities = localStorage.getItem(getLocalStorageKeyDailyQuantities());
      if (storedDailyQuantities) {
        const parsedQuantities = JSON.parse(storedDailyQuantities) as DailyGlobalQuantity[];
        // Ensure parsedQuantities align with current month's days
        const alignedQuantities = calendarDays.map(calDay => {
            const foundQty = parsedQuantities.find(q => q.day === calDay.dayOfMonth);
            return foundQty ? foundQty : { day: calDay.dayOfMonth, quantity: "" };
        });
        setDailyGlobalQuantities(alignedQuantities);
      } else {
        setDailyGlobalQuantities(initialQuantities);
      }

    } catch (error) {
      console.error("Error loading data from localStorage:", error);
      setCostData([]);
      setDailyGlobalQuantities(initialQuantities);
      toast({ title: "Erreur de chargement", description: "Données corrompues, réinitialisation.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [selectedMonth, selectedYear, getLocalStorageKeySuppliers, getLocalStorageKeyDailyQuantities, toast]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(getLocalStorageKeySuppliers(), JSON.stringify(costData));
    }
  }, [costData, getLocalStorageKeySuppliers, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(getLocalStorageKeyDailyQuantities(), JSON.stringify(dailyGlobalQuantities));
    }
  }, [dailyGlobalQuantities, getLocalStorageKeyDailyQuantities, isLoading]);

  const handleSupplierInputChange = (rowIndex: number, fieldName: keyof CostEntry, value: string | number) => {
    setCostData(prevData =>
      prevData.map((row, index) => {
        if (index === rowIndex) {
          let processedValue: string | number;
          const initialFieldType = typeof initialRowDataForSupplier()[fieldName as keyof Omit<CostEntry, 'id'>];
          if (initialFieldType === 'number') {
            processedValue = parseFloat(value as string) || 0;
          } else {
            processedValue = value;
          }
          return { ...row, [fieldName]: processedValue };
        }
        return row;
      })
    );
  };

  const handleDailyQuantityChange = (dayOfMonth: number, value: string) => {
    const numericValue = value === "" ? "" : parseInt(value, 10);
    if (value === "" || (!isNaN(numericValue) && numericValue >= 0)) {
      setDailyGlobalQuantities(prevQuantities =>
        prevQuantities.map(item =>
          item.day === dayOfMonth ? { ...item, quantity: numericValue } : item
        )
      );
    }
  };

  const handleAddSupplierRow = () => {
    setCostData(prevData => [...prevData, { ...initialRowDataForSupplier(), id: `cost_${Date.now()}` }]);
  };

  const handleDeleteSupplierRow = (rowId: string) => {
    setCostData(prevData => prevData.filter(row => row.id !== rowId));
    toast({ title: "Ligne Fournisseur Supprimée", description: "La ligne fournisseur a été retirée du tableau." });
  };

  const totals = useMemo(() => {
    let totalHt = 0;
    let totalTva = 0;
    let totalAvoir = 0;
    let totalEffectifCoeffSum = 0; // Sum of effectif coefficients from suppliers

    costData.forEach(row => {
      totalHt += row.ht || 0;
      totalTva += row.tva || 0;
      totalAvoir += row.avoir || 0;
      totalEffectifCoeffSum += calculateRowEffectif(row, calculateRowTotal(row));
    });

    const totalQuantitiesMonth = dailyGlobalQuantities.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const netCost = totalHt - totalAvoir;
    const prixDeRevient = totalQuantitiesMonth !== 0 ? netCost / totalQuantitiesMonth : 0;

    return { totalHt, totalTva, totalAvoir, totalEffectifCoeffSum, totalQuantitiesMonth, prixDeRevient };
  }, [costData, dailyGlobalQuantities]);

  const generatePdf = () => {
    setIsLoading(true);
    try {
      toast({ title: "Fonction PDF Obsolète", description: "La génération PDF pour le coût de revient mensuel doit être mise à jour pour refléter la nouvelle structure du tableau.", variant: "default", duration: 7000 });
      // PDF generation logic needs to be updated
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      toast({ title: "Erreur PDF", description: `La génération du PDF a échoué: ${error.message || 'Erreur inconnue'}.`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
        <div>
          <Label htmlFor="month-select-cost">Mois</Label>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger id="month-select-cost"><SelectValue placeholder="Mois" /></SelectTrigger>
            <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="year-select-cost">Année</Label>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger id="year-select-cost"><SelectValue placeholder="Année" /></SelectTrigger>
            <SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Section Fournisseurs et Coefficients */}
        <div className="flex-grow">
            <h3 className="text-lg font-semibold p-3 bg-muted/30 border rounded-t-md">Données Fournisseurs & Coefficients</h3>
            <div className="overflow-x-auto border border-t-0 rounded-b-md">
                <Table className="min-w-full">
                <TableHeader>
                    <TableRow>
                    <TableHead className="w-[150px] min-w-[150px] sticky left-0 z-10 bg-card">Fournisseur</TableHead>
                    <TableHead className="w-[80px] min-w-[80px]">HT (€)</TableHead>
                    <TableHead className="w-[80px] min-w-[80px]">TVA (€)</TableHead>
                    <TableHead className="w-[80px] min-w-[80px]">Avoir (€)</TableHead>
                    <TableHead className="w-[60px] min-w-[60px]">IMP</TableHead>
                    <TableHead className="w-[60px] min-w-[60px]">SAJ</TableHead>
                    <TableHead className="w-[60px] min-w-[60px]">IME</TableHead>
                    <TableHead className="w-[60px] min-w-[60px]">ESAT</TableHead>
                    <TableHead className="w-[70px] min-w-[70px]">Repas +</TableHead>
                    <TableHead className="w-[60px] min-w-[60px]">Nous</TableHead>
                    <TableHead className="w-[100px] min-w-[100px] font-semibold text-center">Total Coeff.</TableHead>
                    <TableHead className="w-[60px] min-w-[60px]">PN</TableHead>
                    <TableHead className="w-[70px] min-w-[70px]">PN ESAT</TableHead>
                    <TableHead className="w-[100px] min-w-[100px] font-semibold text-center">Effectif Coeff.</TableHead>
                    <TableHead className="w-[80px] min-w-[80px] text-center sticky right-0 z-10 bg-card">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {costData.map((row, rowIndex) => (
                    <TableRow key={row.id}>
                        <TableCell className="sticky left-0 z-10 bg-card group-hover:bg-muted/50">
                          <Input type="text" value={row.fournisseur} onChange={e => handleSupplierInputChange(rowIndex, 'fournisseur', e.target.value)} className="text-xs p-1 h-7 bg-background" />
                        </TableCell>
                        <TableCell className="p-1"><Input type="number" value={row.ht} onChange={e => handleSupplierInputChange(rowIndex, 'ht', e.target.value)} className="text-xs p-1 h-7 bg-background" /></TableCell>
                        <TableCell className="p-1"><Input type="number" value={row.tva} onChange={e => handleSupplierInputChange(rowIndex, 'tva', e.target.value)} className="text-xs p-1 h-7 bg-background" /></TableCell>
                        <TableCell className="p-1"><Input type="number" value={row.avoir} onChange={e => handleSupplierInputChange(rowIndex, 'avoir', e.target.value)} className="text-xs p-1 h-7 bg-background" /></TableCell>
                        {(['imp', 'saj', 'ime', 'esat', 'repasPlus', 'nous'] as const).map(field => (
                            <TableCell key={field} className="p-1">
                                <Input type="number" value={row[field]} onChange={e => handleSupplierInputChange(rowIndex, field, e.target.value)} className="text-xs p-1 h-7 bg-background w-14 text-center" />
                            </TableCell>
                        ))}
                        <TableCell className="font-semibold text-center align-middle">{calculateRowTotal(row).toFixed(2)}</TableCell>
                        {(['pn', 'pnEsat'] as const).map(field => (
                            <TableCell key={field} className="p-1">
                                <Input type="number" value={row[field]} onChange={e => handleSupplierInputChange(rowIndex, field, e.target.value)} className="text-xs p-1 h-7 bg-background w-14 text-center" />
                            </TableCell>
                        ))}
                        <TableCell className="font-semibold text-center align-middle">{calculateRowEffectif(row, calculateRowTotal(row)).toFixed(0)}</TableCell>
                        <TableCell className="text-center sticky right-0 z-10 bg-card group-hover:bg-muted/50">
                            <Button variant="destructive" size="icon" onClick={() => handleDeleteSupplierRow(row.id)} className="h-7 w-7"><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                <TableFooter>
                    <TableRow className="font-bold bg-muted/80">
                      <TableCell className="sticky left-0 z-10 bg-muted/80">Totaux Fournisseurs</TableCell>
                      <TableCell>{totals.totalHt.toFixed(2)}</TableCell>
                      <TableCell>{totals.totalTva.toFixed(2)}</TableCell>
                      <TableCell>{totals.totalAvoir.toFixed(2)}</TableCell>
                      <TableCell colSpan={7}></TableCell> 
                      <TableCell colSpan={2}></TableCell> 
                      <TableCell className="text-center">{totals.totalEffectifCoeffSum.toFixed(0)}</TableCell>
                      <TableCell className="sticky right-0 z-10 bg-muted/80"></TableCell>
                    </TableRow>
                     <TableRow className="font-bold bg-muted/90">
                      <TableCell colSpan={13} className="text-right sticky left-0 z-10 bg-muted/90">Total Quantités Mois (Global)</TableCell>
                      <TableCell className="text-center">{totals.totalQuantitiesMonth.toFixed(0)}</TableCell>
                      <TableCell className="sticky right-0 z-10 bg-muted/90"></TableCell>
                    </TableRow>
                    <TableRow className="font-bold bg-muted/90">
                      <TableCell colSpan={13} className="text-right sticky left-0 z-10 bg-muted/90">Prix de Revient Mensuel (€)</TableCell>
                      <TableCell className="text-center">{totals.prixDeRevient.toFixed(2)}</TableCell>
                      <TableCell className="sticky right-0 z-10 bg-muted/90"></TableCell>
                    </TableRow>
                </TableFooter>
                </Table>
            </div>
            <div className="mt-4 flex justify-between">
                <Button onClick={handleAddSupplierRow}><PlusCircle className="mr-2 h-4 w-4" /> Ajouter Fournisseur</Button>
                {costData.length > 0 && (
                    <Button onClick={generatePdf} disabled={isLoading} className="">
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                    Générer PDF (Structure Actuelle Non Prise en Charge)
                    </Button>
                )}
            </div>
            {!isLoading && costData.length === 0 && (
                <p className="text-muted-foreground text-center py-8">Aucune donnée de fournisseur pour ce mois. Cliquez sur "Ajouter Fournisseur" pour commencer.</p>
            )}
        </div>

        {/* Calendrier et Saisie des Quantités Journalières Globales */}
        <div className="lg:w-[400px] flex-shrink-0">
            <h3 className="text-lg font-semibold p-3 bg-muted/30 border rounded-t-md">Saisie des Quantités Journalières Globales</h3>
            <ScrollArea className="h-[calc(88vh-15rem)] lg:max-h-[calc(100vh-20rem)] border border-t-0 rounded-b-md">
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/2 text-center">Jour</TableHead>
                    <TableHead className="w-1/2 text-center">Quantité Globale Jour</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyCalendarDays.map((day) => {
                    const quantityEntry = dailyGlobalQuantities.find(q => q.day === day.dayOfMonth);
                    return (
                        <TableRow key={day.date} className={cn(day.isWeekend && "bg-muted/50 text-muted-foreground")}>
                        <TableCell className="text-center">
                            {day.dayOfMonth} - {day.dayName}
                        </TableCell>
                        <TableCell className="p-1">
                            <Input
                            type="number"
                            min="0"
                            value={quantityEntry?.quantity ?? ""}
                            onChange={(e) => handleDailyQuantityChange(day.dayOfMonth, e.target.value)}
                            className="h-7 text-xs text-center"
                            disabled={day.isWeekend}
                            placeholder="Qté"
                            />
                        </TableCell>
                        </TableRow>
                    );
                   })}
                </TableBody>
              </Table>
            </ScrollArea>
        </div>
      </div>
    </div>
  );
}
