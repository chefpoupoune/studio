
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import type { PicnicWeekData, DailyCounts, PicnicRowKey, DisplayRowConfig, ClientPicnicOrder, DailyClientPicnicData, DayOfWeekKey, BreadChoice } from '../types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfWeek, endOfWeek, addDays, subDays, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

// Constants (can be moved to types.ts or a shared util if used elsewhere similarly)
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

const initialRowData = (): DailyCounts => ({
  lundi: '', mardi: '', mercredi: '', jeudi: '', vendredi: ''
});

const createInitialPicnicWeekData = (): PicnicWeekData => ({
  gatien: initialRowData(),
  cedric: initialRowData(),
  dominique: initialRowData(),
  maxime_l: initialRowData(),
  nicolas: initialRowData(),
  maxime_h: initialRowData(),
  philipe: initialRowData(),
  plus: initialRowData(),
  autre: initialRowData(),
  nb_bagette: initialRowData(),
  nb_faluche: initialRowData(),
  total_glaciere: initialRowData(),
});

const createInitialDailyClientPicnicData = (): DailyClientPicnicData => ({
  nbPn: '',
  breadChoice: 'none',
});

const DISPLAY_ROWS_CONFIG: DisplayRowConfig[] = [
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


export default function PicnicRecap() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [picnicData, setPicnicData] = useState<PicnicWeekData>(createInitialPicnicWeekData());
  const [clientOrders, setClientOrders] = useState<ClientPicnicOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  useEffect(() => {
    setIsLoading(true);
    try {
      const storedPicnicData = localStorage.getItem(getPicnicDataStorageKey());
      if (storedPicnicData) {
        const parsedData = JSON.parse(storedPicnicData);
        const initialKeys = Object.keys(createInitialPicnicWeekData()) as PicnicRowKey[];
        const completeData: Partial<PicnicWeekData> = {};
        initialKeys.forEach(key => {
          completeData[key] = parsedData[key] || initialRowData();
        });
        setPicnicData(completeData as PicnicWeekData);
      } else {
        setPicnicData(createInitialPicnicWeekData());
      }

      const storedClientOrders = localStorage.getItem(getClientOrdersStorageKey());
      if (storedClientOrders) {
         const parsedClientOrders: ClientPicnicOrder[] = JSON.parse(storedClientOrders);
         setClientOrders(parsedClientOrders.map(order => ({
          ...order, // Spread existing order properties
          id: order.id || `client_order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, // Ensure ID
          days: { // Ensure all days are present with default structure
            lundi: { ...createInitialDailyClientPicnicData(), ...(order.days?.lundi || {}) },
            mardi: { ...createInitialDailyClientPicnicData(), ...(order.days?.mardi || {}) },
            mercredi: { ...createInitialDailyClientPicnicData(), ...(order.days?.mercredi || {}) },
            jeudi: { ...createInitialDailyClientPicnicData(), ...(order.days?.jeudi || {}) },
            vendredi: { ...createInitialDailyClientPicnicData(), ...(order.days?.vendredi || {}) },
          }
        })));
      } else {
        setClientOrders([]);
      }
    } catch (e) {
      console.error("Failed to load picnic recap data from localStorage for week " + weekIdentifier, e);
      toast({ title: "Erreur de chargement", description: "Données de récapitulatif pique-nique corrompues.", variant: "destructive" });
      setPicnicData(createInitialPicnicWeekData());
      setClientOrders([]);
    }
    setIsLoading(false);
  }, [getPicnicDataStorageKey, getClientOrdersStorageKey, toast, weekIdentifier]);

  const calculateDailyTotal = useCallback((day: DayOfWeekKey): number => {
    let sum = 0;
    for (const rowConfig of DISPLAY_ROWS_CONFIG) {
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
      const contributorRows: PicnicRowKey[] = DISPLAY_ROWS_CONFIG
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

  if (isLoading) {
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
        </div>
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Récapitulatif Hebdomadaire NB PN</CardTitle>
          <CardDescription>
            Visualisation des nombres de pique-niques prévus pour la semaine sélectionnée.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto border rounded-md">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px] min-w-[180px] sticky left-0 z-10 bg-card">Catégorie</TableHead>
                  {DAYS_OF_WEEK_KEYS.map(day => (
                    <TableHead key={day} className="text-center bg-orange-300 text-black capitalize min-w-[100px]">
                      {DAY_LABELS[day]}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {DISPLAY_ROWS_CONFIG.map(rowConfig => (
                  <TableRow key={rowConfig.id}>
                    <TableCell className={cn("font-medium sticky left-0 z-10", rowConfig.bgColor, rowConfig.textColor)}>
                      {rowConfig.label}
                    </TableCell>
                    {DAYS_OF_WEEK_KEYS.map(day => {
                      let cellContent: React.ReactNode;
                      if (rowConfig.id === 'total_global') {
                        cellContent = <span className={cn("font-semibold block py-1.5", rowConfig.textColor)}>{dailyGlobalTotals[day]}</span>;
                      } else if (rowConfig.id === 'nb_bagette') {
                        const value = Math.round(dailyGlobalTotals[day] / 2);
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
          {clientOrders.filter(order => order.clientName.trim() !== '' || DAYS_OF_WEEK_KEYS.some(day => Number(order.days[day].nbPn) > 0)).length === 0 ? (
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
    </div>
  );
}

    