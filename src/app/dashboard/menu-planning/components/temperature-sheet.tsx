"use client";

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import type { DailyMenu, MenuField } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Loader2, CalendarRange, AlertCircle, ThermometerIcon, FileText, Save } from 'lucide-react';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { groupMenusByWeek, type WeekData } from '../utils';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import { firestore } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import useIsMobile from '@/hooks/use-mobile';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

interface MealItemTemperatureInput {
  tempService1?: string;
  tempService2?: string;
  tempService3?: string;
}

interface DailyMenuUpdateInput {
  comment?: string;
}

interface DailyLogInput {
  personnel?: string;
}

const mealPartsOrder: MenuField[] = ['entree', 'plat', 'feculent', 'legume', 'sauce', 'dessert'];

const mealPartDisplayNames: Record<MenuField, string> = {
  entree: "Entrée",
  plat: "Plat Principal",
  feculent: "Féculent",
  legume: "Légume",
  sauce: "Sauce",
  dessert: "Dessert",
  theme: "Thème" 
};

interface TemperatureSheetProps {
  year: number;
  month: number; // 0-indexed
  menuData: DailyMenu[];
  isLoading: boolean; // isLoading from parent (page.tsx)
}

export default function TemperatureSheet({ year, month, menuData, isLoading: pageIsLoading }: TemperatureSheetProps) {
  const [mealItemTemperatures, setMealItemTemperatures] = useState<Record<string, MealItemTemperatureInput>>({}); 
  const [menuChangeComments, setMenuChangeComments] = useState<Record<string, DailyMenuUpdateInput>>({});
  const [dailyLogData, setDailyLogData] = useState<Record<string, DailyLogInput>>({}); 
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(true);
  const [isSavingData, setIsSavingData] = useState(false);
  const [isGeneratingMonthlyPdf, setIsGeneratingMonthlyPdf] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const getFirestoreDocId = useCallback(() => `temps_${year}_${month}`, [year, month]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoadingInitialData(true);
      const docId = getFirestoreDocId();
      const docRef = doc(firestore, "menuTemperatureLogs", docId);
      try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setMealItemTemperatures(data.mealItemTemperatures || {});
          setDailyLogData(data.dailyLogData || {});
          setMenuChangeComments(data.menuChangeComments || {});
        } else {
          setMealItemTemperatures({});
          setDailyLogData({});
        }
      } catch (error) {
        console.error("Error loading temperature data from Firestore:", error);
        toast({ title: "Erreur de chargement (Températures)", description: "Données de température corrompues.", variant: "destructive" });
        setMealItemTemperatures({});
        setDailyLogData({});
        setMenuChangeComments({});
      } finally {
        setIsLoadingInitialData(false);
      }
    };
    loadData();
  }, [year, month, getFirestoreDocId, toast]);


  const weeklyGroupedMenus = useMemo(() => {
    return groupMenusByWeek(year, month, menuData);
  }, [year, month, menuData]);

  const handleMealItemTempChange = (date: string, mealPart: MenuField, field: keyof MealItemTemperatureInput, value: string) => {
    const key = `${date}_${mealPart}`;
    setMealItemTemperatures(prev => ({
        ...prev,
        [key]: { ...(prev[key] || {}), [field]: value }
    }));
  };

  const handleDailyLogChange = (date: string, field: keyof DailyLogInput, value: string) => {
    setDailyLogData(prev => ({
        ...prev,
        [date]: { ...(prev[date] || {}), [field]: value }
    }));
  };
  
  const handleMenuChangeComment = (date: string, mealPart: MenuField, value: string) => {
    const key = `${date}_${mealPart}`;
    setMenuChangeComments(prev => ({
        ...prev,
        [key]: { ...(prev[key] || {}), comment: value }
    }));
  };
  

  const handleSaveData = async () => {
  setIsSavingData(true);
  const docId = getFirestoreDocId();
  const docRef = doc(firestore, "menuTemperatureLogs", docId);
  try {
    await setDoc(docRef, { 
      mealItemTemperatures: mealItemTemperatures, 
      dailyLogData: dailyLogData,
      menuChangeComments: menuChangeComments
    });
    toast({ title: "Données Enregistrées", description: "Vos relevés de température ont été sauvegardés." });
  } catch (error) {
    console.error("Error saving temperature sheet data to Firestore:", error);
    toast({ title: "Erreur de Sauvegarde", description: "Les modifications n'ont pas pu être enregistrées.", variant: "destructive" });
  } finally {
    setIsSavingData(false);
  }
};

   const generateMonthlyPdf = async () => {
    if (weeklyGroupedMenus.length === 0 || weeklyGroupedMenus.every(week => week.menus.length === 0)) {
      toast({
        title: "Aucune Donnée",
        description: `Aucun menu ou relevé de température pour ${format(new Date(year, month), "MMMM yyyy", { locale: fr })}.`,
        variant: "destructive",
      });
      return;
    }
    setIsGeneratingMonthlyPdf(true);

    try {
      const pdfSettings = await getPdfLayoutSettings('temperature_sheet_monthly');
      
      const doc = new jsPDF({   
        orientation: pdfSettings.orientation as any,
        unit: 'pt',
        format: pdfSettings.pageSize as any,
      }) as jsPDFWithAutoTable;
      
      const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });
      const monthYearStr = format(new Date(year, month), "MMMM yyyy", { locale: fr });
      doc.setFont(pdfSettings.fontFamily);
      
      const drawFooter = (data: any) => {
        const pageCount = doc.internal.getNumberOfPages();
        if (pdfSettings.footerText) {
          let footerStr = pdfSettings.footerText
            .replace('{date}', generationDateFormatted)
            .replace('{pageNumber}', data.pageNumber.toString())
            .replace('{totalPages}', pageCount.toString());
          doc.setFontSize(pdfSettings.footerFontSize);
          doc.text(footerStr, data.settings.margin.left, doc.internal.pageSize.height - (pdfSettings.marginBottom / 2));
        }
      };

      weeklyGroupedMenus.forEach((week, weekIndex) => {
        if (week.menus.length === 0) return;

        if (weekIndex > 0) {
            doc.addPage(pdfSettings.pageSize as any, pdfSettings.orientation as any);
        }

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
                        } catch (e) { console.error("Error adding logo to PDF header:", e); }
                    } else {
                        doc.text(cellText, currentX + 3, currentY + pdfSettings.headerFontSize * 0.8, { maxWidth: cellWidth - 6, align: 'left' });
                    }
                    currentX += cellWidth;
                }
                currentY += maxHeightInRow;
            }
            currentY += 10;
        }
        
        const moduleDefaultTitle = `Fiche de Température Mensuelle - ${monthYearStr}`;
        let finalTitle = "";
        if (pdfSettings.showDocumentBaseTitle && pdfSettings.documentBaseTitle && pdfSettings.documentBaseTitle.trim() !== "") {
            finalTitle = pdfSettings.documentBaseTitle.trim();
        }
        if (pdfSettings.showModuleTitle) {
            finalTitle = finalTitle ? `${finalTitle} - ${moduleDefaultTitle}` : moduleDefaultTitle;
        }
        
        if (finalTitle) {
            doc.setFontSize(pdfSettings.documentTitleFontSize);
            doc.text(finalTitle, doc.internal.pageSize.getWidth() / 2, currentY, { align: 'center' });
            currentY += pdfSettings.documentTitleFontSize * 0.7 + 5;
        }

        const headStyles: { fillColor?: [number, number, number], textColor?: [number, number, number], fontSize?: number, fontStyle?: string, valign?: 'middle' } = { 
            fontSize: pdfSettings.tableHeaderFontSize, 
            fontStyle: 'bold',
            valign: 'middle'
        };
        if (pdfSettings.primaryColor) {
            const primaryColorRgb = hexToRgb(pdfSettings.primaryColor);
            if (primaryColorRgb) {
                headStyles.fillColor = [primaryColorRgb.r, primaryColorRgb.g, primaryColorRgb.b];
                const brightness = (primaryColorRgb.r * 299 + primaryColorRgb.g * 587 + primaryColorRgb.b * 114) / 1000;
                headStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
            }
        }
        
        const weekTitle = `Semaine ${week.weekNumberInMonth}: ${format(week.startDate, "dd LLLL", { locale: fr })} - ${format(week.endDate, "dd LLLL yyyy", { locale: fr })}`;
        doc.setFontSize(pdfSettings.defaultFontSize + 2);
        doc.text(weekTitle, pdfSettings.marginLeft, currentY);
        currentY += (pdfSettings.defaultFontSize + 2) * 0.7 + 3;

        const head = [['Jour', 'Plat Concerné (Type: Nom)', 'Modifications', 'Temp. 1er Serv. (°C)', 'Temp. 2ème Serv. (°C)', 'Temp. 3ème Serv. (°C)', 'Personnel']];
        const body: any[][] = [];

        week.menus.forEach(menu => {
          const dailyInputs = dailyLogData[menu.date] || {};
          const presentMealParts = mealPartsOrder.filter(mpKey => mpKey !== 'theme' && menu[mpKey] && menu[mpKey].trim() !== "");
          const numMealPartsForThisDay = presentMealParts.length;

          if (numMealPartsForThisDay === 0) return;

          presentMealParts.forEach((mealPartKey, mealPartIndex) => {
            const mealItemName = menu[mealPartKey];
            const itemTempKey = `${menu.date}_${mealPartKey}`;
            const itemTempInputs = mealItemTemperatures[itemTempKey] || {};
            const menuComment = menuChangeComments[itemTempKey] || {};
            const row: any[] = [];

            if (mealPartIndex === 0) {
              let dayDisplay = format(parseISO(menu.date), "E dd/MM", { locale: fr });
              if (menu.isHoliday && menu.holidayName) {
                dayDisplay += `\n(${menu.holidayName})`;
              }
              row.push({ content: dayDisplay, rowSpan: numMealPartsForThisDay, styles: { valign: 'middle' } });
            }
            
            row.push({ content: `${mealPartDisplayNames[mealPartKey]}: ${mealItemName || '-'}`, styles: { valign: 'middle', cellWidth: 'wrap', fontSize: pdfSettings.tableBodyFontSize - 1 } });
            row.push({ content: menuComment.comment || '-', styles: { halign: 'center', valign: 'middle', cellWidth: 'auto', fontSize: pdfSettings.tableBodyFontSize - 1 } });
            row.push({ content: itemTempInputs.tempService1 || '-', styles: { halign: 'center', valign: 'middle' } });
            row.push({ content: itemTempInputs.tempService2 || '-', styles: { halign: 'center', valign: 'middle' } });
            row.push({ content: itemTempInputs.tempService3 || '-', styles: { halign: 'center', valign: 'middle' } });

            if (mealPartIndex === 0) {
              row.push({ content: dailyInputs.personnel || '-', rowSpan: numMealPartsForThisDay, styles: { halign: 'center', valign: 'middle' } });
            }
            body.push(row);
          });
        });
        
        if (body.length > 0) {
            doc.autoTable({
                head: head,
                body: body,
                startY: currentY,
                theme: 'grid',
                headStyles: headStyles,
                styles: { 
                    fontSize: pdfSettings.tableBodyFontSize, 
                    cellPadding: 1.5,
                    valign: 'middle',
                    minCellHeight: 20
                },
                columnStyles: {
                    0: { cellWidth: 45 },
                    1: { cellWidth: 'auto' }, 
                    2: { cellWidth: 70 }, 
                    3: { cellWidth: 40, halign: 'center' }, 
                    4: { cellWidth: 40, halign: 'center' }, 
                    5: { cellWidth: 40, halign: 'center' }, 
                    6: { cellWidth: 45, halign: 'center' }, 
                },
                didDrawPage: drawFooter,
                margin: { left: pdfSettings.marginLeft, right: pdfSettings.marginRight, bottom: pdfSettings.marginBottom + 10 },
            });
        } else {
            doc.setFontSize(pdfSettings.defaultFontSize);
            doc.text("Aucun relevé de température pour cette semaine.", pdfSettings.marginLeft, currentY, { textColor: 'rgb(100,100,100)' });
        }
      });
      
      doc.save(`Fiche_Temperature_Mensuelle_${format(new Date(year, month), "yyyy-MM", { locale: fr })}.pdf`);
      toast({ title: "PDF Mensuel Généré", description: `Fiche de température pour ${monthYearStr} téléchargée.` });
    } catch (error: any) {
      console.error("Error generating monthly PDF:", error.message, error.stack);
      toast({ title: "Erreur PDF", description: `La génération du PDF mensuel a échoué: ${error.message || 'Erreur inconnue'}`, variant: "destructive" });
    } finally {
      setIsGeneratingMonthlyPdf(false);
    }
  };

  const noDataForMonth = weeklyGroupedMenus.length === 0 || weeklyGroupedMenus.every(week => week.menus.length === 0);

    const currentWeek = useMemo(() => 
      weeklyGroupedMenus.find(w => isWithinInterval(new Date(), { start: w.startDate, end: w.endDate }))
  , [weeklyGroupedMenus]);

  const weeksToDisplay = useMemo(() => 
      isMobile ? (currentWeek ? [currentWeek] : []) : weeklyGroupedMenus
  , [isMobile, currentWeek, weeklyGroupedMenus]);

  const currentCombinedLoadingState = pageIsLoading || isLoadingInitialData;

  if (currentCombinedLoadingState) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Chargement des fiches de température...</span>
      </div>
    );
  }

  
  const renderWeekContent = (week: WeekData) => {
    if (week.menus.length === 0) {
      return (
        <div className="text-center py-6 text-muted-foreground flex items-center justify-center gap-2">
          <AlertCircle className="w-5 h-5" /> Aucun menu planifié à afficher pour cette semaine.
        </div>
      );
    }

    // --- Mobile View for a single week ---
    if (isMobile) {
      return (
        <div className="space-y-4">
          {week.menus.map(menu => {
            const dailyInputs = dailyLogData[menu.date] || {};
            const presentMealParts = mealPartsOrder.filter(mpKey => mpKey !== 'theme' && menu[mpKey] && menu[mpKey].trim() !== "");

            if (presentMealParts.length === 0) {
              if (parseISO(menu.date).getDay() === 0) return null;
              return (
                <div key={`${menu.date}-empty`} className="border-t pt-4 first:pt-0 first:border-t-0">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold">{format(parseISO(menu.date), "E dd/MM", { locale: fr })}</h3>
                    {menu.isHoliday && <span className="text-xs text-amber-600 dark:text-amber-400">{menu.holidayName}</span>}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">Aucun plat défini pour ce jour.</p>
                  <div>
                    <label className="text-xs font-medium">Personnel</label>
                    <Input
                      type="text" placeholder="Initiales" className="text-sm h-9 mt-1"
                      value={dailyInputs.personnel || ''}
                      onChange={(e) => handleDailyLogChange(menu.date, 'personnel', e.target.value)}
                      disabled={parseISO(menu.date).getDay() === 0}
                    />
                  </div>
                </div>
              );
            }

            return (
              <div key={menu.date} className={`border-t pt-4 first:pt-0 first:border-t-0 ${parseISO(menu.date).getDay() === 0 ? "opacity-70" : ""}`}>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold">{format(parseISO(menu.date), "E dd/MM", { locale: fr })}</h3>
                  {menu.isHoliday && <span className="text-xs text-amber-600 dark:text-amber-400">{menu.holidayName}</span>}
                </div>

                {presentMealParts.map(mealPartKey => {
                  const mealItemName = menu[mealPartKey];
                  const itemTempKey = `${menu.date}_${mealPartKey}`;
                  const itemTempInputs = mealItemTemperatures[itemTempKey] || {};
                  return (
                    <div key={mealPartKey} className="mb-4 border-b pb-4 last:border-b-0 last:pb-0">
                      <p className="font-semibold text-sm">{mealPartDisplayNames[mealPartKey]}: <span className="font-normal">{mealItemName}</span></p>

                      <div className="mt-2">
                          <label className="text-xs font-medium">Modifications</label>
                          <Input
                              type="text"
                              placeholder="Menu changé..."
                              className="text-sm h-9 mt-1"
                              value={menuChangeComments[`${menu.date}_${mealPartKey}`]?.comment || ''}
                              onChange={(e) => handleMenuChangeComment(menu.date, mealPartKey, e.target.value)}
                              disabled={parseISO(menu.date).getDay() === 0}
                          />
                      </div>


                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {['tempService1', 'tempService2', 'tempService3'].map((tempKey, i) => (
                          <div key={tempKey}>
                            <label className="text-xs font-medium">{i + 1}er Serv.</label>
                            <Input
                              type="text" placeholder="°C" className="text-sm h-9 mt-1 text-center"
                              value={itemTempInputs[tempKey as keyof MealItemTemperatureInput] || ''}
                              onChange={(e) => handleMealItemTempChange(menu.date, mealPartKey, tempKey as keyof MealItemTemperatureInput, e.target.value)}
                              disabled={parseISO(menu.date).getDay() === 0}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                <div>
                  <label className="text-xs font-medium">Personnel</label>
                  <Input
                    type="text" placeholder="Initiales" className="text-sm h-9 mt-1"
                    value={dailyInputs.personnel || ''}
                    onChange={(e) => handleDailyLogChange(menu.date, 'personnel', e.target.value)}
                    disabled={parseISO(menu.date).getDay() === 0}
                  />
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // --- Desktop View for a single week ---
    return (
      <div className="overflow-x-auto border rounded-md">
      <Table>
        <TableHeader className="sticky top-0 bg-muted/20 z-10">
          <TableRow>
            <TableHead className="w-[100px] min-w-[100px]">Jour</TableHead>
            <TableHead className="min-w-[200px] w-[250px]">Plat Concerné</TableHead>
            <TableHead className="min-w-[150px] w-[150px]">Modifications</TableHead>
            <TableHead className="min-w-[120px] w-[120px] text-center">Temp. 1er Serv.</TableHead>
            <TableHead className="min-w-[120px] w-[120px] text-center">Temp. 2ème Serv.</TableHead>
            <TableHead className="min-w-[120px] w-[120px] text-center">Temp. 3ème Serv.</TableHead>
            <TableHead className="min-w-[120px] w-[120px]">Personnel</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {week.menus.flatMap(menu => {
            const dailyInputs = dailyLogData[menu.date] || {};
            const presentMealParts = mealPartsOrder.filter(mpKey => mpKey !== 'theme' && menu[mpKey] && menu[mpKey].trim() !== "");
            const numMealPartsForThisDay = presentMealParts.length;

            if (numMealPartsForThisDay === 0) {
              if (parseISO(menu.date).getDay() === 0) return [];
              return [(
                <TableRow key={`${menu.date}-empty`} className={parseISO(menu.date).getDay() === 0 ? "bg-muted/30 opacity-70" : ""}>
                  <TableCell className="font-medium align-top py-2">
                    {format(parseISO(menu.date), "E dd/MM", { locale: fr })}
                    {menu.isHoliday && menu.holidayName && <span className="block text-xs text-amber-600 dark:text-amber-400 truncate">{menu.holidayName}</span>}
                  </TableCell>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-2">Aucun plat défini.</TableCell>
                  <TableCell className="p-1 align-top">
                    <Input
                      type="text" placeholder="Initiales" className="text-xs h-10"
                      value={dailyInputs.personnel || ''}
                      onChange={(e) => handleDailyLogChange(menu.date, 'personnel', e.target.value)}
                      disabled={parseISO(menu.date).getDay() === 0}
                    />
                  </TableCell>
                </TableRow>
              )];
            }

            return presentMealParts.map((mealPartKey, mealPartIndex) => {
              const mealItemName = menu[mealPartKey];
              const isFirstMealPartForRowSpan = mealPartIndex === 0;
              const itemTempKey = `${menu.date}_${mealPartKey}`;
              const itemTempInputs = mealItemTemperatures[itemTempKey] || {};
              const menuComment = menuChangeComments[itemTempKey] || {};

              return (
                <TableRow key={`${menu.date}-${mealPartKey}`} className={parseISO(menu.date).getDay() === 0 ? "bg-muted/30 opacity-70" : ""}>
                  {isFirstMealPartForRowSpan && (
                    <TableCell rowSpan={numMealPartsForThisDay} className="font-medium align-top py-2">
                      {format(parseISO(menu.date), "E dd/MM", { locale: fr })}
                      {menu.isHoliday && menu.holidayName && <span className="block text-xs text-amber-600 dark:text-amber-400 truncate">{menu.holidayName}</span>}
                    </TableCell>
                  )}
                  <TableCell className="align-top py-2 text-xs" title={mealItemName}>
                    <span className="font-semibold block">{mealPartDisplayNames[mealPartKey]}:</span>
                    {mealItemName}
                  </TableCell>

                  <TableCell className="p-1 align-top">
                    <Input
                      type="text"
                      placeholder="Changement..."
                      className="text-xs h-10"
                      value={menuComment.comment || ''}
                      onChange={(e) => handleMenuChangeComment(menu.date, mealPartKey, e.target.value)}
                      disabled={parseISO(menu.date).getDay() === 0}
                    />
                  </TableCell>

                  <TableCell className="p-1 align-top">
                    <Input
                      type="text" placeholder="°C" className="text-xs h-10 text-center"
                      value={itemTempInputs.tempService1 || ''}
                      onChange={(e) => handleMealItemTempChange(menu.date, mealPartKey, 'tempService1', e.target.value)}
                      disabled={parseISO(menu.date).getDay() === 0}
                    />
                  </TableCell>
                  <TableCell className="p-1 align-top">
                    <Input
                      type="text" placeholder="°C" className="text-xs h-10 text-center"
                      value={itemTempInputs.tempService2 || ''}
                      onChange={(e) => handleMealItemTempChange(menu.date, mealPartKey, 'tempService2', e.target.value)}
                      disabled={parseISO(menu.date).getDay() === 0}
                    />
                  </TableCell>
                  <TableCell className="p-1 align-top">
                    <Input
                      type="text" placeholder="°C" className="text-xs h-10 text-center"
                      value={itemTempInputs.tempService3 || ''}
                      onChange={(e) => handleMealItemTempChange(menu.date, mealPartKey, 'tempService3', e.target.value)}
                      disabled={parseISO(menu.date).getDay() === 0}
                    />
                  </TableCell>
                  {isFirstMealPartForRowSpan && (
                    <TableCell rowSpan={numMealPartsForThisDay} className="p-1 align-top">
                      <Input
                        type="text" placeholder="Initiales" className="text-xs h-10"
                        value={dailyInputs.personnel || ''}
                        onChange={(e) => handleDailyLogChange(menu.date, 'personnel', e.target.value)}
                        disabled={parseISO(menu.date).getDay() === 0}
                      />
                    </TableCell>
                  )}
                </TableRow>
              );
            });
          })}
        </TableBody>
      </Table>
    </div>
  );
};

return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <Button 
          onClick={handleSaveData} 
          disabled={isSavingData || currentCombinedLoadingState}
          size="sm"
        >
          {isSavingData ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Enregistrer
        </Button>
        <Button 
          onClick={generateMonthlyPdf} 
          disabled={isGeneratingMonthlyPdf || isSavingData || currentCombinedLoadingState || noDataForMonth}
          size="sm"
        >
          {isGeneratingMonthlyPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
          Générer PDF Mensuel
        </Button>
      </div>

      {noDataForMonth ? (
        <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
          <CalendarRange className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            Aucun menu planifié à afficher pour {format(new Date(year, month), "MMMM yyyy", { locale: fr })}.
          </p>
        </div>
      ) : (isMobile && weeksToDisplay.length === 0) ? (
        <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
            <CalendarRange className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
                La semaine en cours n'est pas dans le mois de {format(new Date(year, month), "MMMM yyyy", { locale: fr })}.
            </p>
            <p className="text-xs text-muted-foreground/70">
                Passez en vue ordinateur pour voir toutes les semaines de ce mois.
            </p>
        </div>
      ) : (
        weeksToDisplay.map((week, index) => (
          <Card key={index} className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ThermometerIcon className="w-5 h-5 text-primary"/>
                Semaine {week.weekNumberInMonth}: {format(week.startDate, "dd LLLL", { locale: fr })} - {format(week.endDate, "dd LLLL yyyy", { locale: fr })}
              </CardTitle>
              {!isMobile && (
                <CardDescription>
                  Enregistrez les températures et le personnel pour les plats de cette semaine.
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {renderWeekContent(week)}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
