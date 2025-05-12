
"use client";

import Link from 'next/link';
import { ArrowLeft, BookOpenText, CalendarDays, ClipboardCheck, Thermometer, FileText as FileTextIcon, Loader2 } from 'lucide-react'; // Added Thermometer, FileTextIcon, Loader2
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CurrentDate } from '@/components/current-date';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getDaysInMonth, format, startOfDay, setDate, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getFrenchPublicHolidays, type PublicHoliday } from '@/lib/holiday-utils';
import type { DailyMenu, MenuItem, MenuField } from './types';
import { initialMenuItem, frenchDays } from './types';
import MenuPlanningTable from './components/menu-planning-table';
import WeeklyOrderSheets from './components/weekly-order-sheets';
import TemperatureSheet from './components/temperature-sheet';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Extend jsPDF with autoTable, or TypeScript might complain
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);
const months = Array.from({ length: 12 }, (_, i) => ({
  value: i.toString(),
  label: format(new Date(currentYear, i), "MMMM", { locale: fr }),
}));

export default function MenuPlanningPage() {
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
  const [menuData, setMenuData] = useState<DailyMenu[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingMonthlyPdf, setIsGeneratingMonthlyPdf] = useState(false);
  const { toast } = useToast();

  const generateMonthData = useCallback((year: number, month: number): DailyMenu[] => {
    const daysInSelectedMonth = getDaysInMonth(new Date(year, month));
    const publicHolidaysForYear = getFrenchPublicHolidays(year);
    
    const holidayMap = new Map<string, string>();
    publicHolidaysForYear.forEach(h => {
      holidayMap.set(format(h.date, 'yyyy-MM-dd'), h.name);
    });

    const data: DailyMenu[] = [];
    for (let day = 1; day <= daysInSelectedMonth; day++) {
      const currentDate = startOfDay(new Date(year, month, day));
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const dayOfWeek = currentDate.getDay();
      
      data.push({
        date: dateStr,
        dayName: frenchDays[dayOfWeek],
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isHoliday: holidayMap.has(dateStr),
        holidayName: holidayMap.get(dateStr),
        ...initialMenuItem,
      });
    }
    return data;
  }, []);

  const getLocalStorageKey = useCallback(() => `menu_planning_${selectedYear}_${selectedMonth}`, [selectedYear, selectedMonth]);

  useEffect(() => {
    setIsLoading(true);
    let storedData: DailyMenu[] | null = null;
    try {
      const rawStoredData = localStorage.getItem(getLocalStorageKey());
      if (rawStoredData) {
        storedData = JSON.parse(rawStoredData);
      }
    } catch (error) {
      console.error("Error parsing menu data from localStorage:", error);
      toast({ title: "Erreur de chargement", description: "Données de menu corrompues.", variant: "destructive"});
    }

    const yearNum = parseInt(selectedYear, 10);
    const monthNum = parseInt(selectedMonth, 10);
    
    if (storedData && storedData.length > 0) {
        const expectedDays = getDaysInMonth(new Date(yearNum, monthNum));
        if (storedData.length === expectedDays && storedData[0].date.startsWith(`${selectedYear}-${(monthNum + 1).toString().padStart(2, '0')}`)) {
            setMenuData(storedData);
        } else {
            const freshData = generateMonthData(yearNum, monthNum);
            setMenuData(freshData);
        }
    } else {
      const freshData = generateMonthData(yearNum, monthNum);
      setMenuData(freshData);
    }
    setIsLoading(false);
  }, [selectedYear, selectedMonth, generateMonthData, getLocalStorageKey, toast]);

  useEffect(() => {
    if (!isLoading && menuData.length > 0) {
      localStorage.setItem(getLocalStorageKey(), JSON.stringify(menuData));
    }
  }, [menuData, isLoading, getLocalStorageKey]);

  const handleUpdateMenuEntry = useCallback((date: string, field: MenuField, value: string) => {
    setMenuData(prevData =>
      prevData.map(dayMenu =>
        dayMenu.date === date ? { ...dayMenu, [field]: value } : dayMenu
      )
    );
  }, []);

  const generateMonthlyMenuPdf = () => {
    if (menuData.length === 0) {
      toast({
        title: "Aucune Donnée",
        description: "Aucun menu à exporter pour le mois sélectionné.",
        variant: "destructive",
      });
      return;
    }
    setIsGeneratingMonthlyPdf(true);

    try {
      const doc = new jsPDF() as jsPDFWithAutoTable;
      const monthLabel = months.find(m => m.value === selectedMonth)?.label || '';
      const yearLabel = selectedYear;
      const title = `Planification des Menus - ${monthLabel} ${yearLabel}`;

      doc.setFontSize(18);
      doc.text(title, doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
      doc.setFontSize(10);
      doc.text(`Généré le: ${format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}`, 14, 28);

      const head = [['Date', 'Jour', 'Entrée', 'Plat', 'Féculent', 'Légume', 'Sauce', 'Dessert']];
      
      const body = menuData.map(dayMenu => {
        let dateDisplay = format(parseISO(dayMenu.date), 'dd/MM', { locale: fr });
        // if (dayMenu.isHoliday && dayMenu.holidayName) {
        //   dateDisplay += `\n(${dayMenu.holidayName})`; // Add holiday name to date cell, autoTable handles multiline
        // }
        return [
          dateDisplay,
          dayMenu.dayName + (dayMenu.isHoliday && dayMenu.holidayName ? `\n(${dayMenu.holidayName})` : ''),
          dayMenu.entree || '-',
          dayMenu.plat || '-',
          dayMenu.feculent || '-',
          dayMenu.legume || '-',
          dayMenu.sauce || '-',
          dayMenu.dessert || '-',
        ];
      });

      doc.autoTable({
        head: head,
        body: body,
        startY: 35,
        theme: 'grid',
        headStyles: { fillColor: [50, 50, 50], textColor: [255,255,255], fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 1.5, valign: 'middle' },
        columnStyles: {
          0: { cellWidth: 15 }, // Date
          1: { cellWidth: 25 }, // Jour
        },
        willDrawCell: (data) => {
          const dayMenu = menuData[data.row.index];
          if (dayMenu && data.section === 'body') { // Apply only to body cells
            let fillColor;
            if (dayMenu.isHoliday) {
              fillColor = [255, 255, 204]; // Light yellow for holiday
            } else if (dayMenu.isWeekend) {
              fillColor = [230, 230, 230]; // Light gray for weekend
            }
            if (fillColor) {
              doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
            }
          }
        },
        didDrawPage: (data) => {
          const pageCount = doc.getNumberOfPages();
          doc.setFontSize(8);
          doc.text(`Page ${data.pageNumber} sur ${pageCount}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
        },
      });

      doc.save(`Planification_Menus_${monthLabel}_${yearLabel}.pdf`);
      toast({ title: "PDF Mensuel Généré", description: `La planification des menus pour ${monthLabel} ${yearLabel} a été téléchargée.` });
    } catch (error) {
      console.error("Error generating monthly menu PDF:", error);
      toast({ title: "Erreur PDF", description: "La génération du PDF des menus a échoué.", variant: "destructive" });
    } finally {
      setIsGeneratingMonthlyPdf(false);
    }
  };
  
  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 min-h-screen">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <div className="flex items-center space-x-3">
          <BookOpenText className="w-10 h-10 text-accent" />
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-foreground title-glow text-center sm:text-left">
            Planification des Menus
          </h1>
        </div>
        <Link href="/dashboard" passHref>
          <Button variant="outline" size="sm" className="group w-full sm:w-auto">
            <ArrowLeft className="mr-2 h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
            Retour au Tableau de Bord
          </Button>
        </Link>
      </div>
      <div className="mb-6 text-center sm:text-left">
        <CurrentDate />
      </div>
      
      <Tabs defaultValue="planning" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 gap-2 mb-6 bg-card p-1 rounded-lg">
          <TabsTrigger value="planning" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <CalendarDays className="mr-1 sm:mr-2 h-4 w-4" /> Planification Mensuelle
          </TabsTrigger>
          <TabsTrigger value="order-sheets" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <ClipboardCheck className="mr-1 sm:mr-2 h-4 w-4" /> Fiches de Commande
          </TabsTrigger>
          <TabsTrigger value="temperature-sheets" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Thermometer className="mr-1 sm:mr-2 h-4 w-4" /> Fiches de Température
          </TabsTrigger>
        </TabsList>

        <TabsContent value="planning">
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="w-6 h-6 text-primary"/>
                    Sélection et Création des Menus
                  </CardTitle>
                  <CardDescription>
                    Choisissez une année et un mois pour afficher et modifier les menus. Les samedis et dimanches sont en gris, les jours fériés en jaune.
                  </CardDescription>
                </div>
                <Button onClick={generateMonthlyMenuPdf} disabled={isLoading || isGeneratingMonthlyPdf} className="w-full sm:w-auto">
                  {isGeneratingMonthlyPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileTextIcon className="mr-2 h-4 w-4" />}
                  Générer PDF Mensuel
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                <div>
                  <Label htmlFor="year-select-planning">Année</Label>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger id="year-select-planning">
                      <SelectValue placeholder="Sélectionner une année" />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map(year => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="month-select-planning">Mois</Label>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger id="month-select-planning">
                      <SelectValue placeholder="Sélectionner un mois" />
                    </SelectTrigger>
                    <SelectContent>
                      {months.map(month => (
                        <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isLoading ? (
                <div className="flex justify-center items-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground">Chargement des menus...</span>
                </div>
              ) : (
                <MenuPlanningTable
                  year={parseInt(selectedYear)}
                  month={parseInt(selectedMonth)}
                  menuData={menuData}
                  onUpdateMenuEntry={handleUpdateMenuEntry}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="order-sheets">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="w-6 h-6 text-primary"/>
                Fiches de Commande Hebdomadaires
              </CardTitle>
              <CardDescription>
                Générez les fiches de commande pour chaque semaine du mois sélectionné.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WeeklyOrderSheets
                year={parseInt(selectedYear)}
                month={parseInt(selectedMonth)}
                menuData={menuData}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="temperature-sheets">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Thermometer className="w-6 h-6 text-primary"/>
                Fiches de Température Hebdomadaires
              </CardTitle>
              <CardDescription>
                Consultez et remplissez les fiches de température pour chaque semaine du mois sélectionné, basées sur les plats planifiés.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TemperatureSheet
                year={parseInt(selectedYear)}
                month={parseInt(selectedMonth)}
                menuData={menuData}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

