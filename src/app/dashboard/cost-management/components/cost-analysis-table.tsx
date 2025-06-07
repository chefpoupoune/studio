
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { CostEntry, CostEntryData } from '../types';
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
import { format, getDaysInMonth as dfnsGetDaysInMonth, startOfMonth as dfnsStartOfMonth, addDays as dfnsAddDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const initialRowData = (): CostEntryData => ({
  fournisseur: '', ht: 0, tva: 0, avoir: 0,
  imp: 0, saj: 0, ime: 0, esat: 0, repasPlus: 0, nous: 0, pn: 0, pnEsat: 0,
});

interface DayInfo {
  date: string;
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


export default function CostAnalysisTable() {
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [costData, setCostData] = useState<CostEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [monthlyCalendarDays, setMonthlyCalendarDays] = useState<DayInfo[]>([]);

  const getLocalStorageKey = useCallback(() => `cost_analysis_data_${selectedYear}_${selectedMonth}`, [selectedYear, selectedMonth]);

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
      toast({ title: "Erreur de chargement", description: "Données des coûts corrompues, réinitialisation.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [selectedMonth, selectedYear, getLocalStorageKey, toast]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(getLocalStorageKey(), JSON.stringify(costData));
    }
  }, [costData, getLocalStorageKey, isLoading]);

  useEffect(() => {
    const yearNum = parseInt(selectedYear, 10);
    const monthNum = parseInt(selectedMonth, 10);
    setMonthlyCalendarDays(getMonthDaysCalendar(yearNum, monthNum));
  }, [selectedYear, selectedMonth]);


  const handleInputChange = (rowIndex: number, fieldName: keyof CostEntryData, value: string | number) => {
    setCostData(prevData =>
      prevData.map((row, index) => {
        if (index === rowIndex) {
          let processedValue: string | number;
          if (typeof initialRowData()[fieldName] === 'number') {
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
      totalEffectifQuantity += calculateRowEffectif(row, calculateRowTotal(row));
    });

    const netCost = totalHt - totalAvoir;
    const prixDeRevient = totalEffectifQuantity !== 0 ? netCost / totalEffectifQuantity : 0;

    return { totalHt, totalTva, totalAvoir, totalEffectifQuantity, prixDeRevient };
  }, [costData]);

  const generatePdf = () => {
    setIsLoading(true);
    try {
      // PDF Generation logic - Note: This PDF logic is based on an older table structure.
      // It will need significant rework to match the current UI (one main table).
      // For now, it will generate a PDF but it might not be what the user expects given the UI changes.
      toast({ title: "Avertissement PDF", description: "La génération PDF actuelle ne reflète pas la nouvelle structure du tableau. Une mise à jour est nécessaire.", variant: "default", duration: 7000 });

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
        } catch(e) { console.error("Error drawing logo in PDF:", e); }
      }

      const title = `Coût de Revient - ${monthLabel} ${selectedYear}`;
      doc.setFontSize(pdfSettings.headerFontSize + 2); 
      doc.text(title, pdfSettings.marginLeft, currentY); currentY += (pdfSettings.headerFontSize * 0.7) + 5;
      doc.setFontSize(pdfSettings.defaultFontSize);
      doc.text(`Généré le: ${generationDateFormatted}`, pdfSettings.marginLeft, currentY); currentY += pdfSettings.defaultFontSize + 5;

      const headStyles: { fillColor?: [number, number, number], textColor?: [number, number, number], fontStyle?: string, fontSize?: number } = {
        fontStyle: 'bold', fontSize: pdfSettings.tableHeaderFontSize,
      };
      if (pdfSettings.primaryColor) {
        const primaryColorRgb = hexToRgb(pdfSettings.primaryColor);
        if (primaryColorRgb) {
          headStyles.fillColor = primaryColorRgb;
          const brightness = (primaryColorRgb[0] * 299 + primaryColorRgb[1] * 587 + primaryColorRgb[2] * 114) / 1000;
          headStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
        }
      }
      
      const head = [['Fournisseur', 'HT (€)', 'TVA (€)', 'Avoir (€)', 'IMP', 'SAJ', 'IME', 'ESAT', 'Repas +', 'Nous', 'Total Coeff.', 'PN', 'PN ESAT', 'Effectif Coeff.']];
      const body = costData.map(row => [
        row.fournisseur,
        row.ht.toFixed(2),
        row.tva.toFixed(2),
        row.avoir.toFixed(2),
        row.imp.toFixed(2),
        row.saj.toFixed(2),
        row.ime.toFixed(2),
        row.esat.toFixed(2),
        row.repasPlus.toFixed(2),
        row.nous.toFixed(2),
        calculateRowTotal(row).toFixed(2),
        row.pn.toFixed(2),
        row.pnEsat.toFixed(2),
        calculateRowEffectif(row, calculateRowTotal(row)).toFixed(2),
      ]);

      const pdfFooter = [
        [{ content: 'TOTAUX', styles: { fontStyle: 'bold' } }, totals.totalHt.toFixed(2), totals.totalTva.toFixed(2), totals.totalAvoir.toFixed(2), '', '', '', '', '', '', '', '', '', totals.totalEffectifQuantity.toFixed(0)],
        [{ content: 'Prix de Revient Mensuel (€)', colSpan: 13, styles: { fontStyle: 'bold', halign: 'right' } }, totals.prixDeRevient.toFixed(2)]
      ];

      doc.autoTable({
        head, body, foot: pdfFooter, startY: currentY, theme: 'grid', headStyles,
        styles: { fontSize: pdfSettings.tableBodyFontSize, cellPadding: 1.5, font: pdfSettings.fontFamily },
        columnStyles: { /* Adjust column styles as needed if the PDF is to be fully fixed */ },
        margin: { top: pdfSettings.marginTop, right: pdfSettings.marginRight, bottom: pdfSettings.marginBottom, left: pdfSettings.marginLeft },
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          if (pdfSettings.footerText) {
            let footerStr = pdfSettings.footerText.replace('{date}', generationDateFormatted).replace('{pageNumber}', data.pageNumber.toString()).replace('{totalPages}', pageCount.toString());
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
          {/* Tableau Fournisseurs et Coefficients */}
          <div className="overflow-x-auto border rounded-md">
            <h3 className="text-lg font-semibold p-3 bg-muted/30">Données Fournisseurs & Coefficients</h3>
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
                      <Input type="text" value={row.fournisseur} onChange={e => handleInputChange(rowIndex, 'fournisseur', e.target.value)} className="text-xs p-1 h-7 bg-background" />
                    </TableCell>
                    <TableCell className="p-1"><Input type="number" value={row.ht} onChange={e => handleInputChange(rowIndex, 'ht', e.target.value)} className="text-xs p-1 h-7 bg-background" /></TableCell>
                    <TableCell className="p-1"><Input type="number" value={row.tva} onChange={e => handleInputChange(rowIndex, 'tva', e.target.value)} className="text-xs p-1 h-7 bg-background" /></TableCell>
                    <TableCell className="p-1"><Input type="number" value={row.avoir} onChange={e => handleInputChange(rowIndex, 'avoir', e.target.value)} className="text-xs p-1 h-7 bg-background" /></TableCell>
                    {(['imp', 'saj', 'ime', 'esat', 'repasPlus', 'nous'] as const).map(field => (
                        <TableCell key={field} className="p-1">
                            <Input type="number" value={row[field]} onChange={e => handleInputChange(rowIndex, field, e.target.value)} className="text-xs p-1 h-7 bg-background w-14 text-center" />
                        </TableCell>
                    ))}
                    <TableCell className="font-semibold text-center align-middle">{calculateRowTotal(row).toFixed(2)}</TableCell>
                    {(['pn', 'pnEsat'] as const).map(field => (
                        <TableCell key={field} className="p-1">
                            <Input type="number" value={row[field]} onChange={e => handleInputChange(rowIndex, field, e.target.value)} className="text-xs p-1 h-7 bg-background w-14 text-center" />
                        </TableCell>
                    ))}
                    <TableCell className="font-semibold text-center align-middle">{calculateRowEffectif(row, calculateRowTotal(row)).toFixed(2)}</TableCell>
                    <TableCell className="text-center sticky right-0 z-10 bg-card group-hover:bg-muted/50">
                        <Button variant="destructive" size="icon" onClick={() => handleDeleteRow(row.id)} className="h-7 w-7"><Trash2 className="h-4 w-4" /></Button>
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
                  <TableCell colSpan={7}></TableCell> {/* Span across coefficient columns + Total Coeff. */}
                  <TableCell colSpan={2}></TableCell> {/* Span across PN and PN ESAT */}
                  <TableCell className="text-center">{totals.totalEffectifQuantity.toFixed(0)}</TableCell>
                  <TableCell className="sticky right-0 z-10 bg-muted/80"></TableCell>
                </TableRow>
                <TableRow className="font-bold bg-muted/90">
                  <TableCell colSpan={13} className="text-right sticky left-0 z-10 bg-muted/90">Prix de Revient Mensuel (€)</TableCell>
                  <TableCell className="text-center">{totals.prixDeRevient.toFixed(2)}</TableCell>
                  <TableCell className="sticky right-0 z-10 bg-muted/90"></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
          
          {/* Tableau Calendrier du Mois Sélectionné */}
          <div className="overflow-x-auto border rounded-md mt-6">
            <h3 className="text-lg font-semibold p-3 bg-muted/30">Calendrier du Mois Sélectionné</h3>
            {monthlyCalendarDays.length > 0 ? (
              <Table className="min-w-[300px] max-w-sm mx-auto"> {/* Centered and max-width */}
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/2 text-center">Jour</TableHead>
                    <TableHead className="w-1/2 text-center">Nom du Jour</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyCalendarDays.map((day) => (
                    <TableRow key={day.date} className={cn(day.isWeekend && "bg-muted/50 text-muted-foreground")}>
                      <TableCell className="text-center">{day.dayOfMonth}</TableCell>
                      <TableCell className="text-center">{day.dayName}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-4">Chargement du calendrier...</p>
            )}
          </div>
        </>
      )}
      {costData.length > 0 && (
        <Button onClick={generatePdf} disabled={isLoading} className="mt-4">
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
          Générer PDF Coût de Revient (structure ancienne)
        </Button>
      )}
      {!isLoading && costData.length === 0 && (
         <p className="text-muted-foreground text-center py-8">Aucune donnée de fournisseur pour ce mois. Cliquez sur "Ajouter une ligne" pour commencer.</p>
      )}
    </div>
  );
}
    
    
