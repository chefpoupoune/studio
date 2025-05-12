
"use client";

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import type { DailyMenu, MenuField } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Loader2, CalendarRange, AlertCircle, ThermometerIcon, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { groupMenusByWeek, type WeekData } from '../utils';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

interface MealItemTemperatureInput {
  tempService1?: string;
  tempService2?: string;
  tempService3?: string;
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
  theme: "Thème" // Should not appear in temperature sheet table body but needed for type completeness
};

interface TemperatureSheetProps {
  year: number;
  month: number; // 0-indexed
  menuData: DailyMenu[];
  isLoading: boolean;
}

export default function TemperatureSheet({ year, month, menuData, isLoading: pageLoading }: TemperatureSheetProps) {
  const [mealItemTemperatures, setMealItemTemperatures] = useState<Record<string, MealItemTemperatureInput>>({}); 
  const [dailyLogData, setDailyLogData] = useState<Record<string, DailyLogInput>>({}); 
  const [isComponentLoading, setIsComponentLoading] = useState(true);
  const [isGeneratingMonthlyPdf, setIsGeneratingMonthlyPdf] = useState(false);
  const { toast } = useToast();

  const getMealItemTempsKey = useCallback(() => `temperature_sheet_meal_item_temps_${year}_${month}`, [year, month]);
  const getDailyLogKey = useCallback(() => `temperature_sheet_daily_log_data_${year}_${month}`, [year, month]);

  useEffect(() => {
    setIsComponentLoading(true);
    try {
      const storedMealTemps = localStorage.getItem(getMealItemTempsKey());
      if (storedMealTemps) setMealItemTemperatures(JSON.parse(storedMealTemps));
      else setMealItemTemperatures({});

      const storedDailyLog = localStorage.getItem(getDailyLogKey());
      if (storedDailyLog) setDailyLogData(JSON.parse(storedDailyLog));
      else setDailyLogData({});

    } catch (error) {
      console.error("Error loading temperature data from localStorage:", error);
      toast({ title: "Erreur de chargement", description: "Données de température corrompues.", variant: "destructive" });
      setMealItemTemperatures({});
      setDailyLogData({});
    }
    setIsComponentLoading(false);
  }, [year, month, getMealItemTempsKey, getDailyLogKey, toast]);

  useEffect(() => {
    if (!isComponentLoading) {
      localStorage.setItem(getMealItemTempsKey(), JSON.stringify(mealItemTemperatures));
    }
  }, [mealItemTemperatures, isComponentLoading, getMealItemTempsKey]);

  useEffect(() => {
    if (!isComponentLoading) {
      localStorage.setItem(getDailyLogKey(), JSON.stringify(dailyLogData));
    }
  }, [dailyLogData, isComponentLoading, getDailyLogKey]);


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
  
  const generateMonthlyPdf = () => {
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
      const pdfSettings = getPdfLayoutSettings('temperature_sheet_monthly');
      const doc = new jsPDF('landscape') as jsPDFWithAutoTable;
      const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });
      const monthYearStr = format(new Date(year, month), "MMMM yyyy", { locale: fr });
      
      let currentY = 15;
      if (pdfSettings.headerText) {
        doc.setFontSize(10);
        doc.text(pdfSettings.headerText, 14, currentY);
        currentY += 10;
      }

      // Add Logo URL if available
      if (pdfSettings.logoUrl) {
        doc.setFontSize(8); 
        doc.text(`Logo: ${pdfSettings.logoUrl}`, 14, currentY);
        currentY += 5; 
      }
      
      const mainTitle = `Fiche de Température Mensuelle - ${monthYearStr}`;
      doc.setFontSize(18);
      doc.text(mainTitle, doc.internal.pageSize.getWidth() / 2, currentY, { align: 'center' });
      currentY += 8;
      doc.setFontSize(10);
      doc.text(`Généré le: ${generationDateFormatted}`, 14, currentY);
      currentY += 7;

      const headStyles: { fillColor?: [number, number, number], textColor?: [number, number, number] } = {};
      if (pdfSettings.primaryColor) {
        const primaryColorRgb = hexToRgb(pdfSettings.primaryColor);
        if (primaryColorRgb) {
          headStyles.fillColor = primaryColorRgb;
           const brightness = (primaryColorRgb[0] * 299 + primaryColorRgb[1] * 587 + primaryColorRgb[2] * 114) / 1000;
          headStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
        }
      }


      weeklyGroupedMenus.forEach((week) => {
        if (week.menus.length === 0) return;

        const weekTitle = `Semaine ${week.weekNumberInMonth}: ${format(week.startDate, "dd LLLL", { locale: fr })} - ${format(week.endDate, "dd LLLL yyyy", { locale: fr })}`;
        
        if (currentY + 20 > doc.internal.pageSize.getHeight() - 20) { 
            doc.addPage();
            currentY = 20;
        }
        doc.setFontSize(14);
        doc.text(weekTitle, 14, currentY);
        currentY += 7;

        const head = [['Jour', 'Plat Concerné (Type: Nom)', 'Temp. 1er Serv. (°C)', 'Temp. 2ème Serv. (°C)', 'Temp. 3ème Serv. (°C)', 'Personnel']];
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
            const row: any[] = [];

            if (mealPartIndex === 0) {
              let dayDisplay = format(parseISO(menu.date), "E dd/MM", { locale: fr });
              if (menu.isHoliday && menu.holidayName) {
                dayDisplay += `\n(${menu.holidayName})`;
              }
              row.push({ content: dayDisplay, rowSpan: numMealPartsForThisDay, styles: { valign: 'middle' } });
            }
            
            row.push({ content: `${mealPartDisplayNames[mealPartKey]}: ${mealItemName || '-'}`, styles: { valign: 'middle', cellWidth: 'wrap', fontSize: 8 } });
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
            headStyles: { ...headStyles, fontSize: 9 },
            styles: { fontSize: 8, cellPadding: 1.5 },
            columnStyles: {
                0: { cellWidth: 30 }, 
                1: { cellWidth: 80 }, 
                2: { cellWidth: 30, halign: 'center' }, 
                3: { cellWidth: 30, halign: 'center' }, 
                4: { cellWidth: 30, halign: 'center' }, 
                5: { cellWidth: 30, halign: 'center' }, 
            },
            didDrawPage: (data) => {
              const pageCount = doc.internal.getNumberOfPages();
              if (pdfSettings.footerText) {
                let footerStr = pdfSettings.footerText
                  .replace('{date}', generationDateFormatted)
                  .replace('{pageNumber}', data.pageNumber.toString())
                  .replace('{totalPages}', pageCount.toString());
                doc.setFontSize(9);
                doc.text(footerStr, data.settings.margin.left, doc.internal.pageSize.height - 10);
              }
            },
            pageBreak: 'auto', 
            marginBottom: 15 
          });
          currentY = (doc as any).lastAutoTable.finalY + 10;
        } else {
             if (currentY + 10 > doc.internal.pageSize.getHeight() - 20) {
                doc.addPage();
                currentY = 20;
            }
            doc.setFontSize(10);
            doc.text("Aucun relevé de température pour cette semaine.", 14, currentY, { textColor: 'rgb(100,100,100)' });
            currentY += 10;
        }
      });
      
      doc.save(`Fiche_Temperature_Mensuelle_${format(new Date(year, month), "yyyy-MM", { locale: fr })}.pdf`);
      toast({ title: "PDF Mensuel Généré", description: `Fiche de température pour ${monthYearStr} téléchargée.` });
    } catch (error) {
      console.error("Error generating monthly PDF:", error);
      toast({ title: "Erreur PDF", description: "La génération du PDF mensuel a échoué.", variant: "destructive" });
    } finally {
      setIsGeneratingMonthlyPdf(false);
    }
  };
  
  const currentCombinedLoadingState = pageLoading || isComponentLoading;

  if (currentCombinedLoadingState) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Chargement des fiches de température...</span>
      </div>
    );
  }

  const noDataForMonth = weeklyGroupedMenus.length === 0 || weeklyGroupedMenus.every(week => week.menus.length === 0);

  return (
    <div className="space-y-6">
       <div className="flex justify-end">
        <Button 
          onClick={generateMonthlyPdf} 
          disabled={isGeneratingMonthlyPdf || currentCombinedLoadingState || noDataForMonth}
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
                Aucune semaine avec des menus planifiés à afficher pour {format(new Date(year, month), "MMMM yyyy", { locale: fr })}.
            </p>
            <p className="text-xs text-muted-foreground/70">
                Vérifiez que des menus sont planifiés pour ce mois dans l'onglet "Planification Mensuelle".
            </p>
        </div>
      ) : (
        weeklyGroupedMenus.map((week, index) => (
          <Card key={index} className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                  <ThermometerIcon className="w-5 h-5 text-primary"/>
                  Semaine {week.weekNumberInMonth}: {format(week.startDate, "dd LLLL", { locale: fr })} - {format(week.endDate, "dd LLLL yyyy", { locale: fr })}
              </CardTitle>
              <CardDescription>
                Enregistrez les températures et le personnel pour les plats de cette semaine.
                {week.menus.length === 0 && " (Aucun menu planifié pour cette semaine)"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {week.menus.length > 0 ? (
                <div className="overflow-x-auto border rounded-md">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted/20 z-10">
                      <TableRow>
                        <TableHead className="w-[100px] min-w-[100px]">Jour</TableHead>
                        <TableHead className="min-w-[200px] w-[250px]">Plat Concerné</TableHead>
                        <TableHead className="min-w-[120px] w-[120px] text-center">Temp. 1er Serv. (11h45)</TableHead>
                        <TableHead className="min-w-[120px] w-[120px] text-center">Temp. 2ème Serv. (12h45)</TableHead>
                        <TableHead className="min-w-[120px] w-[120px] text-center">Temp. 3ème Serv. (13h)</TableHead>
                        <TableHead className="min-w-[120px] w-[120px]">Personnel</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {week.menus.flatMap(menu => {
                        const dailyInputs = dailyLogData[menu.date] || {};
                        const presentMealParts = mealPartsOrder.filter(mpKey => mpKey !== 'theme' && menu[mpKey] && menu[mpKey].trim() !== "");
                        const numMealPartsForThisDay = presentMealParts.length;

                        if (numMealPartsForThisDay === 0 && !menu.isWeekend) return [(
                            <TableRow key={`${menu.date}-empty`} className={menu.isWeekend ? "bg-muted/30 opacity-70" : ""}>
                                <TableCell className="font-medium align-top py-2">
                                    {format(parseISO(menu.date), "E dd/MM", { locale: fr })}
                                    {menu.isHoliday && menu.holidayName && (
                                    <span className="block text-xs text-amber-600 dark:text-amber-400 truncate" title={menu.holidayName}>
                                        {menu.holidayName}
                                    </span>
                                    )}
                                </TableCell>
                                <TableCell colSpan={4} className="text-center text-muted-foreground py-2">Aucun plat défini pour ce jour.</TableCell>
                                <TableCell className="p-1 align-top">
                                    <Input 
                                        type="text" 
                                        placeholder="Initiales" 
                                        className="text-xs h-10" 
                                        value={dailyInputs.personnel || ''}
                                        onChange={(e) => handleDailyLogChange(menu.date, 'personnel', e.target.value)}
                                        disabled={menu.isWeekend}
                                    />
                                </TableCell>
                            </TableRow>
                        )];
                        if (numMealPartsForThisDay === 0 && menu.isWeekend) return []; 

                        return presentMealParts.map((mealPartKey, mealPartIndex) => {
                          const mealItemName = menu[mealPartKey];
                          const isFirstMealPartForRowSpan = mealPartIndex === 0;
                          const itemTempKey = `${menu.date}_${mealPartKey}`;
                          const itemTempInputs = mealItemTemperatures[itemTempKey] || {};

                          return (
                            <TableRow key={`${menu.date}-${mealPartKey}`} className={menu.isWeekend ? "bg-muted/30 opacity-70" : ""}>
                              {isFirstMealPartForRowSpan && (
                                <TableCell rowSpan={numMealPartsForThisDay} className="font-medium align-top py-2">
                                  {format(parseISO(menu.date), "E dd/MM", { locale: fr })}
                                  {menu.isHoliday && menu.holidayName && (
                                    <span className="block text-xs text-amber-600 dark:text-amber-400 truncate" title={menu.holidayName}>
                                        {menu.holidayName}
                                    </span>
                                  )}
                                </TableCell>
                              )}
                              <TableCell className="align-top py-2 text-xs" title={mealItemName}>
                                <span className="font-semibold block">{mealPartDisplayNames[mealPartKey]}:</span>
                                {mealItemName}
                              </TableCell>
                              <TableCell className="p-1 align-top">
                                <Input 
                                  type="text" 
                                  placeholder="°C" 
                                  className="text-xs h-10 text-center" 
                                  value={itemTempInputs.tempService1 || ''}
                                  onChange={(e) => handleMealItemTempChange(menu.date, mealPartKey, 'tempService1', e.target.value)}
                                  disabled={menu.isWeekend}
                                />
                              </TableCell>
                              <TableCell className="p-1 align-top">
                                <Input 
                                  type="text" 
                                  placeholder="°C" 
                                  className="text-xs h-10 text-center"
                                  value={itemTempInputs.tempService2 || ''}
                                  onChange={(e) => handleMealItemTempChange(menu.date, mealPartKey, 'tempService2', e.target.value)}
                                  disabled={menu.isWeekend}
                                />
                              </TableCell>
                               <TableCell className="p-1 align-top">
                                <Input 
                                  type="text" 
                                  placeholder="°C" 
                                  className="text-xs h-10 text-center"
                                  value={itemTempInputs.tempService3 || ''}
                                  onChange={(e) => handleMealItemTempChange(menu.date, mealPartKey, 'tempService3', e.target.value)}
                                  disabled={menu.isWeekend}
                                />
                              </TableCell>
                              {isFirstMealPartForRowSpan && (
                                <>
                                  <TableCell rowSpan={numMealPartsForThisDay} className="p-1 align-top">
                                    <Input 
                                      type="text" 
                                      placeholder="Initiales" 
                                      className="text-xs h-10" 
                                      value={dailyInputs.personnel || ''}
                                      onChange={(e) => handleDailyLogChange(menu.date, 'personnel', e.target.value)}
                                      disabled={menu.isWeekend}
                                    />
                                  </TableCell>
                                </>
                              )}
                            </TableRow>
                          );
                        });
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground flex items-center justify-center gap-2">
                  <AlertCircle className="w-5 h-5" /> Aucun menu planifié à afficher pour cette semaine.
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}


    