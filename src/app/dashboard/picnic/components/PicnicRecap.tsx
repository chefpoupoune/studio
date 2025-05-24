
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Info, Save, FileText, Loader2 } from 'lucide-react';
import type { PicnicWeekData, DailyClientPicnicData, PicnicRowKey, DisplayRowConfig, ClientPicnicOrder, DayOfWeekKey, BreadChoice, PicnicRowData } from '../types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfWeek, endOfWeek, addDays, subDays, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';

const DAYS_OF_WEEK_KEYS: DayOfWeekKey[] = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
const DAY_LABELS: Record<DayOfWeekKey, string> = {
  lundi: 'Lundi',
  mardi: 'Mardi',
  mercredi: 'Mercredi',
  jeudi: 'Jeudi',
  vendredi: 'Vendredi',
};

const PICNIC_DATA_STORAGE_KEY_PREFIX = "picnic_nb_pn_data_v1_";
const PICNIC_CLIENT_ORDERS_KEY_PREFIX = "picnic_client_orders_data_v3_";
const PICNIC_BASE_BREAD_KEY_PREFIX = "picnic_base_bread_v1_"; 

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
  { id: 'philipe', label: 'Philipe', bgColor: 'bg-orange-500', textColor: 'text-black', isInputRow: true, isTotalContributor: true, pdfBgColor: [249, 115, 22]}, 
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
  const [isLoading, setIsLoading] = useState(true);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const { toast } = useToast();

  const weekIdentifier = useMemo(() => {
    const monday = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return format(monday, 'yyyy-MM-dd');
  }, [selectedDate]);

  const weekDisplayString = useMemo(() => {
    const monday = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const friday = addDays(monday, 4); 
    return `Semaine du : ${format(monday, 'dd MMMM', { locale: fr })} au ${format(friday, 'dd MMMM yyyy', { locale: fr })}`;
  }, [selectedDate]);

  const getPicnicDataStorageKey = useCallback(() => `${PICNIC_DATA_STORAGE_KEY_PREFIX}${weekIdentifier}`, [weekIdentifier]);
  const getClientOrdersStorageKey = useCallback(() => `${PICNIC_CLIENT_ORDERS_KEY_PREFIX}${weekIdentifier}`, [weekIdentifier]);
  const getBaseBreadStorageKey = useCallback(() => `${PICNIC_BASE_BREAD_KEY_PREFIX}${weekIdentifier}`, [weekIdentifier]);

  useEffect(() => {
    setIsLoading(true);
    setInitialDataLoaded(false); 
    try {
      const storedPicnicDataRaw = localStorage.getItem(getPicnicDataStorageKey());
      setPicnicData(currentData => {
        const freshData = createInitialPicnicWeekDataForRecap();
        const parsedStoredData = storedPicnicDataRaw ? JSON.parse(storedPicnicDataRaw) : {};
        (Object.keys(freshData) as PicnicRowKey[]).forEach(key => {
            freshData[key] = { 
                ...(initialRowDataForRecap()), 
                ...(parsedStoredData[key] || {}), 
                weeklyObservation: parsedStoredData[key]?.weeklyObservation || currentData[key]?.weeklyObservation || '' 
            };
        });
        return freshData;
      });

      const storedClientOrders = localStorage.getItem(getClientOrdersStorageKey());
      if (storedClientOrders) {
         const parsedClientOrders: ClientPicnicOrder[] = JSON.parse(storedClientOrders);
         setClientOrders(parsedClientOrders.map(order => ({
          ...order, 
          id: order.id || `client_order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, 
          days: { 
            lundi: { nbPn: order.days?.lundi?.nbPn || '', breadChoice: order.days?.lundi?.breadChoice || 'none' },
            mardi: { nbPn: order.days?.mardi?.nbPn || '', breadChoice: order.days?.mardi?.breadChoice || 'none' },
            mercredi: { nbPn: order.days?.mercredi?.nbPn || '', breadChoice: order.days?.mercredi?.breadChoice || 'none' },
            jeudi: { nbPn: order.days?.jeudi?.nbPn || '', breadChoice: order.days?.jeudi?.breadChoice || 'none' },
            vendredi: { nbPn: order.days?.vendredi?.nbPn || '', breadChoice: order.days?.vendredi?.breadChoice || 'none' },
          }
        })));
      } else {
        setClientOrders([]); 
      }

      const storedBaseBread = localStorage.getItem(getBaseBreadStorageKey());
      setBaseBreadNumber(storedBaseBread || '');

    } catch (e) {
      console.error("Failed to load picnic recap data from localStorage for week " + weekIdentifier, e);
      toast({ title: "Erreur de chargement", description: "Données de récapitulatif pique-nique corrompues.", variant: "destructive" });
      setPicnicData(createInitialPicnicWeekDataForRecap());
      setClientOrders([]);
      setBaseBreadNumber('');
    }
    setIsLoading(false);
    setInitialDataLoaded(true);
  }, [getPicnicDataStorageKey, getClientOrdersStorageKey, getBaseBreadStorageKey, toast, weekIdentifier]);

  useEffect(() => {
    if (!isLoading && initialDataLoaded) {
      localStorage.setItem(getBaseBreadStorageKey(), baseBreadNumber);
    }
  }, [baseBreadNumber, isLoading, initialDataLoaded, getBaseBreadStorageKey]);

  const handleRecapObservationChange = (rowId: PicnicRowKey, value: string) => {
    setPicnicData(prevData => ({
        ...prevData,
        [rowId]: {
            ...(prevData[rowId] || initialRowDataForRecap()), 
            weeklyObservation: value,
        }
    }));
  };

  const saveRecapObservations = useCallback(() => {
    try {
      localStorage.setItem(getPicnicDataStorageKey(), JSON.stringify(picnicData));
      toast({ title: "Observations du Récapitulatif Sauvegardées", description: "Les observations ont été enregistrées." });
    } catch (e) {
      console.error("Failed to save picnic recap observations to localStorage", e);
      toast({ title: "Erreur de sauvegarde des observations", variant: "destructive" });
    }
  }, [picnicData, toast, getPicnicDataStorageKey]);


  const calculateDailyTotal = useCallback((day: DayOfWeekKey): number => {
    let sum = 0;
    for (const rowConfig of DISPLAY_ROWS_CONFIG_NB_PN_RECAP) {
      if (rowConfig.isInputRow && rowConfig.isTotalContributor) {
          sum += Number(picnicData[rowConfig.id as PicnicRowKey]?.[day]) || 0;
      }
    }
    return sum;
  }, [picnicData]);

  const dailyGlobalTotals = useMemo(() => {
    return DAYS_OF_WEEK_KEYS.reduce((acc, day) => {
      acc[day] = calculateDailyTotal(day);
      return acc;
    }, {} as Record<DayOfWeekKey, number>);
  }, [calculateDailyTotal]);

  const dailyGlaciereTotals = useMemo(() => {
    return DAYS_OF_WEEK_KEYS.reduce((acc, day) => {
      let count = 0;
      const contributorRows: PicnicRowKey[] = DISPLAY_ROWS_CONFIG_NB_PN_RECAP
        .filter(config => config.isInputRow && config.isTotalContributor)
        .map(config => config.id as PicnicRowKey);

      for (const rowId of contributorRows) {
        const value = picnicData[rowId]?.[day];
        if (value !== '' && Number(value) > 0) {
          count++;
        }
      }
      acc[day] = count;
      return acc;
    }, {} as Record<DayOfWeekKey, number>);
  }, [picnicData]);

  const weeklyClientRecapData = useMemo(() => {
    return clientOrders
      .filter(order => order.clientName.trim() !== '' || DAYS_OF_WEEK_KEYS.some(day => Number(order.days[day].nbPn) > 0) || (order.observation && order.observation.trim() !== ''))
      .map(order => {
        const baguetteCounts: Record<DayOfWeekKey, number> = {} as any;
        const falucheCounts: Record<DayOfWeekKey, number> = {} as any;

        DAYS_OF_WEEK_KEYS.forEach(day => {
          const dayData = order.days[day];
          const nbPn = Number(dayData.nbPn) || 0;
          if (nbPn > 0) {
            if (dayData.breadChoice === 'baguette') {
              baguetteCounts[day] = Math.round(nbPn / 2);
              falucheCounts[day] = 0;
            } else if (dayData.breadChoice === 'faluche') {
              falucheCounts[day] = nbPn;
              baguetteCounts[day] = 0;
            } else {
              baguetteCounts[day] = 0;
              falucheCounts[day] = 0;
            }
          } else {
            baguetteCounts[day] = 0;
            falucheCounts[day] = 0;
          }
        });
        return {
          id: order.id,
          clientName: order.clientName,
          baguetteCounts: baguetteCounts,
          falucheCounts: falucheCounts,
          observation: order.observation || ''
        };
    });
  }, [clientOrders]);

  const weeklyRecapFooterTotals = useMemo(() => {
    const totals: { baguette: Record<DayOfWeekKey, number>, faluche: Record<DayOfWeekKey, number> } = {
      baguette: { lundi: 0, mardi: 0, mercredi: 0, jeudi: 0, vendredi: 0 },
      faluche: { lundi: 0, mardi: 0, mercredi: 0, jeudi: 0, vendredi: 0 },
    };
    weeklyClientRecapData.forEach(recap => {
      DAYS_OF_WEEK_KEYS.forEach(day => {
        totals.baguette[day] += recap.baguetteCounts[day] || 0;
        totals.faluche[day] += recap.falucheCounts[day] || 0;
      });
    });
    return totals;
  }, [weeklyClientRecapData]);

  const handlePreviousWeek = () => setSelectedDate(prevDate => subDays(prevDate, 7));
  const handleNextWeek = () => setSelectedDate(prevDate => addDays(prevDate, 7));
  
 const generateRecapPdf = () => {
    if (!initialDataLoaded) {
        toast({ title: "Données non chargées", description: "Veuillez attendre que les données soient chargées.", variant: "default" });
        return;
    }
    setIsGeneratingPdf(true);
    try {
        const pdfSettings = getPdfLayoutSettings('picnic_recap_weekly');
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a3' }) as jsPDFWithAutoTable;
        doc.setFont(pdfSettings.fontFamily || 'helvetica');

        const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });
        let currentY = pdfSettings.marginTop || 20;
        const pageHeight = doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageLeftMargin = pdfSettings.marginLeft || 20;
        const pageRightMargin = pdfSettings.marginRight || 20;
        
        const whiteTextForPdf: [number, number, number] = [255, 255, 255];
        const blackTextForPdf: [number, number, number] = [0, 0, 0];


        if (pdfSettings.logoUrl && pdfSettings.logoUrl.startsWith('data:image')) {
            try {
                const imgProps = doc.getImageProperties(pdfSettings.logoUrl);
                const formatType = imgProps.fileType.toUpperCase();
                const desiredHeight = 30;
                const imgWidth = (imgProps.width * desiredHeight) / imgProps.height;
                doc.addImage(pdfSettings.logoUrl, formatType, pageLeftMargin, currentY, imgWidth, desiredHeight);
                currentY += desiredHeight + 5;
            } catch (e) { console.error("Error adding logo to PDF:", e); }
        }
        if (pdfSettings.headerText) {
            doc.setFontSize(pdfSettings.headerFontSize || 10);
            const headerLines = pdfSettings.headerText.split('\n');
            headerLines.forEach(line => {
                doc.text(line, pageLeftMargin, currentY);
                currentY += (pdfSettings.headerFontSize || 10) * 0.7 + 2;
            });
            currentY += 5;
        }
        
        doc.setFontSize((pdfSettings.headerFontSize || 14) + 4);
        doc.text(`Récapitulatif Pique Nique - ${weekDisplayString}`, pageWidth / 2, currentY, { align: 'center' });
        currentY += ((pdfSettings.headerFontSize || 14) + 4) * 0.7 + 5;
        doc.setFontSize(pdfSettings.defaultFontSize || 10);
        doc.text(`Généré le: ${generationDateFormatted}`, pageLeftMargin, currentY);
        currentY += (pdfSettings.defaultFontSize || 10) + 10;

        const tableBaseStyles = { fontSize: pdfSettings.tableBodyFontSize || 7, cellPadding: 1.5, font: pdfSettings.fontFamily || 'helvetica', lineColor: [180,180,180], lineWidth: 0.5 };
        let tableHeadBaseStyles: any = { fontSize: (pdfSettings.tableHeaderFontSize || 8), fontStyle: 'bold', halign: 'center', valign: 'middle', cellPadding: 1.5, font: pdfSettings.fontFamily || 'helvetica' };
        
        if (pdfSettings.primaryColor) {
            const rgb = hexToRgb(pdfSettings.primaryColor);
            if (rgb) {
                tableHeadBaseStyles.fillColor = rgb;
                const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
                tableHeadBaseStyles.textColor = brightness > 125 ? blackTextForPdf : whiteTextForPdf;
            }
        } else {
            tableHeadBaseStyles.fillColor = [220,220,220];
            tableHeadBaseStyles.textColor = blackTextForPdf;
        }
        const orangeHeaderStyle = {...tableHeadBaseStyles, fillColor: hexToRgb("#FED7AA") || [254, 229, 205], textColor: blackTextForPdf};
        const yellowRowBgColorForPdf = hexToRgb("#FEF9C3") || [254, 249, 195];
        const lightOrangeRowBgColorForPdf = hexToRgb("#FFEDD5") || [255, 237, 213];
        const clientRecapFooterColor = hexToRgb("#FFEBCD") || [255,235,205];
        
        const pageFooterHandler = (data: any) => {
            const pageCount = doc.internal.getNumberOfPages();
            if (pdfSettings.footerText) {
                let footerStr = pdfSettings.footerText
                .replace('{date}', generationDateFormatted)
                .replace('{pageNumber}', data.pageNumber.toString())
                .replace('{totalPages}', pageCount.toString());
                doc.setFontSize(pdfSettings.footerFontSize || 8);
                doc.text(footerStr, pageLeftMargin, pageHeight - (pdfSettings.marginBottom || 20) / 2);
            }
        };
        
        const cellHookHandler = (data: any) => {
            if (data.section === 'head') {
                const isDayHeaderNbPn = (data.table.id === 'nbPnTable' && data.column.index > 0 && data.column.index <= DAYS_OF_WEEK_KEYS.length);
                const isDayHeaderClientRecap = (data.table.id === 'clientRecapTable' && data.column.index >=2 && data.column.index < 2 + DAYS_OF_WEEK_KEYS.length);
                const isDayHeaderBreadNeeds = (data.table.id === 'breadNeedsTable' && data.column.index > 0);

                if (isDayHeaderNbPn || isDayHeaderClientRecap || isDayHeaderBreadNeeds) {
                     data.cell.styles.fillColor = orangeHeaderStyle.fillColor;
                     data.cell.styles.textColor = orangeHeaderStyle.textColor;
                } else { 
                    data.cell.styles.fillColor = tableHeadBaseStyles.fillColor;
                    data.cell.styles.textColor = tableHeadBaseStyles.textColor;
                }
            }
        
            if (data.table.id === 'breadNeedsTable' && data.section === 'body') {
                const firstCellText = String(data.row.cells[0]?.content || '').toLowerCase();
                let rowBgColorToApply: [number,number,number] | undefined = undefined;
                if (firstCellText.includes('pain (total)')) { rowBgColorToApply = yellowRowBgColorForPdf; }
                else if (firstCellText.includes('baguette') || firstCellText.includes('faluche')) { rowBgColorToApply = lightOrangeRowBgColorForPdf; }
                
                if (rowBgColorToApply) {
                    Object.values(data.row.cells).forEach((cell: any) => {
                        cell.styles.fillColor = rowBgColorToApply;
                        cell.styles.textColor = blackTextForPdf;
                    });
                }
            }
        };

        // Table 1: Nombre de Pique-Niques (NB PN) pour la Semaine
        doc.setFontSize((pdfSettings.defaultFontSize || 10) + 1);
        doc.text("Nombre de Pique-Niques (NB PN) pour la Semaine", pageLeftMargin, currentY);
        currentY += ((pdfSettings.defaultFontSize || 10) + 1) * 0.7 + 4;

        const nbPnTableHead = [['Catégorie', ...DAYS_OF_WEEK_KEYS.map(day => DAY_LABELS[day]), 'Observation (Semaine)']];
        
        const nbPnTableBody = DISPLAY_ROWS_CONFIG_NB_PN_RECAP.map(rowConfig => {
            const rowData = picnicData[rowConfig.id as PicnicRowKey];
            const dailyValuesContent = DAYS_OF_WEEK_KEYS.map(day => {
                let displayValue: string;
                if (rowConfig.id === 'total_global') displayValue = dailyGlobalTotals[day]?.toString() || '0';
                else if (rowConfig.id === 'nb_bagette') displayValue = (day === 'lundi' ? Math.round(dailyGlobalTotals[day] / 2) : 0).toString();
                else if (rowConfig.id === 'nb_faluche') displayValue = ((day === 'mercredi' || day === 'vendredi') ? (dailyGlobalTotals[day] || 0) : 0).toString();
                else if (rowConfig.id === 'total_glaciere') displayValue = dailyGlaciereTotals[day]?.toString() || '0';
                else displayValue = String(rowData?.[day] ?? (rowConfig.isInputRow ? '0' : '-'));
                
                let cellStyles: any = { halign: 'center' };
                if (rowConfig.pdfBgColor) {
                    cellStyles.fillColor = rowConfig.pdfBgColor;
                    let textColor = blackTextForPdf;
                    if (rowConfig.textColor === 'text-white') textColor = whiteTextForPdf;
                    else {
                        const brightness = (rowConfig.pdfBgColor[0] * 299 + rowConfig.pdfBgColor[1] * 587 + rowConfig.pdfBgColor[2] * 114) / 1000;
                        textColor = brightness > 130 ? blackTextForPdf : whiteTextForPdf;
                    }
                    cellStyles.textColor = textColor;
                }
                return { content: displayValue, styles: cellStyles };
            });

            let categoryCellStyles: any = { fontStyle: 'bold', halign: 'left' };
            if (rowConfig.pdfBgColor) {
                categoryCellStyles.fillColor = rowConfig.pdfBgColor;
                let textColor = blackTextForPdf;
                if (rowConfig.textColor === 'text-white') textColor = whiteTextForPdf;
                else {
                    const brightness = (rowConfig.pdfBgColor[0] * 299 + rowConfig.pdfBgColor[1] * 587 + rowConfig.pdfBgColor[2] * 114) / 1000;
                    textColor = brightness > 130 ? blackTextForPdf : whiteTextForPdf;
                }
                categoryCellStyles.textColor = textColor;
            }

            let observationCellStyles: any = { halign: 'left' };
            if (rowConfig.pdfBgColor) {
                observationCellStyles.fillColor = rowConfig.pdfBgColor;
                 let textColor = blackTextForPdf;
                if (rowConfig.textColor === 'text-white') textColor = whiteTextForPdf;
                else {
                    const brightness = (rowConfig.pdfBgColor[0] * 299 + rowConfig.pdfBgColor[1] * 587 + rowConfig.pdfBgColor[2] * 114) / 1000;
                    textColor = brightness > 130 ? blackTextForPdf : whiteTextForPdf;
                }
                observationCellStyles.textColor = textColor;
            }
            
            return [
                { content: rowConfig.label, styles: categoryCellStyles },
                ...dailyValuesContent,
                { content: picnicData[rowConfig.id as PicnicRowKey]?.weeklyObservation || '-', styles: observationCellStyles }
            ];
        });
        
        const nbPnColumnStyles: any = { 0: { cellWidth: 120 } }; 
        DAYS_OF_WEEK_KEYS.forEach((_, index) => { nbPnColumnStyles[index + 1] = { cellWidth: 50, halign: 'center' }; }); 
        nbPnColumnStyles[DAYS_OF_WEEK_KEYS.length + 1] = { cellWidth: 'auto', halign: 'left' };

        doc.autoTable({
            head: nbPnTableHead, body: nbPnTableBody, startY: currentY, theme: 'grid',
            styles: tableBaseStyles, columnStyles: nbPnColumnStyles,
            margin: { left: pageLeftMargin, right: pageRightMargin },
            tableId: 'nbPnTable',
            willDrawCell: cellHookHandler, 
            didDrawPage: pageFooterHandler,
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;

        // Table 2: Récapitulatif Hebdomadaire des Commandes Clients
        if (currentY + 80 > pageHeight - (pdfSettings.marginBottom || 20)) { doc.addPage(); currentY = pdfSettings.marginTop || 20; }
        doc.setFontSize((pdfSettings.defaultFontSize || 10) + 1);
        doc.text("Récapitulatif Hebdomadaire des Commandes Clients", pageLeftMargin, currentY);
        currentY += ((pdfSettings.defaultFontSize || 10) + 1) * 0.7 + 4;

        const clientRecapHead = [['Client', 'Pain', ...DAYS_OF_WEEK_KEYS.map(day => DAY_LABELS[day]), 'Observation (Semaine)']];
        const clientRecapBody: any[][] = [];
        weeklyClientRecapData.forEach(recap => {
            const clientHasBaguettes = DAYS_OF_WEEK_KEYS.some(day => recap.baguetteCounts[day] > 0);
            const clientHasFaluches = DAYS_OF_WEEK_KEYS.some(day => recap.falucheCounts[day] > 0);
            if (!clientHasBaguettes && !clientHasFaluches && !recap.observation) return;

            const rowSpan = ((clientHasBaguettes ? 1 : 0) + (clientHasFaluches ? 1 : 0)) || 1;
            
            if (clientHasBaguettes) {
                clientRecapBody.push([
                    { content: recap.clientName || 'Client non nommé', rowSpan: rowSpan, styles: { valign: 'middle', fontStyle: 'bold' } },
                    'Baguette',
                    ...DAYS_OF_WEEK_KEYS.map(day => recap.baguetteCounts[day] > 0 ? recap.baguetteCounts[day].toString() : '-'),
                    { content: recap.observation || '-', rowSpan: rowSpan, styles: { valign: 'middle' } }
                ]);
            }
            if (clientHasFaluches) {
                const falucheRow: any[] = [];
                if (!clientHasBaguettes) { 
                    falucheRow.push({ content: recap.clientName || 'Client non nommé', rowSpan: rowSpan, styles: { valign: 'middle', fontStyle: 'bold' } });
                }
                falucheRow.push('Faluche');
                falucheRow.push(...DAYS_OF_WEEK_KEYS.map(day => recap.falucheCounts[day] > 0 ? recap.falucheCounts[day].toString() : '-'));
                 if (!clientHasBaguettes && !recap.observation) { 
                    // If only faluches and no observation for this client, add an empty cell for observation
                    // but this case is complex to handle correctly with rowspan when observation is only for the client (not per bread type)
                 } else if (!clientHasBaguettes) {
                    falucheRow.push({ content: recap.observation || '-', rowSpan: rowSpan, styles: { valign: 'middle' } });
                 }
                clientRecapBody.push(falucheRow);
            }
             if (!clientHasBaguettes && !clientHasFaluches && recap.observation) { 
                 clientRecapBody.push([
                    { content: recap.clientName || 'Client non nommé', rowSpan: 1, styles: { valign: 'middle', fontStyle: 'bold' } },
                    '-', 
                    ...DAYS_OF_WEEK_KEYS.map(() => '-'), 
                    { content: recap.observation, rowSpan: 1, styles: { valign: 'middle' } }
                ]);
            }
        });
        const clientRecapFoot: any[][] = [
            [{content: 'Total Baguette', colSpan: 2, styles:{fontStyle:'bold', halign:'right'}}, ...DAYS_OF_WEEK_KEYS.map(day => weeklyRecapFooterTotals.baguette[day] > 0 ? weeklyRecapFooterTotals.baguette[day].toString() : '-'), ''],
            [{content: 'Total Faluche', colSpan: 2, styles:{fontStyle:'bold', halign:'right'}}, ...DAYS_OF_WEEK_KEYS.map(day => weeklyRecapFooterTotals.faluche[day] > 0 ? weeklyRecapFooterTotals.faluche[day].toString() : '-'), '']
        ];
        
        const clientRecapColumnStyles : any = { 0: { cellWidth: 100 }, 1: {cellWidth: 50} };
        DAYS_OF_WEEK_KEYS.forEach((_, index) => { clientRecapColumnStyles[index + 2] = { cellWidth: 50, halign: 'center' }; }); 
        clientRecapColumnStyles[DAYS_OF_WEEK_KEYS.length + 2] = { cellWidth: 'auto', halign: 'left' };

        doc.autoTable({
            head: clientRecapHead, body: clientRecapBody, foot: clientRecapFoot, startY: currentY, theme: 'grid',
            styles: tableBaseStyles, columnStyles: clientRecapColumnStyles,
            margin: { left: pageLeftMargin, right: pageRightMargin },
            footStyles: {fillColor: clientRecapFooterColor, textColor: blackTextForPdf, fontStyle:'bold'},
            tableId: 'clientRecapTable',
            willDrawCell: cellHookHandler, 
            didDrawPage: pageFooterHandler,
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;

        // Table 3: Récapitulatif Journalier des Pains Nécessaires
        if (currentY + 70 > pageHeight - (pdfSettings.marginBottom || 20)) { doc.addPage(); currentY = pdfSettings.marginTop || 20; } 
        doc.setFontSize((pdfSettings.defaultFontSize || 10) + 1);
        doc.text("Récapitulatif Journalier des Pains Nécessaires", pageLeftMargin, currentY);
        currentY += ((pdfSettings.defaultFontSize || 10) + 1) * 0.7 + 4;
        
        const baseBreadNumValue = Number(baseBreadNumber) || 0;
        const breadNeedsHead = [['Type de Pain', ...DAYS_OF_WEEK_KEYS.map(day => DAY_LABELS[day])]];
        const breadNeedsBodyPDF = [
            [
                'Pain (Total)',
                ...DAYS_OF_WEEK_KEYS.map(day => {
                    let dailyPainTotal = baseBreadNumValue;
                    if (day === 'mardi' || day === 'jeudi') dailyPainTotal += (dailyGlaciereTotals[day] || 0);
                    return (dailyPainTotal > 0 || (baseBreadNumValue > 0 && (day !== 'mardi' && day !== 'jeudi')) ? dailyPainTotal.toString() : '-');
                })
            ],
            [
                'Baguette',
                ...DAYS_OF_WEEK_KEYS.map(day => {
                    const totalBaguettesForDay = (weeklyRecapFooterTotals.baguette[day] || 0) + (day === 'lundi' ? Math.round(dailyGlobalTotals[day] / 2) : 0);
                    return (totalBaguettesForDay > 0 ? totalBaguettesForDay.toString() : '-');
                })
            ],
            [
                'Faluche',
                ...DAYS_OF_WEEK_KEYS.map(day => {
                    const totalFaluchesForDay = (weeklyRecapFooterTotals.faluche[day] || 0) + ((day === 'mercredi' || day === 'vendredi') ? (dailyGlobalTotals[day] || 0) : 0);
                    return (totalFaluchesForDay > 0 ? totalFaluchesForDay.toString() : '-');
                })
            ],
        ];

        const breadNeedsColumnStyles : any = { 0: { fontStyle: 'bold', cellWidth: 120, halign: 'left' } }; 
         DAYS_OF_WEEK_KEYS.forEach((_, index) => { breadNeedsColumnStyles[index + 1] = { cellWidth: 50, halign: 'center' }; }); 

        doc.autoTable({
            head: breadNeedsHead, body: breadNeedsBodyPDF, startY: currentY, theme: 'grid',
            styles: tableBaseStyles, columnStyles: breadNeedsColumnStyles,
            margin: { left: pageLeftMargin, right: pageRightMargin },
            tableId: 'breadNeedsTable',
            willDrawCell: cellHookHandler,
            didDrawPage: pageFooterHandler,
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
    return <div className="flex justify-center items-center p-10"><Info className="mr-2 h-5 w-5"/>Chargement du récapitulatif...</div>;
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
                  <TableHead className="text-center min-w-[200px]">Observation (Semaine)</TableHead>
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
                    <TableHead className="text-black dark:text-white w-[100px] min-w-[100px]">Pain</TableHead>
                    {DAYS_OF_WEEK_KEYS.map(day => (
                        <TableHead key={day} className="text-center text-black dark:text-white min-w-[80px] capitalize">{DAY_LABELS[day]}</TableHead>
                    ))}
                    <TableHead className="text-black dark:text-white w-[200px] min-w-[200px]">Observation (Semaine)</TableHead> 
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                {weeklyClientRecapData.map((recap) => {
                    const clientHasBaguettes = DAYS_OF_WEEK_KEYS.some(day => recap.baguetteCounts[day] > 0);
                    const clientHasFaluches = DAYS_OF_WEEK_KEYS.some(day => recap.falucheCounts[day] > 0);

                    if (!clientHasBaguettes && !clientHasFaluches && !recap.observation) {
                      return null; 
                    }
                    
                    let clientCellRendered = false;
                    let observationCellRendered = false;
                    const rowSpanForClientNameAndObservation = ((clientHasBaguettes ? 1 : 0) + (clientHasFaluches ? 1 : 0)) || 1;
                    
                    const rowsToRender = [];

                    if (clientHasBaguettes) {
                        const cells = [];
                        if (!clientCellRendered) {
                            cells.push(
                                <TableCell key={`${recap.id}-client`} rowSpan={rowSpanForClientNameAndObservation} className="font-medium sticky left-0 z-10 bg-card group-hover:bg-muted/50 w-[150px] align-middle">
                                    {recap.clientName || <span className="italic text-muted-foreground">Client non nommé</span>}
                                </TableCell>
                            );
                            clientCellRendered = true;
                        }
                        cells.push(<TableCell key={`${recap.id}-breadtype-bag`} className="font-semibold">Baguette</TableCell>);
                        DAYS_OF_WEEK_KEYS.forEach(day => {
                            cells.push(
                                <TableCell key={`${recap.id}-baguette-${day}`} className="text-center">
                                    {recap.baguetteCounts[day] > 0 ? recap.baguetteCounts[day] : '-'}
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
                        rowsToRender.push(<TableRow key={`${recap.id}-baguette-row`}>{cells}</TableRow>);
                    }

                    if (clientHasFaluches) {
                        const cells = [];
                         if (!clientCellRendered) {
                            cells.push(
                                <TableCell key={`${recap.id}-client`} rowSpan={rowSpanForClientNameAndObservation} className="font-medium sticky left-0 z-10 bg-card group-hover:bg-muted/50 w-[150px] align-middle">
                                    {recap.clientName || <span className="italic text-muted-foreground">Client non nommé</span>}
                                </TableCell>
                            );
                            clientCellRendered = true;
                        }
                        cells.push(<TableCell key={`${recap.id}-breadtype-fal`} className="font-semibold">Faluche</TableCell>);
                        DAYS_OF_WEEK_KEYS.forEach(day => {
                            cells.push(
                                <TableCell key={`${recap.id}-faluche-${day}`} className="text-center">
                                    {recap.falucheCounts[day] > 0 ? recap.falucheCounts[day] : '-'}
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
                        rowsToRender.push(<TableRow key={`${recap.id}-faluche-row`}>{cells}</TableRow>);
                    }
                    
                    if (!clientHasBaguettes && !clientHasFaluches && recap.observation) { 
                        const cells = [];
                        if (!clientCellRendered) {
                             cells.push(
                                <TableCell key={`${recap.id}-client`} rowSpan={1} className="font-medium sticky left-0 z-10 bg-card group-hover:bg-muted/50 w-[150px] align-middle">
                                    {recap.clientName || <span className="italic text-muted-foreground">Client non nommé</span>}
                                </TableCell>
                            );
                        }
                         cells.push(<TableCell key={`${recap.id}-breadtype-none`} className="font-semibold">-</TableCell>);
                         DAYS_OF_WEEK_KEYS.forEach(day => {
                            cells.push(<TableCell key={`${recap.id}-none-${day}`} className="text-center">-</TableCell>);
                         });
                         if (!observationCellRendered) {
                             cells.push(
                                <TableCell key={`${recap.id}-obs`} rowSpan={1} className="align-middle">
                                    {recap.observation || '-'}
                                </TableCell>
                            );
                         }
                        rowsToRender.push(<TableRow key={`${recap.id}-obs-only-row`}>{cells}</TableRow>);
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
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-md mt-8">
        <CardHeader>
          <CardTitle>Récapitulatif Journalier des Pains Nécessaires (Commandes Clients)</CardTitle>
          <CardDescription>
            Total des pains (tous types), baguettes et faluches nécessaires chaque jour pour les commandes clients de la semaine sélectionnée.
            <br />
            <span className="text-xs italic">Le nombre de pains de base s'ajoute au total "pain".</span>
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
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
    
