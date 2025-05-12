
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
      const monthKey = `cost_analysis_${year}_${monthIndex}`;
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
        const storedData = localStorage.getItem(monthKey);
        if (storedData) {
          const monthCostEntries: CostEntry[] = JSON.parse(storedData);
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
        console.error(`Error loading data for ${monthLabels[monthIndex].label} ${year}:`, error);
        toast({ title: "Erreur de chargement", description: `Données corrompues pour ${monthLabels[monthIndex].label} ${year}.`, variant: "destructive" });
      }
      
      const totalFixedCosts = summary.emarket + summary.fraisFonctionnement + summary.fraisGestion;
      summary.prixDeRevient = summary.totalEffectifSum !== 0 
        ? (summary.totalHt - summary.totalAvoir + totalFixedCosts) / summary.totalEffectifSum 
        : 0;
      
      summary.totalLigne = summary.totalHt + summary.totalTva + summary.totalAvoir + summary.totalEffectifSum + summary.emarket + summary.fraisFonctionnement + summary.fraisGestion;
        
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
    let grandTotalEffectifSum = 0;
    let grandTotalLigne = 0;
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
      
      if (summary.totalEffectifSum > 0) { 
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

    setIsLoading(true);
    try {
      const doc = new jsPDF('landscape') as jsPDFWithAutoTable;
      const title = `Récapitulatif Annuel Coût de Revient - ${selectedYear}`;
      
      doc.setFontSize(18);
      doc.text(title, 14, 20);
      doc.setFontSize(10);
      doc.text(`Généré le: ${format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}`, 14, 28);

      const head = [['Mois', 'Total HT (€)', 'Total TVA (€)', 'Total Avoir (€)', 'Total Effectif', 'Prix de Revient Mensuel (€)', 'Emarket (€)', 'Frais Fonct. (€)', 'Frais Gestion (€)', 'Total Ligne (€)']];
      
      const body = annualData.map(summary => [
        summary.month,
        summary.totalHt.toFixed(2),
        summary.totalTva.toFixed(2),
        summary.totalAvoir.toFixed(2),
        summary.totalEffectifSum.toFixed(2),
        summary.prixDeRevient.toFixed(2),
        summary.emarket.toFixed(2),
        summary.fraisFonctionnement.toFixed(2),
        summary.fraisGestion.toFixed(2),
        summary.totalLigne.toFixed(2),
      ]);
      
      const footer = [
        [
          { content: 'TOTAL ANNUEL', styles: { fontStyle: 'bold' } },
          { content: annualTotals.grandTotalHt.toFixed(2), styles: { fontStyle: 'bold' } },
          { content: annualTotals.grandTotalTva.toFixed(2), styles: { fontStyle: 'bold' } },
          { content: annualTotals.grandTotalAvoir.toFixed(2), styles: { fontStyle: 'bold' } },
          { content: annualTotals.grandTotalEffectifSum.toFixed(2), styles: { fontStyle: 'bold' } },
          { content: annualTotals.overallPrixDeRevient.toFixed(2), styles: { fontStyle: 'bold' } }, // Overall PR
          { content: annualTotals.grandTotalEmarket.toFixed(2), styles: { fontStyle: 'bold' } },
          { content: annualTotals.grandTotalFraisFonctionnement.toFixed(2), styles: { fontStyle: 'bold' } },
          { content: annualTotals.grandTotalFraisGestion.toFixed(2), styles: { fontStyle: 'bold' } },
          { content: annualTotals.grandTotalLigne.toFixed(2), styles: { fontStyle: 'bold' } },
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
        startY: 35,
        theme: 'grid',
        headStyles: { fillColor: [22, 160, 133] }, 
        footStyles: { fillColor: [220, 220, 220], textColor: [0,0,0] },
        columnStyles: {
            0: { cellWidth: 'auto' }, // Mois
            1: { cellWidth: 'auto', halign: 'right' }, // Total HT
            2: { cellWidth: 'auto', halign: 'right' }, // Total TVA
            3: { cellWidth: 'auto', halign: 'right' }, // Total Avoir
            4: { cellWidth: 'auto', halign: 'right' }, // Total Effectif
            5: { cellWidth: 'auto', halign: 'right' }, // Prix de Revient Mensuel
            6: { cellWidth: 'auto', halign: 'right' }, // Emarket
            7: { cellWidth: 'auto', halign: 'right' }, // Frais Fonct.
            8: { cellWidth: 'auto', halign: 'right' }, // Frais Gestion
            9: { cellWidth: 'auto', halign: 'right' }, // Total Ligne
        },
        didDrawPage: (data) => {
          const pageCount = doc.getNumberOfPages();
          doc.setFontSize(8);
          doc.text(`Page ${data.pageNumber} sur ${pageCount}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
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
              <TableHead className="text-right">Total Effectif</TableHead>
              <TableHead className="text-right">Prix de Revient Mensuel (€)</TableHead>
              <TableHead className="text-right">Emarket (€)</TableHead>
              <TableHead className="text-right">Frais Fonct. (€)</TableHead>
              <TableHead className="text-right">Frais Gestion (€)</TableHead>
              <TableHead className="text-right">Total Ligne (€)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {annualData.map((summary, index) => (
              <TableRow key={index} className={cn(!summary.dataFound && "opacity-70")}>
                <TableCell className="font-medium">{summary.month}</TableCell>
                <TableCell className="text-right">{summary.totalHt.toFixed(2)}</TableCell>
                <TableCell className="text-right">{summary.totalTva.toFixed(2)}</TableCell>
                <TableCell className="text-right">{summary.totalAvoir.toFixed(2)}</TableCell>
                <TableCell className="text-right">{summary.totalEffectifSum.toFixed(2)}</TableCell>
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
              <TableCell className="text-right">{annualTotals.grandTotalEffectifSum.toFixed(2)}</TableCell>
              <TableCell className="text-right">{annualTotals.overallPrixDeRevient.toFixed(2)}</TableCell> 
              <TableCell className="text-right">{annualTotals.grandTotalEmarket.toFixed(2)}</TableCell>
              <TableCell className="text-right">{annualTotals.grandTotalFraisFonctionnement.toFixed(2)}</TableCell>
              <TableCell className="text-right">{annualTotals.grandTotalFraisGestion.toFixed(2)}</TableCell>
              <TableCell className="text-right">{annualTotals.grandTotalLigne.toFixed(2)}</TableCell>
            </TableRow>
            <TableRow className="font-bold bg-muted/80 text-foreground">
              <TableCell colSpan={9} className="text-right">Prix de Revient Annuel Moyen (basé sur PR mensuels avec effectif > 0)</TableCell>
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

