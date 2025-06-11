
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, FileText, Trash2, Thermometer as ThermometerIcon, AlertCircle, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, getYear, getMonth, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import type { PmsEquipmentDefinition, MonthlyTempGridLog, DailyTempGridLogEntry, PmsConfigurations } from '../types';
import { PMS_TEMPERATURE_MONITORING_KEY } from '@/app/dashboard/settings/types';
import { getMonthDays, type DayData } from '../utils';
import { cn } from '@/lib/utils';
// Check import already exists from a previous fix
// import { Checkbox } from '@/components/ui/checkbox'; 
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { firestore } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const currentFullYear = new Date().getFullYear();
const yearsArray = Array.from({ length: 10 }, (_, i) => currentFullYear - 5 + i);
const monthsArray = Array.from({ length: 12 }, (_, i) => ({
  value: i.toString(),
  label: format(new Date(currentFullYear, i), "MMMM", { locale: fr }),
}));

const TEMPERATURE_ROWS = Array.from({ length: 27 }, (_, i) => 16 - i); 

const LOGGED_IN_USERNAME_KEY = 'loggedInUsername';

export default function TemperatureMonitoring() {
  const [selectedYear, setSelectedYear] = useState<string>(getYear(new Date()).toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(getMonth(new Date()).toString());
  
  const [equipmentList, setEquipmentList] = useState<PmsEquipmentDefinition[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | undefined>(undefined);
  
  const [monthDays, setMonthDays] = useState<DayData[]>([]);
  const [records, setRecords] = useState<MonthlyTempGridLog>({});
  
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const [loggedInUsername, setLoggedInUsername] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setLoggedInUsername(localStorage.getItem(LOGGED_IN_USERNAME_KEY));
    }
  }, []);
  
  const getFirestoreDocId = useCallback(() => {
    if (!selectedEquipmentId) return null;
    return `tempGridLog_${selectedEquipmentId}_${selectedYear}_${selectedMonth}`;
  }, [selectedEquipmentId, selectedYear, selectedMonth]);

  const loadPmsConfigurations = useCallback(async () => {
    setIsLoadingConfig(true);
    const pmsSettingsDocRef = doc(firestore, "pmsConfigurations", "mainConfig");
    let fetchedEquipment: PmsEquipmentDefinition[] = [];
    let newSelectedEquipmentId = selectedEquipmentId; 
    try {
      const pmsSettingsSnap = await getDoc(pmsSettingsDocRef);
      if (pmsSettingsSnap.exists()) {
        const pmsSettings = pmsSettingsSnap.data() as PmsConfigurations;
        fetchedEquipment = (pmsSettings[PMS_TEMPERATURE_MONITORING_KEY] || []) as PmsEquipmentDefinition[];
        setEquipmentList(fetchedEquipment);
        
        const currentSelectionStillValid = newSelectedEquipmentId && fetchedEquipment.some(eq => eq.id === newSelectedEquipmentId);
        
        if (fetchedEquipment.length === 0) {
            newSelectedEquipmentId = undefined; // Explicitly reset if list is empty
        } else if (!currentSelectionStillValid) {
          newSelectedEquipmentId = fetchedEquipment[0].id;
        }
      } else {
        setEquipmentList([]);
        newSelectedEquipmentId = undefined; 
        toast({ title: "Configuration Manquante", description: "Aucune configuration d'équipement de température trouvée.", variant: "destructive"});
      }
    } catch (error) {
      console.error("Error loading PMS equipment configurations:", error);
      toast({ title: "Erreur Config Équipement", variant: "destructive" });
      setEquipmentList([]);
      newSelectedEquipmentId = undefined;
    }
    
    if (newSelectedEquipmentId !== selectedEquipmentId) {
        setSelectedEquipmentId(newSelectedEquipmentId);
    }
    setIsLoadingConfig(false);
  }, [toast, selectedEquipmentId]);

  useEffect(() => {
    loadPmsConfigurations(); 

    const handleConfigUpdate = () => {
      console.log("[TempMonitoring] PMS Config updated event received. Reloading equipment list.");
      loadPmsConfigurations();
    };
    window.addEventListener('pmsConfigUpdated', handleConfigUpdate);
    return () => window.removeEventListener('pmsConfigUpdated', handleConfigUpdate);
  }, [loadPmsConfigurations]);


  const loadTemperatureRecords = useCallback(async () => {
    if (!selectedEquipmentId) {
      setRecords({});
      setIsLoadingRecords(false);
      return;
    }
    setIsLoadingRecords(true);
    const docId = getFirestoreDocId();
    if (!docId) { setIsLoadingRecords(false); return; }

    const recordsDocRef = doc(firestore, "pmsTemperatureGridLogs", docId);
    try {
      const docSnap = await getDoc(recordsDocRef);
      if (docSnap.exists()) {
        setRecords(docSnap.data() as MonthlyTempGridLog);
      } else {
        setRecords({});
      }
    } catch (error) {
      console.error("Error loading temperature grid records:", error);
      toast({ title: "Erreur Chargement Relevés", variant: "destructive" });
      setRecords({});
    }
    setIsLoadingRecords(false);
  }, [selectedEquipmentId, getFirestoreDocId, toast]);
  
  useEffect(() => {
    const yearNum = parseInt(selectedYear, 10);
    const monthNum = parseInt(selectedMonth, 10);
    setMonthDays(getMonthDays(yearNum, monthNum));
    loadTemperatureRecords();
  }, [selectedYear, selectedMonth, loadTemperatureRecords]); 

  useEffect(() => {
    if (isLoadingConfig || isLoadingRecords || isSaving || !selectedEquipmentId) return;

    const saveRecords = async () => {
      const docId = getFirestoreDocId();
      if (!docId || (Object.keys(records).length === 0 && !doc(firestore, "pmsTemperatureGridLogs", docId))) return;
      
      setIsSaving(true);
      const recordsDocRef = doc(firestore, "pmsTemperatureGridLogs", docId);
      try {
        await setDoc(recordsDocRef, records);
      } catch (error) {
        console.error("Error auto-saving temperature grid records:", error);
        toast({ title: "Erreur Sauvegarde Auto", variant: "destructive" });
      }
      setIsSaving(false);
    };
    const timeoutId = setTimeout(saveRecords, 2000);
    return () => clearTimeout(timeoutId);
  }, [records, isLoadingConfig, isLoadingRecords, isSaving, selectedEquipmentId, getFirestoreDocId, toast]);

  const selectedEquipmentConfig = useMemo(() => {
    return equipmentList.find(eq => eq.id === selectedEquipmentId);
  }, [selectedEquipmentId, equipmentList]);

  const getEquipmentZoneInfo = useCallback((temp: number, config?: PmsEquipmentDefinition): { label: string; colorClass: string } => {
    if (!config) return { label: '', colorClass: 'bg-background hover:bg-muted/50' };
    
    const { 
      targetTempMin, targetTempMax, 
      tolerance1TempMin, tolerance1TempMax, 
      tolerance2TempMin, tolerance2TempMax 
    } = config;

    const isInRange = (val: number, min?: number, max?: number): boolean => {
      const numVal = Number(val);
      const lower = (min === undefined || min === null || isNaN(Number(min))) ? null : Number(min);
      const upper = (max === undefined || max === null || isNaN(Number(max))) ? null : Number(max);

      if (lower !== null && upper !== null) return numVal >= lower && numVal <= upper;
      if (lower !== null) return numVal >= lower;
      if (upper !== null) return numVal <= upper;
      return false; 
    };

    if ((targetTempMin !== undefined || targetTempMax !== undefined) && isInRange(temp, targetTempMin, targetTempMax)) {
      return { label: "Cible", colorClass: 'bg-green-200 dark:bg-green-800/60 hover:bg-green-300 dark:hover:bg-green-600' };
    }
    if ((tolerance1TempMin !== undefined || tolerance1TempMax !== undefined) && isInRange(temp, tolerance1TempMin, tolerance1TempMax)) {
      return { label: "Tol. 1", colorClass: 'bg-blue-200 dark:bg-blue-800/60 hover:bg-blue-300 dark:hover:bg-blue-600' };
    }
    if ((tolerance2TempMin !== undefined || tolerance2TempMax !== undefined) && isInRange(temp, tolerance2TempMin, tolerance2TempMax)) {
      return { label: "Tol. 2", colorClass: 'bg-yellow-200 dark:bg-yellow-800/60 hover:bg-yellow-300 dark:hover:bg-yellow-600' };
    }

    return { label: "Rejet", colorClass: 'bg-red-200 dark:bg-red-800/60 hover:bg-red-300 dark:hover:bg-red-600' };
  }, []);


  const handleCellClick = (dayDate: string, tempValue: number) => {
    setRecords(prev => {
      const dayRecord = prev[dayDate] || { markedTemp: null, time: '', operator: '' };
      const isCurrentlySelected = dayRecord.markedTemp === tempValue;
      const newMarkedTemp = isCurrentlySelected ? null : tempValue;
      
      let newTime = dayRecord.time || '';
      let newOperator = dayRecord.operator || '';

      if (newMarkedTemp !== null) { 
        if (!newTime || isCurrentlySelected) { 
          newTime = format(new Date(), 'HH:mm');
        }
        if ((!newOperator || isCurrentlySelected) && loggedInUsername) { 
          newOperator = loggedInUsername.substring(0,3).toUpperCase();
        }
      } else { 
        newTime = '';
        newOperator = '';
      }
      
      return {
        ...prev,
        [dayDate]: {
          ...dayRecord,
          markedTemp: newMarkedTemp,
          time: newTime,
          operator: newOperator,
        }
      };
    });
  };
  
  const handleInputChange = (dayDate: string, field: 'time' | 'operator', value: string) => {
     setRecords(prev => {
      const dayRecord = prev[dayDate] || { markedTemp: null, time: '', operator: '' }; 
      return {
        ...prev,
        [dayDate]: {
          ...dayRecord,
          [field]: value,
        }
      };
    });
  };

  const handleClearMonthData = async () => {
    if (!selectedEquipmentId) return;
    if (confirm(`Êtes-vous sûr de vouloir effacer les relevés pour ${selectedEquipmentConfig?.name} en ${monthsArray[parseInt(selectedMonth)].label} ${selectedYear} ?`)) {
      setIsSaving(true);
      const docId = getFirestoreDocId();
      if (!docId) {setIsSaving(false); return;}
      const docRef = doc(firestore, "pmsTemperatureGridLogs", docId);
      try {
        await setDoc(docRef, {}); 
        setRecords({});
        toast({ title: "Données Effacées", description: "Les relevés pour ce mois et cet équipement ont été effacés." });
      } catch (error) {
        console.error("Error clearing month data:", error);
        toast({ title: "Erreur d'Effacement", variant: "destructive" });
      }
      setIsSaving(false);
    }
  };
  
  const generatePdf = () => {
    if (!selectedEquipmentConfig) {
      toast({ title: "Équipement non sélectionné", variant: "destructive" });
      return;
    }
    toast({ title: "PDF Non Implémenté", description: "La génération PDF pour ce tableau est en cours de développement." });
  };

  const isUIDisabled = isLoadingConfig || isLoadingRecords || isSaving;

  if (isLoadingConfig && equipmentList.length === 0) {
    return (
        <Card className="shadow-lg">
            <CardHeader><CardTitle className="flex items-center gap-2"><ThermometerIcon className="w-6 h-6 text-primary"/>Suivi des Températures</CardTitle></CardHeader>
            <CardContent><div className="flex justify-center items-center p-10"><Loader2 className="mr-2 h-5 w-5 animate-spin"/>Chargement des configurations...</div></CardContent>
        </Card>
    );
  }
  
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ThermometerIcon className="w-6 h-6 text-primary"/>
          Suivi des Températures (Frigos, Congélateurs)
        </CardTitle>
        <CardDescription>
          Sélectionnez un équipement, un mois et une année. Cochez la température relevée pour chaque jour.
          Les zones (Cible, Tolérance, Rejet) sont définies dans les Paramètres PMS.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end mb-4">
          <div>
            <Label htmlFor="equipment-select">Équipement</Label>
            <Select value={selectedEquipmentId} onValueChange={setSelectedEquipmentId} disabled={isUIDisabled || equipmentList.length === 0}>
              <SelectTrigger id="equipment-select"><SelectValue placeholder={equipmentList.length === 0 ? "Aucun équipement configuré" : "Sélectionner équipement"} /></SelectTrigger>
              <SelectContent>
                {equipmentList.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="year-select-temp">Année</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear} disabled={isUIDisabled}>
              <SelectTrigger id="year-select-temp"><SelectValue /></SelectTrigger>
              <SelectContent>{yearsArray.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="month-select-temp">Mois</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={isUIDisabled}>
              <SelectTrigger id="month-select-temp"><SelectValue /></SelectTrigger>
              <SelectContent>{monthsArray.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 md:col-span-1 md:justify-self-end">
            <Button onClick={generatePdf} disabled={isUIDisabled || !selectedEquipmentId} className="w-full sm:w-auto">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Générer PDF
            </Button>
          </div>
        </div>

        {(isLoadingConfig || (isLoadingRecords && selectedEquipmentId)) ? (
            <div className="flex justify-center items-center p-10">
                <Loader2 className="mr-2 h-5 w-5 animate-spin"/>
                {isLoadingConfig ? "Chargement des configurations d'équipement..." : "Chargement des relevés..."}
            </div>
        ) : !selectedEquipmentId ? (
             <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
                <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                    {equipmentList.length === 0 ? "Aucun équipement n'est configuré." : "Veuillez sélectionner un équipement pour afficher la grille."}
                </p>
                 {equipmentList.length === 0 && <p className="text-xs text-muted-foreground/70">Configurez les équipements dans Paramètres &gt; Paramètres PMS.</p>}
            </div>
        ) : (
          <div className="overflow-x-auto border rounded-md">
            <Table className="min-w-max border-collapse">
              <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                <TableRow>
                  <TableHead className="w-[180px] min-w-[180px] sticky left-0 z-20 bg-card text-xs p-1 text-center border-r">T°C / Zone</TableHead>
                  {monthDays.map(day => (
                    <TableHead key={day.date} className={cn("w-[40px] min-w-[40px] text-center text-xs p-1 border-r", day.isWeekend && "bg-muted/50")}>
                      {day.dayOfMonth}<br/>{day.dayName.substring(0,3)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {TEMPERATURE_ROWS.map(temp => {
                  const zoneInfo = getEquipmentZoneInfo(temp, selectedEquipmentConfig);
                  return (
                    <TableRow key={temp}>
                      <TableCell className={cn(
                          "sticky left-0 z-10 font-medium text-xs p-1 text-center border-r h-8", 
                          zoneInfo.colorClass 
                        )}>
                        <div className="flex items-center justify-center h-full">
                          {temp}°C {zoneInfo.label && `- ${zoneInfo.label}`}
                        </div>
                      </TableCell>
                      {monthDays.map(day => {
                        const dayRecord = records[day.date] || { markedTemp: null, time: '', operator: '' };
                        const isSelected = dayRecord.markedTemp === temp;
                        return (
                          <TableCell
                            key={`${day.date}-${temp}`}
                            className={cn(
                              "w-[40px] h-8 p-0 text-center cursor-pointer border-r",
                              zoneInfo.colorClass, 
                              day.isWeekend && "opacity-70 cursor-not-allowed",
                              isSelected && "ring-2 ring-primary ring-inset"
                            )}
                            onClick={() => !day.isWeekend && !isSaving && handleCellClick(day.date, temp)}
                          >
                            {isSelected && <Check className="h-4 w-4 mx-auto text-foreground" />}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/20">
                  <TableCell className="sticky left-0 z-10 font-semibold text-xs p-1 text-center border-r bg-muted/20">Heure</TableCell>
                  {monthDays.map(day => (
                    <TableCell key={`time-${day.date}`} className="p-0.5 border-r">
                      <Input
                        type="time"
                        value={records[day.date]?.time || ""}
                        onChange={e => handleInputChange(day.date, 'time', e.target.value)}
                        className="h-7 text-xs w-full text-center bg-background/50 focus:bg-background"
                        disabled={day.isWeekend || isSaving}
                      />
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow className="bg-muted/20">
                  <TableCell className="sticky left-0 z-10 font-semibold text-xs p-1 text-center border-r bg-muted/20">Personnel</TableCell>
                  {monthDays.map(day => (
                    <TableCell key={`operator-${day.date}`} className="p-0.5 border-r">
                      <Input
                        type="text"
                        placeholder="Op."
                        value={records[day.date]?.operator || ""}
                        onChange={e => handleInputChange(day.date, 'operator', e.target.value)}
                        className="h-7 text-xs w-full text-center bg-background/50 focus:bg-background"
                        disabled={day.isWeekend || isSaving}
                        maxLength={5}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
        {selectedEquipmentId && !isLoadingConfig && !isLoadingRecords && (
            <div className="mt-4 flex justify-end">
                <Button variant="destructive" onClick={handleClearMonthData} size="sm" disabled={isSaving || Object.keys(records).length === 0}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4"/>}
                    Effacer Relevés ({selectedEquipmentConfig?.name || 'Mois'})
                </Button>
            </div>
        )}
      </CardContent>
    </Card>
  );
}

