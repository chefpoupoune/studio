
"use client";

import Link from 'next/link';
import { BookOpenText, CalendarDays, ClipboardCheck, Thermometer, FileText as FileTextIcon, Loader2, Trash2 } from 'lucide-react'; // Added Trash2
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CurrentDate } from '@/components/current-date';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getDaysInMonth, format, startOfDay, setDate, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getFrenchPublicHolidays, type PublicHoliday } from '@/lib/holiday-utils';
import type { DailyMenu, MenuItem, MenuField, StoredMenuThemeValue, MenuThemeIdentifier } from './types';
import { initialMenuItem, frenchDays, MENU_THEME_OPTIONS_FOR_SELECT, NO_THEME_SELECT_VALUE } from './types';
import MenuPlanningTable from './components/menu-planning-table';
import WeeklyOrderSheets from './components/weekly-order-sheets';
import TemperatureSheet from './components/temperature-sheet';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import { useIsMobile } from '@/hooks/use-is-mobile'; // Corrected import path
import { firestore } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
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


interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);
const months = Array.from({ length: 12 }, (_, i) => ({
  value: i.toString(),
  label: format(new Date(currentYear, i), "MMMM", { locale: fr }),
}));

const menuPlanningTabsConfig = [
  { value: "planning", label: "Planification Mensuelle", Icon: CalendarDays },
  { value: "order-sheets", label: "Fiches de Commande", Icon: ClipboardCheck },
  { value: "temperature-sheets", label: "Fiches de Température", Icon: Thermometer },
];

