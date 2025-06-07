
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

  const handleInputChange = (rowIndex: number, fieldName: keyof CostEntryData | DayKey, value: string | number) => {
    setCostData(prevData =>
      prevData.map((row, index) => {
        if (index === rowIndex) {
          const isDayKeyField = dayKeys.includes(fieldName as DayKey);
          let processedValue: string | number;

          if (typeof initialRowData()[fieldName as keyof CostEntryData] === 'number' || isDayKeyField) { 
            if (isDayKeyField && value === "") {
                processedValue = ""; // Allow empty string for day inputs
            } else {
                processedValue = parseFloat(value as string) || 0;
            }
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
    toast({ title: "Ligne Fournisseur Supprimée", description: "La ligne fournisseur a été retirée du tableau." });
  };

  const totals = useMemo(() => {
    let totalHt = 0;
    let totalTva = 0;
    let totalAvoir = 0;
    let totalEffectifQuantity = 0; 

    costData.forEach(row => {
      totalHt += row.ht || 0;
      totalTva += row.tva || 0;
      totalAvoir += row.avoir || 0;
      
      dayKeys.forEach(dayKey => {
        totalEffectifQuantity += Number(row[dayKey as DayKey]) || 0;
      });
    });

    const netCost = totalHt - totalAvoir;
    const prixDeRevient = totalEffectifQuantity !== 0 ? netCost / totalEffectifQuantity : 0;

    return { totalHt, totalTva, totalAvoir, totalEffectifQuantity, prixDeRevient };
  }, [costData]);

  const generatePdf = () => {
    setIsLoading(true);
    try {
      const pdfSettings = getPdfLayoutSettings('monthly_cost');
      const doc = new jsPDF('landscape') as jsPDFWithAutoTable; 
      const monthLabel = months.find(m => m.value === selectedMonth)?.label || '';
      const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });

      let currentY = pdfSettings.marginTop; 
      if (pdfSettings.headerText) {
        doc.setFontSize(pdfSettings.headerFontSize);
        doc.text(pdfSettings.headerText.split('\n')[0], pdfSettings.marginLeft, currentY); 
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
      doc.setFontSize(pdfSettings.headerFontSize + 2); 
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
         'Total Coeff.', 'PN', 'PN ESAT', 'Effectif Coeff.']
      ];
      
      const pdfBody: any[] = [];
      costData.forEach(row => {
        const rowTotalCoeff = calculateRowTotal(row);
        const rowEffectifCoeff = calculateRowEffectif(row, rowTotalCoeff);
        dayKeys.forEach((dayKey, dayIndex) => {
          const dayRowEntry: any[] = [];
          
          if (dayIndex === 0) { 
            dayRowEntry.push({ content: row.fournisseur, rowSpan: dayKeys.length, styles: {valign: 'middle'} });
            dayRowEntry.push({ content: row.ht.toFixed(2), rowSpan: dayKeys.length, styles: { halign: 'right', valign: 'middle' } });
            dayRowEntry.push({ content: row.tva.toFixed(2), rowSpan: dayKeys.length, styles: { halign: 'right', valign: 'middle' } });
            dayRowEntry.push({ content: row.avoir.toFixed(2), rowSpan: dayKeys.length, styles: { halign: 'right', valign: 'middle' } });
          }
          
          dayRowEntry.push({ content: (dayIndex + 1).toString(), styles: { halign: 'center' } }); 
          
          if (dayIndex === 0) { 
            dayRowEntry.push({ content: row.imp.toFixed(2), rowSpan: dayKeys.length, styles: { halign: 'right', valign: 'middle' } });
            dayRowEntry.push({ content: row.saj.toFixed(2), rowSpan: dayKeys.length, styles: { halign: 'right', valign: 'middle' } });
            dayRowEntry.push({ content: row.ime.toFixed(2), rowSpan: dayKeys.length, styles: { halign: 'right', valign: 'middle' } });
            dayRowEntry.push({ content: row.esat.toFixed(2), rowSpan: dayKeys.length, styles: { halign: 'right', valign: 'middle' } });
            dayRowEntry.push({ content: row.repasPlus.toFixed(2), rowSpan: dayKeys.length, styles: { halign: 'right', valign: 'middle' } });
            dayRowEntry.push({ content: row.nous.toFixed(2), rowSpan: dayKeys.length, styles: { halign: 'right', valign: 'middle' } });
            dayRowEntry.push({ content: rowTotalCoeff.toFixed(2), rowSpan: dayKeys.length, styles: { halign: 'right', fontStyle: 'bold', valign: 'middle' } });
            dayRowEntry.push({ content: row.pn.toFixed(2), rowSpan: dayKeys.length, styles: { halign: 'right', valign: 'middle' } });
            dayRowEntry.push({ content: row.pnEsat.toFixed(2), rowSpan: dayKeys.length, styles: { halign: 'right', valign: 'middle' } });
            dayRowEntry.push({ content: rowEffectifCoeff.toFixed(2), rowSpan: dayKeys.length, styles: { halign: 'right', fontStyle: 'bold', valign: 'middle' } });
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
          { content: totals.totalEffectifQuantity.toFixed(0), styles: { fontStyle: 'bold', halign: 'right' } } 
        ],
        [
          { content: 'Prix de Revient Mensuel', colSpan: 14, styles: { fontStyle: 'bold', halign: 'right' } },
          { content: totals.prixDeRevient.toFixed(2), styles: { fontStyle: 'bold', halign: 'right' } }
        ]
      ];
      
      const newColumnStyles = {
        0: { cellWidth: 100, halign: 'left' },    
        1: { cellWidth: 30, halign: 'right' },  
        2: { cellWidth: 30, halign: 'right' },  
        3: { cellWidth: 30, halign: 'right' },  
        4: { cellWidth: 15, halign: 'center' }, 
        5: { cellWidth: 25, halign: 'right' }, 
        6: { cellWidth: 25, halign: 'right' },  
        7: { cellWidth: 25, halign: 'right' },  
        8: { cellWidth: 25, halign: 'right' },  
        9: { cellWidth: 25, halign: 'right' }, 
        10: { cellWidth: 25, halign: 'right' }, 
        11: { cellWidth: 35, halign: 'right' }, 
        12: { cellWidth: 25, halign: 'right' }, 
        13: { cellWidth: 25, halign: 'right' }, 
        14: { cellWidth: 35, halign: 'right' }  
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
             <h3 className="text-lg font-semibold p-3 bg-muted/30">Répartition des Coûts et Saisie des Quantités Journalières</h3>
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px] min-w-[150px] sticky left-0 z-20 bg-card"></TableHead> {/* Empty Header for Supplier Name Column */}
                  <TableHead className="w-[60px] min-w-[60px] text-center">Jour</TableHead>
                  <TableHead className="w-[100px] min-w-[100px] text-center"></TableHead> {/* Empty Header for Daily Quantity Column */}
                  <TableHead className="w-[70px] min-w-[70px]">IMP</TableHead>
                  <TableHead className="w-[70px] min-w-[70px]">SAJ</TableHead>
                  <TableHead className="w-[70px] min-w-[70px]">IME</TableHead>
                  <TableHead className="w-[70px] min-w-[70px]">ESAT</TableHead>
                  <TableHead className="w-[70px] min-w-[70px]">Repas +</TableHead>
                  <TableHead className="w-[70px] min-w-[70px]">Nous</TableHead>
                  <TableHead className="w-[100px] min-w-[100px] font-semibold text-center">Total Coeff.</TableHead>
                  <TableHead className="w-[70px] min-w-[70px]">PN</TableHead>
                  <TableHead className="w-[70px] min-w-[70px]">PN ESAT</TableHead>
                  <TableHead className="w-[100px] min-w-[100px] font-semibold text-center">Effectif Coeff.</TableHead>
                  <TableHead className="w-[100px] min-w-[100px] text-center sticky right-0 z-20 bg-card">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costData.map((row, rowIndex) => (
                  <React.Fragment key={row.id + "-details-group"}>
                    {dayKeys.map((dayKey, dayIndex) => (
                      <TableRow key={`${row.id}-${dayKey}`}>
                        {dayIndex === 0 && (
                          <TableCell rowSpan={dayKeys.length} className="font-medium align-top py-2 sticky left-0 z-10 bg-card group-hover:bg-muted/50">
                            {row.fournisseur || `Ligne ${rowIndex + 1}`}
                          </TableCell>
                        )}
                        <TableCell className="text-center">{dayIndex + 1}</TableCell>
                        <TableCell className="p-1">
                          <Input
                            type="text" // Changed to text to allow empty string, parsing will handle numbers
                            value={row[dayKey]}
                            onChange={e => handleInputChange(rowIndex, dayKey as DayKey, e.target.value)}
                            className="w-16 text-xs p-1 text-center bg-background"
                          />
                        </TableCell>
                        {dayIndex === 0 && ( 
                          <React.Fragment>
                            {(['imp', 'saj', 'ime', 'esat', 'repasPlus', 'nous'] as const).map(field => (
                              <TableCell key={field} rowSpan={dayKeys.length} className="p-1 align-top py-2">
                                <Input type="number" value={row[field]} onChange={e => handleInputChange(rowIndex, field, e.target.value)} className="text-xs p-1 bg-background w-16 text-center" />
                              </TableCell>
                            ))}
                            <TableCell rowSpan={dayKeys.length} className="font-semibold text-center align-middle">
                              {calculateRowTotal(row).toFixed(2)}
                            </TableCell>
                            {(['pn', 'pnEsat'] as const).map(field => (
                              <TableCell key={field} rowSpan={dayKeys.length} className="p-1 align-top py-2">
                                <Input type="number" value={row[field]} onChange={e => handleInputChange(rowIndex, field, e.target.value)} className="text-xs p-1 bg-background w-16 text-center" />
                              </TableCell>
                            ))}
                            <TableCell rowSpan={dayKeys.length} className="font-semibold text-center align-middle">
                              {calculateRowEffectif(row, calculateRowTotal(row)).toFixed(2)}
                            </TableCell>
                            <TableCell rowSpan={dayKeys.length} className="text-center align-middle sticky right-0 z-10 bg-card group-hover:bg-muted/50">
                              <Button variant="destructive" size="icon" onClick={() => handleDeleteRow(row.id)}><Trash2 className="h-4 w-4" /></Button>
                            </TableCell>
                          </React.Fragment>
                        )}
                      </TableRow>
                    ))}
                  </React.Fragment>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="font-bold bg-muted/80">
                  <TableCell colSpan={12} className="text-right sticky left-0 bg-muted/80">Total Quantités Mois</TableCell> 
                  <TableCell className="text-center">{totals.totalEffectifQuantity.toFixed(0)}</TableCell>
                  <TableCell className="sticky right-0 bg-muted/80"></TableCell>
                </TableRow>
                <TableRow className="font-bold bg-muted/90">
                  <TableCell colSpan={12} className="text-right sticky left-0 bg-muted/90">Prix de Revient Mensuel (€)</TableCell>
                  <TableCell className="text-center">{totals.prixDeRevient.toFixed(2)}</TableCell>
                  <TableCell className="sticky right-0 bg-muted/90"></TableCell>
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
    

    
