
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
        ['Fournisseur', 'HT', 'TVA', 'Avoir', 'Jour', 'Valeur',
         'IMP', 'SAJ', 'IME', 'ESAT', 'Repas+++', 'Nous', 
         'Total Ligne', 'PN', 'PN ESAT', 'Effectif Ligne']
      ];
      
      const pdfBody: any[] = [];
      costData.forEach(row => {
        const rowTotal = calculateRowTotal(row);
        const rowEffectif = calculateRowEffectif(row, rowTotal);
        dayKeys.forEach((dayKey, dayIndex) => {
          const dayRowEntry: any[] = [];
          if (dayIndex === 0) {
            dayRowEntry.push({ content: row.fournisseur, rowSpan: dayKeys.length });
            dayRowEntry.push({ content: row.ht.toFixed(2), rowSpan: dayKeys.length });
            dayRowEntry.push({ content: row.tva.toFixed(2), rowSpan: dayKeys.length });
            dayRowEntry.push({ content: row.avoir.toFixed(2), rowSpan: dayKeys.length });
          }
          
          dayRowEntry.push(dayIndex + 1); // Jour
          dayRowEntry.push(row[dayKey] === "" ? "" : Number(row[dayKey]).toFixed(2)); // Valeur

          if (dayIndex === 0) {
            dayRowEntry.push({ content: row.imp.toFixed(2), rowSpan: dayKeys.length });
            dayRowEntry.push({ content: row.saj.toFixed(2), rowSpan: dayKeys.length });
            dayRowEntry.push({ content: row.ime.toFixed(2), rowSpan: dayKeys.length });
            dayRowEntry.push({ content: row.esat.toFixed(2), rowSpan: dayKeys.length });
            dayRowEntry.push({ content: row.repasPlus.toFixed(2), rowSpan: dayKeys.length });
            dayRowEntry.push({ content: row.nous.toFixed(2), rowSpan: dayKeys.length });
            dayRowEntry.push({ content: rowTotal.toFixed(2), rowSpan: dayKeys.length });
            dayRowEntry.push({ content: row.pn.toFixed(2), rowSpan: dayKeys.length });
            dayRowEntry.push({ content: row.pnEsat.toFixed(2), rowSpan: dayKeys.length });
            dayRowEntry.push({ content: rowEffectif.toFixed(2), rowSpan: dayKeys.length });
          }
          pdfBody.push(dayRowEntry);
        });
      });
      
      const pdfFooter = [
        [
          { content: 'TOTALS', styles: { fontStyle: 'bold' } },
          { content: totals.totalHt.toFixed(2), styles: { fontStyle: 'bold' } },
          { content: totals.totalTva.toFixed(2), styles: { fontStyle: 'bold' } },
          { content: totals.totalAvoir.toFixed(2), styles: { fontStyle: 'bold' } },
          { content: '', colSpan: 2 }, // Jour, Valeur
          { content: '', colSpan: 6 }, // IMP to Nous
          { content: '' }, // Total Ligne
          { content: '', colSpan: 2 }, // PN, PN ESAT
          { content: totals.totalEffectifSum.toFixed(2), styles: { fontStyle: 'bold' } }
        ],
        [
          { content: 'Prix de Revient', colSpan: 15, styles: { fontStyle: 'bold', halign: 'right' } },
          { content: totals.prixDeRevient.toFixed(2), styles: { fontStyle: 'bold' } }
        ]
      ];

      doc.autoTable({
        head: head,
        body: pdfBody,
        foot: pdfFooter,
        startY: 35,
        theme: 'grid',
        headStyles: { fillColor: [50, 50, 50], textColor: [255,255,255] }, 
        styles: { fontSize: 7, cellPadding: 1.5 }, 
        columnStyles: {
            0: { cellWidth: 30 }, // Fournisseur
            // Adjust other column widths as needed
            1: { cellWidth: 15 }, // HT
            2: { cellWidth: 15 }, // TVA
            3: { cellWidth: 15 }, // Avoir
            4: { cellWidth: 10, halign: 'center' }, // Jour
            5: { cellWidth: 15, halign: 'right' }, // Valeur
            // IMP to Nous (6 columns)
            6: { cellWidth: 15, halign: 'right' }, 7: { cellWidth: 15, halign: 'right' }, 8: { cellWidth: 15, halign: 'right' },
            9: { cellWidth: 15, halign: 'right' }, 10: { cellWidth: 15, halign: 'right' }, 11: { cellWidth: 15, halign: 'right' },
            12: { cellWidth: 18, halign: 'right' }, // Total Ligne
            // PN, PN ESAT
            13: { cellWidth: 15, halign: 'right' }, 14: { cellWidth: 15, halign: 'right' },
            15: { cellWidth: 18, halign: 'right' }, // Effectif Ligne
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
  
  const getColumnClass = (header: string, isHeader: boolean = true) => {
    const grayCols = ['Fournisseur', 'HT', 'TVA', 'Avoir', 'Total', 'Effectif'];
    const orangeCols = ['IMP', 'SAJ', 'IME', 'ESAT', 'Repas +++', 'Nous', 'PN', 'PN ESAT'];
    
    if (isHeader) { // Header specific styles
      if (['Jour', 'Valeur'].includes(header)) return 'bg-primary/40 text-primary-foreground text-center font-semibold py-1';
      if (grayCols.includes(header)) return 'bg-muted text-muted-foreground';
      if (orangeCols.includes(header)) return 'bg-accent/30 text-accent-foreground';
      return 'bg-card text-card-foreground';
    } else { // Cell specific styles
      if (['Jour'].includes(header)) return 'bg-primary/10 text-center p-1';
      if (['Valeur'].includes(header)) return 'bg-primary/10 p-0.5';
      if (grayCols.includes(header)) return 'bg-muted text-muted-foreground';
      if (orangeCols.includes(header)) return 'bg-accent/30 text-accent-foreground';
      return 'bg-card text-card-foreground';
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

      <Button onClick={handleAddRow}><PlusCircle className="mr-2 h-4 w-4" /> Ajouter une ligne de fournisseur</Button>

      {isLoading ? (
        <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin" /> Chargement...</div>
      ) : (
      <div className="overflow-x-auto border rounded-md">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow>
              <TableHead className={cn("sticky left-0 z-10", getColumnClass('Fournisseur'))}>Fournisseur</TableHead>
              {['HT', 'TVA', 'Avoir'].map(h => <TableHead key={h} className={getColumnClass(h)}>{h}</TableHead>)}
              <TableHead className={getColumnClass('Jour')}>Jour</TableHead>
              <TableHead className={getColumnClass('Valeur')}>Valeur</TableHead>
              {['IMP', 'SAJ', 'IME', 'ESAT', 'Repas +++', 'Nous'].map(h => <TableHead key={h} className={getColumnClass(h.replace('+++', ' +++'))}>{h.replace('+++', ' +++')}</TableHead>)}
              <TableHead className={getColumnClass('Total')}>Total</TableHead>
              {['PN', 'PN ESAT'].map(h => <TableHead key={h} className={getColumnClass(h)}>{h}</TableHead>)}
              <TableHead className={getColumnClass('Effectif')}>Effectif</TableHead>
              <TableHead className="bg-card">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {costData.map((row, rowIndex) => (
              <React.Fragment key={row.id}>
                {dayKeys.map((dayKey, dayIndex) => {
                  const rowTotal = calculateRowTotal(row);
                  const rowEffectif = calculateRowEffectif(row, rowTotal);
                  return (
                  <TableRow key={`${row.id}-${dayKey}`}>
                    {dayIndex === 0 && (
                      <>
                        <TableCell rowSpan={dayKeys.length} className={cn("sticky left-0 z-10 align-top", getColumnClass('Fournisseur', false))}>
                          <Input type="text" value={row.fournisseur} onChange={e => handleInputChange(rowIndex, 'fournisseur', e.target.value)} className="w-32 text-xs p-1 bg-background" />
                        </TableCell>
                        {(['ht', 'tva', 'avoir'] as const).map(field => (
                          <TableCell rowSpan={dayKeys.length} key={field} className={cn("align-top", getColumnClass(field.toUpperCase(), false))}>
                            <Input type="number" value={row[field]} onChange={e => handleInputChange(rowIndex, field, e.target.value)} className="w-20 text-xs p-1 bg-background" />
                          </TableCell>
                        ))}
                      </>
                    )}
                    <TableCell className={getColumnClass('Jour', false)}>{dayIndex + 1}</TableCell>
                    <TableCell className={getColumnClass('Valeur', false)}>
                        <Input 
                            type="number" 
                            value={row[dayKey]} 
                            onChange={e => handleInputChange(rowIndex, dayKey, e.target.value)} 
                            className="w-16 h-8 text-xs p-1 bg-background text-center" 
                            placeholder="0"
                        />
                    </TableCell>
                    {dayIndex === 0 && (
                      <>
                        {(['imp', 'saj', 'ime', 'esat', 'repasPlus', 'nous'] as const).map(field => (
                          <TableCell rowSpan={dayKeys.length} key={field} className={cn("align-top", getColumnClass(field.toUpperCase().replace('REPASPLUS', 'Repas +++'), false))}>
                            <Input type="number" value={row[field]} onChange={e => handleInputChange(rowIndex, field, e.target.value)} className="w-20 text-xs p-1 bg-background" />
                          </TableCell>
                        ))}
                        <TableCell rowSpan={dayKeys.length} className={cn("align-top", getColumnClass('Total', false))}>{rowTotal.toFixed(2)}</TableCell>
                        {(['pn', 'pnEsat'] as const).map(field => (
                          <TableCell rowSpan={dayKeys.length} key={field} className={cn("align-top", getColumnClass(field.toUpperCase(), false))}>
                            <Input type="number" value={row[field]} onChange={e => handleInputChange(rowIndex, field, e.target.value)} className="w-20 text-xs p-1 bg-background" />
                          </TableCell>
                        ))}
                        <TableCell rowSpan={dayKeys.length} className={cn("align-top", getColumnClass('Effectif', false))}>{rowEffectif.toFixed(2)}</TableCell>
                        <TableCell rowSpan={dayKeys.length} className={cn("align-top", getColumnClass('Action', false))}>
                          <Button variant="destructive" size="icon" onClick={() => handleDeleteRow(row.id)}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                )})}
              </React.Fragment>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="font-bold bg-muted/80">
              <TableCell className={cn("sticky left-0 z-10", getColumnClass('Fournisseur'))}>Totaux</TableCell>
              <TableCell className={getColumnClass('HT')}>{totals.totalHt.toFixed(2)}</TableCell>
              <TableCell className={getColumnClass('TVA')}>{totals.totalTva.toFixed(2)}</TableCell>
              <TableCell className={getColumnClass('Avoir')}>{totals.totalAvoir.toFixed(2)}</TableCell>
              <TableCell colSpan={2} className={getColumnClass('Jour', false)}></TableCell> {/* Placeholder for Jour, Valeur */}
              <TableCell colSpan={6} className={getColumnClass('IMP', false)}></TableCell> {/* Placeholder for IMP group */}
              <TableCell className={getColumnClass('Total')}></TableCell> 
              <TableCell colSpan={2} className={getColumnClass('PN')}></TableCell> {/* Placeholder for PN, PN ESAT */}
              <TableCell className={getColumnClass('Effectif')}>{totals.totalEffectifSum.toFixed(2)}</TableCell>
              <TableCell className={getColumnClass('Action', false)}></TableCell> 
            </TableRow>
            <TableRow className="font-bold bg-muted/90">
              <TableCell colSpan={15} className={cn("text-right", getColumnClass('Effectif'))}>Prix de Revient</TableCell> 
              <TableCell className={getColumnClass('Effectif')}>{totals.prixDeRevient.toFixed(2)}</TableCell>
              <TableCell className={getColumnClass('Action', false)}></TableCell> 
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

