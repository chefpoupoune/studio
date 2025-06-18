
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FileText, Loader2, Trash2, Users } from 'lucide-react';
import { format, getDaysInMonth, getDate, getDay, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { BenefitEmployee, BenefitDailyStatusCode, FullMonthlyBenefitData, DailyBenefitEntry } from '../types';
import { BENEFIT_STATUS_CODES, BENEFIT_STATUS_LEGEND, frenchShortDays } from '../types';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { firestore } from '@/lib/firebase';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);
const months = Array.from({ length: 12 }, (_, i) => ({
  value: i.toString(),
  label: format(new Date(currentYear, i), "MMMM", { locale: fr }),
}));

const SELECT_EMPTY_VALUE_PLACEHOLDER = "_SELECT_EMPTY_";

interface BenefitTrackingTableProps {
  employees: BenefitEmployee[];
}

export default function BenefitTrackingTable({ employees: employeesToRender }: BenefitTrackingTableProps) {
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
  const [benefitData, setBenefitData] = useState<FullMonthlyBenefitData>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [initialDocExists, setInitialDocExists] = useState<boolean | null>(null);
  const { toast } = useToast();

  const getFirestoreDocId = useCallback(
    () => `benefit_tracking_${selectedYear}_${selectedMonth}`,
    [selectedYear, selectedMonth]
  );

  const daysInSelectedMonth = useMemo(() => {
    const year = parseInt(selectedYear);
    const month = parseInt(selectedMonth);
    const numDays = getDaysInMonth(new Date(year, month));
    return Array.from({ length: numDays }, (_, i) => {
      const date = new Date(year, month, i + 1);
      return {
        dayNumber: i + 1,
        dayLetter: frenchShortDays[getDay(date)],
        isWeekend: getDay(date) === 0 || getDay(date) === 6,
      };
    });
  }, [selectedYear, selectedMonth]);

  // Load data from Firestore
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setInitialDocExists(null); 
      const docId = getFirestoreDocId();
      const docRef = doc(firestore, "monthlyBenefitData", docId);
      try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setBenefitData(docSnap.data() as FullMonthlyBenefitData);
          setInitialDocExists(true);
        } else {
          const initialData: FullMonthlyBenefitData = {};
          const yearNum = parseInt(selectedYear);
          const monthNum = parseInt(selectedMonth);

          employeesToRender.forEach(employee => {
            initialData[employee.id] = {};
            daysInSelectedMonth.forEach(day => {
              const dateKey = `${yearNum}-${(monthNum + 1).toString().padStart(2, '0')}-${day.dayNumber.toString().padStart(2, '0')}`;
              initialData[employee.id][dateKey] = { planning: "X", repasPris: "" }; // Default "X" for planning
            });
          });
          setBenefitData(initialData);
          setInitialDocExists(false);
        }
      } catch (error) {
        console.error("Error loading benefit data from Firestore:", error);
        const initialDataOnError: FullMonthlyBenefitData = {};
        const yearNumOnError = parseInt(selectedYear);
        const monthNumOnError = parseInt(selectedMonth);
        employeesToRender.forEach(employee => {
            initialDataOnError[employee.id] = {};
            daysInSelectedMonth.forEach(day => {
              const dateKey = `${yearNumOnError}-${(monthNumOnError + 1).toString().padStart(2, '0')}-${day.dayNumber.toString().padStart(2, '0')}`;
              initialDataOnError[employee.id][dateKey] = { planning: "X", repasPris: "" }; // Default "X" for planning
            });
        });
        setBenefitData(initialDataOnError);
        setInitialDocExists(false);
        toast({ title: "Erreur de chargement", description: "Données d'avantages non chargées. Initialisation par défaut.", variant: "destructive" });
      }
      setIsLoading(false);
    };
    loadData();
  }, [selectedYear, selectedMonth, getFirestoreDocId, toast, employeesToRender, daysInSelectedMonth]);

  // Save data to Firestore (debounced)
  useEffect(() => {
    const saveData = async () => {
      if (isLoading || isSaving) return; 

      if (initialDocExists === false && Object.keys(benefitData).length === 0 && employeesToRender.length > 0) {
        // This condition might need adjustment if we pre-fill.
        // If pre-filling makes benefitData not empty, this check might prevent saving the pre-fill.
        // However, if pre-filling is the desired state to save, this check is fine.
        // The current logic aims to save if benefitData is NOT empty OR if the doc initially existed.
        // If initialDocExists is false AND benefitData has content (like default 'X's), it will save.
      } else if (initialDocExists === false && Object.keys(benefitData).length === 0) {
         // If doc didn't exist and data is truly empty (e.g., after a clear), don't save empty shell.
        return;
      }


      setIsSaving(true);
      const docId = getFirestoreDocId();
      const docRef = doc(firestore, "monthlyBenefitData", docId);
      try {
        await setDoc(docRef, benefitData);
      } catch (error) {
        console.error("Error saving benefit data to Firestore:", error);
        toast({ title: "Erreur de sauvegarde", description: "Impossible d'enregistrer les données dans Firestore.", variant: "destructive" });
      }
      setIsSaving(false);
    };

    const timeoutId = setTimeout(() => {
      if (initialDocExists !== null) {
        saveData();
      }
    }, 1500); 

    return () => clearTimeout(timeoutId);
  }, [benefitData, isLoading, isSaving, initialDocExists, getFirestoreDocId, toast, employeesToRender]);


  const handleStatusChange = (
    employeeId: string,
    dayNumber: number,
    type: 'planning' | 'repasPris',
    valueFromSelect: string
  ) => {
    const actualValueToStore = valueFromSelect === SELECT_EMPTY_VALUE_PLACEHOLDER ? "" : valueFromSelect as BenefitDailyStatusCode;
    const dateKey = `${selectedYear}-${(parseInt(selectedMonth) + 1).toString().padStart(2, '0')}-${dayNumber.toString().padStart(2, '0')}`;
    setBenefitData(prev => {
      const employeeData = prev[employeeId] || {};
      const dayEntry = employeeData[dateKey] || { planning: "", repasPris: "" };
      return {
        ...prev,
        [employeeId]: {
          ...employeeData,
          [dateKey]: { ...dayEntry, [type]: actualValueToStore },
        },
      };
    });
  };

  const calculateTotal = (employeeId: string, type: 'planning' | 'repasPris'): number => {
    const employeeEntries = benefitData[employeeId];
    if (!employeeEntries) return 0;
    return Object.values(employeeEntries).reduce((sum, entry) => sum + (entry[type] === "X" ? 1 : 0), 0);
  };

  const handleConfirmClearMonthData = async () => {
    setIsSaving(true);
    const docId = getFirestoreDocId();
    const docRef = doc(firestore, "monthlyBenefitData", docId);
    try {
      await deleteDoc(docRef);
      // Re-initialize with defaults instead of just empty
      const initialData: FullMonthlyBenefitData = {};
      const yearNum = parseInt(selectedYear);
      const monthNum = parseInt(selectedMonth);
      employeesToRender.forEach(employee => {
        initialData[employee.id] = {};
        daysInSelectedMonth.forEach(day => {
          const dateKey = `${yearNum}-${(monthNum + 1).toString().padStart(2, '0')}-${day.dayNumber.toString().padStart(2, '0')}`;
          initialData[employee.id][dateKey] = { planning: "X", repasPris: "" };
        });
      });
      setBenefitData(initialData);
      setInitialDocExists(false); 
      toast({ title: "Données Effacées et Réinitialisées", description: `Les données pour ${months[parseInt(selectedMonth)].label} ${selectedYear} ont été effacées et réinitialisées par défaut.` });
    } catch (error) {
      console.error("Error deleting benefit data from Firestore:", error);
      toast({ title: "Erreur de suppression", description: "Impossible de supprimer les données de Firestore.", variant: "destructive" });
    }
    setIsSaving(false);
  };

  const generatePdf = () => {
    setIsLoading(true); 
    try {
      const pdfSettings = getPdfLayoutSettings('benefits');
      const doc = new jsPDF({
        orientation: pdfSettings.orientation,
        unit: 'pt',
        format: pdfSettings.pageSize,
      }) as jsPDFWithAutoTable;

      doc.setFont(pdfSettings.fontFamily || 'helvetica');

      const monthLabel = months.find(m => m.value === selectedMonth)?.label || '';
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
                const cellPadding = 2;
                let imgWidth = data.cell.width - 2 * cellPadding;
                let imgHeight = data.cell.height - 2 * cellPadding;
                const cellAspectRatio = data.cell.width / data.cell.height;
                const imgAspectRatio = imgProps.width / imgProps.height;

                if (imgAspectRatio > cellAspectRatio) {
                    imgHeight = imgWidth / imgAspectRatio;
                } else {
                    imgWidth = imgHeight * imgAspectRatio;
                }
                const imgX = data.cell.x + (data.cell.width - imgWidth) / 2;
                const imgY = data.cell.y + (data.cell.height - imgHeight) / 2;
                doc.addImage(pdfSettings.logoUrl, formatType, imgX, imgY, imgWidth, imgHeight);
              } catch (e: any) {
                console.error(`Error drawing logo in PDF header table: ${e.message || e}. Cell:`, data.cell, {logoUrl: pdfSettings.logoUrl ? pdfSettings.logoUrl.substring(0, 50) + "..." : "N/A"});
                doc.setFillColor(230, 230, 230); doc.rect(data.cell.x + 2, data.cell.y + 2, data.cell.width - 4, data.cell.height - 4, 'F');
                doc.setFontSize(pdfSettings.footerFontSize || 8); doc.setTextColor(100); doc.text("LOGO_ERR", data.cell.x + data.cell.width/2, data.cell.y + data.cell.height/2, {align: 'center', baseline: 'middle'});
              }
            } else if (pdfSettings.logoUrl && headerRows[data.row.index][data.column.index] === '{logo}') {
                doc.setFillColor(230, 230, 230); doc.rect(data.cell.x + 2, data.cell.y + 2, data.cell.width - 4, data.cell.height - 4, 'F');
                doc.setFontSize(pdfSettings.footerFontSize || 8); doc.setTextColor(100); doc.text("LOGO", data.cell.x + data.cell.width/2, data.cell.y + data.cell.height/2, {align: 'center', baseline: 'middle'});
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
        } catch(e: any) {
            console.error(`Error drawing standalone logo in PDF: ${e.message || e}.`, {logoUrl: pdfSettings.logoUrl ? pdfSettings.logoUrl.substring(0, 50) + "..." : "N/A"});
            doc.setFontSize(pdfSettings.defaultFontSize || 10); doc.text(`[Logo Error]`, pdfSettings.marginLeft, currentY); currentY += (pdfSettings.defaultFontSize || 10) + 5;
        }
      } else if (pdfSettings.logoUrl) {
         doc.setFontSize(pdfSettings.defaultFontSize || 10); doc.text(`[Logo URL: ${pdfSettings.logoUrl}]`, pdfSettings.marginLeft, currentY); currentY += (pdfSettings.defaultFontSize || 10) + 5;
      }

      const moduleDefaultTitle = `Suivi Avantages en Nature - ${monthLabel} ${selectedYear}`;
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

      if (finalTitle) {
        doc.setFontSize(pdfSettings.documentTitleFontSize || 18);
        doc.text(finalTitle, pdfSettings.marginLeft, currentY); 
        currentY += (pdfSettings.documentTitleFontSize || 18) * 0.7 + 5;
      }
      
      doc.setFontSize(pdfSettings.defaultFontSize || 10);
      doc.text(`Généré le: ${generationDateFormatted}`, pdfSettings.marginLeft, currentY); currentY += (pdfSettings.defaultFontSize || 10) + 5;

      const headStyles: { fillColor?: [number, number, number], textColor?: [number, number, number], fontStyle?: string, fontSize?: number, font?: string } = {
        fontStyle: 'bold',
        fontSize: pdfSettings.tableHeaderFontSize,
        font: pdfSettings.fontFamily,
      };

      if (pdfSettings.primaryColor) {
        const primaryRgb = hexToRgb(pdfSettings.primaryColor);
        if (primaryRgb) {
          headStyles.fillColor = primaryRgb;
          const brightness = (primaryRgb[0] * 299 + primaryRgb[1] * 587 + primaryRgb[2] * 114) / 1000;
          headStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
        }
      }

      const head: any = [
        [{ content: 'Employé', rowSpan: 2, styles: { ...headStyles, valign: 'middle'} }, { content: 'Type', rowSpan: 2, styles: { ...headStyles, valign: 'middle'} }],
        []
      ];

      daysInSelectedMonth.forEach(day => {
        (head[0] as any[]).push({ content: day.dayNumber.toString(), styles: { ...headStyles, halign: 'center' } });
        (head[1] as any[]).push({ content: day.dayLetter, styles: { ...headStyles, halign: 'center', fontSize: (pdfSettings.tableHeaderFontSize || 9) -1, fillColor: day.isWeekend ? [200, 220, 255] : headStyles.fillColor } });
      });
      (head[0] as any[]).push({ content: 'TOTAL', rowSpan: 2, styles: { ...headStyles, valign: 'middle'} });


      const body = employeesToRender.flatMap(employee => {
        const planningRow: any[] = [{ content: employee.name, rowSpan: 2, styles: { valign: 'middle', fontStyle: 'bold'} }, 'Planning'];
        const repasPrisRow: any[] = ['Repas Pris'];

        daysInSelectedMonth.forEach(day => {
          const dateKey = `${selectedYear}-${(parseInt(selectedMonth) + 1).toString().padStart(2, '0')}-${day.dayNumber.toString().padStart(2, '0')}`;
          const entry = benefitData[employee.id]?.[dateKey] || { planning: "", repasPris: "" };

          const cellStyle = { halign: 'center', fontSize: pdfSettings.tableBodyFontSize, fillColor: day.isWeekend ? [229, 231, 235] : (entry.planning === "X" ? [209,250,229] : undefined) };
          const cellStyleRepas = { halign: 'center', fontSize: pdfSettings.tableBodyFontSize, fillColor: day.isWeekend ? [229, 231, 235] : (entry.repasPris === "X" ? [209,250,229] : undefined) };

          planningRow.push({ content: entry.planning, styles: cellStyle });
          repasPrisRow.push({ content: entry.repasPris, styles: cellStyleRepas });
        });
        planningRow.push({ content: calculateTotal(employee.id, 'planning'), styles: { halign: 'center', fontStyle: 'bold'} });
        repasPrisRow.push({ content: calculateTotal(employee.id, 'repasPris'), styles: { halign: 'center', fontStyle: 'bold'} });
        return [planningRow, repasPrisRow];
      });

      doc.autoTable({
        startY: currentY,
        head: head,
        body: body,
        theme: 'grid',
        margin: {
            top: pdfSettings.marginTop,
            right: pdfSettings.marginRight,
            bottom: pdfSettings.marginBottom,
            left: pdfSettings.marginLeft
        },
        styles: { fontSize: pdfSettings.tableBodyFontSize, font: pdfSettings.fontFamily },
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          if (pdfSettings.footerText) {
            let footerStr = pdfSettings.footerText
              .replace('{date}', generationDateFormatted)
              .replace('{pageNumber}', data.pageNumber.toString())
              .replace('{totalPages}', pageCount.toString());
            doc.setFontSize(pdfSettings.footerFontSize || 8);
            doc.text(footerStr, pdfSettings.marginLeft, doc.internal.pageSize.height - (pdfSettings.marginBottom / 2));
          }
        },
      });

      doc.save(`Avantages_Nature_${monthLabel}_${selectedYear}.pdf`);
      toast({ title: "PDF Généré", description: "Le fichier PDF a été téléchargé." });

    } catch (error: any) {
        console.error(`Error generating PDF: ${error.message || error}`, error);
        toast({ title: "Erreur PDF", description: `La génération du PDF a échoué: ${error.message || 'Erreur inconnue'}.`, variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };


  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end">
        <div>
          <Label htmlFor="year-select-benefits">Année</Label>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger id="year-select-benefits"><SelectValue placeholder="Année" /></SelectTrigger>
            <SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="month-select-benefits">Mois</Label>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger id="month-select-benefits"><SelectValue placeholder="Mois" /></SelectTrigger>
            <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 md:col-span-1 md:justify-self-end pt-2">
            <Button onClick={generatePdf} disabled={isLoading || isSaving || employeesToRender.length === 0} className="w-full sm:w-auto">
                {(isLoading || isSaving) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Générer PDF
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isLoading || isSaving || initialDocExists === false && Object.keys(benefitData).length === 0} className="w-full sm:w-auto">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Effacer Données Mois
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                  <AlertDialogDescription>
                    Êtes-vous sûr de vouloir effacer toutes les données pour ${months[parseInt(selectedMonth)].label} ${selectedYear} ? Cette action est irréversible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirmClearMonthData}>
                    Effacer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </div>
      </div>

      <div className="my-4 p-3 border rounded-md bg-muted/50">
        <p className="font-semibold text-sm mb-2">Légende :</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
          {BENEFIT_STATUS_LEGEND.map(item => (
            <div key={item.code} className="flex items-center gap-1.5">
              <span className={cn("px-1.5 py-0.5 rounded-sm text-xs font-medium", item.displayClass)}>
                {item.code || "-"}
              </span>
              <span>: {item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {isLoading && initialDocExists === null ? ( 
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Chargement des données...</span>
        </div>
      ) : employeesToRender.length === 0 ? (
        <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
            <Users className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
                Aucun membre de la brigade défini.
            </p>
            <p className="text-xs text-muted-foreground/70">
                Veuillez les ajouter dans la section "Suivi des Heures" &gt; "Gestion Personnel" pour commencer le suivi des avantages.
            </p>
        </div>
      ) : (
        <div className="overflow-x-auto border rounded-md shadow-sm">
          <Table className="min-w-full table-fixed">
            <TableHeader>
              <TableRow className="bg-card"> 
                <TableHead className="w-[180px] min-w-[180px] sticky left-0 z-30 bg-card">Employé</TableHead>
                <TableHead className="w-[100px] min-w-[100px] sticky left-[180px] z-30 bg-card">Type</TableHead>
                {daysInSelectedMonth.map(day => (
                  <TableHead key={`header-num-${day.dayNumber}`} className={cn("w-[50px] min-w-[50px] text-center p-1 text-xs bg-card", day.isWeekend && "bg-blue-100 dark:bg-blue-800/30")}>
                    {day.dayNumber}
                  </TableHead>
                ))}
                <TableHead className="w-[70px] min-w-[70px] text-center sticky right-0 z-30 bg-card">TOTAL</TableHead>
              </TableRow>
              <TableRow className="sticky top-10 z-20 bg-card"> 
                <TableHead className="sticky left-0 z-10 bg-card"></TableHead> 
                <TableHead className="sticky left-[180px] z-10 bg-card"></TableHead>
                {daysInSelectedMonth.map(day => (
                  <TableHead key={`header-letter-${day.dayNumber}`} className={cn("text-center p-1 text-xs font-semibold bg-card", day.isWeekend && "bg-blue-100 dark:bg-blue-800/30")}>
                    {day.dayLetter}
                  </TableHead>
                ))}
                <TableHead className="sticky right-0 z-10 bg-card"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employeesToRender.map(employee => (
                <React.Fragment key={employee.id}>
                  {(['planning', 'repasPris'] as const).map((type, typeIndex) => {
                    const dayRow = daysInSelectedMonth.map(day => {
                      const dateKey = `${selectedYear}-${(parseInt(selectedMonth) + 1).toString().padStart(2, '0')}-${day.dayNumber.toString().padStart(2, '0')}`;
                      const entry = benefitData[employee.id]?.[dateKey] || { planning: "", repasPris: "" };
                      const cellValue = entry[type];
                      const statusConfig = BENEFIT_STATUS_LEGEND.find(s => s.code === cellValue);
                      const cellDisplayClass = statusConfig ? statusConfig.displayClass : "border border-muted-foreground/30";

                      return (
                        <TableCell key={`${employee.id}-${day.dayNumber}-${type}`} className={cn("p-0.5 text-center", day.isWeekend && "bg-blue-100 dark:bg-blue-800/20")}>
                          <Select
                            value={cellValue === "" ? SELECT_EMPTY_VALUE_PLACEHOLDER : cellValue}
                            onValueChange={(value) => handleStatusChange(employee.id, day.dayNumber, type, value)}
                            disabled={isSaving}
                          >
                            <SelectTrigger className={cn(
                              "h-7 text-xs min-w-[45px] p-1 justify-center",
                              cellDisplayClass
                            )}>
                              <SelectValue placeholder="-" />
                            </SelectTrigger>
                            <SelectContent>
                              {BENEFIT_STATUS_CODES.map(code => (
                                <SelectItem
                                  key={code === "" ? SELECT_EMPTY_VALUE_PLACEHOLDER : code}
                                  value={code === "" ? SELECT_EMPTY_VALUE_PLACEHOLDER : code}
                                  className="text-xs"
                                >
                                  {code === "" ? "-" : code}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      );
                    });

                    return (
                      <TableRow key={`${employee.id}-${type}`} className={typeIndex === 0 ? "border-t-2 border-primary/50" : ""}>
                        {typeIndex === 0 && (
                          <TableCell rowSpan={2} className="font-medium align-middle sticky left-0 z-10 bg-card">
                            {employee.name}
                          </TableCell>
                        )}
                        <TableCell className="text-xs sticky left-[180px] z-10 bg-card">
                          {type === 'planning' ? 'Planning' : 'Repas Pris'}
                        </TableCell>
                        {dayRow}
                        <TableCell className="text-center font-bold sticky right-0 z-10 bg-card">
                          {calculateTotal(employee.id, type)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
    

    