export default function MenuPlanningPage() {
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
  const [menuData, setMenuData] = useState<DailyMenu[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false); 
  const [isSaving, setIsSaving] = useState(false);
  const [isResettingMonthData, setIsResettingMonthData] = useState(false); // New state for reset
  const [isGeneratingMonthlyPdf, setIsGeneratingMonthlyPdf] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState(menuPlanningTabsConfig[0].value);

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
        holidayName: holidayMap.get(dateStr) || undefined, 
        ...initialMenuItem, 
      });
    }
    return data;
  }, []);

  const getFirestoreDocId = useCallback(() => `menu_${selectedYear}_${selectedMonth}`, [selectedYear, selectedMonth]);

  useEffect(() => {
    const loadMenuData = async () => {
      setDataLoaded(false);
      const docId = getFirestoreDocId();
      const docRef = doc(firestore, "menuPlanning", docId);
      const yearNum = parseInt(selectedYear, 10);
      const monthNum = parseInt(selectedMonth, 10);

      try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const firestoreData = docSnap.data();
          const loadedMenuData = (firestoreData.menus as any[] || []).map((d: any) => ({
             ...initialMenuItem, 
             ...d,
             date: d.date, 
             theme: d.theme || '', 
             entree: d.entree || '',
             plat: d.plat || '',
             feculent: d.feculent || '',
             legume: d.legume || '',
             sauce: d.sauce || '',
             dessert: d.dessert || '',
             holidayName: d.holidayName || undefined,
          }));
          
          const expectedDays = getDaysInMonth(new Date(yearNum, monthNum));
          const firstDayLoadedDate = loadedMenuData.length > 0 ? loadedMenuData[0].date : null;
          const expectedFirstDayPrefix = `${yearNum}-${(monthNum + 1).toString().padStart(2, '0')}`;

            if (loadedMenuData.length === expectedDays && firstDayLoadedDate && firstDayLoadedDate.startsWith(expectedFirstDayPrefix)) {
                setMenuData(loadedMenuData);
            } else {
                console.warn(`Data mismatch for ${docId}. Expected ${expectedDays} days starting with ${expectedFirstDayPrefix}, got ${loadedMenuData.length} days starting with ${firstDayLoadedDate}. Regenerating.`);
                const freshData = generateMonthData(yearNum, monthNum);
                setMenuData(freshData);
                
                const sanitizedFreshData = freshData.map(dayMenu => ({
                  ...dayMenu,
                  entree: dayMenu.entree || '',
                  plat: dayMenu.plat || '',
                  feculent: dayMenu.feculent || '',
                  legume: dayMenu.legume || '',
                  sauce: dayMenu.sauce || '',
                  dessert: dayMenu.dessert || '',
                  theme: dayMenu.theme || '',
                  holidayName: dayMenu.holidayName || null, 
                }));
                await setDoc(docRef, { menus: sanitizedFreshData });
                 window.dispatchEvent(new CustomEvent('menuDataUpdatedInFirestore'));
                 console.log("Dispatched menuDataUpdatedInFirestore event after regenerating and saving month data.");
            }
        } else {
          const freshData = generateMonthData(yearNum, monthNum);
          setMenuData(freshData);
          const sanitizedFreshData = freshData.map(dayMenu => ({
            ...dayMenu,
            entree: dayMenu.entree || '',
            plat: dayMenu.plat || '',
            feculent: dayMenu.feculent || '',
            legume: dayMenu.legume || '',
            sauce: dayMenu.sauce || '',
            dessert: dayMenu.dessert || '',
            theme: dayMenu.theme || '',
            holidayName: dayMenu.holidayName || null, 
          }));
          await setDoc(docRef, { menus: sanitizedFreshData });
          window.dispatchEvent(new CustomEvent('menuDataUpdatedInFirestore'));
          console.log("Dispatched menuDataUpdatedInFirestore event after creating new month data.");
          toast({ title: "Nouveau mois initialisé", description: `Les données pour ${months[monthNum].label} ${yearNum} ont été créées.`});
        }
      } catch (error) {
        console.error("Error loading menu data from Firestore:", error);
        toast({ title: "Erreur de chargement des menus", description: "Impossible de charger les données. Utilisation des données par défaut.", variant: "destructive"});
        setMenuData(generateMonthData(yearNum, monthNum));
      }
      setDataLoaded(true);
    };

    loadMenuData();
  }, [selectedYear, selectedMonth, generateMonthData, getFirestoreDocId, toast]);

  useEffect(() => {
    if (!dataLoaded || isSaving || isResettingMonthData || menuData.length === 0) { // Added isResettingMonthData
      return;
    }
    
    const saveToFirestore = async () => {
      setIsSaving(true);
      const docId = getFirestoreDocId();
      const docRef = doc(firestore, "menuPlanning", docId);
      try {
        const sanitizedMenuData = menuData.map(dayMenu => {
          const sanitizedDayMenu: Record<string, any> = {};
          for (const key in dayMenu) {
            if (Object.prototype.hasOwnProperty.call(dayMenu, key)) {
              const value = (dayMenu as any)[key];
              if (key === 'holidayName') {
                sanitizedDayMenu[key] = value === undefined ? null : value;
              } else if (typeof value === 'string' && value === undefined) { 
                sanitizedDayMenu[key] = '';
              } else if (value === undefined) {
                 sanitizedDayMenu[key] = initialMenuItem[key as keyof MenuItem] === undefined ? null : (initialMenuItem[key as keyof MenuItem] || '');
              }
               else {
                sanitizedDayMenu[key] = value;
              }
            }
          }
          (Object.keys(initialMenuItem) as Array<keyof MenuItem>).forEach(field => {
            if (sanitizedDayMenu[field] === undefined) {
                sanitizedDayMenu[field] = initialMenuItem[field] || '';
            }
          });
          return sanitizedDayMenu as DailyMenu;
        });
        await setDoc(docRef, { menus: sanitizedMenuData });
        window.dispatchEvent(new CustomEvent('menuDataUpdatedInFirestore'));
        console.log("Dispatched menuDataUpdatedInFirestore event after saving to Firestore.");
      } catch (error) {
        console.error("Error saving menu data to Firestore:", error);
        toast({ title: "Erreur de Sauvegarde", description: "Les modifications n'ont pas pu être enregistrées dans Firestore.", variant: "destructive" });
      }
      setIsSaving(false);
    };

    const timeoutId = setTimeout(saveToFirestore, 1500);
    return () => clearTimeout(timeoutId);

  }, [menuData, dataLoaded, isSaving, isResettingMonthData, getFirestoreDocId, toast]);


  const handleUpdateMenuEntry = useCallback((date: string, field: MenuField, value: StoredMenuThemeValue) => {
    setMenuData(prevData =>
      prevData.map(dayMenu =>
        dayMenu.date === date ? { ...dayMenu, [field]: value === undefined ? '' : value } : dayMenu 
      )
    );
  }, []);

  const handleResetCurrentMonthData = async () => {
    setIsResettingMonthData(true);
    const yearNum = parseInt(selectedYear, 10);
    const monthNum = parseInt(selectedMonth, 10);
    const freshData = generateMonthData(yearNum, monthNum);
    const sanitizedFreshData = freshData.map(dayMenu => ({
        ...dayMenu,
        entree: dayMenu.entree || '',
        plat: dayMenu.plat || '',
        feculent: dayMenu.feculent || '',
        legume: dayMenu.legume || '',
        sauce: dayMenu.sauce || '',
        dessert: dayMenu.dessert || '',
        theme: dayMenu.theme || '',
        holidayName: dayMenu.holidayName || null,
    }));
    
    const docId = getFirestoreDocId();
    const docRef = doc(firestore, "menuPlanning", docId);

    try {
      await setDoc(docRef, { menus: sanitizedFreshData });
      setMenuData(freshData); // Update local state after successful save
      window.dispatchEvent(new CustomEvent('menuDataUpdatedInFirestore'));
      toast({ title: "Mois Réinitialisé", description: `Les menus pour ${months[monthNum].label} ${yearNum} ont été réinitialisés.` });
    } catch (error) {
      console.error("Error resetting month data in Firestore:", error);
      toast({ title: "Erreur de Réinitialisation", variant: "destructive" });
    } finally {
      setIsResettingMonthData(false);
    }
  };

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
      const pdfSettings = getPdfLayoutSettings('menu_planning_monthly');
      const doc = new jsPDF({
        orientation: pdfSettings.orientation,
        unit: 'pt',
        format: pdfSettings.pageSize,
      }) as jsPDFWithAutoTable;
      doc.setFont(pdfSettings.fontFamily);

      const monthLabel = months.find(m => m.value === selectedMonth)?.label || '';
      const yearLabel = selectedYear;
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
                doc.setFontSize(8); doc.setTextColor(100); doc.text("LOGO_ERR", data.cell.x + data.cell.width/2, data.cell.y + data.cell.height/2, {align: 'center', baseline: 'middle'});
              }
            } else if (pdfSettings.logoUrl && headerRows[data.row.index][data.column.index] === '{logo}') { 
                doc.setFillColor(230, 230, 230); doc.rect(data.cell.x + 2, data.cell.y + 2, data.cell.width - 4, data.cell.height - 4, 'F');
                doc.setFontSize(8); doc.setTextColor(100); doc.text("LOGO", data.cell.x + data.cell.width/2, data.cell.y + data.cell.height/2, {align: 'center', baseline: 'middle'});
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
            doc.setFontSize(pdfSettings.headerFontSize); doc.text(`[Logo Error]`, pdfSettings.marginLeft, currentY); currentY += pdfSettings.headerFontSize + 5;
        }
      } else if (pdfSettings.logoUrl) {
         doc.setFontSize(pdfSettings.headerFontSize); doc.text(`[Logo URL: ${pdfSettings.logoUrl}]`, pdfSettings.marginLeft, currentY); currentY += pdfSettings.headerFontSize + 5;
      }
      
      const moduleDefaultTitle = `Planification des Menus - ${monthLabel} ${yearLabel}`;
      let title;
      if (pdfSettings.showDocumentBaseTitle && pdfSettings.documentBaseTitle && pdfSettings.documentBaseTitle.trim() !== "") {
        title = `${pdfSettings.documentBaseTitle} - ${moduleDefaultTitle}`;
      } else {
        title = moduleDefaultTitle;
      }
      doc.setFontSize(pdfSettings.documentTitleFontSize);
      doc.text(title, doc.internal.pageSize.getWidth() / 2, currentY, { align: 'center' });
      currentY += pdfSettings.documentTitleFontSize * 0.7 + 5; 
      doc.setFontSize(pdfSettings.defaultFontSize);
      doc.text(`Généré le: ${generationDateFormatted}`, pdfSettings.marginLeft, currentY);
      currentY += pdfSettings.defaultFontSize + 5;


      const headStyles: { fillColor?: [number, number, number], textColor?: [number, number, number], fontStyle?: string, fontSize?: number } = { 
        fontStyle: 'bold',
        fontSize: pdfSettings.tableHeaderFontSize,
      };
      if (pdfSettings.primaryColor) {
        const primaryColorRgb = hexToRgb(pdfSettings.primaryColor);
        if (primaryColorRgb) {
          headStyles.fillColor = primaryColorRgb;
          const brightness = (primaryColorRgb[0] * 299 + primaryColorRgb[1] * 587 + primaryColorRgb[2] * 114) / 1000;
          headStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
        }
      }

      const head = [['Date', 'Jour', 'Thème', 'Entrée', 'Plat', 'Féculent', 'Légume', 'Sauce', 'Dessert']];
      
      const body = menuData.map(dayMenu => {
        const currentThemeValueForSelect = dayMenu.theme === '' ? NO_THEME_SELECT_VALUE : dayMenu.theme;
        const themeLabel = MENU_THEME_OPTIONS_FOR_SELECT.find(t => t.value === currentThemeValueForSelect)?.label || '-';
        return [
          format(parseISO(dayMenu.date), 'dd/MM', { locale: fr }),
          dayMenu.dayName + (dayMenu.holidayName ? `\n(${dayMenu.holidayName})` : ''), 
          themeLabel,
          dayMenu.entree || '-',
          dayMenu.plat || '-',
          dayMenu.feculent || '-',
          dayMenu.legume || '-',
          dayMenu.sauce || '-',
          dayMenu.dessert || '-',
        ];
      });

      const themeRgbColors: Record<MenuThemeIdentifier, [number, number, number]> = {
        froid: [139, 195, 255],
        vege: [110, 231, 183],
        sam: [253, 224, 71],
        poisson: [249, 168, 212],
        fete: [252, 165, 165],
      };
      const holidayWeekendColor: [number, number, number] = [250, 202, 21]; 
      const holidayWeekdayColor: [number, number, number] = [253, 230, 138];
      const weekendColor: [number, number, number] = [229, 231, 235];

      doc.autoTable({
        head: head,
        body: body,
        startY: currentY,
        theme: 'grid',
        headStyles: headStyles,
        styles: { fontSize: pdfSettings.tableBodyFontSize, cellPadding: 1.5, valign: 'middle', font: pdfSettings.fontFamily }, 
        columnStyles: {
          0: { cellWidth: 20 }, 
          1: { cellWidth: 30 }, 
          2: { cellWidth: 25 }, 
        },
        willDrawCell: (data) => {
          if (data.section === 'body' && data.row && typeof data.row.index === 'number' && data.row.index < menuData.length) {
            const dayMenu = menuData[data.row.index];
            if (dayMenu) {
              let fillColorToApply: [number, number, number] | undefined = undefined;

              if (dayMenu.theme && dayMenu.theme !== '' && themeRgbColors[dayMenu.theme as MenuThemeIdentifier]) {
                fillColorToApply = themeRgbColors[dayMenu.theme as MenuThemeIdentifier];
              } else if (dayMenu.isHoliday) {
                fillColorToApply = dayMenu.isWeekend ? holidayWeekendColor : holidayWeekdayColor;
              } else if (dayMenu.isWeekend) {
                fillColorToApply = weekendColor;
              }

              if (fillColorToApply) {
                for (let i = 0; i < data.row.cells.length; i++) {
                    data.row.cells[i].styles.fillColor = fillColorToApply;
                }
              }
            }
          }
        },
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          if (pdfSettings.footerText) {
            let footerStr = pdfSettings.footerText
              .replace('{date}', generationDateFormatted)
              .replace('{pageNumber}', data.pageNumber.toString())
              .replace('{totalPages}', pageCount.toString());
            doc.setFontSize(pdfSettings.footerFontSize);
            doc.text(footerStr, pdfSettings.marginLeft, doc.internal.pageSize.height - (pdfSettings.marginBottom / 2));
          }
        },
        margin: { 
            top: pdfSettings.marginTop, 
            right: pdfSettings.marginRight, 
            bottom: pdfSettings.marginBottom, 
            left: pdfSettings.marginLeft 
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
  
  const planningContent = (
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
              Les thèmes colorient la ligne : Bleu (Froid), Vert (Végé), Jaune (SAM), Rose (Poisson), Orange (Fête).
              Les données sont sauvegardées automatiquement dans Firestore.
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto self-start sm:self-center">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={!dataLoaded || isSaving || isResettingMonthData} className="w-full sm:w-auto">
                  {(isResettingMonthData) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Réinitialiser Mois
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmer la réinitialisation</AlertDialogTitle>
                  <AlertDialogDescription>
                    Êtes-vous sûr de vouloir réinitialiser tous les menus pour ${months.find(m => m.value === selectedMonth)?.label} ${selectedYear} ? Cette action est irréversible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={handleResetCurrentMonthData}>
                    Réinitialiser
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button onClick={generateMonthlyMenuPdf} disabled={!dataLoaded || isGeneratingMonthlyPdf || isSaving || isResettingMonthData} className="w-full sm:w-auto">
              {(isGeneratingMonthlyPdf || isSaving) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileTextIcon className="mr-2 h-4 w-4" />}
              Générer PDF Mensuel
            </Button>
          </div>
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

        {!dataLoaded ? (
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
  );

  const orderSheetsContent = (
     <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-primary"/>
            Fiches de Commande Hebdomadaires
          </CardTitle>
          <CardDescription>
            Générez les fiches de commande pour chaque semaine du mois sélectionné. Les données des menus sont issues de Firestore.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WeeklyOrderSheets
            year={parseInt(selectedYear)}
            month={parseInt(selectedMonth)}
            menuData={menuData}
            isLoading={!dataLoaded}
          />
        </CardContent>
      </Card>
  );

  const temperatureSheetsContent = (
     <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Thermometer className="w-6 h-6 text-primary"/>
            Fiches de Température Hebdomadaires
          </CardTitle>
          <CardDescription>
            Consultez et remplissez les fiches de température pour chaque semaine du mois sélectionné, basées sur les plats planifiés (issus de Firestore).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TemperatureSheet
            year={parseInt(selectedYear)}
            month={parseInt(selectedMonth)}
            menuData={menuData}
            isLoading={!dataLoaded}
          />
        </CardContent>
      </Card>
  );

  const tabsContentMap: Record<string, React.ReactNode> = {
    "planning": planningContent,
    "order-sheets": orderSheetsContent,
    "temperature-sheets": temperatureSheetsContent,
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
        
      </div>
      <div className="mb-6 text-center sm:text-left">
        <CurrentDate />
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {isMobile ? (
          <div className="mb-4">
            <Label htmlFor="mobile-menuplanning-nav-select" className="text-sm font-medium">Naviguer vers :</Label>
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger id="mobile-menuplanning-nav-select" className="w-full mt-1">
                <SelectValue placeholder="Choisir une section..." />
              </SelectTrigger>
              <SelectContent>
                {menuPlanningTabsConfig.map(tab => (
                  <SelectItem key={tab.value} value={tab.value} className="text-sm">
                    <span className="flex items-center">
                      <tab.Icon className="mr-2 h-4 w-4" />
                      {tab.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 gap-1 mb-6 bg-card p-1 rounded-lg">
            {menuPlanningTabsConfig.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-2 py-1">
                <tab.Icon className="mr-1 sm:mr-2 h-4 w-4" /> {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        )}
        
        {menuPlanningTabsConfig.map(tab => (
          <TabsContent key={tab.value} value={tab.value}>
            {tabsContentMap[tab.value]}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

    
    