
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, FileText, Thermometer, FilePlus, SprayCan, Sparkles, Truck, Flame, MapPin, Snowflake, Droplet, ThermometerSun } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { firestore } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { subMonths, getYear, getMonth, startOfMonth, endOfMonth, isValid, format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { 
  generateTemperatureMonitoringPdf, 
  generateCombinedTemperatureMonitoringPdf,
  generateKitchenCleaningPdf,
  generateCombinedKitchenCleaningPdf,
  generateRestaurantCleaningPdf,
  generateCombinedRestaurantCleaningPdf,
  generateReceptionMonitoringPdf,
  generateTempChangeMonitoringPdf,
  generatePicnicMonitoringPdf,
  generateDefrostingMonitoringPdf,
  generateFryerOilMonitoringPdf,
  generateColdChainMonitoringPdf
} from '../services/pdf-generators';
import type { 
  PmsEquipmentDefinition, 
  MonthlyTempGridLog,
  PmsZoneWithTasksDefinition,
  SimplifiedMonthlyCleaningRecord,
  ReceptionLogEntry,
  TempChangeLogEntry,
  PicnicLogEntry,
  DefrostingLogEntry,
  FryerOilLogEntry,
  ColdChainLogEntry
} from '../services/pdf-generators';
import { getPdfLayoutSettings } from '@/lib/pdf-settings';
import { PMS_TEMPERATURE_MONITORING_KEY, PMS_KITCHEN_CLEANING_KEY, PMS_RESTAURANT_CLEANING_KEY } from '@/app/dashboard/settings/types';
import type { PmsConfigurations } from '@/app/dashboard/settings/types';

const PmsReports = () => {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [temperatureEquipments, setTemperatureEquipments] = useState<PmsEquipmentDefinition[]>([]);
  const [kitchenCleaningZones, setKitchenCleaningZones] = useState<PmsZoneWithTasksDefinition[]>([]);
  const [restaurantCleaningZones, setRestaurantCleaningZones] = useState<PmsZoneWithTasksDefinition[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const pmsSettingsDocRef = doc(firestore, "pmsConfigurations", "mainConfig");
        const pmsSettingsSnap = await getDoc(pmsSettingsDocRef);
        if (pmsSettingsSnap.exists()) {
          const pmsConfigs = pmsSettingsSnap.data() as PmsConfigurations;
          setTemperatureEquipments(pmsConfigs[PMS_TEMPERATURE_MONITORING_KEY] || []);
          setKitchenCleaningZones(pmsConfigs[PMS_KITCHEN_CLEANING_KEY] || []);
          setRestaurantCleaningZones(pmsConfigs[PMS_RESTAURANT_CLEANING_KEY] || []);
        }
      } catch (error) {
        console.error("Erreur config PMS:", error);
        toast({ title: "Erreur de chargement", description: "Impossible de charger les configurations PMS.", variant: "destructive" });
      }
    };
    fetchConfigs();
  }, [toast]);

  const openPdfInNewTab = (pdfBlob: Blob) => {
    window.open(URL.createObjectURL(pdfBlob), '_blank');
  };

  const getMonthYear = () => {
    const lastMonth = subMonths(new Date(), 1);
    const year = getYear(lastMonth);
    const monthNum = getMonth(lastMonth);
    const monthName = format(lastMonth, 'MMMM', { locale: fr });
    return { year, monthNum, monthName: monthName.charAt(0).toUpperCase() + monthName.slice(1) };
  };

  const handleGenerateTempPdf = async (equipment: PmsEquipmentDefinition) => {
    setIsLoading(equipment.id);
    try {
      const { year, monthNum, monthName } = getMonthYear();
      const docId = `temp-log_${year}-${String(monthNum + 1).padStart(2, '0')}_${equipment.id}`;
      const docRef = doc(firestore, "pmsTemperatureLog", docId);
      const docSnap = await getDoc(docRef);

      const logData: MonthlyTempGridLog = docSnap.exists() ? docSnap.data().log as MonthlyTempGridLog : {};
      
      const pdfBlob = await generateTemperatureMonitoringPdf(equipment.name, logData, String(year), monthName, getPdfLayoutSettings('pms_temperature_monitoring_monthly'));
      toast({ title: "PDF Généré", description: `Rapport pour ${equipment.name} créé.` });
      openPdfInNewTab(pdfBlob);
    } catch (e: any) {
      console.error("Erreur génération PDF température:", e);
      toast({ title: "Erreur Critique", description: "Impossible de générer le PDF.", variant: "destructive" });
    } finally {
      setIsLoading(null);
    }
  };

  const handleGenerateGlobalTempPdf = async () => {
    setIsLoading('global_temp');
    try {
      const { year, monthNum, monthName } = getMonthYear();
      const allLogs: { equipmentName: string, logData: MonthlyTempGridLog }[] = [];

      for (const equipment of temperatureEquipments) {
        const docId = `temp-log_${year}-${String(monthNum + 1).padStart(2, '0')}_${equipment.id}`;
        const docRef = doc(firestore, "pmsTemperatureLog", docId);
        const docSnap = await getDoc(docRef);
        allLogs.push({
          equipmentName: equipment.name,
          logData: docSnap.exists() ? docSnap.data().log as MonthlyTempGridLog : {}
        });
      }

      const pdfBlob = await generateCombinedTemperatureMonitoringPdf(allLogs, String(year), monthName, getPdfLayoutSettings('pms_temperature_monitoring_monthly'));
      toast({ title: "PDF Global Généré", description: `Rapport global des températures créé.` });
      openPdfInNewTab(pdfBlob);
    } catch (e: any) {
      console.error("Erreur PDF global température:", e);
      toast({ title: "Erreur Critique", description: "Impossible de générer le PDF.", variant: "destructive" });
    } finally {
      setIsLoading(null);
    }
  };

  const fetchCleaningRecords = async (collectionName: string, year: number, month: number) => {
    const startDate = startOfMonth(new Date(year, month));
    const endDate = endOfMonth(new Date(year, month));
    const q = query(collection(firestore, collectionName), where("date", ">=", Timestamp.fromDate(startDate)), where("date", "<=", Timestamp.fromDate(endDate)));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(d => {
      const data = d.data();
      return {
        ...data,
        id: d.id,
        date: (data.date as Timestamp).toDate().toISOString()
      } as SimplifiedMonthlyCleaningRecord;
    });
  };

  const handleGenerateKitchenCleaningPdf = async (zone: PmsZoneWithTasksDefinition) => {
    setIsLoading(zone.id);
    try {
      const { year, monthNum, monthName } = getMonthYear();
      const records = await fetchCleaningRecords("pmsKitchenCleaningLog", year, monthNum);
      const pdfBlob = await generateKitchenCleaningPdf(zone, records, String(year), monthName, getPdfLayoutSettings('pms_kitchen_cleaning_monthly'));
      toast({ title: "PDF Généré", description: `Rapport de nettoyage pour ${zone.name} créé.` });
      openPdfInNewTab(pdfBlob);
    } catch (e: any) {
      console.error("Erreur PDF nettoyage cuisine:", e);
      toast({ title: "Erreur Critique", description: "Impossible de générer le PDF.", variant: "destructive" });
    } finally {
      setIsLoading(null);
    }
  };

  const handleGenerateGlobalKitchenCleaningPdf = async () => {
    setIsLoading('global_kitchen_cleaning');
    try {
      const { year, monthNum, monthName } = getMonthYear();
      const records = await fetchCleaningRecords("pmsKitchenCleaningLog", year, monthNum);
      const pdfBlob = await generateCombinedKitchenCleaningPdf(kitchenCleaningZones, records, String(year), monthName, getPdfLayoutSettings('pms_kitchen_cleaning_monthly'));
      toast({ title: "PDF Global Généré", description: "Rapport global de nettoyage cuisine créé." });
      openPdfInNewTab(pdfBlob);
    } catch (e: any) {
      console.error("Erreur PDF global nettoyage cuisine:", e);
      toast({ title: "Erreur Critique", description: "Impossible de générer le PDF.", variant: "destructive" });
    } finally {
      setIsLoading(null);
    }
  };

  const handleGenerateRestaurantCleaningPdf = async (zone: PmsZoneWithTasksDefinition) => {
    setIsLoading(zone.id);
    try {
      const { year, monthNum, monthName } = getMonthYear();
      const records = await fetchCleaningRecords("pmsRestaurantCleaningLog", year, monthNum);
      const pdfBlob = await generateRestaurantCleaningPdf(zone, records, String(year), monthName, getPdfLayoutSettings('pms_restaurant_cleaning_monthly'));
      toast({ title: "PDF Généré", description: `Rapport de nettoyage pour ${zone.name} créé.` });
      openPdfInNewTab(pdfBlob);
    } catch (e: any) {
      console.error("Erreur PDF nettoyage restaurant:", e);
      toast({ title: "Erreur Critique", description: "Impossible de générer le PDF.", variant: "destructive" });
    } finally {
      setIsLoading(null);
    }
  };

  const handleGenerateGlobalRestaurantCleaningPdf = async () => {
    setIsLoading('global_restaurant_cleaning');
    try {
      const { year, monthNum, monthName } = getMonthYear();
      const records = await fetchCleaningRecords("pmsRestaurantCleaningLog", year, monthNum);
      const pdfBlob = await generateCombinedRestaurantCleaningPdf(restaurantCleaningZones, records, String(year), monthName, getPdfLayoutSettings('pms_restaurant_cleaning_monthly'));
      toast({ title: "PDF Global Généré", description: "Rapport global de nettoyage restaurant créé." });
      openPdfInNewTab(pdfBlob);
    } catch (e: any) {
      console.error("Erreur PDF global nettoyage restaurant:", e);
      toast({ title: "Erreur Critique", description: "Impossible de générer le PDF.", variant: "destructive" });
    } finally {
      setIsLoading(null);
    }
  };

  const handleGenerateReceptionReport = async () => {
    setIsLoading('reception');
    try {
      const { year, monthNum } = getMonthYear();
      const startDate = startOfMonth(new Date(year, monthNum));
      const endDate = endOfMonth(new Date(year, monthNum));
      const q = query(collection(firestore, "pmsReceptionLog"), where("receptionDate", ">=", Timestamp.fromDate(startDate)), where("receptionDate", "<=", Timestamp.fromDate(endDate)));
      const querySnapshot = await getDocs(q);
      const entries: ReceptionLogEntry[] = querySnapshot.docs.map(d => {
        const data = d.data();
        const receptionDate = data.receptionDate instanceof Timestamp ? data.receptionDate.toDate() : new Date();
        return {
          id: d.id,
          receptionDate: isValid(receptionDate) ? receptionDate.toISOString() : '',
          supplier: data.supplier || 'N/A',
          product: data.product || 'N/A',
          temperature: data.temperature,
          compliance: data.compliance || 'N/A',
          operator: data.operator || 'N/A',
        } as ReceptionLogEntry;
      });
      const pdfBlob = await generateReceptionMonitoringPdf(entries, String(year), String(monthNum + 1), getPdfLayoutSettings('pms_reception_monitoring_monthly'));
      toast({ title: entries.length > 0 ? "PDF Généré" : "Rapport Généré (Vide)", description: `Rapport des réceptions créé avec ${entries.length} entrée(s).` });
      openPdfInNewTab(pdfBlob);
    } catch (e: any) {
      console.error("Erreur génération rapport réceptions:", e);
      toast({ title: "Erreur Critique", description: "Impossible de générer le PDF.", variant: "destructive" });
    } finally { setIsLoading(null); }
  };

  const handleGenerateTempChangeReport = async () => {
    setIsLoading('temp_change');
    try {
      const { year, monthNum } = getMonthYear();
      const startDate = startOfMonth(new Date(year, monthNum));
      const endDate = endOfMonth(new Date(year, monthNum));
      const q = query(collection(firestore, "pmsTempChangeLog"), where("date", ">=", Timestamp.fromDate(startDate)), where("date", "<=", Timestamp.fromDate(endDate)));
      const querySnapshot = await getDocs(q);
      const entries: TempChangeLogEntry[] = querySnapshot.docs.map(d => {
        const data = d.data();
        return { ...data, id: d.id, date: (data.date as Timestamp).toDate().toISOString() } as TempChangeLogEntry;
      });
      const pdfBlob = await generateTempChangeMonitoringPdf(entries, String(year), String(monthNum + 1), getPdfLayoutSettings('pms_temp_change_monitoring_monthly'));
      toast({ title: entries.length > 0 ? "PDF Généré" : "Rapport Généré (Vide)", description: `Rapport de changement de température créé avec ${entries.length} entrée(s).` });
      openPdfInNewTab(pdfBlob);
    } catch (e: any) {
      console.error("Erreur génération rapport changement de température:", e);
      toast({ title: "Erreur Critique", description: "Impossible de générer le PDF.", variant: "destructive" });
    } finally { setIsLoading(null); }
  };

  const handleGeneratePicnicReport = async () => {
    setIsLoading('picnic');
    try {
      const { year, monthNum } = getMonthYear();
      const startDate = startOfMonth(new Date(year, monthNum));
      const endDate = endOfMonth(new Date(year, monthNum));
      const q = query(collection(firestore, "pmsPicnicLog"), where("departureDate", ">=", Timestamp.fromDate(startDate)), where("departureDate", "<=", Timestamp.fromDate(endDate)));
      const querySnapshot = await getDocs(q);
      const entries: PicnicLogEntry[] = querySnapshot.docs.map(d => {
        const data = d.data();
        return { ...data, id: d.id, departureDate: (data.departureDate as Timestamp).toDate().toISOString() } as PicnicLogEntry;
      });
      const pdfBlob = await generatePicnicMonitoringPdf(entries, String(year), String(monthNum + 1), getPdfLayoutSettings('pms_picnic_monitoring_monthly'));
      toast({ title: entries.length > 0 ? "PDF Généré" : "Rapport Généré (Vide)", description: `Rapport des pique-niques créé avec ${entries.length} entrée(s).` });
      openPdfInNewTab(pdfBlob);
    } catch (e: any) {
      console.error("Erreur génération rapport pique-nique:", e);
      toast({ title: "Erreur Critique", description: "Impossible de générer le PDF.", variant: "destructive" });
    } finally { setIsLoading(null); }
  };

  const handleGenerateDefrostingReport = async () => {
    setIsLoading('defrosting');
    try {
      const { year, monthNum } = getMonthYear();
      const startDate = startOfMonth(new Date(year, monthNum));
      const endDate = endOfMonth(new Date(year, monthNum));
      const q = query(collection(firestore, "pmsDefrostingLog"), where("startDate", ">=", Timestamp.fromDate(startDate)), where("startDate", "<=", Timestamp.fromDate(endDate)));
      const querySnapshot = await getDocs(q);
      const entries: DefrostingLogEntry[] = querySnapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          productName: data.productName || 'N/A',
          startDate: (data.startDate as Timestamp)?.toDate().toISOString() || '',
          endDate: (data.endDate as Timestamp)?.toDate().toISOString() || '',
          operator: data.operator || 'N/A',
        } as DefrostingLogEntry;
      });
      const pdfBlob = await generateDefrostingMonitoringPdf(entries, String(year), String(monthNum + 1), getPdfLayoutSettings('pms_defrosting_monitoring_monthly'));
      toast({ title: entries.length > 0 ? "PDF Généré" : "Rapport Généré (Vide)", description: `Rapport de décongélation créé avec ${entries.length} entrée(s).` });
      openPdfInNewTab(pdfBlob);
    } catch (e: any) {
      console.error("Erreur génération rapport décongélation:", e);
      toast({ title: "Erreur Critique", description: "Impossible de générer le PDF.", variant: "destructive" });
    } finally { setIsLoading(null); }
  };
  
  const handleGenerateFryerOilReport = async () => {
    setIsLoading('fryer_oil');
    try {
      const { year, monthNum } = getMonthYear();
      const startDate = startOfMonth(new Date(year, monthNum));
      const endDate = endOfMonth(new Date(year, monthNum));
      const q = query(collection(firestore, "pmsFryerOilLog"), where("date", ">=", Timestamp.fromDate(startDate)), where("date", "<=", Timestamp.fromDate(endDate)));
      const querySnapshot = await getDocs(q);
      const entries: FryerOilLogEntry[] = querySnapshot.docs.map(d => {
        const data = d.data();
        return { ...data, id: d.id, date: (data.date as Timestamp).toDate().toISOString() } as FryerOilLogEntry;
      });
      const pdfBlob = await generateFryerOilMonitoringPdf(entries, String(year), String(monthNum + 1), getPdfLayoutSettings('pms_fryer_oil_monitoring_monthly'));
      toast({ title: entries.length > 0 ? "PDF Généré" : "Rapport Généré (Vide)", description: `Rapport huiles de friture créé avec ${entries.length} entrée(s).` });
      openPdfInNewTab(pdfBlob);
    } catch (e: any) {
      console.error("Erreur génération rapport huiles:", e);
      toast({ title: "Erreur Critique", description: "Impossible de générer le PDF.", variant: "destructive" });
    } finally { setIsLoading(null); }
  };

  const handleGenerateColdChainReport = async () => {
    setIsLoading('cold_chain');
    try {
      const { year, monthNum } = getMonthYear();
      const startDate = startOfMonth(new Date(year, monthNum));
      const endDate = endOfMonth(new Date(year, monthNum));
      const q = query(collection(firestore, "pmsColdChainLog"), where("productionDate", ">=", Timestamp.fromDate(startDate)), where("productionDate", "<=", Timestamp.fromDate(endDate)));
      const querySnapshot = await getDocs(q);
      const entries: ColdChainLogEntry[] = querySnapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          productName: data.productName || 'N/A',
          productionDate: (data.productionDate as Timestamp)?.toDate().toISOString() || '',
          coolingEndDate: (data.coolingEndDate as Timestamp)?.toDate().toISOString() || '',
          labelingCompliance: data.labelingCompliance || 'N/A',
          operator: data.operator || 'N/A',
        } as ColdChainLogEntry;
      });

      const pdfBlob = await generateColdChainMonitoringPdf(entries, String(year), String(monthNum + 1), getPdfLayoutSettings('pms_cold_chain_monitoring_monthly'));
      toast({ title: entries.length > 0 ? "PDF Généré" : "Rapport Généré (Vide)", description: `Rapport de liaison froide créé avec ${entries.length} entrée(s).` });
      openPdfInNewTab(pdfBlob);
    } catch (e: any) {
      console.error("Erreur génération rapport liaison froide:", e);
      toast({ title: "Erreur Critique", description: "Impossible de générer le PDF.", variant: "destructive" });
    } finally { setIsLoading(null); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rapports Mensuels / Administratif / Budget</CardTitle>
        <CardDescription>Générez les rapports PDF du mois précédent.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        <Card className="shadow-md">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center"><Thermometer className="mr-3 h-6 w-6 text-blue-500"/>Suivi des Températures</CardTitle>
            <Button onClick={handleGenerateGlobalTempPdf} disabled={!!isLoading || temperatureEquipments.length === 0} className="ml-4 whitespace-nowrap">
              <Loader2 className={isLoading === 'global_temp' ? 'mr-2 h-4 w-4 animate-spin' : 'hidden'} />
              <FilePlus className={isLoading === 'global_temp' ? 'hidden' : 'mr-2 h-4 w-4'}/>Générer Rapport Global
            </Button>
          </CardHeader>
          <CardContent>{temperatureEquipments.length > 0 ? <ul className="space-y-3 pt-4">{temperatureEquipments.map(e => (<li key={e.id} className="flex items-center justify-between p-3 bg-muted/40 rounded-lg"><span className="font-medium text-sm">{e.name}</span><Button onClick={() => handleGenerateTempPdf(e)} disabled={!!isLoading} className="w-32"><Loader2 className={isLoading === e.id ? 'mr-2 h-4 w-4 animate-spin' : 'hidden'} /><FileText className={isLoading === e.id ? 'hidden' : 'mr-2 h-4 w-4'} />Générer</Button></li>))}</ul> : <p className="text-sm text-muted-foreground text-center py-6">Aucun équipement configuré.</p>}</CardContent>
        </Card>

        <Card className="shadow-md">
            <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center"><SprayCan className="mr-3 h-6 w-6 text-green-500"/>Suivi Nettoyage Cuisine</CardTitle>
                <Button onClick={handleGenerateGlobalKitchenCleaningPdf} disabled={!!isLoading || kitchenCleaningZones.length === 0} className="ml-4 whitespace-nowrap">
                    <Loader2 className={isLoading === 'global_kitchen_cleaning' ? 'mr-2 h-4 w-4 animate-spin' : 'hidden'} /><FilePlus className={isLoading === 'global_kitchen_cleaning' ? 'hidden' : 'mr-2 h-4 w-4'}/>Générer Rapport Global
                </Button>
            </CardHeader>
            <CardContent>{kitchenCleaningZones.length > 0 ? <ul className="space-y-3 pt-4">{kitchenCleaningZones.map(z => (<li key={z.id} className="flex items-center justify-between p-3 bg-muted/40 rounded-lg"><span className="font-medium text-sm">{z.name}</span><Button onClick={() => handleGenerateKitchenCleaningPdf(z)} disabled={!!isLoading} className="w-32"><Loader2 className={isLoading === z.id ? 'mr-2 h-4 w-4 animate-spin' : 'hidden'} /><FileText className={isLoading === z.id ? 'hidden' : 'mr-2 h-4 w-4'} />Générer</Button></li>))}</ul> : <p className="text-sm text-muted-foreground text-center py-6">Aucune zone configurée.</p>}</CardContent>
        </Card>

        <Card className="shadow-md">
            <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center"><Sparkles className="mr-3 h-6 w-6 text-yellow-500"/>Suivi Nettoyage Restaurant</CardTitle>
                <Button onClick={handleGenerateGlobalRestaurantCleaningPdf} disabled={!!isLoading || restaurantCleaningZones.length === 0} className="ml-4 whitespace-nowrap">
                    <Loader2 className={isLoading === 'global_restaurant_cleaning' ? 'mr-2 h-4 w-4 animate-spin' : 'hidden'} /><FilePlus className={isLoading === 'global_restaurant_cleaning' ? 'hidden' : 'mr-2 h-4 w-4'}/>Générer Rapport Global
                </Button>
            </CardHeader>
            <CardContent>{restaurantCleaningZones.length > 0 ? <ul className="space-y-3 pt-4">{restaurantCleaningZones.map(z => (<li key={z.id} className="flex items-center justify-between p-3 bg-muted/40 rounded-lg"><span className="font-medium text-sm">{z.name}</span><Button onClick={() => handleGenerateRestaurantCleaningPdf(z)} disabled={!!isLoading} className="w-32"><Loader2 className={isLoading === z.id ? 'mr-2 h-4 w-4 animate-spin' : 'hidden'} /><FileText className={isLoading === z.id ? 'hidden' : 'mr-2 h-4 w-4'} />Générer</Button></li>))}</ul> : <p className="text-sm text-muted-foreground text-center py-6">Aucune zone configurée.</p>}</CardContent>
        </Card>

        <Card className="shadow-md">
            <CardHeader className="flex-row items-center justify-between">
                <div><CardTitle className="flex items-center"><Truck className="mr-3 h-6 w-6 text-purple-500"/>Suivi des Réceptions</CardTitle><CardDescription>Rapport mensuel de toutes les livraisons.</CardDescription></div>
                <Button onClick={handleGenerateReceptionReport} disabled={!!isLoading} className="ml-4 whitespace-nowrap">
                    <Loader2 className={isLoading === 'reception' ? 'mr-2 h-4 w-4 animate-spin' : 'hidden'} /><FileText className={isLoading === 'reception' ? 'hidden' : 'mr-2 h-4 w-4'} />Générer le Rapport
                </Button>
            </CardHeader>
        </Card>

        <Card className="shadow-md">
            <CardHeader className="flex-row items-center justify-between">
                <div><CardTitle className="flex items-center"><Flame className="mr-3 h-6 w-6 text-orange-500"/>Suivi Baisse et Remise en Température</CardTitle><CardDescription>Rapport sur les changements de température des plats.</CardDescription></div>
                <Button onClick={handleGenerateTempChangeReport} disabled={!!isLoading} className="ml-4 whitespace-nowrap">
                    <Loader2 className={isLoading === 'temp_change' ? 'mr-2 h-4 w-4 animate-spin' : 'hidden'} /><FileText className={isLoading === 'temp_change' ? 'hidden' : 'mr-2 h-4 w-4'} />Générer le Rapport
                </Button>
            </CardHeader>
        </Card>

        <Card className="shadow-md">
            <CardHeader className="flex-row items-center justify-between">
                <div><CardTitle className="flex items-center"><MapPin className="mr-3 h-6 w-6 text-teal-500"/>Suivi des Départs Pique-Nique</CardTitle><CardDescription>Rapport mensuel des paniers pique-nique.</CardDescription></div>
                <Button onClick={handleGeneratePicnicReport} disabled={!!isLoading} className="ml-4 whitespace-nowrap">
                    <Loader2 className={isLoading === 'picnic' ? 'mr-2 h-4 w-4 animate-spin' : 'hidden'} /><FileText className={isLoading === 'picnic' ? 'hidden' : 'mr-2 h-4 w-4'} />Générer le Rapport
                </Button>
            </CardHeader>
        </Card>

        <Card className="shadow-md">
            <CardHeader className="flex-row items-center justify-between">
                <div><CardTitle className="flex items-center"><Snowflake className="mr-3 h-6 w-6 text-cyan-500"/>Suivi de Décongélation</CardTitle><CardDescription>Rapport mensuel sur la décongélation des produits.</CardDescription></div>
                <Button onClick={handleGenerateDefrostingReport} disabled={!!isLoading} className="ml-4 whitespace-nowrap">
                    <Loader2 className={isLoading === 'defrosting' ? 'mr-2 h-4 w-4 animate-spin' : 'hidden'} /><FileText className={isLoading === 'defrosting' ? 'hidden' : 'mr-2 h-4 w-4'} />Générer le Rapport
                </Button>
            </CardHeader>
        </Card>

        <Card className="shadow-md">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center"><Droplet className="mr-3 h-6 w-6 text-amber-500"/>Suivi des Huiles de Friture</CardTitle>
              <CardDescription>Rapport mensuel sur le contrôle et le changement des huiles.</CardDescription>
            </div>
            <Button onClick={handleGenerateFryerOilReport} disabled={!!isLoading} className="ml-4 whitespace-nowrap">
              <Loader2 className={isLoading === 'fryer_oil' ? 'mr-2 h-4 w-4 animate-spin' : 'hidden'} />
              <FileText className={isLoading === 'fryer_oil' ? 'hidden' : 'mr-2 h-4 w-4'} />
              Générer le Rapport
            </Button>
          </CardHeader>
        </Card>

        <Card className="shadow-md">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center"><ThermometerSun className="mr-3 h-6 w-6 text-blue-400"/>Suivi de Liaison Froide</CardTitle>
              <CardDescription>Rapport mensuel sur le respect de la chaîne du froid.</CardDescription>
            </div>
            <Button onClick={handleGenerateColdChainReport} disabled={!!isLoading} className="ml-4 whitespace-nowrap">
              <Loader2 className={isLoading === 'cold_chain' ? 'mr-2 h-4 w-4 animate-spin' : 'hidden'} />
              <FileText className={isLoading === 'cold_chain' ? 'hidden' : 'mr-2 h-4 w-4'} />
              Générer le Rapport
            </Button>
          </CardHeader>
        </Card>

      </CardContent>
    </Card>
  );
};

export default PmsReports;
