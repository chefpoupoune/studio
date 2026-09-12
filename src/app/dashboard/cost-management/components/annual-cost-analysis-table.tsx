"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { MonthlySummary } from '../types';
import { months as monthLabels, years as yearOptions, currentYear } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, Loader2, CalendarRange, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getPdfLayoutSettings, hexToRgb,loadPdfLayoutSettingsFromFirestore } from '@/lib/pdf-settings';
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
  const [annualBudget, setAnnualBudget] = useState(185000);
  const [isBudgetLoading, setIsBudgetLoading] = useState(true);
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  const { toast } = useToast();

  const getFirestoreDocId = useCallback((year: number, monthIndex: number) => 
    `entry_${year}_${monthIndex}`, 
  []);

  const loadAnnualBudget = useCallback(async (year: string) => {
    setIsBudgetLoading(true);
    try {
      const docRef = doc(firestore, "costAnalysisAnnualSettings", year);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().annualBudget !== undefined) {
        setAnnualBudget(docSnap.data().annualBudget);
      } else {
        setAnnualBudget(185000); // Default if not found
      }
    } catch (error) {
      console.error("Error loading annual budget:", error);
      toast({
        title: "Erreur de chargement du budget",
        description: "Le budget annuel n'a pas pu être chargé.",
        variant: "destructive",
      });
    }
    setIsBudgetLoading(false);
  }, [toast]);

  const handleSaveBudget = async () => {
    setIsSavingBudget(true);
    try {
      const docRef = doc(firestore, "costAnalysisAnnualSettings", selectedYear);
      await setDoc(docRef, { annualBudget }, { merge: true });
      toast({
        title: "Budget Sauvegardé",
        description: `Le budget annuel pour ${selectedYear} a été sauvegardé.`,
      });
    } catch (error) {
      console.error("Error saving annual budget:", error);
      toast({
        title: "Erreur de sauvegarde",
        description: "Le budget annuel n'a pas pu être sauvegardé.",
        variant: "destructive",
      });
    }
    setIsSavingBudget(false);
  };

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
        emarket: FIXED_MONTHLY_EMARKET_DEFAULT,
        fraisFonctionnement: FIXED_MONTHLY_FRAIS_FONCTIONNEMENT_DEFAULT,
        fraisGestion: FIXED_MONTHLY_FRAIS_GESTION_DEFAULT,
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
          summary.totalHt = data.totalHtSum || 0;
          summary.totalTva = data.totalTvaSum || 0;
          summary.totalAvoir = data.totalAvoirSum || 0;
          summary.totalEffectifSum = data.totalEffectifSumForMonth || 0; 
          summary.dataFound = true;

          summary.manualEmarket = data.manualEmarket !== undefined ? data.manualEmarket : FIXED_MONTHLY_EMARKET_DEFAULT;
          summary.manualFraisFonctionnement = data.manualFraisFonctionnement !== undefined ? data.manualFraisFonctionnement : FIXED_MONTHLY_FRAIS_FONCTIONNEMENT_DEFAULT;
          summary.manualFraisGestion = data.manualFraisGestion !== undefined ? data.manualFraisGestion : FIXED_MONTHLY_FRAIS_GESTION_DEFAULT;
          summary.hasManualAdjustments = data.manualEmarket !== undefined || data.manualFraisFonctionnement !== undefined || data.manualFraisGestion !== undefined;
        } else {
          summary.manualEmarket = FIXED_MONTHLY_EMARKET_DEFAULT;
          summary.manualFraisFonctionnement = FIXED_MONTHLY_FRAIS_FONCTIONNEMENT_DEFAULT;
          summary.manualFraisGestion = FIXED_MONTHLY_FRAIS_GESTION_DEFAULT;
        }
      } catch (error) {
        console.error(`Error loading data from Firestore for ${monthInfo.label} ${year}:`, error);
        toast({ title: "Erreur de chargement Firestore", description: `Données corrompues pour ${monthInfo.label} ${year}.`, variant: "destructive" });
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
      
      summary.totalLigne = (summary.totalHt - summary.totalAvoir) + totalFixedCosts;
        
      return summary;
    });

    const resolvedSummaries = await Promise.all(monthlySummariesPromises);
    setAnnualData(resolvedSummaries);
    setIsLoading(false);
  }, [selectedYear, toast, getFirestoreDocId]);

  useEffect(() => {
    loadAnnualData();
    loadAnnualBudget(selectedYear);
  }, [loadAnnualData, selectedYear, loadAnnualBudget]);

  const handleManualCostChange = (monthIndex: number, field: 'manualEmarket' | 'manualFraisFonctionnement' | 'manualFraisGestion', value: string) => {
    const numericValue = parseFloat(value);
    if (isNaN(numericValue) && value !== '') return;

    setAnnualData(prevData =>
      prevData.map((summary, index) => {
        if (index === monthIndex) {
          const newSummary = {
            ...summary,
            [field]: value === '' ? undefined : numericValue,
            hasManualAdjustments: true,
          };
          
          const actualEmarket = newSummary.manualEmarket ?? FIXED_MONTHLY_EMARKET_DEFAULT;
          const actualFraisFonctionnement = newSummary.manualFraisFonctionnement ?? FIXED_MONTHLY_FRAIS_FONCTIONNEMENT_DEFAULT;
          const actualFraisGestion = newSummary.manualFraisGestion ?? FIXED_MONTHLY_FRAIS_GESTION_DEFAULT;
          const totalFixedCosts = actualEmarket + actualFraisFonctionnement + actualFraisGestion;

          newSummary.prixDeRevient = newSummary.totalEffectifSum !== 0
            ? (newSummary.totalHt - newSummary.totalAvoir + totalFixedCosts) / newSummary.totalEffectifSum
            : 0;
          newSummary.totalLigne = (newSummary.totalHt - newSummary.totalAvoir) + totalFixedCosts;
          
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
      if (summary.hasManualAdjustments) {
        const firestoreDocId = getFirestoreDocId(year, summary.monthIndex);
        const docRef = doc(firestore, "costAnalysisMonthlyEntries", firestoreDocId);
        const dataToSave = {
          manualEmarket: summary.manualEmarket,
          manualFraisFonctionnement: summary.manualFraisFonctionnement,
          manualFraisGestion: summary.manualFraisGestion,
        };
        Object.keys(dataToSave).forEach(key => dataToSave[key as keyof typeof dataToSave] === undefined && delete dataToSave[key as keyof typeof dataToSave]);

        try {
          await setDoc(docRef, dataToSave, { merge: true });
        } catch (error) {
          console.error(`Error saving adjustments for ${summary.month} ${year}:`, error);
          throw error;
        }
      }
    });

    try {
      await Promise.all(savePromises);
      setAnnualData(prev => prev.map(s => ({ ...s, hasManualAdjustments: false })));
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

  const remainingBudget = useMemo(() => {
    return annualBudget - annualTotals.grandTotalLigne;
  }, [annualBudget, annualTotals.grandTotalLigne]);

    const generatePdf = async () => {
    const hasAnyData = annualData.some(m => m.dataFound || m.totalEffectifSum > 0 || m.totalHt > 0 || m.totalAvoir > 0);
    if (!hasAnyData && annualTotals.grandTotalEffectifSum === 0 && annualTotals.grandTotalHt === 0 ) {
       toast({ title: "Aucune Donnée Significative", description: "Aucune donnée à afficher pour cette année.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      // 1. Fetch settings from Firestore
      const allConfigs = await loadPdfLayoutSettingsFromFirestore();
      const pdfSettings = getPdfLayoutSettings('annual_cost', allConfigs);

      const doc = new jsPDF({
        orientation: pdfSettings.orientation,
        unit: 'pt',
        format: pdfSettings.pageSize,
      }) as jsPDFWithAutoTable;

      doc.setFont(pdfSettings.fontFamily);
      const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });
      
      let currentY = pdfSettings.marginTop;
      const pageContentWidth = doc.internal.pageSize.width - pdfSettings.marginLeft - pdfSettings.marginRight;

      // 2. Draw Complex Header from settings
      if (pdfSettings.headerText) {
          const headerRows = pdfSettings.headerText.split('\n');
          doc.setFontSize(pdfSettings.headerFontSize);

          for (const row of headerRows) {
              const cells = row.split('|');
              if (cells.length === 0) continue;
              
              const cellWidth = pageContentWidth / cells.length;
              let maxHeightInRow = 0;
              
              cells.forEach(cell => {
                  const cellText = cell.trim();
                  if (cellText === '{logo}' && pdfSettings.logoUrl) {
                      maxHeightInRow = Math.max(maxHeightInRow, 30);
                  } else {
                      const textLines = doc.splitTextToSize(cellText, cellWidth - 6);
                      const textHeight = textLines.length * pdfSettings.headerFontSize * 0.7;
                      maxHeightInRow = Math.max(maxHeightInRow, textHeight);
                  }
              });
              maxHeightInRow += 6;

              let currentX = pdfSettings.marginLeft;
              for (const cell of cells) {
                  const cellText = cell.trim();
                  doc.rect(currentX, currentY, cellWidth, maxHeightInRow, 'S');

                  if (cellText === '{logo}' && pdfSettings.logoUrl && pdfSettings.logoUrl.startsWith('data:image')) {
                      try {
                          const imgProps = doc.getImageProperties(pdfSettings.logoUrl);
                          const formatType = imgProps.fileType.toUpperCase();
                          const desiredImgHeight = Math.min(maxHeightInRow - 6, 40);
                          const imgWidth = (imgProps.width * desiredImgHeight) / imgProps.height;
                          const imgX = currentX + (cellWidth - imgWidth) / 2;
                          const imgY = currentY + (maxHeightInRow - desiredImgHeight) / 2;
                          doc.addImage(pdfSettings.logoUrl, formatType, imgX, imgY, imgWidth, desiredImgHeight);
                      } catch (e) {
                          console.error("Error adding logo to PDF header cell:", e);
                          doc.text("Logo", currentX + 3, currentY + pdfSettings.headerFontSize);
                      }
                  } else {
                      doc.text(cellText, currentX + 3, currentY + pdfSettings.headerFontSize * 0.8, {
                          maxWidth: cellWidth - 6,
                          align: 'left'
                      });
                  }
                  currentX += cellWidth;
              }
              currentY += maxHeightInRow;
          }
          currentY += 10;
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
        doc.text(finalTitle, doc.internal.pageSize.width / 2, currentY, { align: 'center', maxWidth: pageContentWidth }); 
        currentY += doc.getTextDimensions(finalTitle, { fontSize: pdfSettings.documentTitleFontSize, maxWidth: pageContentWidth }).h + 10;
      }
      
      const headStyles: { fillColor?: [number, number, number], textColor?: [number, number, number], fontStyle?: string, fontSize?: number } = { fontStyle: 'bold', fontSize: pdfSettings.tableHeaderFontSize };
      if (pdfSettings.primaryColor) {
        const primaryRgb = hexToRgb(pdfSettings.primaryColor);
        if (primaryRgb) { headStyles.fillColor = primaryRgb; const brightness = (primaryRgb[0] * 299 + primaryRgb[1] * 587 + primaryRgb[2] * 114) / 1000; headStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255]; }
      }

      const head = [['Mois', 'Total HT (€)', 'Total TVA (€)', 'Total Avoir (€)', 'Total Effectif (Qté)', 'Prix de Revient Mensuel (€)', 'Emarket (€)', 'Frais Fonct. (€)', 'Frais Gestion (€)', 'Dépenses Mensuelles Totales (€)'],];
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
        columnStyles: {
          0: { cellWidth: 'auto' }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' },
          4: { halign: 'right' }, 5: { halign: 'right', cellWidth: 'wrap' }, 6: { halign: 'right' },
          7: { halign: 'right', cellWidth: 'wrap' }, 8: { halign: 'right', cellWidth: 'wrap' }, 9: { halign: 'right', cellWidth: 'wrap' },
        },
        tableWidth: 'auto',
        margin: { left: pdfSettings.marginLeft, right: pdfSettings.marginRight, bottom: pdfSettings.marginBottom },
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          if (pdfSettings.footerText) { let footerStr = pdfSettings.footerText.replace('{date}', generationDateFormatted).replace('{pageNumber}', data.pageNumber.toString()).replace('{totalPages}', pageCount.toString()); doc.setFontSize(pdfSettings.footerFontSize); doc.text(footerStr, data.settings.margin.left, doc.internal.pageSize.height - (pdfSettings.marginBottom / 2)); }
        }
      });
      doc.save(`cout_revien_annuel_${selectedYear}.pdf`);
      toast({ title: "PDF Annuel Généré", description: "Le récapitulatif PDF annuel a été téléchargé." });
    } catch (error) { 
      console.error("Error generating annual PDF:", error); 
      toast({ title: "Erreur PDF", description: "La génération du PDF annuel a échoué.", variant: "destructive" }); 
    } finally { 
      setIsLoading(false); 
    }
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

      <Card>
        <CardHeader>
          <CardTitle>Décompte Budget Annuel</CardTitle>
          <CardDescription>Suivi du budget restant pour l'année sélectionnée.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
                <Label htmlFor="annual-budget-input">Budget Annuel Alloué (€)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    id="annual-budget-input"
                    type="number"
                    value={annualBudget}
                    onChange={(e) => setAnnualBudget(parseFloat(e.target.value) || 0)}
                    placeholder="Entrez le budget annuel"
                    disabled={isBudgetLoading}
                  />
                  <Button onClick={handleSaveBudget} disabled={isSavingBudget || isBudgetLoading} variant="outline" size="icon">
                    {isSavingBudget ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    <span className="sr-only">Sauvegarder le budget</span>
                  </Button>
                </div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted flex-1">
                <p className="text-sm font-medium text-muted-foreground">Dépenses Totales</p>
                <p className="text-2xl font-bold">{annualTotals.grandTotalLigne.toFixed(2)} €</p>
            </div>
            <div className={cn("text-center p-4 rounded-lg flex-1", remainingBudget >= 0 ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900')}>
                <p className={cn("text-sm font-medium", remainingBudget >= 0 ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200')}>Budget Restant</p>
                <p className={cn("text-2xl font-bold", remainingBudget >= 0 ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200')}>{remainingBudget.toFixed(2)} €</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
