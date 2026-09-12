
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Info, Save, FileText, Loader2 } from 'lucide-react';
import type { PicnicWeekData, DailyClientPicnicData, PicnicRowKey, DisplayRowConfig, ClientPicnicOrder, DayOfWeekKey, BreadChoice, PicnicRowData, StoredPicnicMenuTemplate, PicnicMenuDayKey } from '../types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfWeek, endOfWeek, addDays, subDays, parseISO, getMonth, getYear } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPdfLayoutSettings, hexToRgb , } from '@/lib/pdf-settings';
import { PICNIC_MENU_DAY_KEYS, PICNIC_MENU_DAYS_LABELS, NUM_PICNIC_ITEM_SLOTS } from '../types';
import { firestore } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import  useMobile  from '@/hooks/use-mobile';



const DAYS_OF_WEEK_KEYS: DayOfWeekKey[] = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
const DAY_LABELS: Record<DayOfWeekKey, string> = {
  lundi: 'Lundi',
  mardi: 'Mardi',
  mercredi: 'Mercredi',
  jeudi: 'Jeudi',
  vendredi: 'Vendredi',
};

// Firestore collection names (ensure consistency)
const PICNIC_WEEK_DATA_COLLECTION = "picnicWeekData";
const PICNIC_CLIENT_ORDERS_COLLECTION = "picnicClientOrders";
const PICNIC_BASE_BREAD_COLLECTION = "picnicBaseBreadNumbers";
const PICNIC_MENU_TEMPLATES_COLLECTION = "picnicMenuTemplates";
const PICNIC_MENU_SELECTIONS_COLLECTION = "picnicMenuSelections";
const GLOBAL_PICNIC_RECAP_SELECTIONS_DOC_ID = "globalPicnicRecapSelections";


const initialRowDataForRecap = (): PicnicRowData => ({
  lundi: '', mardi: '', mercredi: '', jeudi: '', vendredi: '', weeklyObservation: ''
});

const createInitialPicnicWeekDataForRecap = (): PicnicWeekData => ({
  gatien: initialRowDataForRecap(),
  cedric: initialRowDataForRecap(),
  dominique: initialRowDataForRecap(),
  maxime_l: initialRowDataForRecap(),
  nicolas: initialRowDataForRecap(),
  maxime_h: initialRowDataForRecap(),
  philipe: initialRowDataForRecap(),
  plus: initialRowDataForRecap(),
  autre: initialRowDataForRecap(),
  nb_bagette: initialRowDataForRecap(),
  nb_faluche: initialRowDataForRecap(),
  total_glaciere: initialRowDataForRecap(),
});

const DISPLAY_ROWS_CONFIG_NB_PN_RECAP: Array<DisplayRowConfig & { pdfBgColor?: [number,number,number]}> = [
  { id: 'gatien', label: 'Gatien', bgColor: 'bg-yellow-300', textColor: 'text-black', isInputRow: true, isTotalContributor: true, pdfBgColor: [253, 224, 71] },
  { id: 'cedric', label: 'Cedric', bgColor: 'bg-green-500', textColor: 'text-white', isInputRow: true, isTotalContributor: true, pdfBgColor: [34, 197, 94] },
  { id: 'dominique', label: 'Dominique', bgColor: 'bg-white', textColor: 'text-black', isInputRow: true, isTotalContributor: true, pdfBgColor: [255, 255, 255] },
  { id: 'maxime_l', label: 'Maxime L', bgColor: 'bg-red-500', textColor: 'text-white', isInputRow: true, isTotalContributor: true, pdfBgColor: [239, 68, 68] },
  { id: 'nicolas', label: 'Nicolas', bgColor: 'bg-black', textColor: 'text-white', isInputRow: true, isTotalContributor: true, pdfBgColor: [0,0,0] },
  { id: 'maxime_h', label: 'Maxime H', bgColor: 'bg-blue-500', textColor: 'text-white', isInputRow: true, isTotalContributor: true, pdfBgColor: [59, 130, 246] },
  { id: 'philipe', label: 'Philipe', bgColor: 'bg-orange-500', textColor: 'text-black', isInputRow: true, isTotalContributor: true, pdfBgColor: [249, 115, 22] },
  { id: 'plus', label: 'PLUS', bgColor: 'bg-pink-500', textColor: 'text-white', isInputRow: true, isTotalContributor: true, pdfBgColor: [236, 72, 153] },
  { id: 'autre', label: 'autre', bgColor: 'bg-purple-600', textColor: 'text-white', isInputRow: true, isTotalContributor: true, pdfBgColor: [147, 51, 234] },
  { id: 'total_global', label: 'TOTAL', bgColor: 'bg-orange-300', textColor: 'text-black', isInputRow: false, pdfBgColor: [253, 186, 116] },
  { id: 'nb_bagette', label: 'NB de bagette', bgColor: 'bg-gray-300', textColor: 'text-black', isInputRow: false, pdfBgColor: [209, 213, 219] },
  { id: 'nb_faluche', label: 'NB de Faluche', bgColor: 'bg-gray-300', textColor: 'text-black', isInputRow: false, pdfBgColor: [209, 213, 219] },
  { id: 'total_glaciere', label: 'total glacière', bgColor: 'bg-orange-500', textColor: 'text-black', isInputRow: false, pdfBgColor: [249, 115, 22] },
];

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

