
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { CostEntry, MonthlySummary } from '../types';
import { months as monthLabels, years as yearOptions, currentYear, calculateRowTotal, calculateRowEffectif } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { FileText, Loader2, CalendarRange, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import { firestore } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const FIXED_MONTHLY_EMARKET_DEFAULT = 62.50;
const FIXED_MONTHLY_FRAIS_FONCTIONNEMENT_DEFAULT = 278.04;
const FIXED_MONTHLY_FRAIS_GESTION_DEFAULT = 210.00;

export default function AnnualCostAnalysisTable() {
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [annualData, setAnnualData] = useState<MonthlySummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const getFirestoreDocId = useCallback((year: number, monthIndex: number) => 
    `entry_${year}_${monthIndex}`, 
  []);

  const loadAnnualData = useCallback(async () => {
    setIsLoading(true);
    const year = parseInt(selectedYear);
    const monthlySummariesPromises = monthLabels.map(async (monthInfo, monthIndex) => {
      const firestoreDocId = getFirestoreDocId(year, monthIndex);
      let summary: MonthlySummary = {
        month: monthInfo.label,
        monthIndex: monthIndex,
        totalHt: 0,
        totalTva: 0,
        totalAvoir: 0,
        emarket: FIXED_MONTHLY_EMARKET_DEFAULT, // Default, will be overwritten by manual if exists
        fraisFonctionnement: FIXED_MONTHLY_FRAIS_FONCTIONNEMENT_DEFAULT, // Default
        fraisGestion: FIXED_MONTHLY_FRAIS_GESTION_DEFAULT, // Default
        manualEmarket: undefined,
        manualFraisFonctionnement: undefined,
        manualFraisGestion: undefined,
        totalEffectifSum: 0,
        prixDeRevient: 0,
        totalLigne: 0,
        dataFound: false,
        hasManualAdjustments: false,
      };

      try {
        const docRef = doc(firestore, "costAnalysisMonthlyEntries", firestoreDocId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          summary.totalHt = data.totalHtSum || 0; // Assuming these are stored from monthly table
          summary.totalTva = data.totalTvaSum || 0;
          summary.totalAvoir = data.totalAvoirSum || 0;
          summary.totalEffectifSum = data.totalEffectifSumForMonth || 0; // Assuming this is stored too
          summary.dataFound = true; // If doc exists, assume data was processed for detailed entries

          summary.manualEmarket = data.manualEmarket !== undefined ? data.manualEmarket : FIXED_MONTHLY_EMARKET_DEFAULT;
          summary.manualFraisFonctionnement = data.manualFraisFonctionnement !== undefined ? data.manualFraisFonctionnement : FIXED_MONTHLY_FRAIS_FONCTIONNEMENT_DEFAULT;
          summary.manualFraisGestion = data.manualFraisGestion !== undefined ? data.manualFraisGestion : FIXED_MONTHLY_FRAIS_GESTION_DEFAULT;
          summary.hasManualAdjustments = data.manualEmarket !== undefined || data.manualFraisFonctionnement !== undefined || data.manualFraisGestion !== undefined;
        } else {
          // If doc doesn't exist, use defaults for display
          summary.manualEmarket = FIXED_MONTHLY_EMARKET_DEFAULT;
          summary.manualFraisFonctionnement = FIXED_MONTHLY_FRAIS_FONCTIONNEMENT_DEFAULT;
          summary.manualFraisGestion = FIXED_MONTHLY_FRAIS_GESTION_DEFAULT;
        }
      } catch (error) {
        console.error(`Error loading data from Firestore for ${monthInfo.label} ${year}:`, error);
        toast({ title: "Erreur de chargement Firestore", description: `Données corrompues pour ${monthInfo.label} ${year}.`, variant: "destructive" });
         // Fallback to defaults if error
        summary.manualEmarket = FIXED_MONTHLY_EMARKET_DEFAULT;
        summary.manualFraisFonctionnement = FIXED_MONTHLY_FRAIS_FONCTIONNEMENT_DEFAULT;
        summary.manualFraisGestion = FIXED_MONTHLY_FRAIS_GESTION_DEFAULT;
      }
      
      const actualEmarket = summary.manualEmarket ?? FIXED_MONTHLY_EMARKET_DEFAULT;
      const actualFraisFonctionnement = summary.manualFraisFonctionnement ?? FIXED_MONTHLY_FRAIS_FONCTIONNEMENT_DEFAULT;
      const actualFraisGestion = summary.manualFraisGestion ?? FIXED_MONTHLY_FRAIS_GESTION_DEFAULT;
      const totalFixedCosts = actualEmarket + actualFraisFonctionnement + actualFraisGestion;

      summary.prixDeRevient = summary.totalEffectifSum !== 0 
        ? (summary.totalHt - summary.totalAvoir + totalFixedCosts) / summary.totalEffectifSum 
        : 0;
      
      summary.totalLigne = (summary.totalHt - summary.totalAvoir) + summary.totalTva + totalFixedCosts;
        
      return summary;
    });

    const resolvedSummaries = await Promise.all(monthlySummariesPromises);
    setAnnualData(resolvedSummaries);
    setIsLoading(false);
  }, [selectedYear, toast, getFirestoreDocId]);

  useEffect(() => {
    loadAnnualData();
  }, [loadAnnualData]);

  const handleManualCostChange = (monthIndex: number, field: 'manualEmarket' | 'manualFraisFonctionnement' | 'manualFraisGestion', value: string) => {
    const numericValue = parseFloat(value);
    if (isNaN(numericValue) && value !== '') return; // Allow empty for clearing, otherwise must be number

    setAnnualData(prevData =>
      prevData.map((summary, index) => {
        if (index === monthIndex) {
          const newSummary = {
            ...summary,
            [field]: value === '' ? undefined : numericValue, // Store as undefined if empty for default fallback
            hasManualAdjustments: true,
          };
          
          // Recalculate derived values
          const actualEmarket = newSummary.manualEmarket ?? FIXED_MONTHLY_EMARKET_DEFAULT;
          const actualFraisFonctionnement = newSummary.manualFraisFonctionnement ?? FIXED_MONTHLY_FRAIS_FONCTIONNEMENT_DEFAULT;
          const actualFraisGestion = newSummary.manualFraisGestion ?? FIXED_MONTHLY_FRAIS_GESTION_DEFAULT;
          const totalFixedCosts = actualEmarket + actualFraisFonctionnement + actualFraisGestion;

          newSummary.prixDeRevient = newSummary.totalEffectifSum !== 0
            ? (newSummary.totalHt - newSummary.totalAvoir + totalFixedCosts) / newSummary.totalEffectifSum
            : 0;
          newSummary.totalLigne = (newSummary.totalHt - newSummary.totalAvoir) + newSummary.totalTva + totalFixedCosts;
          
          return newSummary;
        }
        return summary;
      })
    );
  };
  
  const handleSaveAdjustments = async () => {
    setIsSaving(true);
    const year = parseInt(selectedYear);
    const savePromises = annualData.map(async (summary) => {
      if (summary.hasManualAdjustments) { // Only save if there were changes or explicit values
        const firestoreDocId = getFirestoreDocId(year, summary.monthIndex);
        const docRef = doc(firestore, "costAnalysisMonthlyEntries", firestoreDocId);
        const dataToSave = {
          manualEmarket: summary.manualEmarket,
          manualFraisFonctionnement: summary.manualFraisFonctionnement,
          manualFraisGestion: summary.manualFraisGestion,
        };
        // Remove undefined fields before saving to Firestore
        Object.keys(dataToSave).forEach(key => dataToSave[key as keyof typeof dataToSave] === undefined && delete dataToSave[key as keyof typeof dataToSave]);

        try {
          await setDoc(docRef, dataToSave, { merge: true });
        } catch (error) {
          console.error(`Error saving adjustments for ${summary.month} ${year}:`, error);
          throw error; // Re-throw to be caught by Promise.all
        }
      }
    });

    try {
      await Promise.all(savePromises);
      setAnnualData(prev => prev.map(s => ({ ...s, hasManualAdjustments: false }))); // Reset flag after save
      toast({ title: "Ajustements Sauvegardés", description: "Les modifications des frais ont été enregistrées." });
    } catch (error) {
      toast({ title: "Erreur de Sauvegarde", description: "Certains ajustements n'ont pas pu être sauvegardés.", variant: "destructive" });
    }
    setIsSaving(false);
  };

  const annualTotals = useMemo(() => {
    let grandTotalHt = 0;
    let grandTotalTva = 0;
    let grandTotalAvoir = 0;
    let grandTotalEmarket = 0;
    let grandTotalFraisFonctionnement = 0;
    let grandTotalFraisGestion = 0;
    let grandTotalEffectifSum = 0;
    let grandTotalLigne = 0;
    let monthsWithDataForPRAverage = 0;
    let sumOfPrixDeRevient = 0;

    annualData.forEach(summary => {
      grandTotalHt += summary.totalHt;
      grandTotalTva += summary.totalTva;
      grandTotalAvoir += summary.totalAvoir;
      
      const actualEmarket = summary.manualEmarket ?? FIXED_MONTHLY_EMARKET_DEFAULT;
      const actualFraisFonctionnement = summary.manualFraisFonctionnement ?? FIXED_MONTHLY_FRAIS_FONCTIONNEMENT_DEFAULT;
      const actualFraisGestion = summary.manualFraisGestion ?? FIXED_MONTHLY_FRAIS_GESTION_DEFAULT;
      
      grandTotalEmarket += actualEmarket;
      grandTotalFraisFonctionnement += actualFraisFonctionnement;
      grandTotalFraisGestion += actualFraisGestion;
      
      grandTotalEffectifSum += summary.totalEffectifSum;
      grandTotalLigne += summary.totalLigne;
      
      if (summary.totalEffectifSum > 0 && summary.prixDeRevient > 0) { 
        sumOfPrixDeRevient += summary.prixDeRevient;
        monthsWithDataForPRAverage++;
      }
    });
    
    const averagePrixDeRevient = monthsWithDataForPRAverage > 0 ? sumOfPrixDeRevient / monthsWithDataForPRAverage : 0;
    
    const totalAnnualFixedCosts = grandTotalEmarket + grandTotalFraisFonctionnement + grandTotalFraisGestion;
    const overallPrixDeRevient = grandTotalEffectifSum !== 0 
      ? (grandTotalHt - grandTotalAvoir + totalAnnualFixedCosts) / grandTotalEffectifSum 
      : 0;

    return { 
      grandTotalHt, grandTotalTva, grandTotalAvoir, 
      grandTotalEmarket, grandTotalFraisFonctionnement, grandTotalFraisGestion,
      grandTotalEffectifSum, grandTotalLigne, averagePrixDeRevient, overallPrixDeRevient 
    };
  }, [annualData]);

  const generatePdf = () => {
    const hasAnyData = annualData.some(m => m.dataFound || m.totalEffectifSum > 0 || m.totalHt > 0 || m.totalAvoir > 0);
    if (!hasAnyData && annualTotals.grandTotalEffectifSum === 0 && annualTotals.grandTotalHt === 0 ) {
       toast({ title: "Aucune Donnée Significative", description: "Aucune donnée à afficher pour cette année.", variant: "destructive" });
      return;
    }

    setIsLoading(true); // Re-use isLoading for PDF generation to disable buttons
    try {
      console.log("Start annual PDF generation for year:", selectedYear);
      const pdfSettings = getPdfLayoutSettings('annual_cost');
      const doc = new jsPDF({
        orientation: pdfSettings.orientation,
        unit: 'pt',
        format: pdfSettings.pageSize,
      }) as jsPDFWithAutoTable;
      doc.setFont(pdfSettings.fontFamily);
      console.log("pdfSettings:", pdfSettings);
      console.log("doc created");
      const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });
      
      let currentY = pdfSettings.marginTop;
      if (pdfSettings.headerText) {
        const headerRows = pdfSettings.headerText.split('\n').map(rowText => rowText.split('|').map(cellText => cellText.trim()));
        const headerTableBody = headerRows.map(row => row.map(cell => cell === '{logo}' ? '' : cell));
        doc.autoTable({ body: headerTableBody, startY: currentY, theme: 'plain', styles: { fontSize: pdfSettings.headerFontSize, cellPadding: 1, font: pdfSettings.fontFamily }, columnStyles: { 0: { cellWidth: 'auto'} }, margin: { top: pdfSettings.marginTop, left: pdfSettings.marginLeft, right: pdfSettings.marginRight },
          didDrawCell: (data) => {
            if (pdfSettings.logoUrl && pdfSettings.logoUrl.startsWith('data:image') && headerRows[data.row.index][data.column.index] === '{logo}') {
              try { const imgProps = doc.getImageProperties(pdfSettings.logoUrl); const formatType = imgProps.fileType.toUpperCase(); let imgWidth = data.cell.width - 4; let imgHeight = data.cell.height - 4; const cellAspectRatio = data.cell.width / data.cell.height; const imgAspectRatio = imgProps.width / imgProps.height; if (imgAspectRatio > cellAspectRatio) imgHeight = imgWidth / imgAspectRatio; else imgWidth = imgHeight * imgAspectRatio; const imgX = data.cell.x + (data.cell.width - imgWidth) / 2; const imgY = data.cell.y + (data.cell.height - imgHeight) / 2; doc.addImage(pdfSettings.logoUrl, formatType, imgX, imgY, imgWidth, imgHeight); } catch (e: any) { console.error(`Error drawing logo in PDF header table: ${e.message || e}.`);}
            }
          },
        });
        currentY = (doc as any).lastAutoTable.finalY + 5;
      } else if (pdfSettings.logoUrl && pdfSettings.logoUrl.startsWith('data:image')) {
        try { const imgProps = doc.getImageProperties(pdfSettings.logoUrl); const formatType = imgProps.fileType.toUpperCase(); const desiredHeight = 30; const imgWidth = (imgProps.width * desiredHeight) / imgProps.height; doc.addImage(pdfSettings.logoUrl, formatType, pdfSettings.marginLeft, currentY, imgWidth, desiredHeight); currentY += desiredHeight + 5; } catch(e: any) { console.error(`Error drawing standalone logo in PDF: ${e.message || e}.`); }
      }
      
      const moduleDefaultTitle = `Récapitulatif Annuel Coût de Revient - ${selectedYear}`;
      let finalTitle = "";
      if (pdfSettings.showDocumentBaseTitle && pdfSettings.documentBaseTitle && pdfSettings.documentBaseTitle.trim() !== "") {
        finalTitle = pdfSettings.documentBaseTitle.trim();
      }
      if (pdfSettings.showModuleTitle) {
        if (finalTitle) {
          finalTitle += ` - ${moduleDefaultTitle}`;
        } else {
          finalTitle = moduleDefaultTitle;
        }
      }

      if(finalTitle) {
        doc.setFontSize(pdfSettings.documentTitleFontSize); 
        doc.text(finalTitle, pdfSettings.marginLeft, currentY); 
        currentY += pdfSettings.documentTitleFontSize * 0.7 + 5;
      }
      
      const headStyles: { fillColor?: [number, number, number], textColor?: [number, number, number], fontStyle?: string, fontSize?: number } = { fontStyle: 'bold', fontSize: pdfSettings.tableHeaderFontSize };
      if (pdfSettings.primaryColor) {
        const primaryRgb = hexToRgb(pdfSettings.primaryColor);
        if (primaryRgb) { headStyles.fillColor = primaryRgb; const brightness = (primaryRgb[0] * 299 + primaryRgb[1] * 587 + primaryRgb[2] * 114) / 1000; headStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255]; }
      }

      const head = [['Mois', 'Total HT (€)', 'Total TVA (€)', 'Total Avoir (€)', 'Total Effectif (Qté)', 'Prix de Revient Mensuel (€)', 'Emarket (€)', 'Frais Fonct. (€)', 'Frais Gestion (€)', 'Dépenses Mensuelles Totales (€)']];
      const body = annualData.map(summary => [
        summary.month, summary.totalHt.toFixed(2), summary.totalTva.toFixed(2), summary.totalAvoir.toFixed(2),
        summary.totalEffectifSum.toFixed(0), summary.prixDeRevient.toFixed(2),
        (summary.manualEmarket ?? FIXED_MONTHLY_EMARKET_DEFAULT).toFixed(2),
        (summary.manualFraisFonctionnement ?? FIXED_MONTHLY_FRAIS_FONCTIONNEMENT_DEFAULT).toFixed(2),
        (summary.manualFraisGestion ?? FIXED_MONTHLY_FRAIS_GESTION_DEFAULT).toFixed(2),
        summary.totalLigne.toFixed(2),
      ]);
      const footer = [
        [ { content: 'TOTAL ANNUEL', styles: { fontStyle: 'bold' } }, annualTotals.grandTotalHt.toFixed(2), annualTotals.grandTotalTva.toFixed(2), annualTotals.grandTotalAvoir.toFixed(2), annualTotals.grandTotalEffectifSum.toFixed(0), { content: annualTotals.overallPrixDeRevient.toFixed(2), styles: { fontStyle: 'bold' } }, annualTotals.grandTotalEmarket.toFixed(2), annualTotals.grandTotalFraisFonctionnement.toFixed(2), annualTotals.grandTotalFraisGestion.toFixed(2), annualTotals.grandTotalLigne.toFixed(2) ],
        [ { content: 'Prix de Revient Annuel Moyen (basé sur PR mensuels avec effectif > 0)', colSpan: 9, styles: { fontStyle: 'bold', halign: 'right' } }, { content: annualTotals.averagePrixDeRevient.toFixed(2), styles: { fontStyle: 'bold', halign: 'right' } } ]
      ];
      doc.autoTable({ head, body, foot: footer, startY: currentY, theme: 'grid', headStyles, styles: { fontSize: pdfSettings.tableBodyFontSize, font: pdfSettings.fontFamily }, footStyles: { fillColor: [220, 220, 220], textColor: [0,0,0], fontStyle: 'bold' },
        // Allow wrapping for columns with potentially long text, keep numeric columns right-aligned
        columnStyles: {
          0: { cellWidth: 'wrap' }, // Mois - allow wrap
          1: { halign: 'right' }, // Total HT
          2: { halign: 'right' }, // Total TVA
          3: { halign: 'right' }, // Total Avoir
          4: { halign: 'right' }, // Total Effectif
          5: { halign: 'right', cellWidth: 'wrap' }, // Prix de Revient Mensuel - allow wrap
          6: { halign: 'right' }, // Emarket
          7: { halign: 'right', cellWidth: 'wrap' }, // Frais Fonct. - allow wrap
          8: { halign: 'right', cellWidth: 'wrap' }, // Frais Gestion - allow wrap
          9: { halign: 'right', cellWidth: 'wrap' }, // Dépenses Mensuelles Totales - allow wrap
        },
        tableWidth: 'wrap', // Allow table to adjust width
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          if (pdfSettings.footerText) { let footerStr = pdfSettings.footerText.replace('{date}', generationDateFormatted).replace('{pageNumber}', data.pageNumber.toString()).replace('{totalPages}', pageCount.toString()); doc.setFontSize(pdfSettings.footerFontSize); doc.text(footerStr, data.settings.margin.left, doc.internal.pageSize.height - (pdfSettings.marginBottom / 2)); }
        }
      });
      doc.save(`cout_revient_annuel_${selectedYear}.pdf`);
      toast({ title: "PDF Annuel Généré", description: "Le récapitulatif PDF annuel a été téléchargé." });
    } catch (error) { console.error("Error generating annual PDF:", error); toast({ title: "Erreur PDF", description: "La génération du PDF annuel a échoué.", variant: "destructive" }); }
    finally { setIsLoading(false); }
  };

  const noDataForYear = !isLoading && annualData.every(m => !m.dataFound && m.totalEffectifSum === 0 && m.totalHt === 0 && m.totalAvoir === 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
        <div>
          <Label htmlFor="year-select-annual">Année</Label>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger id="year-select-annual"><SelectValue placeholder="Année" /></SelectTrigger>
            <SelectContent>{yearOptions.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2 flex flex-col sm:flex-row gap-2 justify-end">
           <Button 
            onClick={handleSaveAdjustments} 
            disabled={isLoading || isSaving || annualData.every(s => !s.hasManualAdjustments)} 
            className="w-full sm:w-auto"
            variant="outline"
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Enregistrer Ajustements Frais
          </Button>
           <Button 
            onClick={generatePdf} 
            disabled={isLoading || isSaving || noDataForYear} 
            className="w-full sm:w-auto"
          >
            {(isLoading && !isSaving) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            Générer PDF Annuel
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Chargement des données annuelles...</span>
        </div>
      ) : (
      <div className="overflow-x-auto border rounded-md">
        <Table className="min-w-full">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Mois</TableHead>
              <TableHead className="text-right">Total HT (€)</TableHead>
              <TableHead className="text-right">Total TVA (€)</TableHead>
              <TableHead className="text-right">Total Avoir (€)</TableHead>
              <TableHead className="text-right">Total Effectif (Qté)</TableHead>
              <TableHead className="text-right">Prix de Revient Mensuel (€)</TableHead>
              <TableHead className="text-right w-32 min-w-[120px]">Emarket (€)</TableHead>
              <TableHead className="text-right w-32 min-w-[120px]">Frais Fonct. (€)</TableHead>
              <TableHead className="text-right w-32 min-w-[120px]">Frais Gestion (€)</TableHead>
              <TableHead className="text-right">Dépenses Mensuelles Totales (€)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {annualData.map((summary, index) => (
              <TableRow key={index} className={cn(!summary.dataFound && "opacity-70")}>
                <TableCell className="font-medium">{summary.month}</TableCell>
                <TableCell className="text-right">{summary.totalHt.toFixed(2)}</TableCell>
                <TableCell className="text-right">{summary.totalTva.toFixed(2)}</TableCell>
                <TableCell className="text-right">{summary.totalAvoir.toFixed(2)}</TableCell>
                <TableCell className="text-right">{summary.totalEffectifSum.toFixed(0)}</TableCell> 
                <TableCell className="text-right">{summary.prixDeRevient.toFixed(2)}</TableCell>
                <TableCell className="text-right p-1">
                  <Input type="number" step="0.01"
                    value={summary.manualEmarket ?? ''}
                    placeholder={(FIXED_MONTHLY_EMARKET_DEFAULT).toFixed(2)}
                    onChange={(e) => handleManualCostChange(index, 'manualEmarket', e.target.value)}
                    className="h-8 text-xs text-right bg-background/50"
                    disabled={isSaving}
                  />
                </TableCell>
                <TableCell className="text-right p-1">
                  <Input type="number" step="0.01"
                    value={summary.manualFraisFonctionnement ?? ''}
                     placeholder={(FIXED_MONTHLY_FRAIS_FONCTIONNEMENT_DEFAULT).toFixed(2)}
                    onChange={(e) => handleManualCostChange(index, 'manualFraisFonctionnement', e.target.value)}
                    className="h-8 text-xs text-right bg-background/50"
                    disabled={isSaving}
                  />
                </TableCell>
                <TableCell className="text-right p-1">
                  <Input type="number" step="0.01"
                    value={summary.manualFraisGestion ?? ''}
                    placeholder={(FIXED_MONTHLY_FRAIS_GESTION_DEFAULT).toFixed(2)}
                    onChange={(e) => handleManualCostChange(index, 'manualFraisGestion', e.target.value)}
                    className="h-8 text-xs text-right bg-background/50"
                    disabled={isSaving}
                  />
                </TableCell>
                <TableCell className="text-right">{summary.totalLigne.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="font-bold bg-muted text-foreground">
              <TableCell>TOTAL ANNUEL</TableCell>
              <TableCell className="text-right">{annualTotals.grandTotalHt.toFixed(2)}</TableCell>
              <TableCell className="text-right">{annualTotals.grandTotalTva.toFixed(2)}</TableCell>
              <TableCell className="text-right">{annualTotals.grandTotalAvoir.toFixed(2)}</TableCell>
              <TableCell className="text-right">{annualTotals.grandTotalEffectifSum.toFixed(0)}</TableCell>
              <TableCell className="text-right" title="Basé sur les totaux annuels (HT, Avoir, Frais Fixes) / Total Effectif Annuel">{annualTotals.overallPrixDeRevient.toFixed(2)}</TableCell> 
              <TableCell className="text-right">{annualTotals.grandTotalEmarket.toFixed(2)}</TableCell>
              <TableCell className="text-right">{annualTotals.grandTotalFraisFonctionnement.toFixed(2)}</TableCell>
              <TableCell className="text-right">{annualTotals.grandTotalFraisGestion.toFixed(2)}</TableCell>
              <TableCell className="text-right">{annualTotals.grandTotalLigne.toFixed(2)}</TableCell>
            </TableRow>
            <TableRow className="font-bold bg-muted/80 text-foreground">
              <TableCell colSpan={9} className="text-right">Prix de Revient Annuel Moyen (moyenne des PR mensuels avec effectif > 0)</TableCell>
              <TableCell className="text-right">{annualTotals.averagePrixDeRevient.toFixed(2)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      )}
       {noDataForYear && (
         <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
            <CalendarRange className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
                Aucune donnée mensuelle significative trouvée pour l'année {selectedYear}.
            </p>
            <p className="text-xs text-muted-foreground/70">
                Veuillez saisir des données dans l'onglet "Coût de Revient Mensuel" pour cette année.
            </p>
        </div>
      )}
    </div>
  );
}


