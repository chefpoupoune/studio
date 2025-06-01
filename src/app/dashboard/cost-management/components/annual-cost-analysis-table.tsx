
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { CostEntry, MonthlySummary } from '../types';
import { months as monthLabels, years as yearOptions, currentYear, calculateRowTotal, calculateRowEffectif } from '../types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { FileText, Loader2, CalendarRange } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import { firestore } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const FIXED_MONTHLY_EMARKET = 62.50;
const FIXED_MONTHLY_FRAIS_FONCTIONNEMENT = 278.04;
const FIXED_MONTHLY_FRAIS_GESTION = 210.00;

export default function AnnualCostAnalysisTable() {
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [annualData, setAnnualData] = useState<MonthlySummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const loadAnnualData = useCallback(async () => {
    setIsLoading(true);
    const year = parseInt(selectedYear);
    const monthlySummaries: MonthlySummary[] = [];

    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const firestoreDocId = `entry_${year}_${monthIndex}`;
      let summary: MonthlySummary = {
        month: monthLabels[monthIndex].label,
        monthIndex: monthIndex,
        totalHt: 0,
        totalTva: 0,
        totalAvoir: 0,
        emarket: FIXED_MONTHLY_EMARKET,
        fraisFonctionnement: FIXED_MONTHLY_FRAIS_FONCTIONNEMENT,
        fraisGestion: FIXED_MONTHLY_FRAIS_GESTION,
        totalEffectifSum: 0,
        prixDeRevient: 0,
        totalLigne: 0,
        dataFound: false,
      };

      try {
        const docRef = doc(firestore, "costAnalysisMonthlyEntries", firestoreDocId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const monthCostEntries: CostEntry[] = docSnap.data().entries || [];
          if (monthCostEntries.length > 0) {
            summary.dataFound = true;
            monthCostEntries.forEach(entry => {
              summary.totalHt += entry.ht || 0;
              summary.totalTva += entry.tva || 0;
              summary.totalAvoir += entry.avoir || 0;
              const rowTotal = calculateRowTotal(entry);
              summary.totalEffectifSum += calculateRowEffectif(entry, rowTotal);
            });
          }
        }
      } catch (error) {
        console.error(`Error loading data from Firestore for ${monthLabels[monthIndex].label} ${year}:`, error);
        toast({ title: "Erreur de chargement Firestore", description: `Données corrompues pour ${monthLabels[monthIndex].label} ${year}.`, variant: "destructive" });
      }
      
      const totalFixedCosts = summary.emarket + summary.fraisFonctionnement + summary.fraisGestion;
      summary.prixDeRevient = summary.totalEffectifSum !== 0 
        ? (summary.totalHt - summary.totalAvoir + totalFixedCosts) / summary.totalEffectifSum 
        : 0;
      
      // Recalculate totalLigne. It should sum all costs including fixed ones.
      // Original totalLigne was: summary.totalHt + summary.totalTva + summary.totalAvoir + summary.totalEffectifSum + totalFixedCosts
      // Let's confirm the definition. If "Prix de Revient Mensuel avec Frais de Gestion" is the total *expenditure*
      // then it could be: Total Biens (HT - Avoir) + Total TVA + Total Frais Fixes.
      // "Prix de revient" typically refers to cost per unit.
      // The column header is "Prix de Revient Mensuel avec Frais de Gestion (€)"
      // So, if `prixDeRevient` is cost per `totalEffectifSum`, then `totalLigne` should be `prixDeRevient * totalEffectifSum` if `totalEffectifSum` is # of items,
      // OR it might be the sum of all actual costs for the month.
      // Let's assume for now it's the sum of all monetary values in the row as it was previously calculated.
      // Total HT + Total TVA - Total Avoir (valeur d'achat réelle) + Total Effectif (valeur ajoutée par le travail) + Frais Fixes
      // Wait, Total Effectif is a quantity, not a monetary value. It's `sum(calculateRowEffectif(entry, rowTotal))`
      // And `rowTotal` is sum of IMP, SAJ, IME, ESAT, RepasPlus, Nous. These look like quantities.
      // So, `totalEffectifSum` IS a sum of quantities.
      // The column "Prix de Revient Mensuel (€)" IS `(totalHt - totalAvoir + totalFixedCosts) / totalEffectifSum`. This is correct.
      // The column "Prix de Revient Mensuel avec Frais de Gestion (€)" implies this is the "Total Ligne"
      // If so, it means the total expenses of the month.
      // Total Expenses = (Total HT - Total Avoir) + Total TVA + Total Frais Fixes
      summary.totalLigne = (summary.totalHt - summary.totalAvoir) + summary.totalTva + totalFixedCosts;
        
      monthlySummaries.push(summary);
    }
    setAnnualData(monthlySummaries);
    setIsLoading(false);
  }, [selectedYear, toast]);

  useEffect(() => {
    loadAnnualData();
  }, [loadAnnualData]);

  const annualTotals = useMemo(() => {
    let grandTotalHt = 0;
    let grandTotalTva = 0;
    let grandTotalAvoir = 0;
    let grandTotalEmarket = 0;
    let grandTotalFraisFonctionnement = 0;
    let grandTotalFraisGestion = 0;
    let grandTotalEffectifSum = 0; // This is sum of quantities
    let grandTotalLigne = 0; // This is sum of monthly total expenses
    let monthsWithDataForPRAverage = 0;
    let sumOfPrixDeRevient = 0;

    annualData.forEach(summary => {
      grandTotalHt += summary.totalHt;
      grandTotalTva += summary.totalTva;
      grandTotalAvoir += summary.totalAvoir;
      grandTotalEmarket += summary.emarket;
      grandTotalFraisFonctionnement += summary.fraisFonctionnement;
      grandTotalFraisGestion += summary.fraisGestion;
      grandTotalEffectifSum += summary.totalEffectifSum;
      grandTotalLigne += summary.totalLigne;
      
      if (summary.totalEffectifSum > 0 && summary.prixDeRevient > 0) { 
        sumOfPrixDeRevient += summary.prixDeRevient;
        monthsWithDataForPRAverage++;
      }
    });
    
    // Average of monthly "Prix de Revient"
    const averagePrixDeRevient = monthsWithDataForPRAverage > 0 ? sumOfPrixDeRevient / monthsWithDataForPRAverage : 0;
    
    // Overall annual "Prix de Revient" based on annual totals
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

    setIsLoading(true);
    try {
      const pdfSettings = getPdfLayoutSettings('annual_cost');
      const doc = new jsPDF('landscape') as jsPDFWithAutoTable;
      const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });
      
      let currentY = pdfSettings.marginTop;
      if (pdfSettings.headerText) {
        const headerRows = pdfSettings.headerText.split('\n').map(rowText =>
          rowText.split('|').map(cellText => cellText.trim())
        );
        const headerTableBody = headerRows.map(row => row.map(cell => cell === '{logo}' ? '' : cell));

        doc.autoTable({
          body: headerTableBody,
          startY: currentY,
          theme: 'plain',
          styles: { fontSize: pdfSettings.headerFontSize, cellPadding: 1, font: pdfSettings.fontFamily },
          columnStyles: { 0: { cellWidth: 'auto'} },
          margin: { top: pdfSettings.marginTop, left: pdfSettings.marginLeft, right: pdfSettings.marginRight },
          didDrawCell: (data) => {
            if (pdfSettings.logoUrl && pdfSettings.logoUrl.startsWith('data:image') && headerRows[data.row.index][data.column.index] === '{logo}') {
              try {
                const imgProps = doc.getImageProperties(pdfSettings.logoUrl);
                const formatType = imgProps.fileType.toUpperCase();
                let imgWidth = data.cell.width - 4; // Padding
                let imgHeight = data.cell.height - 4;
                const cellAspectRatio = data.cell.width / data.cell.height;
                const imgAspectRatio = imgProps.width / imgProps.height;
                if (imgAspectRatio > cellAspectRatio) imgHeight = imgWidth / imgAspectRatio; else imgWidth = imgHeight * imgAspectRatio;
                const imgX = data.cell.x + (data.cell.width - imgWidth) / 2;
                const imgY = data.cell.y + (data.cell.height - imgHeight) / 2;
                doc.addImage(pdfSettings.logoUrl, formatType, imgX, imgY, imgWidth, imgHeight);
              } catch (e: any) { console.error(`Error drawing logo in PDF header table: ${e.message || e}.`);}
            }
          },
        });
        currentY = (doc as any).lastAutoTable.finalY + 5;
      } else if (pdfSettings.logoUrl && pdfSettings.logoUrl.startsWith('data:image')) {
        try {
            const imgProps = doc.getImageProperties(pdfSettings.logoUrl);
            const formatType = imgProps.fileType.toUpperCase();
            const desiredHeight = 30;
            const imgWidth = (imgProps.width * desiredHeight) / imgProps.height;
            doc.addImage(pdfSettings.logoUrl, formatType, pdfSettings.marginLeft, currentY, imgWidth, desiredHeight);
            currentY += desiredHeight + 5;
        } catch(e: any) { console.error(`Error drawing standalone logo in PDF: ${e.message || e}.`); }
      }
      
      const baseDocTitle = pdfSettings.documentBaseTitle || "Récapitulatif Annuel Coût de Revient";
      const title = `${baseDocTitle} - ${selectedYear}`;
      doc.setFontSize(pdfSettings.documentTitleFontSize);
      doc.text(title, pdfSettings.marginLeft, currentY);
      currentY += pdfSettings.documentTitleFontSize * 0.7 + 5;
      doc.setFontSize(pdfSettings.defaultFontSize);
      doc.text(`Généré le: ${generationDateFormatted}`, pdfSettings.marginLeft, currentY);
      currentY += pdfSettings.defaultFontSize + 7;

      const headStyles: { fillColor?: [number, number, number], textColor?: [number, number, number], fontStyle?: string, fontSize?: number } = {
        fontStyle: 'bold',
        fontSize: pdfSettings.tableHeaderFontSize,
      };

      if (pdfSettings.primaryColor) {
        const primaryRgb = hexToRgb(pdfSettings.primaryColor);
        if (primaryRgb) {
          headStyles.fillColor = primaryRgb;
          const brightness = (primaryRgb[0] * 299 + primaryRgb[1] * 587 + primaryRgb[2] * 114) / 1000;
          headStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
        }
      }

      const head = [['Mois', 'Total HT (€)', 'Total TVA (€)', 'Total Avoir (€)', 'Total Effectif (Quantité)', 'Prix de Revient Mensuel (€)', 'Emarket (€)', 'Frais Fonct. (€)', 'Frais Gestion (€)', 'Dépenses Mensuelles Totales (€)']];
      
      const body = annualData.map(summary => [
        summary.month,
        summary.totalHt.toFixed(2),
        summary.totalTva.toFixed(2),
        summary.totalAvoir.toFixed(2),
        summary.totalEffectifSum.toFixed(0), // Display as integer
        summary.prixDeRevient.toFixed(2),
        summary.emarket.toFixed(2),
        summary.fraisFonctionnement.toFixed(2),
        summary.fraisGestion.toFixed(2),
        summary.totalLigne.toFixed(2), // totalLigne is now Dépenses Mensuelles Totales
      ]);
      
      const footer = [
        [
          { content: 'TOTAL ANNUEL', styles: { fontStyle: 'bold' } },
          { content: annualTotals.grandTotalHt.toFixed(2), styles: { fontStyle: 'bold' } },
          { content: annualTotals.grandTotalTva.toFixed(2), styles: { fontStyle: 'bold' } },
          { content: annualTotals.grandTotalAvoir.toFixed(2), styles: { fontStyle: 'bold' } },
          { content: annualTotals.grandTotalEffectifSum.toFixed(0), styles: { fontStyle: 'bold' } }, // Display as integer
          { content: annualTotals.overallPrixDeRevient.toFixed(2), styles: { fontStyle: 'bold', description: 'Prix de revient annuel global' } }, 
          { content: annualTotals.grandTotalEmarket.toFixed(2), styles: { fontStyle: 'bold' } },
          { content: annualTotals.grandTotalFraisFonctionnement.toFixed(2), styles: { fontStyle: 'bold' } },
          { content: annualTotals.grandTotalFraisGestion.toFixed(2), styles: { fontStyle: 'bold' } },
          { content: annualTotals.grandTotalLigne.toFixed(2), styles: { fontStyle: 'bold' } }, // Dépenses Annuelles Totales
        ],
         [
          { content: 'Prix de Revient Annuel Moyen (basé sur PR mensuels avec effectif > 0)', colSpan: 9, styles: { fontStyle: 'bold', halign: 'right' } },
          { content: annualTotals.averagePrixDeRevient.toFixed(2), styles: { fontStyle: 'bold', halign: 'right' } }
        ]
      ];

      doc.autoTable({
        head: head,
        body: body,
        foot: footer,
        startY: currentY,
        theme: 'grid',
        headStyles: headStyles, 
        styles: { fontSize: pdfSettings.tableBodyFontSize, font: pdfSettings.fontFamily },
        footStyles: { fillColor: [220, 220, 220], textColor: [0,0,0], fontStyle: 'bold' },
        columnStyles: {
            0: { cellWidth: 'auto' }, 
            1: { cellWidth: 'auto', halign: 'right' }, 
            2: { cellWidth: 'auto', halign: 'right' }, 
            3: { cellWidth: 'auto', halign: 'right' }, 
            4: { cellWidth: 'auto', halign: 'right' }, 
            5: { cellWidth: 'auto', halign: 'right' }, 
            6: { cellWidth: 'auto', halign: 'right' }, 
            7: { cellWidth: 'auto', halign: 'right' }, 
            8: { cellWidth: 'auto', halign: 'right' }, 
            9: { cellWidth: 'auto', halign: 'right' }, 
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

      doc.save(`cout_revient_annuel_${selectedYear}.pdf`);
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
        <div className="sm:col-start-3">
           <Button 
            onClick={generatePdf} 
            disabled={isLoading || noDataForYear} 
            className="w-full sm:w-auto"
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
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
              <TableHead className="text-right">Emarket (€)</TableHead>
              <TableHead className="text-right">Frais Fonct. (€)</TableHead>
              <TableHead className="text-right">Frais Gestion (€)</TableHead>
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
                <TableCell className="text-right">{summary.emarket.toFixed(2)}</TableCell>
                <TableCell className="text-right">{summary.fraisFonctionnement.toFixed(2)}</TableCell>
                <TableCell className="text-right">{summary.fraisGestion.toFixed(2)}</TableCell>
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