export default function PicnicRecap() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [picnicData, setPicnicData] = useState<PicnicWeekData>(createInitialPicnicWeekDataForRecap());
  const [clientOrders, setClientOrders] = useState<ClientPicnicOrder[]>([]);
  const [baseBreadNumber, setBaseBreadNumber] = useState<string>('');

  const [allMonthlyTemplates, setAllMonthlyTemplates] = useState<Record<string, StoredPicnicMenuTemplate[]>>({});
  const [selectedTemplateIndices, setSelectedTemplateIndices] = useState<Record<string, number | null>>({});
  const [activeMenuTemplateForRecap, setActiveMenuTemplateForRecap] = useState<StoredPicnicMenuTemplate | null>(null);
  const [overrideTemplateId, setOverrideTemplateId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const { toast } = useToast();

const isMobile = useMobile();


  useEffect(() => {
    setIsClient(true);
  }, []);

  const weekIdentifier = useMemo(() => {
    const monday = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return format(monday, 'yyyy-MM-dd'); // Using YYYY-MM-DD as a more standard week ID format
  }, [selectedDate]);

  const weekDisplayString = useMemo(() => {
    const monday = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const friday = addDays(monday, 4);
    return `Semaine du : ${format(monday, 'dd MMMM', { locale: fr })} au ${format(friday, 'dd MMMM yyyy', { locale: fr })}`;
  }, [selectedDate]);

  // Load all necessary data from Firestore
  useEffect(() => {
    if (!isClient || !weekIdentifier) return;

    const loadAllDataForRecap = async () => {
      setIsLoading(true);
      setInitialDataLoaded(false);
      console.log(`[Recap LOAD ALL] For week: ${weekIdentifier}`);
      try {
        // 1. Load Picnic Week Data (NB PN)
        const picnicDataDocRef = doc(firestore, PICNIC_WEEK_DATA_COLLECTION, weekIdentifier);
        const picnicDataSnap = await getDoc(picnicDataDocRef);
        if (picnicDataSnap.exists()) {
          const dataFromDb = picnicDataSnap.data() as PicnicWeekData;
           const completeData: Partial<PicnicWeekData> = {};
            (Object.keys(createInitialPicnicWeekDataForRecap()) as PicnicRowKey[]).forEach(key => {
              completeData[key] = { ...(initialRowDataForRecap()), ...dataFromDb[key] };
            });
          setPicnicData(completeData as PicnicWeekData);
        } else {
          setPicnicData(createInitialPicnicWeekDataForRecap());
        }

        // 2. Load Client Orders
        const clientOrdersDocRef = doc(firestore, PICNIC_CLIENT_ORDERS_COLLECTION, weekIdentifier);
        const clientOrdersSnap = await getDoc(clientOrdersDocRef);
        if (clientOrdersSnap.exists()) {
          const data = clientOrdersSnap.data();
          setClientOrders(data.orders || []);
        } else {
          setClientOrders([]);
        }

        // 3. Load Base Bread Number
        const baseBreadDocRef = doc(firestore, PICNIC_BASE_BREAD_COLLECTION, weekIdentifier);
        const baseBreadSnap = await getDoc(baseBreadDocRef);
        setBaseBreadNumber(baseBreadSnap.exists() ? (baseBreadSnap.data().baseBreadNumber as string) : '');

        // 4. Load All Monthly Menu Templates (if not already loaded or stale)
        const templatesCollectionRef = collection(firestore, PICNIC_MENU_TEMPLATES_COLLECTION);
        const templatesSnapshot = await getDocs(templatesCollectionRef);
        const loadedTemplates: Record<string, StoredPicnicMenuTemplate[]> = {};
        templatesSnapshot.forEach(docSnap => {
          loadedTemplates[docSnap.id] = (docSnap.data().templates as StoredPicnicMenuTemplate[]) || [];
        });
        setAllMonthlyTemplates(loadedTemplates);

        // 5. Load Selected Template Indices
        const selectionsDocRef = doc(firestore, PICNIC_MENU_SELECTIONS_COLLECTION, GLOBAL_PICNIC_RECAP_SELECTIONS_DOC_ID);
        const selectionsDocSnap = await getDoc(selectionsDocRef);
        setSelectedTemplateIndices(selectionsDocSnap.exists() ? (selectionsDocSnap.data() as Record<string, number | null>) : {});

      } catch (e) {
        console.error(`[Recap LOAD ALL] Failed to load data for week ${weekIdentifier}`, e);
        toast({ title: "Erreur de chargement du récapitulatif", variant: "destructive" });
        setPicnicData(createInitialPicnicWeekDataForRecap());
        setClientOrders([]);
        setBaseBreadNumber('');
        setAllMonthlyTemplates({});
        setSelectedTemplateIndices({});
      } finally {
        setInitialDataLoaded(true);
        setIsLoading(false);
         console.log(`[Recap LOAD ALL] Finished loading for week ${weekIdentifier}. InitialDataLoaded: true`);
      }
    };

    loadAllDataForRecap();
  }, [isClient, weekIdentifier, toast]);


  // Determine active menu template for the current week
   useEffect(() => {
    if (!isClient || !initialDataLoaded) {
        setActiveMenuTemplateForRecap(null);
        return;
    }

    if (overrideTemplateId && overrideTemplateId !== 'auto') {
        const [monthIndex, templateIndex] = overrideTemplateId.split('-').map(Number);
        if (allMonthlyTemplates[monthIndex]?.[templateIndex]) {
            const template = allMonthlyTemplates[monthIndex][templateIndex];
            setActiveMenuTemplateForRecap(template);
            return; 
        } else {
             setOverrideTemplateId('auto');
        }
    }

    const currentMonthIndex = getMonth(selectedDate).toString();
    const templateIndexForMonth = selectedTemplateIndices[currentMonthIndex];
    
    if (templateIndexForMonth !== null && templateIndexForMonth !== undefined && allMonthlyTemplates[currentMonthIndex]?.[templateIndexForMonth]) {
        const template = allMonthlyTemplates[currentMonthIndex][templateIndexForMonth];
        setActiveMenuTemplateForRecap(template);
    } else {
        setActiveMenuTemplateForRecap(null);
    }
  }, [isClient, selectedDate, allMonthlyTemplates, selectedTemplateIndices, initialDataLoaded, overrideTemplateId]);


  // Save baseBreadNumber to Firestore
  useEffect(() => {
    if (!isClient || isLoading || !initialDataLoaded || !weekIdentifier) return;

    const saveBaseBread = async () => {
      try {
        const baseBreadDocRef = doc(firestore, PICNIC_BASE_BREAD_COLLECTION, weekIdentifier);
        await setDoc(baseBreadDocRef, { baseBreadNumber });
      } catch (e) {
        console.error(`Failed to save base bread number for week ${weekIdentifier}:`, e);
        toast({ title: "Erreur sauvegarde pain de base", variant: "destructive" });
      }
    };
    
    const timeoutId = setTimeout(saveBaseBread, 1000);
    return () => clearTimeout(timeoutId);

  }, [baseBreadNumber, isClient, isLoading, initialDataLoaded, weekIdentifier, toast]);


  const handleRecapObservationChange = (rowId: PicnicRowKey, value: string) => {
    setPicnicData(prevData => ({
        ...prevData,
        [rowId]: {
            ...(prevData[rowId] || initialRowDataForRecap()),
            weeklyObservation: value,
        }
    }));
  };

  const saveRecapObservations = useCallback(async () => {
    if (!isClient || !weekIdentifier) return;
    try {
      const picnicDataDocRef = doc(firestore, PICNIC_WEEK_DATA_COLLECTION, weekIdentifier);
      await setDoc(picnicDataDocRef, picnicData);
      toast({ title: "Observations du Récapitulatif Sauvegardées" });
    } catch (e) {
      console.error("Failed to save picnic recap observations to Firestore", e);
      toast({ title: "Erreur de sauvegarde des observations", variant: "destructive" });
    }
  }, [picnicData, toast, weekIdentifier, isClient]);

  const calculateDailyTotal = useCallback((day: DayOfWeekKey): number => {
    return DISPLAY_ROWS_CONFIG_NB_PN_RECAP
        .filter(row => row.isInputRow && row.isTotalContributor)
        .reduce((sum, row) => sum + (Number(picnicData[row.id as PicnicRowKey]?.[day]) || 0), 0);
  }, [picnicData]);

  const dailyGlobalTotals = useMemo(() => DAYS_OF_WEEK_KEYS.reduce((acc, day) => ({ ...acc, [day]: calculateDailyTotal(day) }), {} as Record<DayOfWeekKey, number>), [calculateDailyTotal]);

  const dailyGlaciereTotals = useMemo(() => {
    return DAYS_OF_WEEK_KEYS.reduce((acc, day) => {
      const count = DISPLAY_ROWS_CONFIG_NB_PN_RECAP
        .filter(config => config.isInputRow && config.isTotalContributor)
        .reduce((sum, config) => sum + (Number(picnicData[config.id as PicnicRowKey]?.[day]) > 0 ? 1 : 0), 0);
      return { ...acc, [day]: count };
    }, {} as Record<DayOfWeekKey, number>);
  }, [picnicData]);

  const weeklyClientRecapData = useMemo(() => {
    return clientOrders
      .filter(order => order.clientName.trim() !== '' || DAYS_OF_WEEK_KEYS.some(day => Number(order.days[day]?.nbPn) > 0) || (order.observation && order.observation.trim() !== ''))
      .map(order => {
        const countsReducer = (choice: BreadChoice) => DAYS_OF_WEEK_KEYS.reduce((acc, day) => {
            const dayData = order.days[day];
            const nbPn = Number(dayData?.nbPn) || 0;
            acc[day] = { count: 0, pn: 0 };
            if (nbPn > 0 && dayData.breadChoice === choice) {
                acc[day].pn = nbPn;
                if (choice === 'baguette') acc[day].count = Math.round(nbPn / 2);
                else acc[day].count = nbPn; // Faluche & Salade
            }
            return acc;
        }, {} as Record<DayOfWeekKey, { count: number; pn: number }>);

        return {
          id: order.id,
          clientName: order.clientName,
          baguetteCounts: countsReducer('baguette'),
          falucheCounts: countsReducer('faluche'),
          saladeCounts: countsReducer('salade'),
          observation: order.observation || ''
        };
    });
  }, [clientOrders]);

  const weeklyRecapFooterTotals = useMemo(() => {
    const totals: { baguette: Record<DayOfWeekKey, number>, faluche: Record<DayOfWeekKey, number>, salade: Record<DayOfWeekKey, number> } = {
      baguette: { lundi: 0, mardi: 0, mercredi: 0, jeudi: 0, vendredi: 0 },
      faluche: { lundi: 0, mardi: 0, mercredi: 0, jeudi: 0, vendredi: 0 },
      salade: { lundi: 0, mardi: 0, mercredi: 0, jeudi: 0, vendredi: 0 },
    };
    weeklyClientRecapData.forEach(recap => {
      DAYS_OF_WEEK_KEYS.forEach(day => {
        totals.baguette[day] += recap.baguetteCounts[day]?.count || 0;
        totals.faluche[day] += recap.falucheCounts[day]?.count || 0;
        totals.salade[day] += recap.saladeCounts[day]?.count || 0;
      });
    });
    return totals;
  }, [weeklyClientRecapData]);

  const handlePreviousWeek = () => setSelectedDate(prevDate => subDays(prevDate, 7));
  const handleNextWeek = () => setSelectedDate(prevDate => addDays(prevDate, 7));

 const generateRecapPdf = async () => {
    if (!initialDataLoaded) {
        toast({ title: "Données non chargées", description: "Veuillez attendre que les données soient chargées.", variant: "default" });
        return;
    }
    setIsGeneratingPdf(true);
    try {
        const pdfSettings = await getPdfLayoutSettings('picnic_recap_weekly');
        
        const orientation = (pdfSettings.orientation === 'landscape' ? 'l' : 'p') as 'l' | 'p';
        const pageFormat = pdfSettings.pageSize || 'a3';

        const doc = new jsPDF({ orientation, unit: 'pt', format: pageFormat }) as jsPDFWithAutoTable;
        doc.setFont(pdfSettings.fontFamily);

        const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });
        let currentY = pdfSettings.marginTop;
        const pageHeight = doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageContentWidth = pageWidth - pdfSettings.marginLeft - pdfSettings.marginRight;
        
        const drawPageFooter = (data: any) => {
            const pageCount = doc.internal.getNumberOfPages();
            if (pdfSettings.footerText) {
                let footerStr = pdfSettings.footerText
                .replace('{date}', generationDateFormatted)
                .replace('{pageNumber}', data.pageNumber.toString())
                .replace('{totalPages}', pageCount.toString());
                doc.setFontSize(pdfSettings.footerFontSize);
                doc.text(footerStr, pdfSettings.marginLeft, pageHeight - (pdfSettings.marginBottom / 2));
            }
        };

        const drawPageHeader = () => {
            currentY = pdfSettings.marginTop;
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
        };

        drawPageHeader();

        const moduleDefaultTitle = `Récapitulatif Pique Nique - ${weekDisplayString}`;
        let finalTitle = "";
        if (pdfSettings.showDocumentBaseTitle && pdfSettings.documentBaseTitle) {
            finalTitle = pdfSettings.documentBaseTitle.trim();
        }
        if (pdfSettings.showModuleTitle) {
            finalTitle = finalTitle ? `${finalTitle} - ${moduleDefaultTitle}` : moduleDefaultTitle;
        }
        if (finalTitle) {
            doc.setFontSize(pdfSettings.documentTitleFontSize);
            doc.text(finalTitle, pageWidth / 2, currentY, { align: 'center' });
            currentY += pdfSettings.documentTitleFontSize * 0.7 + 15;
        }

        const blackText: [number, number, number] = [0, 0, 0];
        const whiteText: [number, number, number] = [255, 255, 255];
        
        const tableBaseStyles = { fontSize: pdfSettings.tableBodyFontSize, cellPadding: 1.5, font: pdfSettings.fontFamily, lineColor: [180, 180, 180], lineWidth: 0.5 };
        let tableHeadBaseStyles: any = { fontSize: pdfSettings.tableHeaderFontSize, fontStyle: 'bold', halign: 'center', valign: 'middle', cellPadding: 1.5, font: pdfSettings.fontFamily };
        
        if (pdfSettings.primaryColor) {
            const rgb = hexToRgb(pdfSettings.primaryColor);
            if(rgb) {
                tableHeadBaseStyles.fillColor = [rgb.r, rgb.g, rgb.b];
                const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
                tableHeadBaseStyles.textColor = brightness > 130 ? blackText : whiteText;
            }
        } else {
            tableHeadBaseStyles.fillColor = [220, 220, 220]; 
            tableHeadBaseStyles.textColor = blackText;
        }

        const orangeHeaderStyle = {...tableHeadBaseStyles, fillColor: [253, 186, 116], textColor: blackText};
        const clientRecapFooterColor = [255, 235, 205];

        let startYForSideBySide = currentY;

        doc.setFontSize(pdfSettings.defaultFontSize);
        doc.text("Nombre de Pique-Niques (NB PN) pour la Semaine", pdfSettings.marginLeft, currentY);
        currentY += pdfSettings.defaultFontSize * 0.7 + 4;

        const nbPnTableWidth = (pageContentWidth - 20) * 0.6;
        const nbPnTableHead = [['Catégorie', ...DAYS_OF_WEEK_KEYS.map(day => DAY_LABELS[day]), 'Observation (Semaine)']];
        const nbPnTableBody = DISPLAY_ROWS_CONFIG_NB_PN_RECAP.map(rowConfig => {
            const rowData = picnicData[rowConfig.id as PicnicRowKey];
            const currentPdfBgColor = rowConfig.pdfBgColor || [255,255,255];
            let currentRowTextColor = blackText;
            if (rowConfig.pdfBgColor) {
                 if (rowConfig.textColor === 'text-white') currentRowTextColor = whiteText;
                 else {
                    const brightness = (currentPdfBgColor[0] * 299 + currentPdfBgColor[1] * 587 + currentPdfBgColor[2] * 114) / 1000;
                    currentRowTextColor = brightness > 130 ? blackText : whiteText;
                }
            }
            const dailyValuesCells = DAYS_OF_WEEK_KEYS.map(day => {
                let displayValue: string;
                 if (rowConfig.id === 'total_global') displayValue = dailyGlobalTotals[day]?.toString() || '0';
                else if (rowConfig.id === 'nb_bagette') displayValue = (day === 'lundi' ? Math.round(dailyGlobalTotals[day] / 2) : 0).toString();
                else if (rowConfig.id === 'nb_faluche') displayValue = ((day === 'mercredi' || day === 'vendredi') ? (dailyGlobalTotals[day] || 0) : 0).toString();
                else if (rowConfig.id === 'total_glaciere') displayValue = dailyGlaciereTotals[day]?.toString() || '0';
                else displayValue = String(rowData?.[day] ?? (rowConfig.isInputRow ? '0' : '-'));
                return { content: displayValue, styles: { halign: 'center', fillColor: currentPdfBgColor, textColor: currentRowTextColor } };
            });
            const observationCell = { content: picnicData[rowConfig.id as PicnicRowKey]?.weeklyObservation || '-', styles: { halign: 'left', fillColor: currentPdfBgColor, textColor: currentRowTextColor, cellWidth: 'wrap' } };
            return [ { content: rowConfig.label, styles: { fontStyle: 'bold', halign: 'left', fillColor: currentPdfBgColor, textColor: currentRowTextColor } }, ...dailyValuesCells, observationCell];
        });
        const nbPnColumnStyles: any = { 0: { cellWidth: nbPnTableWidth * 0.20 }, 6: { cellWidth: nbPnTableWidth * 0.25 }};
        DAYS_OF_WEEK_KEYS.forEach((_, index) => { nbPnColumnStyles[index + 1] = { cellWidth: nbPnTableWidth * 0.11 }; }); 

        doc.autoTable({
            head: nbPnTableHead, body: nbPnTableBody, startY: currentY, theme: 'grid',
            styles: {...tableBaseStyles, fontSize: pdfSettings.tableBodyFontSize }, 
            headStyles: { ...tableHeadBaseStyles },
            columnStyles: nbPnColumnStyles, margin: { left: pdfSettings.marginLeft, right: pageWidth - pdfSettings.marginLeft - nbPnTableWidth },
            didDrawPage: drawPageFooter,
        });
        const nbPnTableFinalY = (doc as any).lastAutoTable.finalY;
        let menuTableFinalY = startYForSideBySide;


        let menuTableStartY = startYForSideBySide;
        const selectedMenuTableWidth = (pageContentWidth - 20) * 0.4;
        const startXForMenuTable = pdfSettings.marginLeft + nbPnTableWidth + 20;

        if (activeMenuTemplateForRecap) {
            doc.setFontSize(pdfSettings.defaultFontSize);
            doc.text(`Menu Pique Nique Sélectionné`, startXForMenuTable, menuTableStartY, {maxWidth: selectedMenuTableWidth - 5});
            menuTableStartY += pdfSettings.defaultFontSize * 0.7 * 2 + 4;
            
            const menuTableHead = [PICNIC_MENU_DAY_KEYS.map(dayKey => PICNIC_MENU_DAYS_LABELS[dayKey])];
            const menuTableBodyData: any[][] = [];
            for (let i = 0; i < NUM_PICNIC_ITEM_SLOTS; i++) menuTableBodyData.push(PICNIC_MENU_DAY_KEYS.map(dayKey => activeMenuTemplateForRecap.days[dayKey]?.[i] || '-'));
            if (activeMenuTemplateForRecap.weeklyNote) menuTableBodyData.push([{content: `Note: ${activeMenuTemplateForRecap.weeklyNote}`, colSpan: PICNIC_MENU_DAY_KEYS.length, styles: { fontStyle: 'italic', halign: 'left' }}]);
            
            doc.autoTable({
                head: menuTableHead, body: menuTableBodyData, startY: menuTableStartY, theme: 'grid',
                styles: {...tableBaseStyles, fontSize: pdfSettings.tableBodyFontSize -1 }, headStyles: orangeHeaderStyle,
                margin: { left: startXForMenuTable, right: pdfSettings.marginRight }, 
                didDrawPage: drawPageFooter,
            });
            menuTableFinalY = (doc as any).lastAutoTable.finalY;
        } else {
             doc.setFontSize(pdfSettings.defaultFontSize);
             doc.text("Aucun menu sélectionné pour le récap.", startXForMenuTable, menuTableStartY);
             menuTableFinalY = menuTableStartY + pdfSettings.defaultFontSize * 2;
        }
        currentY = Math.max(nbPnTableFinalY, menuTableFinalY) + 15;


        if (currentY + 20 > pageHeight - pdfSettings.marginBottom - 40) { doc.addPage(); drawPageHeader(); currentY = pdfSettings.marginTop; }
        doc.setFontSize(pdfSettings.defaultFontSize);
        doc.text("Récapitulatif Hebdomadaire des Commandes Clients", pdfSettings.marginLeft, currentY);
        currentY += pdfSettings.defaultFontSize * 0.7 + 4;
        const clientRecapHead = [['Client', 'Pain/Salade', ...DAYS_OF_WEEK_KEYS.map(day => DAY_LABELS[day]), 'Observation (Semaine)']];
        const clientRecapBody: any[][] = [];

        weeklyClientRecapData.forEach(recap => {
            const clientHasBaguettes = DAYS_OF_WEEK_KEYS.some(day => recap.baguetteCounts[day].count > 0);
            const clientHasFaluches = DAYS_OF_WEEK_KEYS.some(day => recap.falucheCounts[day].count > 0);
            const clientHasSalades = DAYS_OF_WEEK_KEYS.some(day => recap.saladeCounts[day].count > 0);

            if (!clientHasBaguettes && !clientHasFaluches && !clientHasSalades && !recap.observation) return;
            
            const rowSpan = [clientHasBaguettes, clientHasFaluches, clientHasSalades].filter(Boolean).length || 1;
            let clientCellRendered = false;
            let observationCellRendered = false;
            
            const addPdfRow = (type: string, counts: Record<DayOfWeekKey, { count: number, pn: number }>) => {
                const row = [];
                if (!clientCellRendered) {
                    row.push({ content: recap.clientName || 'Client non nommé', rowSpan, styles: { valign: 'middle', fontStyle: 'bold' } });
                    clientCellRendered = true;
                }
                row.push({ content: type, styles: { valign: 'middle' } });
                DAYS_OF_WEEK_KEYS.forEach(day => {
                    row.push(counts[day].count > 0 ? `${counts[day].count} (${counts[day].pn} PN)` : '-');
                });
                if (!observationCellRendered) {
                    row.push({ content: recap.observation || '-', rowSpan, styles: { valign: 'middle', cellWidth: 'wrap' } });
                    observationCellRendered = true;
                }
                clientRecapBody.push(row);
            };

            if (clientHasBaguettes) addPdfRow('Baguette', recap.baguetteCounts);
            if (clientHasFaluches) addPdfRow('Faluche', recap.falucheCounts);
            if (clientHasSalades) addPdfRow('Salade', recap.saladeCounts);

             if (!clientHasBaguettes && !clientHasFaluches && !clientHasSalades && recap.observation) {
                clientRecapBody.push([
                    { content: recap.clientName || 'Client non nommé', rowSpan: 1, styles: { valign: 'middle', fontStyle: 'bold' } }, 
                    '-', 
                    ...DAYS_OF_WEEK_KEYS.map(() => '-'), 
                    { content: recap.observation, rowSpan: 1, styles: { valign: 'middle', cellWidth:'wrap' } }
                ]);
             }
        });

        const clientRecapFoot: any[][] = [
            [{content: 'Total Baguette', colSpan: 2, styles:{fontStyle:'bold', halign:'right'}}, ...DAYS_OF_WEEK_KEYS.map(day => weeklyRecapFooterTotals.baguette[day] > 0 ? weeklyRecapFooterTotals.baguette[day].toString() : '-'), ''],
            [{content: 'Total Faluche', colSpan: 2, styles:{fontStyle:'bold', halign:'right'}}, ...DAYS_OF_WEEK_KEYS.map(day => weeklyRecapFooterTotals.faluche[day] > 0 ? weeklyRecapFooterTotals.faluche[day].toString() : '-'), ''],
            [{content: 'Total Salade', colSpan: 2, styles:{fontStyle:'bold', halign:'right'}}, ...DAYS_OF_WEEK_KEYS.map(day => weeklyRecapFooterTotals.salade[day] > 0 ? weeklyRecapFooterTotals.salade[day].toString() : '-'), '']
        ];
        
        doc.autoTable({
            head: clientRecapHead, body: clientRecapBody, foot: clientRecapFoot, startY: currentY, theme: 'grid',
            styles: {...tableBaseStyles}, 
            headStyles: orangeHeaderStyle, 
            margin: { left: pdfSettings.marginLeft, right: pdfSettings.marginRight }, footStyles: {fillColor: clientRecapFooterColor, textColor: blackText, fontStyle:'bold'},
            didDrawPage: drawPageFooter,
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;

        if (currentY + 20 > pageHeight - pdfSettings.marginBottom - 30) { doc.addPage(); drawPageHeader(); currentY = pdfSettings.marginTop; }
        doc.setFontSize(pdfSettings.defaultFontSize);
        doc.text("Récapitulatif Journalier des Pains & Salades Nécessaires", pdfSettings.marginLeft, currentY);
        currentY += pdfSettings.defaultFontSize * 0.7 + 4;

        const baseBreadNumValue = Number(baseBreadNumber) || 0;
        const breadNeedsHead = [['Type de Pain', ...DAYS_OF_WEEK_KEYS.map(day => DAY_LABELS[day])]];
        const breadNeedsBodyPDF = [
            ['Pain (Total)', ...DAYS_OF_WEEK_KEYS.map(day => { 
                let dailyPainTotal = baseBreadNumValue; 
                if (day === 'mardi' || day === 'jeudi') {
                    dailyPainTotal += (dailyGlaciereTotals[day] || 0);
                }
                return (dailyPainTotal > 0 || (baseBreadNumValue > 0 && (day !== 'mardi' && day !== 'jeudi'))) ? dailyPainTotal.toString() : '-';
            })],
            ['Baguette', ...DAYS_OF_WEEK_KEYS.map(day => { 
                const totalBaguettesForDay = (weeklyRecapFooterTotals.baguette[day] || 0) + (day === 'lundi' ? Math.round(dailyGlobalTotals[day] / 2) : 0); 
                return (totalBaguettesForDay > 0 ? totalBaguettesForDay.toString() : '-');
            })],
            ['Faluche', ...DAYS_OF_WEEK_KEYS.map(day => { 
                const totalFaluchesForDay = (weeklyRecapFooterTotals.faluche[day] || 0) + ((day === 'mercredi' || day === 'vendredi') ? (dailyGlobalTotals[day] || 0) : 0); 
                return (totalFaluchesForDay > 0 ? totalFaluchesForDay.toString() : '-');
            })],
             ['Salade', ...DAYS_OF_WEEK_KEYS.map(day => { 
                const totalSaladesForDay = (weeklyRecapFooterTotals.salade[day] || 0);
                return (totalSaladesForDay > 0 ? totalSaladesForDay.toString() : '-');
            })],
        ];

        doc.autoTable({
            head: breadNeedsHead, 
            body: breadNeedsBodyPDF, 
            startY: currentY, 
            theme: 'grid',
            styles: {...tableBaseStyles, fontSize: pdfSettings.tableBodyFontSize - 1},
            headStyles: orangeHeaderStyle,
            willDrawCell: (data) => {
                if (data.section === 'body') {
                    if (data.row.index === 0) { // Pain (Total)
                         data.cell.styles.fillColor = [254, 249, 195]; // yellow-100
                         data.cell.styles.fontStyle = 'bold';
                    } else if (data.row.index === 3) { // Salade
                         data.cell.styles.fillColor = [220, 252, 231]; // green-100
                    } else { // Baguette / Faluche
                         data.cell.styles.fillColor = [255, 237, 213]; // orange-100
                    }
                    if (data.column.index > 0) {
                        data.cell.styles.halign = 'center';
                    }
                     if (data.column.index === 0) {
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            },
            margin: { left: pdfSettings.marginLeft, right: pdfSettings.marginRight },
            didDrawPage: drawPageFooter,
        });
        
        doc.save(`Recap_Pique_Nique_Semaine_${weekIdentifier}.pdf`);
        toast({ title: "PDF Récapitulatif Généré", description: "Le PDF a été téléchargé." });
    } catch (error: any) {
        console.error("Error generating recap PDF:", error);
        toast({ title: "Erreur PDF", description: `La génération du PDF a échoué: ${error.message || 'Erreur inconnue'}.`, variant: "destructive" });
    } finally {
        setIsGeneratingPdf(false);
    }
  };



  if (isLoading && !initialDataLoaded) {
    return <div className="flex justify-center items-center p-10"><Loader2 className="mr-2 h-5 w-5 animate-spin"/>Chargement du récapitulatif...</div>;
  }

   if (isMobile) {
    return (
      <div className="space-y-6 p-1 md:p-4">
        <div className="flex flex-col justify-between items-center gap-4 mb-4">
            <h2 className="text-lg font-semibold text-center">{weekDisplayString}</h2>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={handlePreviousWeek} aria-label="Semaine précédente">
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="w-auto">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(selectedDate, "dd/MM", { locale: fr })}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(date) => date && setSelectedDate(date)}
                            initialFocus
                            locale={fr}
                            weekStartsOn={1}
                        />
                    </PopoverContent>
                </Popover>
                <Button variant="outline" size="icon" onClick={handleNextWeek} aria-label="Semaine suivante">
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
            <Button onClick={generateRecapPdf} disabled={isGeneratingPdf || !initialDataLoaded} className="w-full">
                {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Générer PDF Récapitulatif
            </Button>
        </div>

        <Card>
            <CardHeader>
                <CardTitle className="text-base">Forcer un Menu</CardTitle>
            </CardHeader>
            <CardContent>
                 <Select onValueChange={setOverrideTemplateId} value={overrideTemplateId || 'auto'}>
                    <SelectTrigger>
                        <SelectValue placeholder="Choisir un modèle de menu..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="auto">Sélection Automatique</SelectItem>
                        {Object.entries(allMonthlyTemplates).map(([monthIndex, templates]) => (
                            <SelectGroup key={monthIndex}>
                                <SelectLabel>{format(new Date(2024, parseInt(monthIndex), 1), 'MMMM', {locale:fr})}</SelectLabel>
                                {templates.map((template, templateIndex) => (
                                    <SelectItem key={`${monthIndex}-${templateIndex}`} value={`${monthIndex}-${templateIndex}`}>
                                        {template.name || `Modèle ${templateIndex + 1}`}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        ))}
                    </SelectContent>
                </Select>
            </CardContent>
        </Card>

        {/* Récapitulatif NB PN */}
        <Card>
            <CardHeader>
                <CardTitle>Récapitulatif NB PN</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                                    {DISPLAY_ROWS_CONFIG_NB_PN_RECAP.map((rowConfig) => (
                        <div key={rowConfig.id} className={cn("p-3 border rounded-md", rowConfig.bgColor, rowConfig.textColor)}>
                            <h4 className="font-medium text-sm mb-2">{rowConfig.label}</h4>
                            <div className="space-y-2">
                                <div className="grid grid-cols-5 gap-1 text-center text-xs">
                                    {DAYS_OF_WEEK_KEYS.map(day => (
                                        <div key={day} className="font-semibold capitalize">{DAY_LABELS[day].substring(0,3)}</div>
                                    ))}
                                    {DAYS_OF_WEEK_KEYS.map(day => {
                                        let cellContent;
                                        if (rowConfig.id === 'total_global') cellContent = dailyGlobalTotals[day];
                                        else if (rowConfig.id === 'nb_bagette') cellContent = day === 'lundi' ? Math.round(dailyGlobalTotals[day] / 2) : 0;
                                        else if (rowConfig.id === 'nb_faluche') cellContent = (day === 'mercredi' || day === 'vendredi') ? dailyGlobalTotals[day] : 0;
                                        else if (rowConfig.id === 'total_glaciere') cellContent = dailyGlaciereTotals[day];
                                        else cellContent = picnicData[rowConfig.id as PicnicRowKey]?.[day] ?? '0';
                                        return <div key={day} className="p-1 tabular-nums">{(cellContent === 0 || cellContent === '0') ? '-' : cellContent}</div>
                                    })}
                                </div>
                                <Input
                                    type="text"
                                    value={picnicData[rowConfig.id as PicnicRowKey]?.weeklyObservation ?? ''}
                                    onChange={(e) => handleRecapObservationChange(rowConfig.id as PicnicRowKey, e.target.value)}
                                    className={cn(
                                        "h-8 text-xs bg-transparent border-current/50 focus:border-current focus:ring-1",
                                        rowConfig.textColor.includes('white') ? "text-white placeholder:text-gray-300/70 focus:ring-white/50" : "text-black placeholder:text-gray-600/70 focus:ring-black/50"
                                    )}
                                    placeholder="Observation..."
                                />
                            </div>
                        </div>
                    ))}

                 <div className="mt-4 flex justify-end">
                  <Button onClick={saveRecapObservations} size="sm">
                    <Save className="mr-2 h-4 w-4" />
                    Sauvegarder Obs.
                  </Button>
                </div>
            </CardContent>
        </Card>

        {/* Menu Pique Nique */}
        {activeMenuTemplateForRecap && (
            <Card>
                <CardHeader>
                    <CardTitle>Menu Sélectionné</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {PICNIC_MENU_DAY_KEYS.map(dayKey => (
                                        <TableHead key={dayKey} className="capitalize p-1">{PICNIC_MENU_DAYS_LABELS[dayKey]}</TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Array.from({ length: NUM_PICNIC_ITEM_SLOTS }).map((_, itemIndex) => (
                                    <TableRow key={itemIndex}>
                                        {PICNIC_MENU_DAY_KEYS.map(dayKey => (
                                            <TableCell key={`${dayKey}-${itemIndex}`} className="p-1 text-xs">
                                                {activeMenuTemplateForRecap.days[dayKey]?.[itemIndex] || '-'}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    {activeMenuTemplateForRecap.weeklyNote && (
                      <p className="mt-3 text-xs italic text-muted-foreground">Note: {activeMenuTemplateForRecap.weeklyNote}</p>
                    )}
                </CardContent>
            </Card>
        )}

        {/* Commandes Clients */}
        <Card>
            <CardHeader>
                <CardTitle>Commandes Clients</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {weeklyClientRecapData.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4 text-sm">Aucune commande client.</p>
                ) : (
                    weeklyClientRecapData.map((recap) => (
                        <div key={recap.id} className="border rounded-md p-3">
                            <h4 className="font-medium text-sm mb-2">{recap.clientName || "Client non nommé"}</h4>
                            <div className="space-y-2">
                                {DAYS_OF_WEEK_KEYS.some(day => recap.baguetteCounts[day].count > 0) && <div>
                                    <div className="font-semibold text-xs mb-1">Baguettes</div>
                                    <div className="grid grid-cols-5 gap-1 text-center text-xs">
                                        {DAYS_OF_WEEK_KEYS.map(day => <div key={day} className="font-semibold capitalize">{DAY_LABELS[day].substring(0,3)}</div>)}
                                        {DAYS_OF_WEEK_KEYS.map(day => <div key={day}>{recap.baguetteCounts[day].count > 0 ? `${recap.baguetteCounts[day].count} (${recap.baguetteCounts[day].pn} PN)` : '-'}</div>)}
                                    </div>
                                </div>}
                                {DAYS_OF_WEEK_KEYS.some(day => recap.falucheCounts[day].count > 0) && <div>
                                    <div className="font-semibold text-xs mb-1">Faluches</div>
                                    <div className="grid grid-cols-5 gap-1 text-center text-xs">
                                        {DAYS_OF_WEEK_KEYS.map(day => <div key={day} className="font-semibold capitalize">{DAY_LABELS[day].substring(0,3)}</div>)}
                                        {DAYS_OF_WEEK_KEYS.map(day => <div key={day}>{recap.falucheCounts[day].count > 0 ? `${recap.falucheCounts[day].count} (${recap.falucheCounts[day].pn} PN)` : '-'}</div>)}
                                    </div>
                                </div>}
                                {DAYS_OF_WEEK_KEYS.some(day => recap.saladeCounts[day].count > 0) && <div>
                                <div className="font-semibold text-xs mb-1">Salades</div>
                                <div className="grid grid-cols-5 gap-1 text-center text-xs">
                                    {DAYS_OF_WEEK_KEYS.map(day => <div key={day} className="font-semibold capitalize">{DAY_LABELS[day].substring(0,3)}</div>)}
                                    {DAYS_OF_WEEK_KEYS.map(day => <div key={day}>{recap.saladeCounts[day].count > 0 ? `${recap.saladeCounts[day].count} (${recap.saladeCounts[day].pn} PN)` : '-'}</div>)}
                                </div>
                            </div>}
                                {recap.observation && (
                                    <p className="text-xs italic text-muted-foreground pt-2 border-t mt-2">Obs: {recap.observation}</p>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
        
        {/* Pains Nécessaires */}
        <Card>
            <CardHeader>
                <CardTitle>Récapitulatif Pains & Salades</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <Label htmlFor="base-bread-input-mobile">Nombre de Pains de Base</Label>
                    <Input id="base-bread-input-mobile" type="number" min="0" value={baseBreadNumber} onChange={(e) => setBaseBreadNumber(e.target.value)} className="mt-1 h-8" placeholder="Ex: 10" />
                </div>
                <div className="space-y-2 text-sm">
                    {[{label: 'Pain (Total)', type: 'pain'}, {label: 'Baguette', type: 'baguette'}, {label: 'Faluche', type: 'faluche'}, {label: 'Salade', type: 'salade'}].map(item => (
                        <div key={item.type} className="p-2 rounded-md bg-muted/50">
                            <h4 className="font-semibold">{item.label}</h4>
                            <div className="grid grid-cols-5 gap-1 text-center text-xs mt-1">
                                {DAYS_OF_WEEK_KEYS.map(day => <div key={day} className="font-semibold capitalize">{DAY_LABELS[day].substring(0,3)}</div>)}
                                {DAYS_OF_WEEK_KEYS.map(day => {
                                    let total = 0;
                                    if (item.type === 'pain') {
                                        total = (Number(baseBreadNumber) || 0);
                                        if (day === 'mardi' || day === 'jeudi') total += (dailyGlaciereTotals[day] || 0);
                                    } else if (item.type === 'baguette') {
                                        total = (weeklyRecapFooterTotals.baguette[day] || 0) + (day === 'lundi' ? Math.round(dailyGlobalTotals[day] / 2) : 0);
                                    } else if (item.type === 'faluche') {
                                        total = (weeklyRecapFooterTotals.faluche[day] || 0) + ((day === 'mercredi' || day === 'vendredi') ? (dailyGlobalTotals[day] || 0) : 0);
                                    } else if (item.type === 'salade') {
                                        total = weeklyRecapFooterTotals.salade[day] || 0;
                                    }
                                    return <div key={day}>{total > 0 ? total : '-'}</div>
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
      </div>
    );
  }



  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
        <h2 className="text-xl font-semibold">{weekDisplayString}</h2>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePreviousWeek} aria-label="Semaine précédente">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-auto">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, "dd/MM", { locale: fr })} (Sél. Sem.)
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                  locale={fr}
                  weekStartsOn={1}
                />
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="icon" onClick={handleNextWeek} aria-label="Semaine suivante">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button onClick={generateRecapPdf} disabled={isGeneratingPdf || !initialDataLoaded} size="sm">
              {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Générer PDF Récapitulatif
            </Button>
        </div>
      </div>

        <Card className="shadow-md">
            <CardHeader>
                <CardTitle>Sélection du Menu pour le Récapitulatif</CardTitle>
                <CardDescription>
                    Par défaut, le menu affiché correspond à celui sélectionné pour le mois en cours ({format(selectedDate, 'MMMM', {locale:fr})}). 
                    <br/>
                    Vous pouvez forcer l'affichage d'un autre modèle de menu pour ce récapitulatif.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Label>Forcer un modèle de menu</Label>
                 <Select onValueChange={setOverrideTemplateId} value={overrideTemplateId || 'auto'}>
                    <SelectTrigger className="w-full md:w-[480px] mt-1">
                        <SelectValue placeholder="Choisir un modèle de menu..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="auto">Sélection Automatique (par défaut)</SelectItem>
                        {Object.entries(allMonthlyTemplates).map(([monthIndex, templates]) => (
                            <SelectGroup key={monthIndex}>
                                <SelectLabel>{format(new Date(2024, parseInt(monthIndex), 1), 'MMMM', {locale:fr})}</SelectLabel>
                                {templates.map((template, templateIndex) => (
                                    <SelectItem key={`${monthIndex}-${templateIndex}`} value={`${monthIndex}-${templateIndex}`}>
                                        {template.name || `Modèle ${templateIndex + 1}`}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        ))}
                    </SelectContent>
                </Select>
            </CardContent>
        </Card>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Récapitulatif Hebdomadaire NB PN (Pique-Niques Semaine)</CardTitle>
          <CardDescription>
            Visualisation des nombres de pique-niques et observations pour la semaine sélectionnée. Les observations sont modifiables ici.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto border rounded-md">
            <Table className="min-w-[1050px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px] min-w-[180px] sticky left-0 z-10 bg-card">Catégorie</TableHead>
                  {DAYS_OF_WEEK_KEYS.map(day => (
                    <TableHead key={day} className="text-center bg-orange-300 text-black capitalize min-w-[100px]">
                      {DAY_LABELS[day]}
                    </TableHead>
                  ))}
                  <TableHead className="text-center min-w-[200px] bg-card">Observation (Semaine)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {DISPLAY_ROWS_CONFIG_NB_PN_RECAP.map(rowConfig => {
                  return (
                  <TableRow key={rowConfig.id}>
                    <TableCell className={cn("font-medium sticky left-0 z-10", rowConfig.bgColor, rowConfig.textColor)}>
                      {rowConfig.label}
                    </TableCell>
                    {DAYS_OF_WEEK_KEYS.map(day => {
                      let cellContent: React.ReactNode;
                      if (rowConfig.id === 'total_global') {
                        cellContent = <span className={cn("font-semibold block py-1.5", rowConfig.textColor)}>{dailyGlobalTotals[day]}</span>;
                      } else if (rowConfig.id === 'nb_bagette') {
                        const value = day === 'lundi' ? Math.round(dailyGlobalTotals[day] / 2) : 0;
                        cellContent = <span className={cn("font-semibold block py-1.5", rowConfig.textColor)}>{value}</span>;
                      } else if (rowConfig.id === 'nb_faluche') {
                        const value = (day === 'mercredi' || day === 'vendredi') ? dailyGlobalTotals[day] : 0;
                        cellContent = <span className={cn("font-semibold block py-1.5", rowConfig.textColor)}>{value}</span>;
                      } else if (rowConfig.id === 'total_glaciere') {
                        cellContent = <span className={cn("font-semibold block py-1.5", rowConfig.textColor)}>{dailyGlaciereTotals[day]}</span>;
                      } else {
                        cellContent = <span className={cn("block py-1.5", rowConfig.textColor)}>{picnicData[rowConfig.id as PicnicRowKey]?.[day] ?? '0'}</span>;
                      }
                      return (
                        <TableCell key={`${rowConfig.id}-${day}`} className={cn("p-1 text-center tabular-nums", rowConfig.bgColor)}>
                           {cellContent}
                        </TableCell>
                      );
                    })}
                    <TableCell className={cn("p-1", rowConfig.bgColor)}>
                       <Input
                          type="text"
                          value={picnicData[rowConfig.id as PicnicRowKey]?.weeklyObservation ?? ''}
                          onChange={(e) => handleRecapObservationChange(rowConfig.id as PicnicRowKey, e.target.value)}
                          className={cn(
                            "h-8 text-xs bg-transparent border-transparent focus:border-current focus:ring-1",
                            rowConfig.textColor.includes('white') ? "text-white placeholder:text-gray-300 focus:ring-white/50" : "text-black placeholder:text-gray-500 focus:ring-black/50"
                          )}
                          placeholder="Notes..."
                        />
                    </TableCell>
                  </TableRow>
                )})}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={saveRecapObservations} size="sm">
              <Save className="mr-2 h-4 w-4" />
              Sauvegarder Observations du Récapitulatif
            </Button>
          </div>
        </CardContent>
      </Card>

      {activeMenuTemplateForRecap && (
        <Card className="shadow-md mt-8">
          <CardHeader>
            <CardTitle>Menu Pique Nique Sélectionné pour Récapitulatif</CardTitle>
            <CardDescription>
              Menu du modèle de semaine sélectionné pour le récapitulatif.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto border rounded-md">
              <Table className="min-w-[800px]">
                <TableHeader>
                  <TableRow>
                    {PICNIC_MENU_DAY_KEYS.map(dayKey => (
                      <TableHead key={dayKey} className="text-center capitalize bg-orange-400 text-white p-2">
                        {PICNIC_MENU_DAYS_LABELS[dayKey]}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: NUM_PICNIC_ITEM_SLOTS }).map((_, itemIndex) => (
                    <TableRow key={itemIndex}>
                      {PICNIC_MENU_DAY_KEYS.map(dayKey => (
                        <TableCell key={`${dayKey}-${itemIndex}`} className="p-1 text-xs">
                          {activeMenuTemplateForRecap.days[dayKey]?.[itemIndex] || <span className="text-muted-foreground">-</span>}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {activeMenuTemplateForRecap.weeklyNote && (
              <p className="mt-3 text-sm italic text-muted-foreground">
                Note pour ce modèle : {activeMenuTemplateForRecap.weeklyNote}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-md mt-8">
        <CardHeader>
          <CardTitle>Récapitulatif Hebdomadaire des Commandes Clients</CardTitle>
          <CardDescription>
            Totaux par type de pain pour chaque client sur la semaine sélectionnée : {weekDisplayString}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {weeklyClientRecapData.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Aucune commande client avec des quantités pour cette semaine.</p>
          ) : (
            <div className="overflow-x-auto border rounded-md">
              <Table className="min-w-[1000px]">
                <TableHeader>
                  <TableRow className="bg-orange-200 dark:bg-orange-700/50 text-xs">
                    <TableHead className="text-black dark:text-white sticky left-0 z-10 bg-orange-200 dark:bg-orange-700/50 w-[150px] min-w-[150px]">Client</TableHead>
                    <TableHead className="text-black dark:text-white w-[100px] min-w-[100px]">Pain/Salade</TableHead>
                    {DAYS_OF_WEEK_KEYS.map(day => (
                        <TableHead key={day} className="text-center text-black dark:text-white min-w-[80px] capitalize">{DAY_LABELS[day]}</TableHead>
                    ))}
                    <TableHead className="text-black dark:text-white w-[200px] min-w-[200px]">Observation (Semaine)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                {weeklyClientRecapData.map((recap) => {
                    const clientHasBaguettes = DAYS_OF_WEEK_KEYS.some(day => recap.baguetteCounts[day].count > 0);
                    const clientHasFaluches = DAYS_OF_WEEK_KEYS.some(day => recap.falucheCounts[day].count > 0);
                    const clientHasSalades = DAYS_OF_WEEK_KEYS.some(day => recap.saladeCounts[day].count > 0);

                    if (!clientHasBaguettes && !clientHasFaluches && !clientHasSalades && !recap.observation) {
                      return null;
                    }
                    
                    const rowSpanForClientNameAndObservation = [clientHasBaguettes, clientHasFaluches, clientHasSalades].filter(Boolean).length || 1;
                    const rowsToRender: React.ReactNode[] = [];
                    let clientCellRendered = false;
                    let observationCellRendered = false;

                    const addRow = (type: string, counts: Record<DayOfWeekKey, { count: number, pn: number }>, key: string) => {
                        const cells: React.ReactNode[] = [];
                        if (!clientCellRendered) {
                            cells.push(
                                <TableCell key={`${recap.id}-client`} rowSpan={rowSpanForClientNameAndObservation} className="font-medium sticky left-0 z-10 bg-card group-hover:bg-muted/50 w-[150px] align-middle">
                                    {recap.clientName || <span className="italic text-muted-foreground">Client non nommé</span>}
                                </TableCell>
                            );
                            clientCellRendered = true;
                        }
                        cells.push(<TableCell key={`${recap.id}-type-${key}`} className="font-semibold">{type}</TableCell>);
                        DAYS_OF_WEEK_KEYS.forEach(day => {
                            cells.push(
                                <TableCell key={`${recap.id}-${key}-${day}`} className="text-center">
                                    {counts[day].count > 0 ? `${counts[day].count} (${counts[day].pn} PN)` : '-'}
                                </TableCell>
                            );
                        });
                        if (!observationCellRendered) {
                             cells.push(
                                <TableCell key={`${recap.id}-obs`} rowSpan={rowSpanForClientNameAndObservation} className="align-middle">
                                    {recap.observation || '-'}
                                </TableCell>
                            );
                            observationCellRendered = true;
                        }
                        rowsToRender.push(<TableRow key={`${recap.id}-${key}-row`}>{cells}</TableRow>);
                    };

                    if (clientHasBaguettes) addRow('Baguette', recap.baguetteCounts, 'baguette');
                    if (clientHasFaluches) addRow('Faluche', recap.falucheCounts, 'faluche');
                    if (clientHasSalades) addRow('Salade', recap.saladeCounts, 'salade');

                    if (!clientHasBaguettes && !clientHasFaluches && !clientHasSalades && recap.observation) {
                         rowsToRender.push(
                            <TableRow key={`${recap.id}-obs-only-row`}>
                                <TableCell key={`${recap.id}-client`} rowSpan={1} className="font-medium sticky left-0 z-10 bg-card group-hover:bg-muted/50 w-[150px] align-middle">
                                    {recap.clientName || <span className="italic text-muted-foreground">Client non nommé</span>}
                                </TableCell>
                                <TableCell key={`${recap.id}-type-none`}>-</TableCell>
                                {DAYS_OF_WEEK_KEYS.map(day => <TableCell key={`${recap.id}-none-${day}`} className="text-center">-</TableCell>)}
                                <TableCell key={`${recap.id}-obs`} rowSpan={1} className="align-middle">{recap.observation}</TableCell>
                            </TableRow>
                        );
                    }

                    return <React.Fragment key={recap.id}>{rowsToRender}</React.Fragment>;
                  })}
                </TableBody>
                 <TableFooter className="text-xs">
                    <TableRow className="bg-orange-100 dark:bg-orange-800/50">
                        <TableCell colSpan={2} className="text-right font-bold text-black dark:text-white sticky left-0 z-10 bg-orange-100 dark:bg-orange-800/50">Total Baguette</TableCell>
                        {DAYS_OF_WEEK_KEYS.map(day => (
                          <TableCell key={`footer-total-baguette-${day}`} className="text-center font-bold text-black dark:text-white">
                            {weeklyRecapFooterTotals.baguette[day] > 0 ? weeklyRecapFooterTotals.baguette[day] : '-'}
                          </TableCell>
                        ))}
                         <TableCell className="text-black dark:text-white"></TableCell>
                    </TableRow>
                    <TableRow className="bg-orange-100 dark:bg-orange-800/50">
                        <TableCell colSpan={2} className="text-right font-bold text-black dark:text-white sticky left-0 z-10 bg-orange-100 dark:bg-orange-800/50">Total Faluche</TableCell>
                        {DAYS_OF_WEEK_KEYS.map(day => (
                          <TableCell key={`footer-total-faluche-${day}`} className="text-center font-bold text-black dark:text-white">
                            {weeklyRecapFooterTotals.faluche[day] > 0 ? weeklyRecapFooterTotals.faluche[day] : '-'}
                          </TableCell>
                        ))}
                        <TableCell className="text-black dark:text-white"></TableCell>
                    </TableRow>
                    <TableRow className="bg-green-100 dark:bg-green-800/50">
                        <TableCell colSpan={2} className="text-right font-bold text-black dark:text-white sticky left-0 z-10 bg-green-100 dark:bg-green-800/50">Total Salade</TableCell>
                        {DAYS_OF_WEEK_KEYS.map(day => (
                          <TableCell key={`footer-total-salade-${day}`} className="text-center font-bold text-black dark:text-white">
                            {weeklyRecapFooterTotals.salade[day] > 0 ? weeklyRecapFooterTotals.salade[day] : '-'}
                          </TableCell>
                        ))}
                        <TableCell className="text-black dark:text-white"></TableCell>
                    </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-md mt-8">
        <CardHeader>
          <CardTitle>Récapitulatif Journalier des Pains & Salades Nécessaires</CardTitle>
          <CardDescription>
            Total des pains/salades nécessaires chaque jour pour la semaine sélectionnée.
            <br />
            <span className="text-xs italic">"Pain (Total)" = Pains de Base + Total Glacière (Mardi/Jeudi). "Baguette" et "Faluche" incluent les commandes clients et les totaux du 1er tableau.</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 max-w-xs">
            <Label htmlFor="base-bread-input">Nombre de Pains de Base pour la Semaine :</Label>
            <Input
              id="base-bread-input"
              type="number"
              min="0"
              value={baseBreadNumber}
              onChange={(e) => setBaseBreadNumber(e.target.value)}
              className="mt-1 h-8"
              placeholder="Ex: 10"
            />
          </div>
          <div className="overflow-x-auto border rounded-md">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px] min-w-[120px] bg-card"></TableHead>
                  {DAYS_OF_WEEK_KEYS.map(day => (
                    <TableHead key={day} className="text-center bg-orange-200 dark:bg-orange-700/50 text-black capitalize min-w-[80px]">
                      {DAY_LABELS[day]}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody className="text-sm">
                <TableRow>
                  <TableCell className="font-semibold bg-yellow-200 dark:bg-yellow-700/50 text-black">Pain (Total)</TableCell>
                  {DAYS_OF_WEEK_KEYS.map(day => {
                    let dailyPainTotal = (Number(baseBreadNumber) || 0);
                    if (day === 'mardi' || day === 'jeudi') {
                        dailyPainTotal += (dailyGlaciereTotals[day] || 0);
                    }
                    return (
                        <TableCell key={`total-pain-${day}`} className="text-center bg-yellow-100 dark:bg-yellow-800/40">
                            {dailyPainTotal > 0 ? dailyPainTotal : ( (Number(baseBreadNumber) || 0) > 0 && (day !== 'mardi' && day !== 'jeudi') ? dailyPainTotal : '-')}
                        </TableCell>
                    );
                  })}
                </TableRow>
                <TableRow>
                  <TableCell className="font-semibold bg-orange-300 dark:bg-orange-800/50 text-black">Baguette</TableCell>
                  {DAYS_OF_WEEK_KEYS.map(day => {
                    const totalBaguettesForDay = (weeklyRecapFooterTotals.baguette[day] || 0) + (day === 'lundi' ? Math.round(dailyGlobalTotals[day] / 2) : 0);
                    return (
                      <TableCell key={`total-baguette-${day}`} className="text-center bg-orange-100 dark:bg-orange-700/40">
                        {totalBaguettesForDay > 0 ? totalBaguettesForDay : '-'}
                      </TableCell>
                    );
                  })}
                </TableRow>
                <TableRow>
                  <TableCell className="font-semibold bg-orange-300 dark:bg-orange-800/50 text-black">Faluche</TableCell>
                  {DAYS_OF_WEEK_KEYS.map(day => {
                    const totalFaluchesForDay = (weeklyRecapFooterTotals.faluche[day] || 0) + ((day === 'mercredi' || day === 'vendredi') ? (dailyGlobalTotals[day] || 0) : 0);
                    return (
                      <TableCell key={`total-faluche-${day}`} className="text-center bg-orange-100 dark:bg-orange-700/40">
                        {totalFaluchesForDay > 0 ? totalFaluchesForDay : '-'}
                      </TableCell>
                    );
                  })}
                </TableRow>
                 <TableRow>
                  <TableCell className="font-semibold bg-green-200 dark:bg-green-800/50 text-black">Salade</TableCell>
                  {DAYS_OF_WEEK_KEYS.map(day => {
                    const totalSaladesForDay = weeklyRecapFooterTotals.salade[day] || 0;
                    return (
                      <TableCell key={`total-salade-${day}`} className="text-center bg-green-100 dark:bg-green-700/40">
                        {totalSaladesForDay > 0 ? totalSaladesForDay : '-'}
                      </TableCell>
                    );
                  })}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {!isLoading && initialDataLoaded && !activeMenuTemplateForRecap && (
        <div className="mt-8 text-center text-muted-foreground">
          <Info className="mx-auto h-8 w-8 mb-2"/>
          {overrideTemplateId && overrideTemplateId !== 'auto' 
            ? "Le modèle de menu forcé n'a pas pu être chargé."
            : `Aucun modèle de menu n'a été sélectionné pour le mois de ${format(selectedDate, 'MMMM', {locale:fr})} dans l'onglet "Menu".`}
          <br/>
          Veuillez en sélectionner un pour l'afficher ici, ou forcer un autre modèle ci-dessus.
        </div>
      )}
    </div>
  );
}
