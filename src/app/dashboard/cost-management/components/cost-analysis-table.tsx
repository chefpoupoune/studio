"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2, FileText, Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, getDaysInMonth as dfnsGetDaysInMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getPdfLayoutSettings, hexToRgb, loadPdfLayoutSettingsFromFirestore } from '@/lib/pdf-settings';
import type { CostEntry, DailyCoefficientEntry } from '../types';
import { months, years, currentYear } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getMonthDays, DayData } from '@/app/dashboard/pms/utils';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { firestore, auth } from '@/lib/firebase';
import { getEffectifsForMonth } from '@/app/dashboard/effectifs/services';
import { Effectif } from '@/app/dashboard/effectifs/types';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const initialSupplierRow = (): Omit<CostEntry, 'id'> => ({
  fournisseur: '', ht: 0, tva: 0, avoir: 0,
});

const initialDailyCoefficientEntry = (day: number): DailyCoefficientEntry => ({
  day, imp: "", saj: "", ime: "", esat: "", repasPlus: "", nous: "", pn: "", pnEsat: ""
});

export default function CostAnalysisTable() {
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  
  const [costData, setCostData] = useState<CostEntry[]>([]); 
  const [dailyCoeffData, setDailyCoeffData] = useState<DailyCoefficientEntry[]>([]); 
  const [supplierOptions, setSupplierOptions] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [needsAutoSave, setNeedsAutoSave] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const configRef = doc(firestore, "pmsConfigurations", "mainConfig");
    const unsubscribe = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        const configData = docSnap.data();
        if (configData && Array.isArray(configData.supplierManagement_v1)) {
          const supplierNames = configData.supplierManagement_v1
            .filter((item: any) => typeof item.name === 'string')
            .map((item: any) => item.name as string);
          setSupplierOptions(supplierNames);
        } else {
          setSupplierOptions([]);
        }
      } else {
        setSupplierOptions([]);
      }
    }, (error) => {
      console.error("Error fetching real-time supplier options:", error);
    });
    return () => unsubscribe();
  }, []);

  const getFirestoreDocId = useCallback(() => `entry_${selectedYear}_${selectedMonth}`, [selectedYear, selectedMonth]);

  const dailyCoeffTotals = useMemo(() => {
    const totals: { [K in keyof Omit<DailyCoefficientEntry, 'day'>]: number } & { totalCoeffJour: number[], totalPnJour: number[], totalGlobalJour: number[] } = {
      imp: 0, saj: 0, ime: 0, esat: 0, repasPlus: 0, nous: 0, pn: 0, pnEsat: 0,
      totalCoeffJour: Array(dailyCoeffData.length).fill(0),
      totalPnJour: Array(dailyCoeffData.length).fill(0),
      totalGlobalJour: Array(dailyCoeffData.length).fill(0),
    };

    dailyCoeffData.forEach((dayEntry, dayIndex) => {
      let currentDayTotalCoeff = 0;
      let currentDayTotalPn = 0;
      (Object.keys(dayEntry) as Array<keyof DailyCoefficientEntry>).forEach(key => {
        if (key !== 'day') {
          const val = Number(dayEntry[key as keyof DailyCoefficientEntry]) || 0;
          (totals[key as keyof typeof totals] as number) += val;
          if (['imp', 'saj', 'ime', 'esat', 'repasPlus', 'nous'].includes(key)) {
            currentDayTotalCoeff += val;
          }
          if (['pn', 'pnEsat'].includes(key)) {
            currentDayTotalPn += val;
          }
        }
      });
      totals.totalCoeffJour[dayIndex] = currentDayTotalCoeff;
      totals.totalPnJour[dayIndex] = currentDayTotalPn;
      totals.totalGlobalJour[dayIndex] = currentDayTotalCoeff + currentDayTotalPn;
    });
    return totals;
  }, [dailyCoeffData]);
  
  const grandTotalGlobalJourValue = useMemo(() => {
    return dailyCoeffTotals.totalGlobalJour.reduce((sum, val) => sum + val, 0);
  }, [dailyCoeffTotals.totalGlobalJour]);

  const supplierTotals = useMemo(() => {
    let totalHt = 0, totalTva = 0, totalAvoir = 0;
    costData.forEach(row => {
      totalHt += Number(row.ht) || 0;
      totalTva += Number(row.tva) || 0;
      totalAvoir += Number(row.avoir) || 0;
    });
    return { totalHt, totalTva, totalAvoir };
  }, [costData]);

  const handleSaveData = useCallback(async () => {
    setIsSaving(true);
    const docId = getFirestoreDocId();
    if (!docId) {
      toast({ title: "Erreur", description: "Impossible de déterminer l'identifiant du document.", variant: "destructive" });
      setIsSaving(false);
      return;
    }

    const docRef = doc(firestore, "costAnalysisMonthlyEntries", docId);
    
    const dataToSave = {
        suppliers: costData.filter(s => s.fournisseur.trim() !== ''),
        dailyCoefficients: dailyCoeffData,
        totalHtSum: supplierTotals.totalHt,
        totalTvaSum: supplierTotals.totalTva,
        totalAvoirSum: supplierTotals.totalAvoir,
        totalEffectifSumForMonth: grandTotalGlobalJourValue,
    };

    try {
        await setDoc(docRef, dataToSave, { merge: true });
        toast({ title: "Données Sauvegardées", description: "Les modifications ont été enregistrées avec succès." });
        setIsDirty(false);
    } catch (error) {
        console.error("Error saving data to Firestore:", error);
        toast({ title: "Erreur de sauvegarde", description: "Les modifications n'ont pas pu être enregistrées.", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  }, [getFirestoreDocId, costData, dailyCoeffData, supplierTotals, grandTotalGlobalJourValue, toast]);

  useEffect(() => {
    const fetchAndSyncData = async () => {
        setIsLoading(true);
        setIsDirty(false);

        const docId = getFirestoreDocId();
        const docRef = doc(firestore, "costAnalysisMonthlyEntries", docId);
        
        try {
            const dateForEffectifs = new Date(parseInt(selectedYear), parseInt(selectedMonth));
            const effectifsData = await getEffectifsForMonth(dateForEffectifs);
            
            const docSnap = await getDoc(docRef);
            const daysInMonth = dfnsGetDaysInMonth(new Date(parseInt(selectedYear), parseInt(selectedMonth)));

            let currentCostData: CostEntry[];
            let currentDailyCoeffs: DailyCoefficientEntry[];
            let savedTotalEffectif = 0;

            if (docSnap.exists()) {
                const data = docSnap.data();
                currentCostData = data.suppliers && data.suppliers.length > 0 ? data.suppliers : [{ ...initialSupplierRow(), id: `supplier_init_${Date.now()}` }];
                currentDailyCoeffs = data.dailyCoefficients || Array.from({ length: daysInMonth }, (_, i) => initialDailyCoefficientEntry(i + 1));
                savedTotalEffectif = data.totalEffectifSumForMonth || 0;
            } else {
                currentCostData = [{ ...initialSupplierRow(), id: `supplier_init_${Date.now()}` }];
                currentDailyCoeffs = Array.from({ length: daysInMonth }, (_, i) => initialDailyCoefficientEntry(i + 1));
            }

            const syncedDailyCoeffs = currentDailyCoeffs.map((dayEntry, index) => {
                const dayOfMonth = index + 1;
                const dateStr = `${selectedYear}-${String(parseInt(selectedMonth) + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
                const effectifForDay = effectifsData.find(e => e.date === dateStr);

                if (effectifForDay) {
                    const pnTotal = (effectifForDay.impPn || 0) + (effectifForDay.sajPn || 0) + (effectifForDay.imePn || 0);
                    return {
                        ...dayEntry,
                        imp: effectifForDay.imp || 0,
                        saj: effectifForDay.saj || 0,
                        ime: effectifForDay.ime || 0,
                        esat: effectifForDay.esat || 0,
                        repasPlus: effectifForDay.repasExceptionnel || 0,
                        nous: effectifForDay.nous || 0,
                        pn: pnTotal,
                        pnEsat: effectifForDay.esatPn || 0,
                    };
                }
                return dayEntry;
            });

            const newGrandTotal = syncedDailyCoeffs.reduce((monthTotal, dayEntry) => {
                const dayTotal = (Object.keys(dayEntry) as (keyof DailyCoefficientEntry)[]).reduce((daySum, key) => {
                    if (key !== 'day') {
                        return daySum + (Number(dayEntry[key]) || 0);
                    }
                    return daySum;
                }, 0);
                return monthTotal + dayTotal;
            }, 0);

            const coeffsChanged = JSON.stringify(syncedDailyCoeffs) !== JSON.stringify(currentDailyCoeffs);
            const totalIsIncorrect = newGrandTotal !== savedTotalEffectif;

            setCostData(currentCostData.map((s: any, index: number) => ({ ...initialSupplierRow(), ...s, id: s.id || `supplier_${Date.now()}_${index}` })));
            setDailyCoeffData(syncedDailyCoeffs.length !== daysInMonth ? Array.from({ length: daysInMonth }, (_, i) => initialDailyCoefficientEntry(i + 1)) : syncedDailyCoeffs);

            if (coeffsChanged || totalIsIncorrect) {
                setNeedsAutoSave(true);
            }

        } catch (error) {
            console.error("Error loading or syncing data:", error);
            toast({ title: "Erreur de chargement", description: "Données corrompues ou erreur de synchronisation.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    fetchAndSyncData();
  }, [selectedMonth, selectedYear, getFirestoreDocId, toast]);

  useEffect(() => {
    if (needsAutoSave && !isLoading) {
        toast({ title: "Synchronisation...", description: "Sauvegarde automatique des nouvelles données." });
        handleSaveData();
        setNeedsAutoSave(false);
    }
  }, [needsAutoSave, isLoading, handleSaveData, toast]);

  const prixDeRevientMensuel = useMemo(() => {
    const coutMatierePremiere = supplierTotals.totalHt - supplierTotals.totalAvoir;
    if (grandTotalGlobalJourValue === 0) return 0;
    return coutMatierePremiere / grandTotalGlobalJourValue;
  }, [supplierTotals, grandTotalGlobalJourValue]);
  
  const handleSupplierInputChange = (rowIndex: number, fieldName: 'fournisseur' | 'ht' | 'tva' | 'avoir', value: string | number) => {
    setIsDirty(true);
    setCostData(prevData =>
      prevData.map((row, index) => {
        if (index === rowIndex) {
          let processedValue = fieldName === 'fournisseur'
            ? value
            : typeof (initialSupplierRow() as any)[fieldName] === 'number'
            ? parseFloat(value as string) || 0
            : value;
          return { ...row, [fieldName]: processedValue };
        }
        return row;
      })
    );
  };
  
  const handleDailyCoeffInputChange = (dayIndex: number, fieldName: keyof Omit<DailyCoefficientEntry, 'day'>, value: string) => {
    setIsDirty(true);
    const numericValue = value === "" ? "" : parseFloat(value); 
    if (value === "" || (!isNaN(numericValue as number) && (numericValue as number) >= 0)) {
        setDailyCoeffData(prevData =>
            prevData.map((entry, index) => {
                if (index === dayIndex) {
                    return { ...entry, [fieldName]: numericValue };
                }
                return entry;
            })
        );
    }
  };

  const handleAddSupplierRow = () => {
    setIsDirty(true);
    setCostData(prevData => [...prevData, { ...initialSupplierRow(), id: `supplier_${Date.now()}` }]);
  };

  const handleDeleteSupplierRow = (rowId: string) => {
    if (costData.length <= 1) { 
        toast({ title: "Action impossible", description: "Au moins une ligne fournisseur doit être conservée.", variant: "default" });
        return;
    }
    setIsDirty(true);
    setCostData(prevData => prevData.filter(row => row.id !== rowId));
    toast({ title: "Ligne Fournisseur Supprimée" });
  };

  const generatePdf = async () => {
    setIsLoading(true);
    try {
        const allConfigs = await loadPdfLayoutSettingsFromFirestore();
        const pdfSettings = await getPdfLayoutSettings('monthly_cost', allConfigs);
        
        const doc = new jsPDF({
            orientation: pdfSettings.orientation,
            unit: 'pt',
            format: pdfSettings.pageSize,
        }) as jsPDFWithAutoTable;
        
        doc.setFont(pdfSettings.fontFamily || 'helvetica');
        const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });
        const monthLabel = months.find(m => m.value === selectedMonth)?.label || '';
        const yearLabel = selectedYear;
        
        let currentY = pdfSettings.marginTop;
        const pageContentWidth = doc.internal.pageSize.width - pdfSettings.marginLeft - pdfSettings.marginRight;

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
        
        const moduleDefaultTitle = `Fiche de Coût de Revient Mensuel - ${monthLabel} ${yearLabel}`;
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
            doc.text(finalTitle, doc.internal.pageSize.getWidth() / 2, currentY, { align: 'center' });
            currentY += pdfSettings.documentTitleFontSize * 0.7 + 5;
        }

        const tableHeadStyles: any = {
            fontStyle: 'bold', fontSize: pdfSettings.tableHeaderFontSize,
            halign: 'center', valign: 'middle',
        };
        const tableBodyStyles: any = { fontSize: pdfSettings.tableBodyFontSize, valign: 'middle' };
        const darkFooterCellStyles = { fontStyle: 'bold', fillColor: [45, 55, 72], textColor: [255, 255, 255] };
        
        if (pdfSettings.primaryColor) {
            const primaryRgb = hexToRgb(pdfSettings.primaryColor);
            if (primaryRgb) {
                tableHeadStyles.fillColor = [primaryRgb.r, primaryRgb.g, primaryRgb.b];
                const brightness = (primaryRgb.r * 299 + primaryRgb.g * 587 + primaryRgb.b * 114) / 1000;
                tableHeadStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
            }
        } else {
            tableHeadStyles.fillColor = [200,200,200]; 
            tableHeadStyles.textColor = [0,0,0];
        }

        doc.setFontSize(pdfSettings.defaultFontSize + 2);
        doc.setFont(undefined, 'bold');
        
        const titleText1 = "Tableau des Fournisseurs";
        doc.text(titleText1, pdfSettings.marginLeft, currentY);

        const textWidth1 = doc.getTextDimensions(titleText1).w;
        doc.setLineWidth(0.5); 
        doc.line(pdfSettings.marginLeft, currentY + 2, pdfSettings.marginLeft + textWidth1, currentY + 2);
        
        doc.setFont(undefined, 'normal');
        currentY += (pdfSettings.defaultFontSize + 2) * 0.7 + 3;

        const supplierTableHead = [['Fournisseur', 'HT (€)', 'TVA (€)', 'Avoir (€)']];
        const supplierTableBody = costData.map(row => [
            row.fournisseur,
            row.ht.toFixed(2),
            row.tva.toFixed(2),
            row.avoir.toFixed(2),
        ]);
        const supplierTableFoot = [[
            { content: 'Total Fournisseurs', styles: { ...darkFooterCellStyles, halign: 'right'} },
            { content: supplierTotals.totalHt.toFixed(2), styles: { ...darkFooterCellStyles, halign: 'right'} },
            { content: supplierTotals.totalTva.toFixed(2), styles: { ...darkFooterCellStyles, halign: 'right'} },
            { content: supplierTotals.totalAvoir.toFixed(2), styles: { ...darkFooterCellStyles, halign: 'right'} },
        ]];
        doc.autoTable({
            head: supplierTableHead, body: supplierTableBody, foot: supplierTableFoot,
            startY: currentY, theme: 'grid',
            headStyles: tableHeadStyles, styles: {...tableBodyStyles, halign: 'left'},
            columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
            margin: { left: pdfSettings.marginLeft, right: pdfSettings.marginRight },
            tableWidth: 'auto'
        });
        currentY = (doc as any).lastAutoTable.finalY + 10;

        doc.setFontSize(pdfSettings.defaultFontSize + 2);
        doc.setFont(undefined, 'bold');
        
        const titleText2 = "Tableau des Coefficients et Quantités Journaliers";
        doc.text(titleText2, pdfSettings.marginLeft, currentY);
        
        const textWidth2 = doc.getTextDimensions(titleText2).w;
        doc.setLineWidth(0.5); 
        doc.line(pdfSettings.marginLeft, currentY + 2, pdfSettings.marginLeft + textWidth2, currentY + 2);
        
        doc.setFont(undefined, 'normal');
        currentY += (pdfSettings.defaultFontSize + 2) * 0.7 + 3;

        const daysInMonthArray = getMonthDays(parseInt(selectedYear, 10), parseInt(selectedMonth, 10));
        const dailyCoeffTableHead = [['Jour', 'IMP', 'SAJ', 'IME', 'ESAT', 'Repas ++', 'Nous', 'Total Coeff.', 'PN', 'PN ESAT', 'Total PN', 'TOTAL GLOBAL JOUR.']];
        const dailyCoeffTableBody = dailyCoeffData.map((entry, dayIndex) => {
            const dayInfo = daysInMonthArray[dayIndex];
            return [
                `${dayInfo.dayOfMonth} - ${dayInfo.dayName.substring(0,3)}`,
                entry.imp === "" ? "0" : Number(entry.imp).toFixed(0),
                entry.saj === "" ? "0" : Number(entry.saj).toFixed(0),
                entry.ime === "" ? "0" : Number(entry.ime).toFixed(0),
                entry.esat === "" ? "0" : Number(entry.esat).toFixed(0),
                entry.repasPlus === "" ? "0" : Number(entry.repasPlus).toFixed(0),
                entry.nous === "" ? "0" : Number(entry.nous).toFixed(0),
                { content: dailyCoeffTotals.totalCoeffJour[dayIndex].toFixed(0), styles: { fontStyle: 'bold' } },
                entry.pn === "" ? "0" : Number(entry.pn).toFixed(0),
                entry.pnEsat === "" ? "0" : Number(entry.pnEsat).toFixed(0),
                { content: dailyCoeffTotals.totalPnJour[dayIndex].toFixed(0), styles: { fontStyle: 'bold' } },
                { content: dailyCoeffTotals.totalGlobalJour[dayIndex].toFixed(0), styles: { fontStyle: 'bold' } },
            ]
        });
        const dailyCoeffTableFoot = [[
            { content: 'Total Mois', styles: { ...darkFooterCellStyles, halign: 'right'} },
            { content: dailyCoeffTotals.imp.toFixed(0), styles: { ...darkFooterCellStyles, halign: 'center'} },
            { content: dailyCoeffTotals.saj.toFixed(0), styles: { ...darkFooterCellStyles, halign: 'center'} },
            { content: dailyCoeffTotals.ime.toFixed(0), styles: { ...darkFooterCellStyles, halign: 'center'} },
            { content: dailyCoeffTotals.esat.toFixed(0), styles: { ...darkFooterCellStyles, halign: 'center'} },
            { content: dailyCoeffTotals.repasPlus.toFixed(0), styles: { ...darkFooterCellStyles, halign: 'center'} },
            { content: dailyCoeffTotals.nous.toFixed(0), styles: { ...darkFooterCellStyles, halign: 'center'} },
            { content: (dailyCoeffTotals.totalCoeffJour.reduce((s,v) => s+v,0)).toFixed(0), styles: { ...darkFooterCellStyles, halign: 'center' } },
            { content: dailyCoeffTotals.pn.toFixed(0), styles: { ...darkFooterCellStyles, halign: 'center'} },
            { content: dailyCoeffTotals.pnEsat.toFixed(0), styles: { ...darkFooterCellStyles, halign: 'center'} },
            { content: (dailyCoeffTotals.totalPnJour.reduce((s,v) => s+v,0)).toFixed(0), styles: { ...darkFooterCellStyles, halign: 'center' } },
            { content: grandTotalGlobalJourValue.toFixed(0), styles: { ...darkFooterCellStyles, halign: 'center' } },
        ]];
        doc.autoTable({
            head: dailyCoeffTableHead, body: dailyCoeffTableBody, foot: dailyCoeffTableFoot,
            startY: currentY, theme: 'grid',
            headStyles: {...tableHeadStyles, fontSize: 7, cellPadding: 1}, 
            styles: {...tableBodyStyles, fontSize: 6.5, cellPadding: 0.5, halign: 'center'}, 
            footStyles: { ...tableHeadStyles, fontSize: 7, cellPadding: 1, halign: 'center', fillColor: darkFooterCellStyles.fillColor, textColor: darkFooterCellStyles.textColor },
            columnStyles: { 
                0: { halign: 'left', cellWidth: 35, fontStyle: 'bold' }, 
                7: { fontStyle: 'bold', fillColor: [227, 242, 253] },
                10: { fontStyle: 'bold', fillColor: [232, 245, 233] },
                11: { fontStyle: 'bold', fillColor: [253, 237, 237] } 
            },
            margin: { left: pdfSettings.marginLeft, right: pdfSettings.marginRight },
            pageBreak: 'avoid',
            didDrawPage: (data) => {
                const pageCount = doc.internal.getNumberOfPages();
                if (pdfSettings.footerText) {
                    let footerStr = pdfSettings.footerText.replace('{date}', generationDateFormatted).replace('{pageNumber}', data.pageNumber.toString()).replace('{totalPages}', pageCount.toString());
                    doc.setFontSize(pdfSettings.footerFontSize);
                    doc.text(footerStr, data.settings.margin.left, doc.internal.pageSize.height - (pdfSettings.marginBottom / 2));
                }
            },
        });
        currentY = (doc as any).lastAutoTable.finalY + 20;

        doc.setFontSize(pdfSettings.defaultFontSize + 2);
        doc.setFont(undefined, 'bold');
        doc.text("Calcul du Prix de Revient Mensuel", pdfSettings.marginLeft, currentY);
        doc.setFont(undefined, 'normal');
        currentY += (pdfSettings.defaultFontSize + 2) * 0.7 + 15;

        const coutMatierePrem = supplierTotals.totalHt - supplierTotals.totalAvoir;

        const drawUnderlinedTitle = (title: string, value: string, y: number) => {
            doc.setFontSize(pdfSettings.defaultFontSize);
            doc.setFont(undefined, 'normal');
            const titleText = `${title}:`;
            const titleWidth = doc.getTextDimensions(titleText).w;
            doc.text(titleText, pdfSettings.marginLeft, y);
            doc.setLineWidth(0.5);
            doc.line(pdfSettings.marginLeft, y + 2, pdfSettings.marginLeft + titleWidth, y + 2);
            doc.setFont(undefined, 'bold');
            doc.text(value, pdfSettings.marginLeft + titleWidth + 5, y);
            doc.setFont(undefined, 'normal');
            return y + pdfSettings.defaultFontSize * 0.7 + 12;
        }

        currentY = drawUnderlinedTitle(
            "Coût Matière Première (Total HT Fournisseurs - Total Avoir Fournisseurs)",
            `${coutMatierePrem.toFixed(2)} €`,
            currentY
        );

        currentY = drawUnderlinedTitle(
            "Total du Mois ",
            `${grandTotalGlobalJourValue.toFixed(2)}`,
            currentY
        );

        currentY += 10;

        doc.setFontSize(pdfSettings.defaultFontSize + 2); 
        doc.setFont(undefined, 'bold');
        const prixRevientText = `Prix de Revient du Mois:`;
        const prixRevientWidth = doc.getTextDimensions(prixRevientText).w;
        doc.text(prixRevientText, pdfSettings.marginLeft, currentY);
        doc.setLineWidth(0.5);
        doc.line(pdfSettings.marginLeft, currentY + 2, pdfSettings.marginLeft + prixRevientWidth, currentY + 2);
        doc.text(`${prixDeRevientMensuel.toFixed(2)} €`, pdfSettings.marginLeft + prixRevientWidth + 10, currentY);
        doc.setFont(undefined, 'normal');

        doc.save(`Cout_Revient_Mensuel_${monthLabel}_${yearLabel}.pdf`);
        toast({ title: "PDF Généré", description: "Le PDF du coût de revient mensuel a été téléchargé." });
    } catch (error: any) {
        console.error("Error generating PDF:", error);
        toast({ title: "Erreur PDF", description: `La génération du PDF a échoué: ${error.message || 'Erreur inconnue'}.`, variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };

  const daysInMonthArray = useMemo(() => {
    const year = parseInt(selectedYear, 10);
    const monthIndex = parseInt(selectedMonth, 10);
    return getMonthDays(year, monthIndex);
  }, [selectedYear, selectedMonth]);

  const uiIsDisabled = isLoading || isSaving;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
        <div>
          <Label htmlFor="month-select-cost">Mois</Label>
          <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={uiIsDisabled}>
            <SelectTrigger id="month-select-cost"><SelectValue /></SelectTrigger>
            <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="year-select-cost">Année</Label>
          <Select value={selectedYear} onValueChange={setSelectedYear} disabled={uiIsDisabled}>
            <SelectTrigger id="year-select-cost"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="sm:col-start-3 justify-self-end flex flex-col sm:flex-row gap-2">
            <Button onClick={handleSaveData} disabled={!isDirty || isSaving} className="w-full sm:w-auto">
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Enregistrer
            </Button>
            <Button onClick={generatePdf} disabled={uiIsDisabled} className="w-full sm:w-auto">
                {isLoading && !isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                PDF du Mois
            </Button>
        </div>
      </div>

      {isLoading && costData.length === 0 && dailyCoeffData.length === 0 ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Chargement des données...</span>
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Données Fournisseurs</CardTitle>
              <CardDescription>Entrez les informations financières pour chaque fournisseur. Cliquez sur "Enregistrer" pour sauvegarder.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto border rounded-md">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="min-w-[150px]">Fournisseur</TableHead>
                    <TableHead className="min-w-[80px] text-right">HT (€)</TableHead>
                    <TableHead className="min-w-[80px] text-right">TVA (€)</TableHead>
                    <TableHead className="min-w-[80px] text-right">Avoir (€)</TableHead>
                    <TableHead className="min-w-[50px] text-center">Action</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {costData.map((row, rowIndex) => (
                      <TableRow key={row.id || `supplier_new_${rowIndex}`}>
                        <TableCell className="p-1">
                           <Select value={row.fournisseur} onValueChange={(value) => handleSupplierInputChange(rowIndex, 'fournisseur', value as string)} disabled={isSaving}>
                             <SelectTrigger className="text-xs p-1 h-8">
                                <SelectValue placeholder={"Choisir un fournisseur"} />
                             </SelectTrigger>
                             <SelectContent>
                               {supplierOptions.map(supplier => (
                                 <SelectItem key={supplier} value={supplier}>{supplier}</SelectItem>
                               ))}
                             </SelectContent>
                           </Select>
                         </TableCell>
                        <TableCell className="p-1"><Input type="number" value={row.ht} onChange={e => handleSupplierInputChange(rowIndex, 'ht', e.target.value)} className="text-xs p-1 h-8 text-right" disabled={isSaving} /></TableCell>
                        <TableCell className="p-1"><Input type="number" value={row.tva} onChange={e => handleSupplierInputChange(rowIndex, 'tva', e.target.value)} className="text-xs p-1 h-8 text-right" disabled={isSaving} /></TableCell>
                        <TableCell className="p-1"><Input type="number" value={row.avoir} onChange={e => handleSupplierInputChange(rowIndex, 'avoir', e.target.value)} className="text-xs p-1 h-8 text-right" disabled={isSaving} /></TableCell>
                        <TableCell className="text-center p-1">
                          <Button variant="destructive" size="icon" onClick={() => handleDeleteSupplierRow(row.id!)} className="h-8 w-8" disabled={costData.length <= 1 || isSaving}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="font-bold bg-muted/80 ">
                    <TableCell>Total Fournisseurs</TableCell>
                    <TableCell className="text-right ">{supplierTotals.totalHt.toFixed(2)}</TableCell>
                    <TableCell className="text-right ">{supplierTotals.totalTva.toFixed(2)}</TableCell>
                    <TableCell className="text-right ">{supplierTotals.totalAvoir.toFixed(2)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow></TableFooter>
                </Table>
              </div>
              <Button onClick={handleAddSupplierRow} className="mt-4" disabled={isSaving}><PlusCircle className="mr-2 h-4 w-4" /> Ajouter Ligne Fournisseur</Button>
            </CardContent>
          </Card>

          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Coefficients et Quantités Journaliers</CardTitle>
              <CardDescription>Les données des effectifs sont synchronisées automatiquement. Les champs sont en lecture seule.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto border rounded-md">
                <Table className="min-w-[1200px]">
                  <TableHeader><TableRow>
                    <TableHead className="w-[100px] text-center">Jour</TableHead>
                    <TableHead className="min-w-[70px] text-center">IMP</TableHead>
                    <TableHead className="min-w-[70px] text-center">SAJ</TableHead>
                    <TableHead className="min-w-[70px] text-center">IME</TableHead>
                    <TableHead className="min-w-[70px] text-center">ESAT</TableHead>
                    <TableHead className="min-w-[70px] text-center">Repas ++</TableHead>
                    <TableHead className="min-w-[70px] text-center">Nous</TableHead>
                    <TableHead className="min-w-[80px] text-center font-semibold bg-blue-100 dark:bg-blue-800/30">Total (Coeff)</TableHead>
                    <TableHead className="min-w-[70px] text-center">PN</TableHead>
                    <TableHead className="min-w-[70px] text-center">PN ESAT</TableHead>
                    <TableHead className="min-w-[80px] text-center font-semibold bg-green-100 dark:bg-green-800/30">Total (PN)</TableHead>
                    <TableHead className="min-w-[90px] text-center font-semibold bg-purple-100 dark:bg-purple-800/30">TOTAL GLOBAL JOUR.</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {dailyCoeffData.map((entry, dayIndex) => (
                      <TableRow key={entry.day}>
                        <TableCell className="font-medium text-center">{daysInMonthArray[dayIndex]?.dayOfMonth} - {daysInMonthArray[dayIndex]?.dayName.substring(0,3)}</TableCell>
                        {(['imp', 'saj', 'ime', 'esat', 'repasPlus', 'nous'] as const).map(field => (
                          <TableCell key={field} className="p-1">
                            <Input type="number" value={entry[field]} onChange={e => handleDailyCoeffInputChange(dayIndex, field, e.target.value)} className="text-xs p-1 h-8 text-center" placeholder="0" disabled={true} />
                          </TableCell>
                        ))}
                        <TableCell className="text-center font-semibold bg-blue-100 dark:bg-blue-800/30">{dailyCoeffTotals.totalCoeffJour[dayIndex].toFixed(2)}</TableCell>
                         {(['pn', 'pnEsat'] as const).map(field => (
                            <TableCell key={field} className="p-1">
                                <Input type="number" value={entry[field]} onChange={e => handleDailyCoeffInputChange(dayIndex, field, e.target.value)} className="text-xs p-1 h-8 text-center" placeholder="0" disabled={true} />
                            </TableCell>
                        ))}
                        <TableCell className="text-center font-semibold bg-green-100 dark:bg-green-800/30">{dailyCoeffTotals.totalPnJour[dayIndex].toFixed(0)}</TableCell>
                        <TableCell className="text-center font-semibold bg-purple-100 dark:bg-purple-800/30">{dailyCoeffTotals.totalGlobalJour[dayIndex].toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter><TableRow className="font-bold bg-muted/80">
                    <TableCell>Total Mois</TableCell>
                    <TableCell className="text-center">{dailyCoeffTotals.imp.toFixed(2)}</TableCell>
                    <TableCell className="text-center">{dailyCoeffTotals.saj.toFixed(2)}</TableCell>
                    <TableCell className="text-center">{dailyCoeffTotals.ime.toFixed(2)}</TableCell>
                    <TableCell className="text-center">{dailyCoeffTotals.esat.toFixed(2)}</TableCell>
                    <TableCell className="text-center">{dailyCoeffTotals.repasPlus.toFixed(2)}</TableCell>
                    <TableCell className="text-center">{dailyCoeffTotals.nous.toFixed(2)}</TableCell>
                    <TableCell className="text-center font-semibold bg-blue-100 dark:bg-blue-800/30">
                      {(dailyCoeffTotals.totalCoeffJour.reduce((s,v) => s+v,0)).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">{dailyCoeffTotals.pn.toFixed(0)}</TableCell>
                    <TableCell className="text-center">{dailyCoeffTotals.pnEsat.toFixed(0)}</TableCell>
                     <TableCell className="text-center font-semibold bg-green-100 dark:bg-green-800/30">
                      {(dailyCoeffTotals.totalPnJour.reduce((s,v) => s+v,0)).toFixed(0)}
                    </TableCell>
                    <TableCell className="text-center font-semibold bg-purple-100 dark:bg-purple-800/30">
                      {grandTotalGlobalJourValue.toFixed(2)}
                    </TableCell>
                  </TableRow></TableFooter>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="mt-8">
            <CardHeader>
                <CardTitle>Calcul du Prix de Revient Mensuel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div><span className="font-medium">Coût Matière Première (Total HT Fournisseurs - Total Avoir Fournisseurs):</span> <span className="font-semibold">{(supplierTotals.totalHt - supplierTotals.totalAvoir).toFixed(2)} €</span></div>
                    <div><span className="font-medium">Total du Mois (Σ TOTAL GLOBAL JOUR.):</span> <span className="font-semibold">{grandTotalGlobalJourValue.toFixed(2)}</span></div>
                </div>
                <div className="mt-4 pt-4 border-t">
                    <Label className="text-lg font-semibold">Prix de Revient du Mois :</Label>
                    <span className="text-2xl font-bold ml-2 text-primary">{prixDeRevientMensuel.toFixed(2)} €</span>
                    <p className="text-xs text-muted-foreground mt-1">
                        Calculé comme : (Coût Matière Première) / Total du Mois (Σ TOTAL GLOBAL JOUR.).
                    </p>
                </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
