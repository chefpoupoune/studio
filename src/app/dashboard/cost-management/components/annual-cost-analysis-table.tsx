
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
        totalEffectifSum: 0,
        prixDeRevient: 0,
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
            summary.prixDeRevient = summary.totalEffectifSum !== 0 ? (summary.totalHt - summary.totalAvoir) / summary.totalEffectifSum : 0;
          }
        }
      } catch (error) {
        console.error(`Error loading data for ${monthLabels[monthIndex].label} ${year}:`, error);
        toast({ title: "Erreur de chargement", description: `Données corrompues pour ${monthLabels[monthIndex].label} ${year}.`, variant: "destructive" });
      }
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
    let grandTotalEffectifSum = 0;
    let monthsWithData = 0;
    let sumOfPrixDeRevient = 0;

    annualData.forEach(summary => {
      grandTotalHt += summary.totalHt;
      grandTotalTva += summary.totalTva;
      grandTotalAvoir += summary.totalAvoir;
      grandTotalEffectifSum += summary.totalEffectifSum;
      if (summary.dataFound && summary.totalEffectifSum > 0) { // only count if data was found and effectif is not zero
        sumOfPrixDeRevient += summary.prixDeRevient;
        monthsWithData++;
      }
    });
    
    const averagePrixDeRevient = monthsWithData > 0 ? sumOfPrixDeRevient / monthsWithData : 0;
    // Alternative calculation for annual prix de revient based on annual totals
    const overallPrixDeRevient = grandTotalEffectifSum !== 0 ? (grandTotalHt - grandTotalAvoir) / grandTotalEffectifSum : 0;


    return { grandTotalHt, grandTotalTva, grandTotalAvoir, grandTotalEffectifSum, averagePrixDeRevient, overallPrixDeRevient };
  }, [annualData]);

  const generatePdf = () => {
    if (annualData.every(m => !m.dataFound)) {
       toast({ title: "Aucune Donnée", description: "Aucune donnée mensuelle trouvée pour cette année.", variant: "destructive" });
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

      const head = [['Mois', 'Total HT (€)', 'Total TVA (€)', 'Total Avoir (€)', 'Total Effectif', 'Prix de Revient Mensuel (€)']];
      
      const body = annualData.map(summary => [
        summary.month,
        summary.totalHt.toFixed(2),
        summary.totalTva.toFixed(2),
        summary.totalAvoir.toFixed(2),
        summary.totalEffectifSum.toFixed(2),
        summary.prixDeRevient.toFixed(2),
      ]);
      
      const footer = [
        [
          { content: 'TOTAL ANNUEL', styles: { fontStyle: 'bold' } },
          { content: annualTotals.grandTotalHt.toFixed(2), styles: { fontStyle: 'bold' } },
          { content: annualTotals.grandTotalTva.toFixed(2), styles: { fontStyle: 'bold' } },
          { content: annualTotals.grandTotalAvoir.toFixed(2), styles: { fontStyle: 'bold' } },
          { content: annualTotals.grandTotalEffectifSum.toFixed(2), styles: { fontStyle: 'bold' } },
          { content: annualTotals.overallPrixDeRevient.toFixed(2), styles: { fontStyle: 'bold' } }, // Using overall annual PR
        ],
         [
          { content: 'Prix de Revient Annuel Moyen', colSpan: 5, styles: { fontStyle: 'bold', halign: 'right' } },
          { content: annualTotals.averagePrixDeRevient.toFixed(2), styles: { fontStyle: 'bold' } } // Average of monthly PRs
        ]
      ];

      doc.autoTable({
        head: head,
        body: body,
        foot: footer,
        startY: 35,
        theme: 'grid',
        headStyles: { fillColor: [22, 160, 133] }, // Example: teal
        footStyles: { fillColor: [220, 220, 220], textColor: [0,0,0] },
        columnStyles: {
            0: { cellWidth: 'auto' }, 
            1: { cellWidth: 'auto', halign: 'right' },
            2: { cellWidth: 'auto', halign: 'right' },
            3: { cellWidth: 'auto', halign: 'right' },
            4: { cellWidth: 'auto', halign: 'right' },
            5: { cellWidth: 'auto', halign: 'right' },
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
          <Button onClick={generatePdf} disabled={isLoading || annualData.every(m => !m.dataFound)} className="w-full sm:w-auto">
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {annualData.map((summary, index) => (
              <TableRow key={index} className={cn(!summary.dataFound && "bg-muted/30 opacity-70")}>
                <TableCell className="font-medium">{summary.month}</TableCell>
                <TableCell className="text-right">{summary.totalHt.toFixed(2)}</TableCell>
                <TableCell className="text-right">{summary.totalTva.toFixed(2)}</TableCell>
                <TableCell className="text-right">{summary.totalAvoir.toFixed(2)}</TableCell>
                <TableCell className="text-right">{summary.totalEffectifSum.toFixed(2)}</TableCell>
                <TableCell className="text-right">{summary.prixDeRevient.toFixed(2)}</TableCell>
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
            </TableRow>
            <TableRow className="font-bold bg-muted/80 text-foreground">
              <TableCell colSpan={5} className="text-right">Prix de Revient Annuel Moyen (basé sur les PR mensuels)</TableCell>
              <TableCell className="text-right">{annualTotals.averagePrixDeRevient.toFixed(2)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      )}
       {!isLoading && annualData.every(m => !m.dataFound) && (
         <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
            <CalendarRange className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
                Aucune donnée mensuelle trouvée pour l'année {selectedYear}.
            </p>
            <p className="text-xs text-muted-foreground/70">
                Veuillez saisir des données dans l'onglet "Coût de Revient Mensuel" pour cette année.
            </p>
        </div>
      )}
    </div>
  );
}

