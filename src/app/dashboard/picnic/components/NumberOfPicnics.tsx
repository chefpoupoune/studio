
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Save, Trash2, PlusCircle, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { PicnicWeekData, PicnicRowKey, DisplayRowConfig, ClientPicnicOrder, BreadChoice, DailyClientPicnicData, DayOfWeekKey, PicnicRowData } from '../types';
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
import { format, startOfWeek, endOfWeek, addDays, subDays, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { firestore } from '@/lib/firebase';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

const DAYS_OF_WEEK_KEYS: DayOfWeekKey[] = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
const DAY_LABELS: Record<DayOfWeekKey, string> = {
  lundi: 'Lundi',
  mardi: 'Mardi',
  mercredi: 'Mercredi',
  jeudi: 'Jeudi',
  vendredi: 'Vendredi',
};

const PICNIC_WEEK_DATA_COLLECTION = "picnicWeekData";
const PICNIC_CLIENT_ORDERS_COLLECTION = "picnicClientOrders";

const initialRowData = (): PicnicRowData => ({
  lundi: '', mardi: '', mercredi: '', jeudi: '', vendredi: '', weeklyObservation: ''
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
  const [selectedClientOrderDay, setSelectedClientOrderDay] = useState<DayOfWeekKey>('lundi');
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingPicnicData, setIsSavingPicnicData] = useState(false);
  const [isSavingClientOrders, setIsSavingClientOrders] = useState(false);

  const weekIdentifier = useMemo(() => {
    const monday = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return format(monday, 'yyyy-MM-dd');
  }, [selectedDate]);

  const weekDisplayString = useMemo(() => {
    const monday = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const friday = addDays(monday, 4);
    return `Semaine du : ${format(monday, 'dd MMMM', { locale: fr })} au ${format(friday, 'dd MMMM yyyy', { locale: fr })}`;
  }, [selectedDate]);

  useEffect(() => {
    setIsLoading(true);
    const loadDataForWeek = async () => {
      try {
        // Load Picnic Data (NB PN)
        const picnicDataDocRef = doc(firestore, PICNIC_WEEK_DATA_COLLECTION, weekIdentifier);
        const picnicDataSnap = await getDoc(picnicDataDocRef);
        if (picnicDataSnap.exists()) {
          const parsedData = picnicDataSnap.data() as PicnicWeekData;
          const completeData: Partial<PicnicWeekData> = {};
          (Object.keys(createInitialPicnicWeekData()) as PicnicRowKey[]).forEach(key => {
            completeData[key] = { ...(initialRowData()), ...parsedData[key] };
          });
          setPicnicData(completeData as PicnicWeekData);
        } else {
          setPicnicData(createInitialPicnicWeekData());
        }

        // Load Client Orders
        const clientOrdersDocRef = doc(firestore, PICNIC_CLIENT_ORDERS_COLLECTION, weekIdentifier);
        const clientOrdersSnap = await getDoc(clientOrdersDocRef);
        if (clientOrdersSnap.exists()) {
          const data = clientOrdersSnap.data();
          const parsedClientOrders: ClientPicnicOrder[] = data.orders || [];
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
        console.error("Failed to load data from Firestore for week " + weekIdentifier, e);
        toast({ title: "Erreur de chargement", description: "Données de pique-nique corrompues pour la semaine sélectionnée.", variant: "destructive" });
        setPicnicData(createInitialPicnicWeekData());
        setClientOrders(Array.from({ length: 3 }, createInitialClientOrder));
      } finally {
        setIsLoading(false);
      }
    };
    loadDataForWeek();
  }, [weekIdentifier, toast]);

  const savePicnicDataToFirestore = useCallback(async () => {
    if (isSavingPicnicData) return;
    setIsSavingPicnicData(true);
    try {
      const picnicDataDocRef = doc(firestore, PICNIC_WEEK_DATA_COLLECTION, weekIdentifier);
      await setDoc(picnicDataDocRef, picnicData);
      toast({ title: "Données Hebdomadaires Sauvegardées", description: "Les nombres de pique-niques ont été enregistrés dans Firestore." });
    } catch (e) {
      console.error("Failed to save picnic data to Firestore", e);
      toast({ title: "Erreur de sauvegarde (NB PN)", variant: "destructive" });
    } finally {
      setIsSavingPicnicData(false);
    }
  }, [picnicData, weekIdentifier, toast, isSavingPicnicData]);

  const saveClientOrdersToFirestore = useCallback(async () => {
    if (isSavingClientOrders) return;
    setIsSavingClientOrders(true);
    try {
      const clientOrdersDocRef = doc(firestore, PICNIC_CLIENT_ORDERS_COLLECTION, weekIdentifier);
      await setDoc(clientOrdersDocRef, { orders: clientOrders });
      toast({ title: "Commandes Clients Sauvegardées", description: "Les commandes clients ont été enregistrées dans Firestore." });
    } catch (e) {
      console.error("Failed to save client orders to Firestore", e);
      toast({ title: "Erreur de sauvegarde (Commandes Clients)", variant: "destructive" });
    } finally {
      setIsSavingClientOrders(false);
    }
  }, [clientOrders, weekIdentifier, toast, isSavingClientOrders]);

  const handleConfirmClearPicnicData = async () => {
    setIsSavingPicnicData(true);
    try {
      const picnicDataDocRef = doc(firestore, PICNIC_WEEK_DATA_COLLECTION, weekIdentifier);
      await setDoc(picnicDataDocRef, createInitialPicnicWeekData()); // Save empty data
      setPicnicData(createInitialPicnicWeekData()); 
      toast({ title: "Données hebdomadaires (NB PN) effacées de Firestore.", variant: "destructive"});
    } catch (e) {
      console.error("Error clearing picnic data in Firestore:", e);
      toast({ title: "Erreur d'effacement (NB PN)", variant: "destructive"});
    } finally {
      setIsSavingPicnicData(false);
    }
  };

  const handleConfirmClearClientOrders = async () => {
    setIsSavingClientOrders(true);
    const initialEmptyOrders = Array.from({ length: 3 }, createInitialClientOrder);
    try {
      const clientOrdersDocRef = doc(firestore, PICNIC_CLIENT_ORDERS_COLLECTION, weekIdentifier);
      await setDoc(clientOrdersDocRef, { orders: initialEmptyOrders }); // Save empty orders
      setClientOrders(initialEmptyOrders);
      toast({ title: "Données commandes clients effacées de Firestore.", variant: "destructive"});
    } catch (e) {
      console.error("Error clearing client orders in Firestore:", e);
      toast({ title: "Erreur d'effacement (Commandes Clients)", variant: "destructive"});
    } finally {
      setIsSavingClientOrders(false);
    }
  };

  const handleDailyValueChange = (rowId: PicnicRowKey, day: DayOfWeekKey, value: string) => {
    const numericValue = value === '' ? '' : parseInt(value, 10);
    if (value === '' || (!isNaN(numericValue) && numericValue >= 0)) {
      setPicnicData(prevData => {
        const currentRowData = prevData[rowId] || initialRowData(); // Ensure all fields from initialRowData are present
        return {
          ...prevData,
          [rowId]: {
            ...currentRowData, // Spread all fields from existing/initial row
            [day]: value === '' ? '' : numericValue, // Then update the specific day
          }
        };
      });
    }
  };
  
  const handleObservationChange = (rowId: PicnicRowKey, value: string) => {
    setPicnicData(prevData => {
        const currentRowData = prevData[rowId] || initialRowData(); // Ensure all fields from initialRowData are present
        return {
            ...prevData,
            [rowId]: {
                ...currentRowData,
                weeklyObservation: value,
            }
        };
    });
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

  const handleClientOrderDailyInputChange = (index: number, day: DayOfWeekKey, value: string) => {
    setClientOrders(prevOrders => {
      const newOrders = [...prevOrders];
      const currentDayData = newOrders[index].days[day];
      const updatedDayData = { ...currentDayData, nbPn: value };

      const nbPnValue = Number(value);
      if (isNaN(nbPnValue) || nbPnValue <= 0) {
        updatedDayData.breadChoice = 'none';
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

  const clientBreadTotalsForSelectedDay = useMemo(() => {
    let baguettes = 0;
    let faluches = 0;
    
    clientOrders.forEach(order => {
      const dayData = order.days[selectedClientOrderDay];
      const nbPn = Number(dayData.nbPn);
      if (!isNaN(nbPn) && nbPn > 0) {
        if (dayData.breadChoice === 'baguette') {
          baguettes += Math.round(nbPn / 2);
        } else if (dayData.breadChoice === 'faluche') {
          faluches += nbPn;
        }
      }
    });
    return {
      baguettes: baguettes,
      faluches: faluches,
    };
  }, [clientOrders, selectedClientOrderDay]);

  const weeklyClientRecapData = useMemo(() => {
    return clientOrders
      .filter(order => order.clientName.trim() !== '' || DAYS_OF_WEEK_KEYS.some(day => Number(order.days[day].nbPn) > 0))
      .map(order => {
        const dailyBaguetteCounts: Record<DayOfWeekKey, number> = {} as any;
        const dailyFalucheCounts: Record<DayOfWeekKey, number> = {} as any;

        DAYS_OF_WEEK_KEYS.forEach(day => {
          const dayData = order.days[day];
          const nbPn = Number(dayData.nbPn) || 0;
          if (nbPn > 0) {
            if (dayData.breadChoice === 'baguette') {
              dailyBaguetteCounts[day] = Math.round(nbPn / 2);
              dailyFalucheCounts[day] = 0;
            } else if (dayData.breadChoice === 'faluche') {
              dailyFalucheCounts[day] = nbPn;
              dailyBaguetteCounts[day] = 0;
            } else {
              dailyBaguetteCounts[day] = 0;
              dailyFalucheCounts[day] = 0;
            }
          } else {
            dailyBaguetteCounts[day] = 0;
            dailyFalucheCounts[day] = 0;
          }
        });
        return {
          id: order.id,
          clientName: order.clientName,
          baguetteCounts: dailyBaguetteCounts,
          falucheCounts: dailyFalucheCounts,
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

  const handlePreviousWeek = () => {
    setSelectedDate(prevDate => subDays(prevDate, 7));
  };

  const handleNextWeek = () => {
    setSelectedDate(prevDate => addDays(prevDate, 7));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2 text-muted-foreground">Chargement des données de la semaine...</p>
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
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Nombre de Pique-Niques (NB PN) pour la Semaine</CardTitle>
          <CardDescription>
            Saisissez le nombre de pique-niques prévus pour chaque catégorie et chaque jour, ainsi que les observations hebdomadaires.
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
                            onChange={(e) => handleDailyValueChange(rowConfig.id as PicnicRowKey, day, e.target.value)}
                            className={cn(
                              "h-8 text-center tabular-nums bg-transparent border-transparent focus:border-current focus:ring-1",
                              rowConfig.textColor.includes('white') ? "text-white placeholder:text-gray-300 focus:ring-white/50" : "text-black placeholder:text-gray-500 focus:ring-black/50"
                            )}
                            placeholder="0"
                            disabled={isSavingPicnicData}
                          />
                        );
                      } else if (rowConfig.id === 'total_global') {
                        cellContent = <span className={cn("font-semibold block py-1.5", rowConfig.textColor)}>{dailyGlobalTotals[day]}</span>;
                      } else if (rowConfig.id === 'nb_bagette') {
                        const value = Math.round(dailyGlobalTotals[day] / 2);
                        cellContent = <span className={cn("font-semibold block py-1.5", rowConfig.textColor)}>{value}</span>;
                      } else if (rowConfig.id === 'nb_faluche') {
                        const value = (day === 'mercredi' || day === 'vendredi') ? dailyGlobalTotals[day] : 0;
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
                    <TableCell className={cn("p-1", rowConfig.bgColor)}>
                      {rowConfig.isInputRow ? (
                        <Input
                          type="text"
                          value={picnicData[rowConfig.id as PicnicRowKey]?.weeklyObservation ?? ''}
                          onChange={(e) => handleObservationChange(rowConfig.id as PicnicRowKey, e.target.value)}
                          className={cn(
                            "h-8 text-sm bg-transparent border-transparent focus:border-current focus:ring-1",
                            rowConfig.textColor.includes('white') ? "text-white placeholder:text-gray-300 focus:ring-white/50" : "text-black placeholder:text-gray-500 focus:ring-black/50"
                          )}
                          placeholder="Notes..."
                          disabled={isSavingPicnicData}
                        />
                      ) : (
                        <span className={cn("block py-1.5", rowConfig.textColor)}>-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-6 flex justify-end space-x-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                   <Button variant="outline" disabled={isSavingPicnicData}>
                      {isSavingPicnicData && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
                    <AlertDialogAction onClick={handleConfirmClearPicnicData}>
                      Effacer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button onClick={savePicnicDataToFirestore} disabled={isSavingPicnicData}>
                  {isSavingPicnicData && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  Sauvegarder Données Semaine
              </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Commandes Clients Pique-Niques</CardTitle>
          <CardDescription>
            Saisissez les commandes spécifiques des clients, le nombre de pique-niques et choisissez le type de pain pour le jour sélectionné.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-end gap-4">
            <div className="flex-grow">
              <Label htmlFor="client-order-day-select">Sélectionner un Jour</Label>
              <Select value={selectedClientOrderDay} onValueChange={(value) => setSelectedClientOrderDay(value as DayOfWeekKey)} disabled={isSavingClientOrders}>
                <SelectTrigger id="client-order-day-select" className="mt-1">
                  <SelectValue placeholder="Choisir un jour..." />
                </SelectTrigger>
                <SelectContent>
                  {DAYS_OF_WEEK_KEYS.map(day => (
                    <SelectItem key={day} value={day} className="capitalize">
                      {DAY_LABELS[day]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="overflow-x-auto border rounded-md">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow className="bg-amber-200 dark:bg-amber-700/50">
                  <TableHead className="w-[200px] min-w-[200px] text-black dark:text-white sticky left-0 z-10 bg-amber-200 dark:bg-amber-700/50">Client</TableHead>
                  <TableHead className="w-[120px] min-w-[120px] text-center text-black dark:text-white capitalize">NB PN ({DAY_LABELS[selectedClientOrderDay]})</TableHead>
                  <TableHead className="w-[150px] min-w-[150px] text-center text-black dark:text-white capitalize">Pain ({DAY_LABELS[selectedClientOrderDay]})</TableHead>
                  <TableHead className="w-[250px] min-w-[250px] text-black dark:text-white">Observation (Semaine)</TableHead>
                  <TableHead className="w-[80px] min-w-[80px] text-center text-black dark:text-white sticky right-0 z-10 bg-amber-200 dark:bg-amber-700/50">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientOrders.map((order, index) => {
                    const dayData = order.days[selectedClientOrderDay];
                    const nbPnValue = Number(dayData.nbPn);
                    const isNbPnZeroOrInvalid = isNaN(nbPnValue) || nbPnValue <= 0;
                    return (
                        <TableRow key={order.id}>
                        <TableCell className="p-1 sticky left-0 z-10 bg-card group-hover:bg-muted/50">
                            <Input
                            value={order.clientName}
                            onChange={(e) => handleClientOrderClientNameChange(index, e.target.value)}
                            className="h-8"
                            placeholder="Nom du client"
                            disabled={isSavingClientOrders}
                            />
                        </TableCell>
                        <TableCell className="p-1">
                            <Input
                            type="number"
                            min="0"
                            value={dayData.nbPn}
                            onChange={(e) => handleClientOrderDailyInputChange(index, selectedClientOrderDay, e.target.value)}
                            className="h-8 text-center"
                            placeholder="0"
                            disabled={isSavingClientOrders}
                            />
                        </TableCell>
                        <TableCell className="p-1">
                            <Select
                            value={isNbPnZeroOrInvalid ? 'none' : dayData.breadChoice}
                            onValueChange={(value) => handleClientOrderDailyBreadChange(index, selectedClientOrderDay, value as BreadChoice)}
                            disabled={isNbPnZeroOrInvalid || isSavingClientOrders}
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
                        <TableCell className="p-1">
                            <Input
                            value={order.observation}
                            onChange={(e) => handleClientOrderObservationChange(index, e.target.value)}
                            className="h-8"
                            placeholder="Détails..."
                            disabled={isSavingClientOrders}
                            />
                        </TableCell>
                        <TableCell className="p-1 text-center sticky right-0 z-10 bg-card group-hover:bg-muted/50">
                            <Button variant="destructive" size="icon" onClick={() => handleDeleteClientOrderRow(order.id)} className="h-8 w-8" disabled={isSavingClientOrders}>
                            <Trash2 className="h-4 w-4" />
                            </Button>
                        </TableCell>
                        </TableRow>
                    );
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="bg-amber-100 dark:bg-amber-800/50">
                    <TableCell colSpan={2} className="text-right font-semibold text-black dark:text-white">
                        TOTAUX PAINS ({DAY_LABELS[selectedClientOrderDay].toUpperCase()}) :
                    </TableCell>
                    <TableCell className="text-left font-bold text-black dark:text-white">
                       B: {clientBreadTotalsForSelectedDay.baguettes}, F: {clientBreadTotalsForSelectedDay.faluches}
                    </TableCell>
                    <TableCell colSpan={2}></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
          <div className="mt-6 flex justify-between items-center">
            <Button onClick={handleAddClientOrderRow} variant="outline" disabled={isSavingClientOrders}>
              <PlusCircle className="mr-2 h-4 w-4" /> Ajouter Ligne Client
            </Button>
            <div className="flex space-x-2">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={isSavingClientOrders}>
                        {isSavingClientOrders && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Trash2 className="mr-2 h-4 w-4" />
                        Effacer Commandes Clients (semaine)
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
                <Button onClick={saveClientOrdersToFirestore} disabled={isSavingClientOrders}>
                    {isSavingClientOrders && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4" />
                    Sauvegarder Commandes Clients
                </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg mt-8">
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

