
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
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';


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
    if (!isLoading) { 
        localStorage.setItem(getLocalStorageKey(), JSON.stringify(costData));
    }
  }, [costData, getLocalStorageKey, isLoading]);

  const handleInputChange = (rowIndex: number, fieldName: keyof CostEntryData, value: string | number) => {
    setCostData(prevData =>
      prevData.map((row, index) => {
        if (index === rowIndex) {
          const fieldDefinition = initialRowData()[fieldName];
          let processedValue: string | number;

          if (typeof fieldDefinition === 'number') { 
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
      const pdfSettings = getPdfLayoutSettings('monthly_cost');
      const doc = new jsPDF('landscape') as jsPDFWithAutoTable; // Default A4 landscape
      const monthLabel = months.find(m => m.value === selectedMonth)?.label || '';
      const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });

      let currentY = pdfSettings.marginTop; // Use margin from settings
      if (pdfSettings.headerText) {
        // Simplified header rendering for brevity, assuming single line for now
        doc.setFontSize(pdfSettings.headerFontSize);
        doc.text(pdfSettings.headerText.split('\n')[0], pdfSettings.marginLeft, currentY); // Use margin
        currentY += (pdfSettings.headerFontSize * 0.7) + 5;
      }

      if (pdfSettings.logoUrl && pdfSettings.logoUrl.startsWith('data:image')) {
        try {
            const imgProps = doc.getImageProperties(pdfSettings.logoUrl);
            const format = imgProps.fileType.toUpperCase();
            const desiredHeight = 20; 
            const imgWidth = (imgProps.width * desiredHeight) / imgProps.height;
            doc.addImage(pdfSettings.logoUrl, format, pdfSettings.marginLeft, currentY, imgWidth, desiredHeight);
            currentY += desiredHeight + 5;
        } catch(e: any) {
            console.error(`Error drawing logo in PDF: ${e.message || e}.`);
            doc.setFontSize(pdfSettings.defaultFontSize); doc.text(`[Logo Error]`, pdfSettings.marginLeft, currentY); currentY += pdfSettings.defaultFontSize + 5;
        }
      }


      const title = `Coût de Revient - ${monthLabel} ${selectedYear}`;
      doc.setFontSize(pdfSettings.headerFontSize + 2); // Slightly larger title
      doc.text(title, pdfSettings.marginLeft, currentY); currentY += (pdfSettings.headerFontSize * 0.7) + 5;
      doc.setFontSize(pdfSettings.defaultFontSize);
      doc.text(`Généré le: ${generationDateFormatted}`, pdfSettings.marginLeft, currentY); currentY += pdfSettings.defaultFontSize + 5;


      const headStyles: { fillColor?: [number, number, number], textColor?: [number, number, number], fontStyle?: string, fontSize?: number } = {
        fontStyle: 'bold',
        fontSize: pdfSettings.tableHeaderFontSize,
      };
      if (pdfSettings.primaryColor) {
        const primaryColorRgb = hexToRgb(pdfSettings.primaryColor);
        if (primaryColorRgb) {
          headStyles.fillColor = primaryColorRgb;
           const brightness = (primaryColorRgb[0] * 299 + primaryColorRgb[1] * 587 + primaryColorRgb[2] * 114) / 1000;
          headStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
        }
      }

      const head = [
        ['Fournisseur', 'HT', 'TVA', 'Avoir', 'Jour', 
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
            dayRowEntry.push({ content: row.ht.toFixed(2), rowSpan: dayKeys.length, styles: { halign: 'right' } });
            dayRowEntry.push({ content: row.tva.toFixed(2), rowSpan: dayKeys.length, styles: { halign: 'right' } });
            dayRowEntry.push({ content: row.avoir.toFixed(2), rowSpan: dayKeys.length, styles: { halign: 'right' } });
          }
          
          dayRowEntry.push({ content: (dayIndex + 1).toString(), styles: { halign: 'center' } }); 

          if (dayIndex === 0) {
            dayRowEntry.push({ content: row.imp.toFixed(2), rowSpan: dayKeys.length, styles: { halign: 'right' } });
            dayRowEntry.push({ content: row.saj.toFixed(2), rowSpan: dayKeys.length, styles: { halign: 'right' } });
            dayRowEntry.push({ content: row.ime.toFixed(2), rowSpan: dayKeys.length, styles: { halign: 'right' } });
            dayRowEntry.push({ content: row.esat.toFixed(2), rowSpan: dayKeys.length, styles: { halign: 'right' } });
            dayRowEntry.push({ content: row.repasPlus.toFixed(2), rowSpan: dayKeys.length, styles: { halign: 'right' } });
            dayRowEntry.push({ content: row.nous.toFixed(2), rowSpan: dayKeys.length, styles: { halign: 'right' } });
            dayRowEntry.push({ content: rowTotal.toFixed(2), rowSpan: dayKeys.length, styles: { halign: 'right', fontStyle: 'bold' } });
            dayRowEntry.push({ content: row.pn.toFixed(2), rowSpan: dayKeys.length, styles: { halign: 'right' } });
            dayRowEntry.push({ content: row.pnEsat.toFixed(2), rowSpan: dayKeys.length, styles: { halign: 'right' } });
            dayRowEntry.push({ content: rowEffectif.toFixed(2), rowSpan: dayKeys.length, styles: { halign: 'right', fontStyle: 'bold' } });
          }
          pdfBody.push(dayRowEntry);
        });
      });
      
      const pdfFooter = [
        [
          { content: 'TOTALS', styles: { fontStyle: 'bold' } },
          { content: totals.totalHt.toFixed(2), styles: { fontStyle: 'bold', halign: 'right' } },
          { content: totals.totalTva.toFixed(2), styles: { fontStyle: 'bold', halign: 'right' } },
          { content: totals.totalAvoir.toFixed(2), styles: { fontStyle: 'bold', halign: 'right' } },
          { content: '', styles: { halign: 'center'} }, 
          { content: '', colSpan: 6, styles: {halign: 'right'} }, 
          { content: '', styles: {halign: 'right'} }, 
          { content: '', colSpan: 2, styles: {halign: 'right'} }, 
          { content: totals.totalEffectifSum.toFixed(2), styles: { fontStyle: 'bold', halign: 'right' } }
        ],
        [
          { content: 'Prix de Revient', colSpan: 14, styles: { fontStyle: 'bold', halign: 'right' } },
          { content: totals.prixDeRevient.toFixed(2), styles: { fontStyle: 'bold', halign: 'right' } }
        ]
      ];
      
      const newColumnStyles = {
        0: { cellWidth: 150, halign: 'left' },    // Fournisseur
        1: { cellWidth: 40, halign: 'right' },  // HT
        2: { cellWidth: 40, halign: 'right' },  // TVA
        3: { cellWidth: 40, halign: 'right' },  // Avoir
        4: { cellWidth: 20, halign: 'center' }, // Jour
        5: { cellWidth: 35, halign: 'right' },  // IMP
        6: { cellWidth: 35, halign: 'right' },  // SAJ
        7: { cellWidth: 35, halign: 'right' },  // IME
        8: { cellWidth: 35, halign: 'right' },  // ESAT
        9: { cellWidth: 35, halign: 'right' },  // Repas +++
        10: { cellWidth: 35, halign: 'right' }, // Nous
        11: { cellWidth: 45, halign: 'right' }, // Total Ligne
        12: { cellWidth: 35, halign: 'right' }, // PN
        13: { cellWidth: 35, halign: 'right' }, // PN ESAT
        14: { cellWidth: 45, halign: 'right' }  // Effectif Ligne
      };


      doc.autoTable({
        head: head,
        body: pdfBody,
        foot: pdfFooter,
        startY: currentY,
        theme: 'grid',
        headStyles: headStyles, 
        styles: { fontSize: pdfSettings.tableBodyFontSize, cellPadding: 1.5, font: pdfSettings.fontFamily }, 
        columnStyles: newColumnStyles,
        margin: { 
            top: pdfSettings.marginTop, 
            right: pdfSettings.marginRight, 
            bottom: pdfSettings.marginBottom, 
            left: pdfSettings.marginLeft 
        },
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          if (pdfSettings.footerText) {
            let footerStr = pdfSettings.footerText
              .replace('{date}', generationDateFormatted)
              .replace('{pageNumber}', data.pageNumber.toString())
              .replace('{totalPages}', pageCount.toString());
            doc.setFontSize(pdfSettings.footerFontSize);
            doc.text(footerStr, data.settings.margin.left, doc.internal.pageSize.height - (pdfSettings.marginBottom / 2));
          }
        }
      });

      doc.save(`cout_de_revient_${monthLabel}_${selectedYear}.pdf`);
      toast({ title: "PDF Généré", description: "Le fichier PDF du coût de revient a été téléchargé." });
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

      <Button onClick={handleAddRow}><PlusCircle className="mr-2 h-4 w-4" /> Ajouter une ligne de fournisseur</Button>

      {isLoading ? (
        <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin" /> Chargement...</div>
      ) : (
        <>
          {/* Tableau Fournisseurs */}
          <div className="overflow-x-auto border rounded-md">
            <h3 className="text-lg font-semibold p-3 bg-muted/30">Données Fournisseurs</h3>
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-1/3 sticky left-0 z-10 bg-card">Fournisseur</TableHead>
                  <TableHead className="w-1/4">HT (€)</TableHead>
                  <TableHead className="w-1/4">TVA (€)</TableHead>
                  <TableHead className="w-1/4">Avoir (€)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costData.map((row, rowIndex) => (
                  <TableRow key={row.id + "-supplier"}>
                    <TableCell className="sticky left-0 z-10 bg-card group-hover:bg-muted/50">
                      <Input type="text" value={row.fournisseur} onChange={e => handleInputChange(rowIndex, 'fournisseur', e.target.value)} className="text-xs p-1 bg-background" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={row.ht} onChange={e => handleInputChange(rowIndex, 'ht', e.target.value)} className="text-xs p-1 bg-background" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={row.tva} onChange={e => handleInputChange(rowIndex, 'tva', e.target.value)} className="text-xs p-1 bg-background" />
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={row.avoir} onChange={e => handleInputChange(rowIndex, 'avoir', e.target.value)} className="text-xs p-1 bg-background" />
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
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          {/* Tableau Répartition et Actions */}
          <div className="overflow-x-auto border rounded-md mt-6">
             <h3 className="text-lg font-semibold p-3 bg-muted/30">Répartition des Coûts et Effectifs</h3>
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px] min-w-[80px]">Jour</TableHead>
                  {dayKeys.map((dayKey, dayIndex) => (
                    <TableHead key={dayKey} className="w-[60px] min-w-[60px] text-center">{dayIndex + 1}</TableHead>
                  ))}
                  <TableHead className="w-[80px] min-w-[80px]">IMP</TableHead>
                  <TableHead className="w-[80px] min-w-[80px]">SAJ</TableHead>
                  <TableHead className="w-[80px] min-w-[80px]">IME</TableHead>
                  <TableHead className="w-[80px] min-w-[80px]">ESAT</TableHead>
                  <TableHead className="w-[80px] min-w-[80px]">Repas +</TableHead>
                  <TableHead className="w-[80px] min-w-[80px]">Nous</TableHead>
                  <TableHead className="w-[100px] min-w-[100px] font-semibold">Total Ligne</TableHead>
                  <TableHead className="w-[80px] min-w-[80px]">PN</TableHead>
                  <TableHead className="w-[80px] min-w-[80px]">PN ESAT</TableHead>
                  <TableHead className="w-[100px] min-w-[100px] font-semibold">Effectif Ligne</TableHead>
                  <TableHead className="w-[100px] min-w-[100px] text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costData.map((row, rowIndex) => {
                  const rowTotal = calculateRowTotal(row);
                  const rowEffectif = calculateRowEffectif(row, rowTotal);
                  return (
                    <TableRow key={row.id + "-details"}>
                      <TableCell className="font-medium bg-muted/10">{row.fournisseur || `Ligne ${rowIndex + 1}`}</TableCell>
                      {dayKeys.map(dayKey => (
                        <TableCell key={dayKey} className="p-1">
                          <Input
                            type="number"
                            value={row[dayKey]}
                            onChange={e => handleInputChange(rowIndex, dayKey, e.target.value)}
                            className="w-12 text-xs p-1 bg-background"
                          />
                        </TableCell>
                      ))}
                      {(['imp', 'saj', 'ime', 'esat', 'repasPlus', 'nous'] as const).map(field => (
                        <TableCell key={field} className="p-1">
                          <Input type="number" value={row[field]} onChange={e => handleInputChange(rowIndex, field, e.target.value)} className="text-xs p-1 bg-background" />
                        </TableCell>
                      ))}
                      <TableCell className="font-semibold text-center">{rowTotal.toFixed(2)}</TableCell>
                      {(['pn', 'pnEsat'] as const).map(field => (
                        <TableCell key={field} className="p-1">
                          <Input type="number" value={row[field]} onChange={e => handleInputChange(rowIndex, field, e.target.value)} className="text-xs p-1 bg-background" />
                        </TableCell>
                      ))}
                      <TableCell className="font-semibold text-center">{rowEffectif.toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                        <Button variant="destructive" size="icon" onClick={() => handleDeleteRow(row.id)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="font-bold bg-muted/80">
                  <TableCell colSpan={32 + 6 + 1 + 2 + 1} className="text-right">Total Effectif Lignes</TableCell> {/* Ajuster colSpan en fonction du nombre de colonnes avant */}
                  <TableCell className="text-center">{totals.totalEffectifSum.toFixed(2)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
                <TableRow className="font-bold bg-muted/90">
                  <TableCell colSpan={32 + 6 + 1 + 2 + 1} className="text-right">Prix de Revient Mensuel</TableCell>
                  <TableCell className="text-center">{totals.prixDeRevient.toFixed(2)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </>
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

    
