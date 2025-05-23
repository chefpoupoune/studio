
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Save, Trash2, PlusCircle } from 'lucide-react'; // Added PlusCircle
import type { PicnicWeekData, DailyCounts, PicnicRowKey, DisplayRowConfig, ClientPicnicOrder } from '../types';
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

const DAYS_OF_WEEK: (keyof DailyCounts)[] = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi'];
const DAY_LABELS: Record<keyof DailyCounts, string> = {
  lundi: 'Lundi',
  mardi: 'Mardi',
  mercredi: 'Mercredi',
  jeudi: 'Jeudi',
  vendredi: 'Vendredi',
};

const PICNIC_DATA_STORAGE_KEY = "picnic_nb_pn_data_v1";
const PICNIC_CLIENT_ORDERS_KEY = "picnic_client_orders_data_v1"; // New key for client orders

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

const createInitialClientOrder = (): ClientPicnicOrder => ({
  id: `client_order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
  clientName: '',
  nbPn: '',
  observation: '',
  totalBaguette: '',
  totalFaluche: '',
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
  const [picnicData, setPicnicData] = useState<PicnicWeekData>(createInitialPicnicWeekData());
  const [clientOrders, setClientOrders] = useState<ClientPicnicOrder[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedData = localStorage.getItem(PICNIC_DATA_STORAGE_KEY);
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

      const storedClientOrders = localStorage.getItem(PICNIC_CLIENT_ORDERS_KEY);
      if (storedClientOrders) {
        setClientOrders(JSON.parse(storedClientOrders));
      } else {
        setClientOrders(Array.from({ length: 5 }, createInitialClientOrder));
      }
    } catch (e) {
      console.error("Failed to load picnic data from localStorage", e);
      toast({ title: "Erreur de chargement", description: "Données de pique-nique corrompues.", variant: "destructive" });
      setPicnicData(createInitialPicnicWeekData());
      setClientOrders(Array.from({ length: 5 }, createInitialClientOrder));
    }
  }, [toast]);

  const saveData = useCallback(() => {
    try {
      localStorage.setItem(PICNIC_DATA_STORAGE_KEY, JSON.stringify(picnicData));
      toast({ title: "Données Hebdomadaires Sauvegardées", description: "Les nombres de pique-niques de la semaine ont été enregistrés." });
    } catch (e) {
      console.error("Failed to save picnic data to localStorage", e);
      toast({ title: "Erreur de sauvegarde (semaine)", variant: "destructive" });
    }
  }, [picnicData, toast]);
  
  const saveClientOrders = useCallback(() => {
    try {
      localStorage.setItem(PICNIC_CLIENT_ORDERS_KEY, JSON.stringify(clientOrders));
      toast({ title: "Commandes Clients Sauvegardées", description: "Les commandes clients pour pique-niques ont été enregistrées." });
    } catch (e) {
      console.error("Failed to save client orders to localStorage", e);
      toast({ title: "Erreur de sauvegarde (commandes clients)", variant: "destructive" });
    }
  }, [clientOrders, toast]);

  const handleConfirmClearData = () => {
    setPicnicData(createInitialPicnicWeekData());
    toast({ title: "Données hebdomadaires effacées", variant: "destructive"});
  };
  
  const handleConfirmClearClientOrders = () => {
    setClientOrders(Array.from({ length: 5 }, createInitialClientOrder)); 
    toast({ title: "Données commandes clients effacées", variant: "destructive"});
  };


  const handleInputChange = (rowId: PicnicRowKey, day: keyof DailyCounts, value: string) => {
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
  
  const handleClientOrderInputChange = (index: number, field: keyof Omit<ClientPicnicOrder, 'id' | 'totalBaguette'>, value: string) => {
    setClientOrders(prevOrders => {
      const newOrders = [...prevOrders];
      newOrders[index] = { ...newOrders[index], [field]: value };
      return newOrders;
    });
  };

  const handleAddClientOrderRow = () => {
    setClientOrders(prevOrders => [...prevOrders, createInitialClientOrder()]);
  };

  const handleDeleteClientOrderRow = (idToDelete: string) => {
    setClientOrders(prevOrders => prevOrders.filter(order => order.id !== idToDelete));
  };


  const calculateDailyTotal = useCallback((day: keyof DailyCounts): number => {
    let sum = 0;
    for (const rowConfig of DISPLAY_ROWS_CONFIG) {
      if (rowConfig.isInputRow && rowConfig.isTotalContributor) { 
          sum += Number(picnicData[rowConfig.id as PicnicRowKey]?.[day]) || 0;
      }
    }
    return sum;
  }, [picnicData]);

  const dailyGlobalTotals = useMemo(() => {
    return DAYS_OF_WEEK.reduce((acc, day) => {
      acc[day] = calculateDailyTotal(day);
      return acc;
    }, {} as Record<keyof DailyCounts, number>);
  }, [calculateDailyTotal]);

  const dailyGlaciereTotals = useMemo(() => {
    return DAYS_OF_WEEK.reduce((acc, day) => {
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
    }, {} as Record<keyof DailyCounts, number>);
  }, [picnicData]);


  return (
    <div className="space-y-8">
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
                  {DAYS_OF_WEEK.map(day => (
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
                    {DAYS_OF_WEEK.map(day => (
                      <TableCell key={`${rowConfig.id}-${day}`} className={cn("p-1 text-center tabular-nums", rowConfig.bgColor)}>
                        {rowConfig.isInputRow ? (
                          <Input
                            type="number"
                            min="0"
                            value={picnicData[rowConfig.id as PicnicRowKey]?.[day] ?? ''}
                            onChange={(e) => handleInputChange(rowConfig.id as PicnicRowKey, day, e.target.value)}
                            className={cn(
                              "h-8 text-center tabular-nums",
                              rowConfig.textColor === 'text-white' ? "text-white placeholder:text-gray-300 bg-transparent" : "text-black placeholder:text-gray-500 bg-transparent",
                              `${rowConfig.bgColor.replace('bg-','border-')}/50 focus:border-ring` 
                            )}
                            placeholder="0"
                          />
                        ) : rowConfig.id === 'total_global' ? ( 
                          <span className={cn("font-semibold", rowConfig.textColor)}>{dailyGlobalTotals[day]}</span>
                        ) : rowConfig.id === 'nb_bagette' ? (
                          <span className={cn("font-semibold", rowConfig.textColor)}>
                            {day === 'lundi' ? Math.round(dailyGlobalTotals[day] / 2) : '0'}
                          </span>
                        ) : rowConfig.id === 'nb_faluche' ? (
                          <span className={cn("font-semibold", rowConfig.textColor)}>
                            {day === 'mercredi' ? dailyGlobalTotals[day] : day === 'vendredi' ? dailyGlobalTotals[day] : '0'}
                          </span>
                        ) : rowConfig.id === 'total_glaciere' ? (
                          <span className={cn("font-semibold", rowConfig.textColor)}>{dailyGlaciereTotals[day]}</span>
                        ) : null}
                      </TableCell>
                    ))}
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
          <CardTitle>Commandes Clients Pique-Niques</CardTitle>
          <CardDescription>
            Saisissez les commandes spécifiques des clients pour les pique-niques.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto border rounded-md">
            <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow className="bg-amber-200">
                  <TableHead className="w-[200px] min-w-[200px] text-black">Client</TableHead>
                  <TableHead className="w-[100px] min-w-[100px] text-center text-black">NB PN</TableHead>
                  <TableHead className="w-[250px] min-w-[250px] text-black">Observation</TableHead>
                  <TableHead className="w-[120px] min-w-[120px] text-center text-black">Total Baguette</TableHead>
                  <TableHead className="w-[120px] min-w-[120px] text-center text-black">Total Faluche</TableHead>
                  <TableHead className="w-[100px] min-w-[100px] text-center text-black">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientOrders.map((order, index) => {
                  const nbPnValue = Number(order.nbPn);
                  const calculatedBaguettes = !isNaN(nbPnValue) && nbPnValue > 0 ? Math.round(nbPnValue / 2) : 0;
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="p-1">
                        <Input
                          value={order.clientName}
                          onChange={(e) => handleClientOrderInputChange(index, 'clientName', e.target.value)}
                          className="h-8"
                          placeholder="Nom du client"
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          type="number"
                          min="0"
                          value={order.nbPn}
                          onChange={(e) => handleClientOrderInputChange(index, 'nbPn', e.target.value)}
                          className="h-8 text-center"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          value={order.observation}
                          onChange={(e) => handleClientOrderInputChange(index, 'observation', e.target.value)}
                          className="h-8"
                          placeholder="Détails..."
                        />
                      </TableCell>
                      <TableCell className="p-1 text-center">
                        <span className="h-8 flex items-center justify-center tabular-nums">
                          {calculatedBaguettes}
                        </span>
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          type="number"
                          min="0"
                          value={order.totalFaluche}
                          onChange={(e) => handleClientOrderInputChange(index, 'totalFaluche', e.target.value)}
                          className="h-8 text-center"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell className="p-1 text-center">
                        <Button variant="destructive" size="icon" onClick={() => handleDeleteClientOrderRow(order.id)} className="h-8 w-8">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
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
                        Êtes-vous sûr de vouloir effacer toutes les commandes clients ? Cette action est irréversible.
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
        </CardContent>
      </Card>
    </div>
  );
}

    