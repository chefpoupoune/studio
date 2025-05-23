
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

const DISPLAY_ROWS_CONFIG_NB_PN_RECAP: DisplayRowConfig[] = [
  { id: 'gatien', label: 'Gatien', bgColor: 'bg-yellow-300', textColor: 'text-black', isInputRow: true, isTotalContributor: true },
  { id: 'cedric', label: 'Cedric', bgColor: 'bg-green-500', textColor: 'text-white', isInputRow: true, isTotalContributor: true },
  { id: 'dominique', label: 'Dominique', bgColor: 'bg-white', textColor: 'text-black', isInputRow: true, isTotalContributor: true },
  { id: 'maxime_l', label: 'Maxime L', bgColor: 'bg-red-500', textColor: 'text-white', isInputRow: true, isTotalContributor: true },
  { id: 'nicolas', label: 'Nicolas', bgColor: 'bg-black', textColor: 'text-white', isInputRow: true, isTotalContributor: true },
  { id: 'maxime_h', label: 'Maxime H', bgColor: 'bg-blue-500', textColor: 'text-white', isInputRow: true, isTotalContributor: true },
  { id: 'philipe', label: 'Philipe', bgColor: 'bg-orange-500', textColor: 'text-black', isInputRow: true, isTotalContributor: true },
  { id: 'plus', label: 'PLUS', bgColor: 'bg-pink-500', textColor: 'text-white', isInputRow: true, isTotalContributor: true },
  { id: 'autre', label: 'autre', bgColor: 'bg-purple-600', textColor: 'text-white', isInputRow: true, isTotalContributor: true },
  { id: 'total_global', label: 'TOTAL', bgColor: 'bg-orange-300', textColor: 'text-black', isInputRow: false },
  { id: 'nb_bagette', label: 'NB de bagette', bgColor: 'bg-gray-300', textColor: 'text-black', isInputRow: false },
  { id: 'nb_faluche', label: 'NB de Faluche', bgColor: 'bg-gray-300', textColor: 'text-black', isInputRow: false },
  { id: 'total_glaciere', label: 'total glacière', bgColor: 'bg-orange-500', textColor: 'text-black', isInputRow: false },
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
      if (storedPicnicDataRaw) {
        const parsedData = JSON.parse(storedPicnicDataRaw);
        setPicnicData(currentData => {
            const freshData = createInitialPicnicWeekDataForRecap();
            (Object.keys(freshData) as PicnicRowKey[]).forEach(key => {
                freshData[key] = { 
                    ...(initialRowDataForRecap()), 
                    ...(parsedData[key] || {}), 
                    weeklyObservation: parsedData[key]?.weeklyObservation || currentData[key]?.weeklyObservation || '' 
                };
            });
            return freshData;
        });
      } else {
        setPicnicData(currentData => {
            const freshDataForNewWeek = createInitialPicnicWeekDataForRecap();
            (Object.keys(freshDataForNewWeek) as PicnicRowKey[]).forEach(key => {
                if (currentData && currentData[key]?.weeklyObservation) {
                    freshDataForNewWeek[key].weeklyObservation = currentData[key].weeklyObservation;
                }
            });
            return freshDataForNewWeek;
        });
      }

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
      .filter(order => order.clientName.trim() !== '' || DAYS_OF_WEEK_KEYS.some(day => Number(order.days[day].nbPn) > 0))
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
          observation: order.observation 
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
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: pdfSettings.pageSize }) as jsPDFWithAutoTable;
        doc.setFont(pdfSettings.fontFamily);

        const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });
        let currentY = pdfSettings.marginTop;

        // Logo & Header Text
        if (pdfSettings.logoUrl && pdfSettings.logoUrl.startsWith('data:image')) {
            try {
                const imgProps = doc.getImageProperties(pdfSettings.logoUrl);
                const formatType = imgProps.fileType.toUpperCase();
                const desiredHeight = 30;
                const imgWidth = (imgProps.width * desiredHeight) / imgProps.height;
                doc.addImage(pdfSettings.logoUrl, formatType, pdfSettings.marginLeft, currentY, imgWidth, desiredHeight);
                currentY += desiredHeight + 5;
            } catch (e) { console.error("Error adding logo to PDF:", e); }
        }
        if (pdfSettings.headerText) {
            doc.setFontSize(pdfSettings.headerFontSize);
            const headerLines = pdfSettings.headerText.split('\n');
            headerLines.forEach(line => {
                doc.text(line, pdfSettings.marginLeft, currentY);
                currentY += (pdfSettings.headerFontSize * 0.7) + 2;
            });
            currentY += 5;
        }
        
        // Main Title
        doc.setFontSize(pdfSettings.headerFontSize + 4);
        doc.text(`Récapitulatif Pique Nique - ${weekDisplayString}`, doc.internal.pageSize.getWidth() / 2, currentY, { align: 'center' });
        currentY += (pdfSettings.headerFontSize + 4) * 0.7 + 5;
        doc.setFontSize(pdfSettings.defaultFontSize);
        doc.text(`Généré le: ${generationDateFormatted}`, pdfSettings.marginLeft, currentY);
        currentY += pdfSettings.defaultFontSize + 10;

        const tableHeadStyles: any = { fontSize: pdfSettings.tableHeaderFontSize, fontStyle: 'bold', halign: 'center' };
        if (pdfSettings.primaryColor) {
            const rgb = hexToRgb(pdfSettings.primaryColor);
            if (rgb) {
                tableHeadStyles.fillColor = rgb;
                const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
                tableHeadStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
            }
        }
        const tableBodyStyles = { fontSize: pdfSettings.tableBodyFontSize, cellPadding: 2 };

        // Table 1: Nombre de Pique-Niques (NB PN) pour la Semaine
        doc.setFontSize(pdfSettings.defaultFontSize + 2);
        doc.text("Nombre de Pique-Niques (NB PN) pour la Semaine", pdfSettings.marginLeft, currentY);
        currentY += (pdfSettings.defaultFontSize + 2) * 0.7 + 5;

        const nbPnTableHead = [['Catégorie', ...DAYS_OF_WEEK_KEYS.map(day => DAY_LABELS[day]), 'Observation (Semaine)']];
        const nbPnTableBody = DISPLAY_ROWS_CONFIG_NB_PN_RECAP.map(rowConfig => {
            const rowData = picnicData[rowConfig.id as PicnicRowKey];
            const dailyValues = DAYS_OF_WEEK_KEYS.map(day => {
                if (rowConfig.id === 'total_global') return dailyGlobalTotals[day]?.toString() || '0';
                if (rowConfig.id === 'nb_bagette') return day === 'lundi' ? (Math.round(dailyGlobalTotals[day] / 2) || 0).toString() : '0';
                if (rowConfig.id === 'nb_faluche') return (day === 'mercredi' || day === 'vendredi') ? (dailyGlobalTotals[day] || 0).toString() : '0';
                if (rowConfig.id === 'total_glaciere') return dailyGlaciereTotals[day]?.toString() || '0';
                return rowData?.[day]?.toString() || (rowConfig.isInputRow ? '0' : '-');
            });
            return [rowConfig.label, ...dailyValues, rowData?.weeklyObservation || '-'];
        });
        doc.autoTable({
            head: nbPnTableHead, body: nbPnTableBody, startY: currentY, theme: 'grid',
            headStyles: tableHeadStyles, styles: tableBodyStyles,
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 }, 6: { cellWidth: 'wrap', minCellWidth: 100 } },
            margin: { left: pdfSettings.marginLeft, right: pdfSettings.marginRight },
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;

        // Table 2: Récapitulatif Hebdomadaire des Commandes Clients
        if (currentY + 40 > doc.internal.pageSize.getHeight() - pdfSettings.marginBottom) { doc.addPage(); currentY = pdfSettings.marginTop; }
        doc.setFontSize(pdfSettings.defaultFontSize + 2);
        doc.text("Récapitulatif Hebdomadaire des Commandes Clients", pdfSettings.marginLeft, currentY);
        currentY += (pdfSettings.defaultFontSize + 2) * 0.7 + 5;

        const clientRecapHead = [['Client', 'Pain', ...DAYS_OF_WEEK_KEYS.map(day => DAY_LABELS[day])]];
        const clientRecapBody: any[][] = [];
        weeklyClientRecapData.forEach(recap => {
            const clientHasBaguettes = DAYS_OF_WEEK_KEYS.some(day => recap.baguetteCounts[day] > 0);
            const clientHasFaluches = DAYS_OF_WEEK_KEYS.some(day => recap.falucheCounts[day] > 0);
            if (!clientHasBaguettes && !clientHasFaluches) return;

            const rowSpan = (clientHasBaguettes && clientHasFaluches) ? 2 : 1;
            if (clientHasBaguettes) {
                clientRecapBody.push([
                    { content: recap.clientName || 'Client non nommé', rowSpan: rowSpan, styles: { valign: 'middle', fontStyle: 'bold' } },
                    'Baguette',
                    ...DAYS_OF_WEEK_KEYS.map(day => recap.baguetteCounts[day] > 0 ? recap.baguetteCounts[day].toString() : '-')
                ]);
            }
            if (clientHasFaluches) {
                const row = ['Faluche', ...DAYS_OF_WEEK_KEYS.map(day => recap.falucheCounts[day] > 0 ? recap.falucheCounts[day].toString() : '-')];
                if (!clientHasBaguettes) { // Only add client name if it wasn't added with baguettes
                    row.unshift({ content: recap.clientName || 'Client non nommé', rowSpan: 1, styles: { valign: 'middle', fontStyle: 'bold' } });
                }
                clientRecapBody.push(row);
            }
        });
         const clientRecapFoot: any[][] = [
            [{content: 'Total Baguette', colSpan: 2, styles: {fontStyle:'bold', halign:'right'}}, ...DAYS_OF_WEEK_KEYS.map(day => weeklyRecapFooterTotals.baguette[day] > 0 ? weeklyRecapFooterTotals.baguette[day].toString() : '-')],
            [{content: 'Total Faluche', colSpan: 2, styles: {fontStyle:'bold', halign:'right'}}, ...DAYS_OF_WEEK_KEYS.map(day => weeklyRecapFooterTotals.faluche[day] > 0 ? weeklyRecapFooterTotals.faluche[day].toString() : '-')]
        ];
        doc.autoTable({
            head: clientRecapHead, body: clientRecapBody, foot: clientRecapFoot, startY: currentY, theme: 'grid',
            headStyles: { ...tableHeadStyles, fillColor: hexToRgb('#FFA500') }, styles: tableBodyStyles, // Orange header for this table
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 100 } },
            margin: { left: pdfSettings.marginLeft, right: pdfSettings.marginRight },
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;

        // Table 3: Récapitulatif Journalier des Pains Nécessaires
        if (currentY + 40 > doc.internal.pageSize.getHeight() - pdfSettings.marginBottom) { doc.addPage(); currentY = pdfSettings.marginTop; }
        doc.setFontSize(pdfSettings.defaultFontSize + 2);
        doc.text("Récapitulatif Journalier des Pains Nécessaires (Commandes Clients)", pdfSettings.marginLeft, currentY);
        currentY += (pdfSettings.defaultFontSize + 2) * 0.7 + 5;
        const breadNeedsHead = [['Type de Pain', ...DAYS_OF_WEEK_KEYS.map(day => DAY_LABELS[day])]];
        const breadNeedsBody = [
            ['Pain (Total)', ...DAYS_OF_WEEK_KEYS.map(day => {
                let dailyPainTotal = (Number(baseBreadNumber) || 0);
                if (day === 'mardi' || day === 'jeudi') dailyPainTotal += (dailyGlaciereTotals[day] || 0);
                return dailyPainTotal > 0 ? dailyPainTotal.toString() : '-';
            })],
            ['Baguette', ...DAYS_OF_WEEK_KEYS.map(day => {
                const totalBaguettesForDay = (weeklyRecapFooterTotals.baguette[day] || 0) + (day === 'lundi' ? Math.round(dailyGlobalTotals[day] / 2) : 0);
                return totalBaguettesForDay > 0 ? totalBaguettesForDay.toString() : '-';
            })],
            ['Faluche', ...DAYS_OF_WEEK_KEYS.map(day => {
                const totalFaluchesForDay = (weeklyRecapFooterTotals.faluche[day] || 0) + ((day === 'mercredi' || day === 'vendredi') ? (dailyGlobalTotals[day] || 0) : 0);
                return totalFaluchesForDay > 0 ? totalFaluchesForDay.toString() : '-';
            })],
        ];
        doc.autoTable({
            head: breadNeedsHead, body: breadNeedsBody, startY: currentY, theme: 'grid',
            headStyles: { ...tableHeadStyles, fillColor: hexToRgb('#FFA500') }, styles: tableBodyStyles, // Orange header
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 100 } },
            didDrawCell: (data) => { // Custom cell styling for this table's body
                if (data.section === 'body') {
                    if (data.row.index === 0) data.cell.styles.fillColor = hexToRgb('#FFFFE0'); // Light yellow for "Pain (Total)"
                    if (data.row.index === 1 || data.row.index === 2) data.cell.styles.fillColor = hexToRgb('#FFDAB9'); // PeachPuff for "Baguette" & "Faluche"
                }
            },
            margin: { left: pdfSettings.marginLeft, right: pdfSettings.marginRight },
        });
        currentY = (doc as any).lastAutoTable.finalY + 15;

        // PDF Footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            if (pdfSettings.footerText) {
                let footerStr = pdfSettings.footerText
                .replace('{date}', generationDateFormatted)
                .replace('{pageNumber}', i.toString())
                .replace('{totalPages}', pageCount.toString());
                doc.setFontSize(pdfSettings.footerFontSize);
                doc.text(footerStr, pdfSettings.marginLeft, doc.internal.pageSize.height - (pdfSettings.marginBottom / 2));
            }
        }

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
            Visualisation des nombres de pique-niques et observations pour la semaine sélectionnée.
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
            Totaux par type de pain pour chaque client sur la semaine sélectionnée.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {weeklyClientRecapData.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Aucune commande client avec des quantités pour cette semaine.</p>
          ) : (
            <div className="overflow-x-auto border rounded-md">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow className="bg-orange-200 dark:bg-orange-700/50 text-xs">
                    <TableHead className="text-black dark:text-white sticky left-0 z-10 bg-orange-200 dark:bg-orange-700/50 w-[150px] min-w-[150px]">Client</TableHead>
                    <TableHead className="text-black dark:text-white w-[100px] min-w-[100px]">Pain</TableHead>
                    {DAYS_OF_WEEK_KEYS.map(day => (
                        <TableHead key={day} className="text-center text-black dark:text-white min-w-[80px] capitalize">{DAY_LABELS[day]}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {weeklyClientRecapData.map((recap) => {
                    const clientHasBaguettes = DAYS_OF_WEEK_KEYS.some(day => recap.baguetteCounts[day] > 0);
                    const clientHasFaluches = DAYS_OF_WEEK_KEYS.some(day => recap.falucheCounts[day] > 0);

                    if (!clientHasBaguettes && !clientHasFaluches) {
                      return null; 
                    }
                    
                    let clientCellRendered = false;
                    const rowSpanForClientName = (clientHasBaguettes && clientHasFaluches) ? 2 : 1;

                    return (
                      <React.Fragment key={recap.id}>
                        {clientHasBaguettes && (
                          <TableRow>
                            {!clientCellRendered && (
                              <TableCell rowSpan={rowSpanForClientName} className="font-medium sticky left-0 z-10 bg-card group-hover:bg-muted/50 w-[150px] align-middle">
                                {recap.clientName || <span className="italic text-muted-foreground">Client non nommé</span>}
                              </TableCell>
                            )}
                            {clientCellRendered = true}
                            <TableCell className="font-semibold">Baguette</TableCell>
                            {DAYS_OF_WEEK_KEYS.map(day => (
                              <TableCell key={`${recap.id}-baguette-${day}`} className="text-center">
                                {recap.baguetteCounts[day] > 0 ? recap.baguetteCounts[day] : '-'}
                              </TableCell>
                            ))}
                          </TableRow>
                        )}
                        {clientHasFaluches && (
                          <TableRow>
                            {!clientCellRendered && (
                              <TableCell rowSpan={1} className="font-medium sticky left-0 z-10 bg-card group-hover:bg-muted/50 w-[150px] align-middle">
                                {recap.clientName || <span className="italic text-muted-foreground">Client non nommé</span>}
                              </TableCell>
                            )}
                            <TableCell className="font-semibold">Faluche</TableCell>
                            {DAYS_OF_WEEK_KEYS.map(day => (
                              <TableCell key={`${recap.id}-faluche-${day}`} className="text-center">
                                {recap.falucheCounts[day] > 0 ? recap.falucheCounts[day] : '-'}
                              </TableCell>
                            ))}
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
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
                    </TableRow>
                    <TableRow className="bg-orange-100 dark:bg-orange-800/50">
                        <TableCell colSpan={2} className="text-right font-bold text-black dark:text-white sticky left-0 z-10 bg-orange-100 dark:bg-orange-800/50">Total Faluche</TableCell>
                        {DAYS_OF_WEEK_KEYS.map(day => (
                          <TableCell key={`footer-total-faluche-${day}`} className="text-center font-bold text-black dark:text-white">
                            {weeklyRecapFooterTotals.faluche[day] > 0 ? weeklyRecapFooterTotals.faluche[day] : '-'}
                          </TableCell>
                        ))}
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
                    // This line previously added baguette and faluche totals. Removing them based on user request.
                    // dailyPainTotal += (weeklyRecapFooterTotals.baguette[day] || 0) + (weeklyRecapFooterTotals.faluche[day] || 0);
                    return (
                        <TableCell key={`total-pain-${day}`} className="text-center bg-yellow-100 dark:bg-yellow-800/40">
                            {dailyPainTotal > 0 ? dailyPainTotal : '-'}
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
    
