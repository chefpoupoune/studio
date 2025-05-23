
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Save, Trash2, PlusCircle, Calendar as CalendarIcon } from 'lucide-react';
import type { PicnicWeekData, DailyCounts, PicnicRowKey, DisplayRowConfig, ClientPicnicOrder, BreadChoice, DailyClientPicnicData, DayOfWeekKey } from '../types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfWeek, endOfWeek, addDays, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

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

const createInitialClientOrder = (): ClientPicnicOrder => ({
  id: `client_order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
  clientName: '',
  observation: '',
  days: {
    lundi: createInitialDailyClientPicnicData(),
    mardi: createInitialDailyClientPicnicData(),
    mercredi: createInitialDailyClientPicnicData(),
    jeudi: createInitialDailyClientPicnicData(),
    vendredi: createInitialDailyClientPicnicData(),
  },
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

export default function NumberOfPicnics() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [picnicData, setPicnicData] = useState<PicnicWeekData>(createInitialPicnicWeekData());
  const [clientOrders, setClientOrders] = useState<ClientPicnicOrder[]>([]);
  const { toast } = useToast();

  const weekIdentifier = useMemo(() => {
    const monday = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return format(monday, 'yyyy-MM-dd');
  }, [selectedDate]);

  const weekDisplayString = useMemo(() => {
    const monday = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const sunday = endOfWeek(selectedDate, { weekStartsOn: 1 });
    return `Semaine du : ${format(monday, 'dd MMMM', { locale: fr })} au ${format(sunday, 'dd MMMM yyyy', { locale: fr })}`;
  }, [selectedDate]);

  const getPicnicDataStorageKey = useCallback(() => `${PICNIC_DATA_STORAGE_KEY_PREFIX}${weekIdentifier}`, [weekIdentifier]);
  const getClientOrdersStorageKey = useCallback(() => `${PICNIC_CLIENT_ORDERS_KEY_PREFIX}${weekIdentifier}`, [weekIdentifier]);

  useEffect(() => {
    try {
      const storedData = localStorage.getItem(getPicnicDataStorageKey());
      if (storedData) {
        const parsedData = JSON.parse(storedData);
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
          ...createInitialClientOrder(), 
          ...order,
          id: order.id || `client_order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          days: { 
            lundi: { ...createInitialDailyClientPicnicData(), ...(order.days?.lundi || {}) },
            mardi: { ...createInitialDailyClientPicnicData(), ...(order.days?.mardi || {}) },
            mercredi: { ...createInitialDailyClientPicnicData(), ...(order.days?.mercredi || {}) },
            jeudi: { ...createInitialDailyClientPicnicData(), ...(order.days?.jeudi || {}) },
            vendredi: { ...createInitialDailyClientPicnicData(), ...(order.days?.vendredi || {}) },
          }
        })));
      } else {
        setClientOrders(Array.from({ length: 3 }, createInitialClientOrder)); 
      }
    } catch (e) {
      console.error("Failed to load picnic data from localStorage for week " + weekIdentifier, e);
      toast({ title: "Erreur de chargement", description: "Données de pique-nique corrompues pour la semaine sélectionnée.", variant: "destructive" });
      setPicnicData(createInitialPicnicWeekData());
      setClientOrders(Array.from({ length: 3 }, createInitialClientOrder));
    }
  }, [getPicnicDataStorageKey, getClientOrdersStorageKey, toast, weekIdentifier]);

  const saveData = useCallback(() => {
    try {
      localStorage.setItem(getPicnicDataStorageKey(), JSON.stringify(picnicData));
      toast({ title: "Données Hebdomadaires Sauvegardées", description: "Les nombres de pique-niques de la semaine ont été enregistrés." });
    } catch (e) {
      console.error("Failed to save picnic data to localStorage", e);
      toast({ title: "Erreur de sauvegarde (semaine)", variant: "destructive" });
    }
  }, [picnicData, toast, getPicnicDataStorageKey]);

  const saveClientOrders = useCallback(() => {
    try {
      localStorage.setItem(getClientOrdersStorageKey(), JSON.stringify(clientOrders));
      toast({ title: "Commandes Clients Sauvegardées", description: "Les commandes clients pour pique-niques ont été enregistrées." });
    } catch (e) {
      console.error("Failed to save client orders to localStorage", e);
      toast({ title: "Erreur de sauvegarde (commandes clients)", variant: "destructive" });
    }
  }, [clientOrders, toast, getClientOrdersStorageKey]);

  const handleConfirmClearData = () => {
    setPicnicData(createInitialPicnicWeekData());
    toast({ title: "Données hebdomadaires effacées", variant: "destructive"});
  };

  const handleConfirmClearClientOrders = () => {
    setClientOrders(Array.from({ length: 3 }, createInitialClientOrder));
    toast({ title: "Données commandes clients effacées", variant: "destructive"});
  };

  const handleInputChange = (rowId: PicnicRowKey, day: DayOfWeekKey, value: string) => {
    const numericValue = value === '' ? '' : parseInt(value, 10);
    if (value === '' || (!isNaN(numericValue) && numericValue >= 0)) {
      setPicnicData(prevData => ({
        ...prevData,
        [rowId]: {
          ...prevData[rowId],
          [day]: value === '' ? '' : numericValue,
        }
      }));
    }
  };

  const handleClientOrderClientNameChange = (index: number, value: string) => {
    setClientOrders(prevOrders => {
      const newOrders = [...prevOrders];
      newOrders[index] = { ...newOrders[index], clientName: value };
      return newOrders;
    });
  };
  
  const handleClientOrderObservationChange = (index: number, value: string) => {
    setClientOrders(prevOrders => {
      const newOrders = [...prevOrders];
      newOrders[index] = { ...newOrders[index], observation: value };
      return newOrders;
    });
  };

  const handleClientOrderDailyInputChange = (index: number, day: DayOfWeekKey, field: 'nbPn', value: string) => {
    setClientOrders(prevOrders => {
      const newOrders = [...prevOrders];
      const currentDayData = newOrders[index].days[day];
      const updatedDayData = { ...currentDayData, [field]: value };

      if (field === 'nbPn') {
        const nbPnValue = Number(value);
        if (isNaN(nbPnValue) || nbPnValue <= 0) {
          updatedDayData.breadChoice = 'none';
        }
      }
      newOrders[index] = {
        ...newOrders[index],
        days: { ...newOrders[index].days, [day]: updatedDayData }
      };
      return newOrders;
    });
  };

  const handleClientOrderDailyBreadChange = (index: number, day: DayOfWeekKey, choice: BreadChoice) => {
    setClientOrders(prevOrders => {
      const newOrders = [...prevOrders];
      const currentDayData = newOrders[index].days[day];
      const updatedDayData = { ...currentDayData, breadChoice: choice };
      newOrders[index] = {
        ...newOrders[index],
        days: { ...newOrders[index].days, [day]: updatedDayData }
      };
      return newOrders;
    });
  };

  const handleAddClientOrderRow = () => {
    setClientOrders(prevOrders => [...prevOrders, createInitialClientOrder()]);
  };

  const handleDeleteClientOrderRow = (idToDelete: string) => {
    setClientOrders(prevOrders => prevOrders.filter(order => order.id !== idToDelete));
  };

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

  const clientDailyBreadTotals = useMemo(() => {
    const totals: Record<DayOfWeekKey, { baguettes: number; faluches: number }> = {
      lundi: { baguettes: 0, faluches: 0 },
      mardi: { baguettes: 0, faluches: 0 },
      mercredi: { baguettes: 0, faluches: 0 },
      jeudi: { baguettes: 0, faluches: 0 },
      vendredi: { baguettes: 0, faluches: 0 },
    };

    clientOrders.forEach(order => {
      DAYS_OF_WEEK_KEYS.forEach(day => {
        const dayData = order.days[day];
        const nbPn = Number(dayData.nbPn);
        if (!isNaN(nbPn) && nbPn > 0) {
          if (dayData.breadChoice === 'baguette') {
            totals[day].baguettes += nbPn;
          } else if (dayData.breadChoice === 'faluche') {
            totals[day].faluches += nbPn;
          }
        }
      });
    });
    return totals;
  }, [clientOrders]);


  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
        <h2 className="text-xl font-semibold">{weekDisplayString}</h2>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full sm:w-auto">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(selectedDate, "dd/MM/yyyy", { locale: fr })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              initialFocus
              locale={fr}
            />
          </PopoverContent>
        </Popover>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Nombre de Pique-Niques (NB PN) pour la Semaine</CardTitle>
          <CardDescription>
            Saisissez le nombre de pique-niques prévus pour chaque catégorie et chaque jour. Les totaux sont calculés automatiquement.
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
                      if (rowConfig.isInputRow) {
                        cellContent = (
                          <Input
                            type="number"
                            min="0"
                            value={picnicData[rowConfig.id as PicnicRowKey]?.[day] ?? ''}
                            onChange={(e) => handleInputChange(rowConfig.id as PicnicRowKey, day, e.target.value)}
                            className={cn(
                              "h-8 text-center tabular-nums bg-transparent border-transparent focus:border-current focus:ring-1",
                              rowConfig.textColor === 'text-white' ? "text-white placeholder:text-gray-300 focus:ring-white/50" : "text-black placeholder:text-gray-500 focus:ring-black/50"
                            )}
                            placeholder="0"
                          />
                        );
                      } else if (rowConfig.id === 'total_global') {
                        cellContent = <span className={cn("font-semibold block py-1.5", rowConfig.textColor)}>{dailyGlobalTotals[day]}</span>;
                      } else if (rowConfig.id === 'nb_bagette') {
                        const value = Math.round(dailyGlobalTotals[day] / 2);
                        cellContent = <span className={cn("font-semibold block py-1.5", rowConfig.textColor)}>{value}</span>;
                      } else if (rowConfig.id === 'nb_faluche') {
                        const value = (day === 'mercredi' || day === 'vendredi') ? dailyGlobalTotals[day] : '0';
                        cellContent = <span className={cn("font-semibold block py-1.5", rowConfig.textColor)}>{value}</span>;
                      } else if (rowConfig.id === 'total_glaciere') {
                        cellContent = <span className={cn("font-semibold block py-1.5", rowConfig.textColor)}>{dailyGlaciereTotals[day]}</span>;
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
          <div className="mt-6 flex justify-end space-x-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                   <Button variant="outline">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Effacer Données Semaine
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                    <AlertDialogDescription>
                      Êtes-vous sûr de vouloir effacer toutes les données de cette semaine pour les pique-niques ? Cette action est irréversible.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmClearData}>
                      Effacer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button onClick={saveData}>
                  <Save className="mr-2 h-4 w-4" />
                  Sauvegarder Données Semaine
              </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Commandes Clients Pique-Niques pour la Semaine</CardTitle>
          <CardDescription>
            Saisissez les commandes spécifiques des clients, le nombre de pique-niques par jour et choisissez le type de pain.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto border rounded-md">
            <Table className="min-w-[1200px]">
              <TableHeader>
                <TableRow className="bg-amber-200">
                  <TableHead className="w-[150px] min-w-[150px] text-black sticky left-0 z-10 bg-amber-200">Client</TableHead>
                  {DAYS_OF_WEEK_KEYS.map(day => (
                    <React.Fragment key={`header-${day}`}>
                      <TableHead className="w-[80px] min-w-[80px] text-center text-black capitalize">{DAY_LABELS[day]} NB PN</TableHead>
                      <TableHead className="w-[120px] min-w-[120px] text-center text-black capitalize">{DAY_LABELS[day]} Pain</TableHead>
                    </React.Fragment>
                  ))}
                  <TableHead className="w-[200px] min-w-[200px] text-black">Observation (Semaine)</TableHead>
                  <TableHead className="w-[80px] min-w-[80px] text-center text-black sticky right-0 z-10 bg-amber-200">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientOrders.map((order, index) => (
                    <TableRow key={order.id}>
                      <TableCell className="p-1 sticky left-0 z-10 bg-card group-hover:bg-muted/50">
                        <Input
                          value={order.clientName}
                          onChange={(e) => handleClientOrderClientNameChange(index, e.target.value)}
                          className="h-8"
                          placeholder="Nom du client"
                        />
                      </TableCell>
                      {DAYS_OF_WEEK_KEYS.map(day => {
                        const nbPnValue = Number(order.days[day].nbPn);
                        const isNbPnZeroOrInvalid = isNaN(nbPnValue) || nbPnValue <= 0;
                        return (
                          <React.Fragment key={`${order.id}-${day}`}>
                            <TableCell className="p-1">
                              <Input
                                type="number"
                                min="0"
                                value={order.days[day].nbPn}
                                onChange={(e) => handleClientOrderDailyInputChange(index, day, 'nbPn', e.target.value)}
                                className="h-8 text-center"
                                placeholder="0"
                              />
                            </TableCell>
                            <TableCell className="p-1">
                              <Select
                                value={isNbPnZeroOrInvalid ? 'none' : order.days[day].breadChoice}
                                onValueChange={(value) => handleClientOrderDailyBreadChange(index, day, value as BreadChoice)}
                                disabled={isNbPnZeroOrInvalid}
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue placeholder="Pain..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none" className="text-xs">Aucun</SelectItem>
                                  <SelectItem value="baguette" className="text-xs">Baguette</SelectItem>
                                  <SelectItem value="faluche" className="text-xs">Faluche</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </React.Fragment>
                        );
                      })}
                      <TableCell className="p-1">
                        <Input
                          value={order.observation}
                          onChange={(e) => handleClientOrderObservationChange(index, e.target.value)}
                          className="h-8"
                          placeholder="Détails..."
                        />
                      </TableCell>
                      <TableCell className="p-1 text-center sticky right-0 z-10 bg-card group-hover:bg-muted/50">
                        <Button variant="destructive" size="icon" onClick={() => handleDeleteClientOrderRow(order.id)} className="h-8 w-8">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
               <TableFooter>
                <TableRow className="bg-amber-100 dark:bg-amber-800/50">
                  <TableCell colSpan={1} className="text-right font-semibold text-black sticky left-0 z-10 bg-amber-100 dark:bg-amber-800/50">TOTAUX PAINS COMMANDÉS :</TableCell>
                  {DAYS_OF_WEEK_KEYS.map(day => (
                    <React.Fragment key={`footer-total-${day}`}>
                      <TableCell className="text-center font-bold text-black">
                        B: {clientDailyBreadTotals[day].baguettes}
                      </TableCell>
                      <TableCell className="text-center font-bold text-black">
                        F: {clientDailyBreadTotals[day].faluches}
                      </TableCell>
                    </React.Fragment>
                  ))}
                  <TableCell colSpan={2}></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
          <div className="mt-6 flex justify-between items-center">
            <Button onClick={handleAddClientOrderRow} variant="outline">
              <PlusCircle className="mr-2 h-4 w-4" /> Ajouter Ligne Client
            </Button>
            <div className="flex space-x-2">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                    <Button variant="outline">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Effacer Toutes les Commandes Clients
                    </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                        <AlertDialogDescription>
                        Êtes-vous sûr de vouloir effacer toutes les commandes clients pour cette semaine ? Cette action est irréversible.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmClearClientOrders}>
                        Effacer Tout
                        </AlertDialogAction>
                    </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <Button onClick={saveClientOrders}>
                    <Save className="mr-2 h-4 w-4" />
                    Sauvegarder Commandes Clients
                </Button>
            </div>
          </div>

          <Card className="mt-8 shadow-md">
            <CardHeader>
                <CardTitle>Récapitulatif des Pains par Jour pour les Commandes Clients</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow className="bg-amber-100 dark:bg-amber-800/50">
                            <TableHead className="w-[150px] text-black">Jour</TableHead>
                            <TableHead className="text-center text-black">Total Baguettes</TableHead>
                            <TableHead className="text-center text-black">Total Faluches</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {DAYS_OF_WEEK_KEYS.map(day => (
                            <TableRow key={`total-summary-${day}`}>
                                <TableCell className="font-medium capitalize">{DAY_LABELS[day]}</TableCell>
                                <TableCell className="text-center font-semibold">{clientDailyBreadTotals[day].baguettes}</TableCell>
                                <TableCell className="text-center font-semibold">{clientDailyBreadTotals[day].faluches}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}


    