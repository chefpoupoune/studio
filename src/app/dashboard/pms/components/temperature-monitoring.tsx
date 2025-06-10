
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, FileText, Trash2, Thermometer as ThermometerIcon, AlertCircle, Check } from 'lucide-react'; // Added Check
import { useToast } from '@/hooks/use-toast';
import { format, getYear, getMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import type { PmsEquipmentDefinition, MonthlyTempGridLog, DailyTempGridLogEntry, PmsConfigurations } from '../types';
import { PMS_TEMPERATURE_MONITORING_KEY } from '@/app/dashboard/settings/types';
import { getMonthDays, type DayData } from '../utils';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox'; 
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

const TEMPERATURE_ROWS = Array.from({ length: 27 }, (_, i) => 16 - i); // 16 down to -10

const LOGGED_IN_USERNAME_KEY = 'loggedInUsername';

export default function TemperatureMonitoring() {
  const [selectedYear, setSelectedYear] = useState<string>(getYear(new Date()).toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(getMonth(new Date()).toString());
  
  const [equipmentList, setEquipmentList] = useState<PmsEquipmentDefinition[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | undefined>(undefined);
  
  const [monthDays, setMonthDays] = useState<DayData[]>([]);
  const [records, setRecords] = useState<MonthlyTempGridLog>({});
  
  const [isLoading, setIsLoading] = useState(true);
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

  // Load equipment configurations and then records
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      // Load equipment configurations
      const pmsSettingsDocRef = doc(firestore, "pmsConfigurations", "mainConfig");
      let fetchedEquipment: PmsEquipmentDefinition[] = [];
      try {
        const pmsSettingsSnap = await getDoc(pmsSettingsDocRef);
        if (pmsSettingsSnap.exists()) {
          const pmsSettings = pmsSettingsSnap.data() as PmsConfigurations;
          fetchedEquipment = (pmsSettings[PMS_TEMPERATURE_MONITORING_KEY] || []) as PmsEquipmentDefinition[];
          setEquipmentList(fetchedEquipment);
          if (fetchedEquipment.length > 0 && !selectedEquipmentId) {
            setSelectedEquipmentId(fetchedEquipment[0].id);
          } else if (fetchedEquipment.length === 0) {
            setSelectedEquipmentId(undefined);
          }
        } else {
          setEquipmentList([]);
          setSelectedEquipmentId(undefined);
          toast({ title: "Configuration Manquante", description: "Aucune configuration d'équipement de température trouvée.", variant: "destructive"});
        }
      } catch (error) {
        console.error("Error loading PMS equipment configurations:", error);
        toast({ title: "Erreur Config Équipement", variant: "destructive" });
        setEquipmentList([]);
        setSelectedEquipmentId(undefined);
      }

      // Update month days based on selectedYear and selectedMonth
      const yearNum = parseInt(selectedYear, 10);
      const monthNum = parseInt(selectedMonth, 10);
      setMonthDays(getMonthDays(yearNum, monthNum));
      
      setIsLoading(false); // Initial config load done
    };
    loadInitialData();
  }, [selectedYear, selectedMonth, toast]); // Removed selectedEquipmentId from deps to avoid loop

  // Load records when selectedEquipmentId, year, or month changes
  useEffect(() => {
    if (!selectedEquipmentId) {
      setRecords({}); // Clear records if no equipment selected
      setIsLoading(false);
      return;
    }
    const loadRecords = async () => {
      setIsLoading(true);
      const docId = getFirestoreDocId();
      if (!docId) { setIsLoading(false); return; }

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
      setIsLoading(false);
    };
    loadRecords();
  }, [selectedEquipmentId, selectedYear, selectedMonth, getFirestoreDocId, toast]);


  // Debounced save
  useEffect(() => {
    if (isLoading || isSaving || !selectedEquipmentId) return;

    const saveRecords = async () => {
      const docId = getFirestoreDocId();
      if (!docId || Object.keys(records).length === 0 && !doc(firestore, "pmsTemperatureGridLogs", docId)) return;
      
      setIsSaving(true);
      const recordsDocRef = doc(firestore, "pmsTemperatureGridLogs", docId);
      try {
        await setDoc(recordsDocRef, records);
        // toast({ title: "Sauvegarde Auto", description: "Modifications enregistrées." });
      } catch (error) {
        console.error("Error auto-saving temperature grid records:", error);
        toast({ title: "Erreur Sauvegarde Auto", variant: "destructive" });
      }
      setIsSaving(false);
    };
    const timeoutId = setTimeout(saveRecords, 2000);
    return () => clearTimeout(timeoutId);
  }, [records, isLoading, isSaving, selectedEquipmentId, getFirestoreDocId, toast]);

  const selectedEquipmentConfig = useMemo(() => {
    return equipmentList.find(eq => eq.id === selectedEquipmentId);
  }, [selectedEquipmentId, equipmentList]);

  const getCellColorClass = (temp: number): string => {
    if (!selectedEquipmentConfig) return 'bg-background hover:bg-muted/50';

    const { targetTempMin, targetTempMax, tolerance1TempMin, tolerance1TempMax } = selectedEquipmentConfig;

    // Zone Cible (Vert)
    if (targetTempMin !== undefined && targetTempMax !== undefined && temp >= targetTempMin && temp <= targetTempMax) {
      return 'bg-green-200 dark:bg-green-700 hover:bg-green-300 dark:hover:bg-green-600';
    }
    // Zone Tolérance (Bleu) - based on image: 0 to -4 AND 5 to 9 for frigo positif
    // This simplified logic uses tolerance1 as a single band around target.
    // To precisely match the image, PmsEquipmentDefinition would need more complex range fields.
    // For now, we use the values from the image for "Frigo Positif" as reference.
    if (selectedEquipmentConfig.name.toLowerCase().includes("frigo positif") || selectedEquipmentConfig.name.toLowerCase().includes("réfrigérateur")) {
        if ((temp >= 0 && temp < 1) || (temp > 4 && temp <= 9)) { // Approximation of blue zones from image
             return 'bg-blue-200 dark:bg-blue-700 hover:bg-blue-300 dark:hover:bg-blue-600';
        }
        if (temp < 0 || temp > 9) { // Approximation of red zones
            return 'bg-red-200 dark:bg-red-700 hover:bg-red-300 dark:hover:bg-red-600';
        }
    } else if (selectedEquipmentConfig.equipmentType === 'freezer') { // Example for freezer
        if (temp >= -18 && temp <= -15) return 'bg-green-200 dark:bg-green-700 hover:bg-green-300 dark:hover:bg-green-600'; // Target
        if ((temp > -15 && temp <= -12) || (temp < -18 && temp >= -22)) return 'bg-blue-200 dark:bg-blue-700 hover:bg-blue-300 dark:hover:bg-blue-600'; // Tolerance
        return 'bg-red-200 dark:bg-red-700 hover:bg-red-300 dark:hover:bg-red-600'; // Rejection
    }

    // Fallback for general equipment based on config if available
    if (tolerance1TempMin !== undefined && tolerance1TempMax !== undefined && temp >= tolerance1TempMin && temp <= tolerance1TempMax) {
      return 'bg-blue-200 dark:bg-blue-700 hover:bg-blue-300 dark:hover:bg-blue-600';
    }
    // Zone Rejet (Rouge)
    return 'bg-red-200 dark:bg-red-700 hover:bg-red-300 dark:hover:bg-red-600';
  };

  const handleCellClick = (dayDate: string, tempValue: number) => {
    setRecords(prev => {
      const dayRecord = prev[dayDate] || {};
      return {
        ...prev,
        [dayDate]: {
          ...dayRecord,
          markedTemp: dayRecord.markedTemp === tempValue ? null : tempValue,
        }
      };
    });
  };
  
  const handleInputChange = (dayDate: string, field: 'time' | 'operator', value: string) => {
     setRecords(prev => {
      const dayRecord = prev[dayDate] || {};
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
        await setDoc(docRef, {}); // Empty object to clear data
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
    // PDF generation logic will be complex and similar to the kitchen cleaning one,
    // but needs to render the grid with checks. This is a placeholder.
    toast({ title: "PDF Non Implémenté", description: "La génération PDF pour ce tableau est en cours de développement." });
  };

  const getZoneLabel = (temp: number): string => {
    // Hardcoded based on image for "Frigo Positif"
    if (temp >= 1 && temp <= 4) return "Zone Cible";
    if ((temp >= 0 && temp < 1) || (temp >= 5 && temp <= 9)) return "Zone de Tolérance";
    if ((temp >= -10 && temp < 0) || (temp >= 10 && temp <= 16)) return "Zone de Rejet";
    return "";
  };


  if (isLoading && equipmentList.length === 0) {
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
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end mb-4">
          <div>
            <Label htmlFor="equipment-select">Équipement</Label>
            <Select value={selectedEquipmentId} onValueChange={setSelectedEquipmentId} disabled={isLoading || isSaving || equipmentList.length === 0}>
              <SelectTrigger id="equipment-select"><SelectValue placeholder={equipmentList.length === 0 ? "Aucun équipement configuré" : "Sélectionner équipement"} /></SelectTrigger>
              <SelectContent>
                {equipmentList.map(eq => <SelectItem key={eq.id} value={eq.id}>{eq.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="year-select-temp">Année</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear} disabled={isLoading || isSaving}>
              <SelectTrigger id="year-select-temp"><SelectValue /></SelectTrigger>
              <SelectContent>{yearsArray.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="month-select-temp">Mois</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={isLoading || isSaving}>
              <SelectTrigger id="month-select-temp"><SelectValue /></SelectTrigger>
              <SelectContent>{monthsArray.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 md:col-span-1 md:justify-self-end">
            <Button onClick={generatePdf} disabled={isLoading || isSaving || !selectedEquipmentId} className="w-full sm:w-auto">
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Générer PDF
            </Button>
          </div>
        </div>

        {isLoading && selectedEquipmentId ? (
            <div className="flex justify-center items-center p-10"><Loader2 className="mr-2 h-5 w-5 animate-spin"/>Chargement des relevés...</div>
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
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead className="w-[100px] min-w-[100px] sticky left-0 z-20 bg-card text-xs p-1 text-center border-r">T°C / Zone</TableHead>
                  {monthDays.map(day => (
                    <TableHead key={day.date} className={cn("w-[40px] min-w-[40px] text-center text-xs p-1 border-r", day.isWeekend && "bg-muted/50")}>
                      {day.dayOfMonth}<br/>{day.dayName.substring(0,3)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {TEMPERATURE_ROWS.map(temp => (
                  <TableRow key={temp}>
                    <TableCell className={cn(
                        "sticky left-0 z-10 font-medium text-xs p-1 text-center border-r h-8", 
                        getCellColorClass(temp)
                      )}>
                      <div className="flex items-center justify-center h-full">
                        {temp}°C
                        {temp === 16 && <span className="text-[0.6rem] ml-1 leading-tight">Zone Rejet</span>}
                        {temp === 9 && <span className="text-[0.6rem] ml-1 leading-tight">Zone Tol.</span>}
                        {temp === 4 && <span className="text-[0.6rem] ml-1 leading-tight">Zone Cible</span>}
                        {temp === 0 && <span className="text-[0.6rem] ml-1 leading-tight">Zone Tol.</span>}
                        {temp === -5 && <span className="text-[0.6rem] ml-1 leading-tight">Zone Rejet</span>}
                      </div>
                    </TableCell>
                    {monthDays.map(day => {
                      const dayRecord = records[day.date] || {};
                      const isSelected = dayRecord.markedTemp === temp;
                      return (
                        <TableCell
                          key={`${day.date}-${temp}`}
                          className={cn(
                            "w-[40px] h-8 p-0 text-center cursor-pointer border-r",
                            getCellColorClass(temp),
                            day.isWeekend && "opacity-70 cursor-not-allowed",
                            isSelected && "ring-2 ring-primary ring-inset"
                          )}
                          onClick={() => !day.isWeekend && handleCellClick(day.date, temp)}
                        >
                          {isSelected && <Check className="h-4 w-4 mx-auto text-foreground" />}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
                {/* Heure Row */}
                <TableRow className="bg-muted/20">
                  <TableCell className="sticky left-0 z-10 font-semibold text-xs p-1 text-center border-r bg-muted/20">Heure</TableCell>
                  {monthDays.map(day => (
                    <TableCell key={`time-${day.date}`} className="p-0.5 border-r">
                      <Input
                        type="time"
                        value={records[day.date]?.time || ""}
                        onChange={e => handleInputChange(day.date, 'time', e.target.value)}
                        className="h-7 text-xs w-full text-center"
                        disabled={day.isWeekend || isSaving}
                      />
                    </TableCell>
                  ))}
                </TableRow>
                {/* Personnel Row */}
                <TableRow className="bg-muted/20">
                  <TableCell className="sticky left-0 z-10 font-semibold text-xs p-1 text-center border-r bg-muted/20">Personnel</TableCell>
                  {monthDays.map(day => (
                    <TableCell key={`operator-${day.date}`} className="p-0.5 border-r">
                      <Input
                        type="text"
                        placeholder="Initiales"
                        value={(records[day.date]?.operator || (loggedInUsername && records[day.date]?.markedTemp ? loggedInUsername.substring(0,3).toUpperCase() : ""))}
                        onChange={e => handleInputChange(day.date, 'operator', e.target.value)}
                        className="h-7 text-xs w-full text-center"
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
        {selectedEquipmentId && !isLoading && (
            <div className="mt-4 flex justify-end">
                <Button variant="destructive" onClick={handleClearMonthData} size="sm" disabled={isSaving || Object.keys(records).length === 0}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4"/>}
                    Effacer Relevés du Mois ({selectedEquipmentConfig?.name})
                </Button>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
