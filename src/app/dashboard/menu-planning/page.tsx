
"use client";

import Link from 'next/link';
import { BookOpenText, CalendarDays, ClipboardCheck, Thermometer, FileText as FileTextIcon, Loader2, Trash2 } from 'lucide-react'; // Added Trash2
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CurrentDate } from '@/components/current-date';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getDaysInMonth, format, startOfDay, setDate, parseISO, endOfMonth } from 'date-fns';
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
import {
  MENU_THEME_FROID_HEX,
  MENU_THEME_VEGE_HEX,
  MENU_THEME_SAM_HEX,
  MENU_THEME_POISSON_HEX,
  MENU_THEME_FETE_HEX,
  MENU_WEEKEND_HEX,
  MENU_HOLIDAY_WEEKDAY_HEX, MENU_HOLIDAY_WEEKEND_HEX, } from '@/config/colors';
import { useIsMobile } from '@/hooks/use-mobile'; 
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

{
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
  const [menuData, setMenuData] = useState<DailyMenu[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResettingMonthData, setIsResettingMonthData] = useState(false);
  const [isGeneratingMonthlyPdf, setIsGeneratingMonthlyPdf] = useState(false);
  const [isGeneratingAllWeeklyPdfs, setIsGeneratingAllWeeklyPdfs] = useState(false); // New state for generating all weekly PDFs
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState(menuPlanningTabsConfig[0].value);
  // Ref pour accéder aux méthodes du composant WeeklyOrderSheets (sera utilisé plus tard)
  const weeklyOrderSheetsRef = useRef<{ generatePdfForWeek: (week: WeekData, weekIndex: number) => void }[] | null>(null);


  // Add a console.log to track activeTab changes
  useEffect(() => {
    console.log("Active tab changed to:", activeTab);
  }, [activeTab]);

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

  const handleSaveMenu = useCallback(async () => {
    if (!dataLoaded || isSaving || isResettingMonthData || menuData.length === 0) {
      console.log("Save conditions not met. Skipping save.");
      return;
    }


    setIsSaving(true);
    const docId = getFirestoreDocId();
    const docRef = doc(firestore, "menuPlanning", docId);

    try {
      const sanitizedMenuData = menuData.map(dayMenu => {
        const sanitizedDayMenu: Record<string, any> = {};
        for (const key in dayMenu) {
          if (Object.prototype.hasOwnProperty.call(dayMenu, key)) {
            const value = (dayMenu as any)[key];
            sanitizedDayMenu[key] = value === undefined ? null : (value === '' ? '' : value);
          }
        }
        (Object.keys(initialMenuItem) as Array<keyof MenuItem>).forEach(field => {
            if (sanitizedDayMenu[field] === undefined) {
                sanitizedDayMenu[field] = initialMenuItem[field] === undefined ? null : (initialMenuItem[field] || '');
            }
          });
        return sanitizedDayMenu;
      });

      await setDoc(docRef, { menus: sanitizedMenuData });
      window.dispatchEvent(new CustomEvent('menuDataUpdatedInFirestore'));
      toast({ title: "Menus sauvegardés", description: "Les modifications ont été enregistrées." });
    } catch (error) {
      console.error("Error saving menu data to Firestore:", error);
      toast({ title: "Erreur de Sauvegarde", description: "Les modifications n'ont pas pu être enregistrées.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [menuData, dataLoaded, isSaving, isResettingMonthData, getFirestoreDocId, toast]);

  useEffect(() => {
    // This useEffect is now only for cleanup or side effects that don't involve automatic saving.

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
        doc.setFontSize(pdfSettings.documentTitleFontSize);
        doc.text(finalTitle, doc.internal.pageSize.getWidth() / 2, currentY, { align: 'center' });
        currentY += pdfSettings.documentTitleFontSize * 0.7 + 5;
      }

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

      const themeRgbColors: Record<MenuThemeIdentifier, [number, number, number] | null> = MENU_THEME_OPTIONS_FOR_SELECT.reduce((acc, themeOption) => {
        if (themeOption.value !== NO_THEME_SELECT_VALUE) { // Exclure l'option "Pas de thème"
           acc[themeOption.value as MenuThemeIdentifier] = hexToRgb(
                (({
                    froid: MENU_THEME_FROID_HEX, vege: MENU_THEME_VEGE_HEX, sam: MENU_THEME_SAM_HEX, poisson: MENU_THEME_POISSON_HEX, fete: MENU_THEME_FETE_HEX
                })[themeOption.value as MenuThemeIdentifier]) || ''
           );
        }
        return acc;
    }, {} as Record<MenuThemeIdentifier, [number, number, number] | null>);
    console.log("themeRgbColors:", themeRgbColors); // Conservez cette ligne de log que vous avez ajoutée

      const holidayWeekendColor = hexToRgb(MENU_HOLIDAY_WEEKEND_HEX);
      const holidayWeekdayColor = hexToRgb(MENU_HOLIDAY_WEEKDAY_HEX);
      const weekendColor = hexToRgb(MENU_WEEKEND_HEX);

   doc.autoTable({
          headStyles: headStyles,
          styles: {
            fontSize: pdfSettings.tableBodyFontSize,
            cellPadding: 1.5,
            valign: 'middle',
            font: pdfSettings.fontFamily,
        },
          columnStyles: {
   0: { cellWidth: 30 }, // Date
   1: { cellWidth: 40 }, // Jour
   2: { cellWidth: 40 }, // Thème
   3: { cellWidth: 60 }, // Entrée
   4: { cellWidth: 55 }, // Plat
   5: { cellWidth: 55 }, // Féculent
   6: { cellWidth: 55 }, // Légume
   7: { cellWidth: 55 }, // Sauce
   8: { cellWidth: 55 }, // Dessert
          },
          head: head,
   body: body,
   didParseCell: (data) => {
    if (data.section === 'body' && data.row && typeof data.row.index ==='number' && data.row.index < menuData.length) {
       // Récupérer les données du jour correspondant
       const dayMenu = menuData[data.row.index];

       let fillColorToApply: [number, number, number] | undefined = undefined;
       const defaultRowColor: [number, number, number] = [255, 255, 255]; // Couleur par défaut au blanc

       // Appliquer la logique de couleur (thème, jour férié, week-end)
       if (dayMenu.theme && dayMenu.theme !== '' && themeRgbColors[dayMenu.theme as MenuThemeIdentifier]) {
            fillColorToApply = themeRgbColors[dayMenu.theme as MenuThemeIdentifier];
       } else if (dayMenu.isHoliday) {
           fillColorToApply = dayMenu.isWeekend ? holidayWeekendColor : holidayWeekdayColor;
       } else if (dayMenu.isWeekend) {
           fillColorToApply = weekendColor;
       }

       // Si aucune couleur spécifique n'est appliquée, utiliser la couleur blanche par défaut
       if (!fillColorToApply) {
           fillColorToApply = defaultRowColor;
       }

       // Appliquer la couleur au style de la cellule pour que jspdf-autotable la dessine
       // S'assurer que la propriété styles existe sur la cellule courante
       if (!data.cell.styles) {
           data.cell.styles = {};
       }
       data.cell.styles.fillColor = fillColorToApply;
        // Ajouter les styles de bordure par défaut
        data.cell.styles.lineWidth = data.row.index === menuData.length - 1 ? 0.1 : 0.05; // Ligne plus épaisse en bas de la dernière ligne
        data.cell.styles.lineColor = [0, 0, 0]; // Bordures noires

    }
  },
          margin: { top: currentY + 10, left: pdfSettings.marginLeft, right: pdfSettings.marginRight }, // Positionner le tableau après le titre
          startY: currentY + 10, // Définir startY explicitement
          didDrawPage: (data) => {
            const pageCount = doc.internal.getNumberOfPages();
            const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });
            if (pdfSettings.footerText) {
                let footerStr = pdfSettings.footerText
                  .replace('{date}', generationDateFormatted)
                  .replace('{pageNumber}', data.pageNumber.toString())
                  .replace('{totalPages}', pageCount.toString());
                doc.setFontSize(pdfSettings.footerFontSize);
                doc.text(footerStr, pdfSettings.marginLeft, pageHeight - (pdfSettings.marginBottom / 2), { align: 'left' });
            }
          }
        });


    // Function to generate a single weekly PDF - Moved inside page.tsx
    const generateWeeklyPdf = (week: WeekData, weekIndex: number, toastMessage: boolean = true) => {
        console.log('generateWeeklyPdf called for week', week.weekNumberInMonth);
        // setIsGeneratingPdf(weekIndex); // This state is now in WeeklyOrderSheets component

        try {
            const pdfSettings = getPdfLayoutSettings('weekly_order_sheet');
            const doc = new jsPDF({
                orientation: pdfSettings.orientation,
                unit: 'pt',
                format: pdfSettings.pageSize
            }) as jsPDFWithAutoTable;
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            let currentY = pdfSettings.marginTop;
            doc.setFont(pdfSettings.fontFamily);

            // Section En-tête et Titre du Document (similar to monthly)
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

            const moduleDefaultTitle = "Fiche de Commande Cuisine";
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
              doc.setFontSize(pdfSettings.documentTitleFontSize);
              doc.text(finalTitle, pageWidth / 2, currentY + 5, { align: 'center' });
              currentY += (pdfSettings.documentTitleFontSize || 14) + 5;
            }

            doc.setFontSize(pdfSettings.defaultFontSize);
            const semaineText = `Semaine du: ${format(week.startDate, "dd/MM/yyyy", { locale: fr })}  Au: ${format(week.endDate, "dd/MM/yyyy", { locale: fr })}`;
            doc.text(semaineText, pdfSettings.marginLeft, currentY + 10);
            currentY += (pdfSettings.defaultFontSize * 1.2) + 10;


            // Section Tableaux des Menus et Catégories

            // Prepare data for the weekly menu table
            const weeklyMenuHeader = [['Date', 'Jour', 'Entrée', 'Plat', 'Féculent', 'Légume', 'Sauce', 'Dessert']];
            const weeklyMenuBody = week.menus.map(menu => [
              format(parseISO(menu.date), 'dd/MM', { locale: fr }),
              menu.dayName,
              menu.entree || '-',
              menu.plat || '-',
              menu.feculent || '-',
              menu.legume || '-',
              menu.sauce || '-',
              menu.dessert || '-',
            ]);

            // Add the weekly menu table to the PDF (maintenant le premier autoTable)
            doc.autoTable({
              startY: currentY, // Commencez après le titre et la date de la semaine
              head: weeklyMenuHeader,
              body: weeklyMenuBody,
              theme: 'grid',
              headStyles: { fontStyle: 'bold', fontSize: pdfSettings.tableHeaderFontSize, halign: 'center', fillColor: pdfSettings.primaryColor ? hexToRgb(pdfSettings.primaryColor) : [200, 200, 200] }, // Styles en-tête menus
              styles: { fontSize: pdfSettings.tableBodyFontSize, cellPadding: 2, valign: 'middle', font: pdfSettings.fontFamily, lineWidth: 0.1, lineColor: [0, 0, 0], halign: 'center', minCellHeight: 15 }, // Styles corps menus
              columnStyles: {
                0: { cellWidth: 40 }, // Date
                1: { cellWidth: 40 }, // Jour
                2: { cellWidth: 'auto' }, // Entrée
                3: { cellWidth: 'auto' }, // Plat
                4: { cellWidth: 'auto' }, // Féculent
                5: { cellWidth: 'auto' }, // Légume
                6: { cellWidth: 'auto' }, // Sauce
                7: { cellWidth: 'auto' }, // Dessert
              },
              margin: { left: pdfSettings.marginLeft, right: pdfSettings.marginRight },
              didDrawPage: (data) => {
                  const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });
                  const pageCount = doc.internal.getNumberOfPages();
                  if (pdfSettings.footerText) {
                    let footerStr = pdfSettings.footerText
                      .replace('{date}', generationDateFormatted)
                      .replace('{pageNumber}', data.pageNumber.toString())
                      .replace('{totalPages}', pageCount.toString());
                    doc.setFontSize(pdfSettings.footerFontSize);
                    doc.text(footerStr, pdfSettings.marginLeft, pageHeight - (pdfSettings.marginBottom / 2));
                  }
                });