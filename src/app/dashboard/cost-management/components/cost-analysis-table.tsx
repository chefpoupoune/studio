
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { CostEntry, CostEntryData, DayKey } from '../types';
import { months, years, currentYear, calculateRowTotal, calculateRowEffectif } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { PlusCircle, Trash2, FileText, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const initialRowData = (): CostEntryData => ({
  fournisseur: '', ht: 0, tva: 0, avoir: 0,
  day1: "", day2: "", day3: "", day4: "", day5: "", day6: "", day7: "", day8: "", day9: "", day10: "",
  day11: "", day12: "", day13: "", day14: "", day15: "", day16: "", day17: "", day18: "", day19: "", day20: "",
  day21: "", day22: "", day23: "", day24: "", day25: "", day26: "", day27: "", day28: "", day29: "", day30: "", day31: "",
  imp: 0, saj: 0, ime: 0, esat: 0, repasPlus: 0, nous: 0, pn: 0, pnEsat: 0,
});

const dayKeys = Array.from({ length: 31 }, (_, i) => `day${i + 1}` as DayKey);

export default function CostAnalysisTable() {
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [costData, setCostData] = useState<CostEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const getLocalStorageKey = useCallback(() => `cost_analysis_${selectedYear}_${selectedMonth}`, [selectedYear, selectedMonth]);

  useEffect(() => {
    setIsLoading(true);
    try {
      const storedData = localStorage.getItem(getLocalStorageKey());
      if (storedData) {
        setCostData(JSON.parse(storedData));
      } else {
        setCostData([]);
      }
    } catch (error) {
      console.error("Error loading data from localStorage:", error);
      setCostData([]);
      toast({ title: "Erreur de chargement", description: "Données corrompues, réinitialisation.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [selectedMonth, selectedYear, getLocalStorageKey, toast]);

  useEffect(() => {
    if (!isLoading) { // Avoid saving while initially loading
        localStorage.setItem(getLocalStorageKey(), JSON.stringify(costData));
    }
  }, [costData, getLocalStorageKey, isLoading]);

  const handleInputChange = (rowIndex: number, fieldName: keyof CostEntryData | DayKey, value: string | number) => {
    setCostData(prevData =>
      prevData.map((row, index) => {
        if (index === rowIndex) {
          const newValue = (typeof row[fieldName as keyof CostEntry] === 'number' && fieldName !== 'fournisseur' && !dayKeys.includes(fieldName as DayKey))
            ? parseFloat(value as string) || 0
            : (dayKeys.includes(fieldName as DayKey) && value === "") ? "" : (dayKeys.includes(fieldName as DayKey) ? parseFloat(value as string) || 0 : value);
          return { ...row, [fieldName]: newValue };
        }
        return row;
      })
    );
  };

  const handleAddRow = () => {
    setCostData(prevData => [...prevData, { ...initialRowData(), id: `cost_${Date.now()}` }]);
  };

  const handleDeleteRow = (rowId: string) => {
    setCostData(prevData => prevData.filter(row => row.id !== rowId));
    toast({ title: "Ligne Supprimée", description: "La ligne a été retirée du tableau." });
  };

  const totals = useMemo(() => {
    let totalHt = 0;
    let totalTva = 0;
    let totalAvoir = 0;
    let totalEffectifSum = 0;

    costData.forEach(row => {
      totalHt += row.ht || 0;
      totalTva += row.tva || 0;
      totalAvoir += row.avoir || 0;
      const rowTotal = calculateRowTotal(row);
      totalEffectifSum += calculateRowEffectif(row, rowTotal);
    });

    const prixDeRevient = totalEffectifSum !== 0 ? (totalHt - totalAvoir) / totalEffectifSum : 0;

    return { totalHt, totalTva, totalAvoir, totalEffectifSum, prixDeRevient };
  }, [costData]);

  const generatePdf = () => {
    setIsLoading(true);
    try {
      const doc = new jsPDF('landscape') as jsPDFWithAutoTable;
      const monthLabel = months.find(m => m.value === selectedMonth)?.label || '';
      const title = `Coût de Revient - ${monthLabel} ${selectedYear}`;
      
      doc.setFontSize(18);
      doc.text(title, 14, 20);
      doc.setFontSize(10);
      doc.text(`Généré le: ${format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}`, 14, 28);

      const head = [
        ['Fournisseur', 'HT', 'TVA', 'Avoir', ...dayKeys.map(d => d.substring(3)), 
         'IMP', 'SAJ', 'IME', 'ESAT', 'Repas+++', 'Nous', 'Total Ligne', 'PN', 'PN ESAT', 'Effectif Ligne']
      ];
      
      const body = costData.map(row => {
        const rowTotal = calculateRowTotal(row);
        const rowEffectif = calculateRowEffectif(row, rowTotal);
        return [
          row.fournisseur, row.ht, row.tva, row.avoir, 
          ...dayKeys.map(key => row[key] ?? ''),
          row.imp, row.saj, row.ime, row.esat, row.repasPlus, row.nous, 
          rowTotal.toFixed(2), row.pn, row.pnEsat, rowEffectif.toFixed(2)
        ];
      });

      // Add summary rows to body to be styled by autoTable
      body.push([
        { content: 'TOTALS', colSpan: 1, styles: { fontStyle: 'bold', halign: 'right' } },
        { content: totals.totalHt.toFixed(2), styles: { fontStyle: 'bold' } },
        { content: totals.totalTva.toFixed(2), styles: { fontStyle: 'bold' } },
        { content: totals.totalAvoir.toFixed(2), styles: { fontStyle: 'bold' } },
        ...Array(31 + 6).fill(''), // empty cells for day columns + IMP to Nous
        { content: '', styles: { fontStyle: 'bold'} }, // Total Ligne sum
        { content: '', styles: { fontStyle: 'bold'} }, // PN sum
        { content: '', styles: { fontStyle: 'bold'} }, // PN ESAT sum
        { content: totals.totalEffectifSum.toFixed(2), styles: { fontStyle: 'bold' } }
      ]);
      body.push([
        { content: 'Prix de Revient', colSpan: head[0].length -1 , styles: { fontStyle: 'bold', halign: 'right' } },
        { content: totals.prixDeRevient.toFixed(2), styles: { fontStyle: 'bold' } }
      ]);


      doc.autoTable({
        head: head,
        body: body,
        startY: 35,
        theme: 'grid',
        headStyles: { fillColor: [50, 50, 50], textColor: [255,255,255] }, // Kept for PDF specific styling
        styles: { fontSize: 5, cellPadding: 1 }, 
        columnStyles: {
            0: { cellWidth: 30 }, 
        },
        didDrawPage: (data) => {
          const pageCount = doc.getNumberOfPages();
          doc.setFontSize(8);
          doc.text(`Page ${data.pageNumber} sur ${pageCount}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
        }
      });

      doc.save(`cout_de_revient_${monthLabel}_${selectedYear}.pdf`);
      toast({ title: "PDF Généré", description: "Le fichier PDF du coût de revient a été téléchargé." });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Erreur PDF", description: "La génération du PDF a échoué.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };
  
  const getColumnClass = (header: string) => {
    const grayCols = ['Fournisseur', 'HT', 'TVA', 'Avoir', 'Total', 'Effectif'];
    const orangeCols = ['IMP', 'SAJ', 'IME', 'ESAT', 'Repas +++', 'Nous', 'PN', 'PN ESAT']; // Note: 'Repas +++'
    if (grayCols.includes(header)) return 'bg-muted text-muted-foreground';
    if (orangeCols.includes(header)) return 'bg-accent/30 text-accent-foreground';
    // Check if header is a number string for day columns
    const dayNumber = parseInt(header, 10);
    if (!isNaN(dayNumber) && dayNumber >= 1 && dayNumber <= 31) return 'bg-primary/20 text-primary-foreground';
    return 'bg-card'; // Default background for headers like "Jours du Mois"
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

      <Button onClick={handleAddRow}><PlusCircle className="mr-2 h-4 w-4" /> Ajouter une ligne</Button>

      {isLoading ? (
        <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin" /> Chargement...</div>
      ) : (
      <div className="overflow-x-auto border rounded-md">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              <TableHead rowSpan={2} className={cn("sticky left-0 z-10", getColumnClass('Fournisseur'))}>Fournisseur</TableHead>
              {['HT', 'TVA', 'Avoir'].map(h => <TableHead rowSpan={2} key={h} className={getColumnClass(h)}>{h}</TableHead>)}
              
              <TableHead colSpan={31} className={cn("text-center", getColumnClass('1'))}> {/* '1' to get day column style */}
                Jours du Mois
              </TableHead>
              
              {['IMP', 'SAJ', 'IME', 'ESAT', 'Repas +++', 'Nous'].map(h => <TableHead rowSpan={2} key={h} className={getColumnClass(h)}>{h.replace('+++', ' +++')}</TableHead>)}
              <TableHead rowSpan={2} className={getColumnClass('Total')}>Total</TableHead>
              {['PN', 'PN ESAT'].map(h => <TableHead rowSpan={2} key={h} className={getColumnClass(h)}>{h}</TableHead>)}
              <TableHead rowSpan={2} className={getColumnClass('Effectif')}>Effectif</TableHead>
              <TableHead rowSpan={2} className="bg-card">Action</TableHead>
            </TableRow>
            <TableRow>
              {/* Individual day headers */}
              {dayKeys.map((dayKey, i) => <TableHead key={dayKey} className={cn("text-center", getColumnClass((i+1).toString()))}>{i + 1}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {costData.map((row, rowIndex) => {
              const rowTotal = calculateRowTotal(row);
              const rowEffectif = calculateRowEffectif(row, rowTotal);
              return (
                <TableRow key={row.id}>
                  <TableCell className={cn("sticky left-0 z-10", getColumnClass('Fournisseur'))}>
                    <Input type="text" value={row.fournisseur} onChange={e => handleInputChange(rowIndex, 'fournisseur', e.target.value)} className="w-32 text-xs p-1 bg-background" />
                  </TableCell>
                  {(['ht', 'tva', 'avoir'] as const).map(field => (
                    <TableCell key={field} className={getColumnClass(field.toUpperCase())}>
                      <Input type="number" value={row[field]} onChange={e => handleInputChange(rowIndex, field, e.target.value)} className="w-20 text-xs p-1 bg-background" />
                    </TableCell>
                  ))}
                  {dayKeys.map((dayKey, i) => (
                     <TableCell key={dayKey} className={getColumnClass((i+1).toString())}>
                        <Input type="number" value={row[dayKey]} onChange={e => handleInputChange(rowIndex, dayKey, e.target.value)} className="w-12 text-xs p-1 bg-background" placeholder="0"/>
                     </TableCell>
                  ))}
                  {(['imp', 'saj', 'ime', 'esat', 'repasPlus', 'nous'] as const).map(field => (
                    <TableCell key={field} className={getColumnClass(field.toUpperCase().replace('REPASPLUS', 'Repas +++'))}> {/* Ensure correct key for Repas +++ */}
                      <Input type="number" value={row[field]} onChange={e => handleInputChange(rowIndex, field, e.target.value)} className="w-20 text-xs p-1 bg-background" />
                    </TableCell>
                  ))}
                  <TableCell className={getColumnClass('Total')}>{rowTotal.toFixed(2)}</TableCell>
                  {(['pn', 'pnEsat'] as const).map(field => (
                    <TableCell key={field} className={getColumnClass(field.toUpperCase())}>
                      <Input type="number" value={row[field]} onChange={e => handleInputChange(rowIndex, field, e.target.value)} className="w-20 text-xs p-1 bg-background" />
                    </TableCell>
                  ))}
                  <TableCell className={getColumnClass('Effectif')}>{rowEffectif.toFixed(2)}</TableCell>
                  <TableCell className="bg-card">
                    <Button variant="destructive" size="icon" onClick={() => handleDeleteRow(row.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow className="font-bold bg-muted/80">
              <TableCell className={cn("sticky left-0 z-10", getColumnClass('Fournisseur'))}>Totaux</TableCell>
              <TableCell className={getColumnClass('HT')}>{totals.totalHt.toFixed(2)}</TableCell>
              <TableCell className={getColumnClass('TVA')}>{totals.totalTva.toFixed(2)}</TableCell>
              <TableCell className={getColumnClass('Avoir')}>{totals.totalAvoir.toFixed(2)}</TableCell>
              <TableCell colSpan={31 + 6} className={getColumnClass('1')}></TableCell> {/* Placeholder for day columns & IMP to Nous */}
              <TableCell className={getColumnClass('Total')}></TableCell> {/* Total Col */}
              <TableCell className={getColumnClass('PN')}></TableCell>
              <TableCell className={getColumnClass('PN ESAT')}></TableCell> {/* PN, PN ESAT Cols */}
              <TableCell className={getColumnClass('Effectif')}>{totals.totalEffectifSum.toFixed(2)}</TableCell>
              <TableCell className="bg-card"></TableCell> {/* Action Col */}
            </TableRow>
            <TableRow className="font-bold bg-muted/90">
              <TableCell colSpan={ (1 + 3 + 31 + 6 + 1 + 2)} className={cn("text-right", getColumnClass('Effectif'))}>Prix de Revient</TableCell> {/* Sum of all columns before Effectif */}
              <TableCell className={getColumnClass('Effectif')}>{totals.prixDeRevient.toFixed(2)}</TableCell>
              <TableCell className="bg-card"></TableCell> {/* Action Col */}
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      )}
      {costData.length > 0 && (
        <Button onClick={generatePdf} disabled={isLoading} className="mt-4">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
          Générer PDF Coût de Revient
        </Button>
      )}
       {!isLoading && costData.length === 0 && (
         <p className="text-muted-foreground text-center py-8">Aucune donnée pour ce mois. Cliquez sur "Ajouter une ligne" pour commencer.</p>
      )}
    </div>
  );
}
