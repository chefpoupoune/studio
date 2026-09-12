
"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, UtensilsCrossed, WashingMachine, CookingPot, Archive, Thermometer, ShoppingBasket } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';

// **NOUVEAU GÉNÉRATEUR**
import { generateCombinedCleaningPlanPdfs } from '../../utils/pmsCombinedCleaningPdfGenerator';

// Autres générateurs de rapports
import { generateTemperatureMonitoringPdf } from '../../../pms/utils/pmsPdfGenerators';
import { generateFryingOilsPdf } from '../../utils/pmsFryingOilsPdfGenerator'; 
import { generateDefrostingMonitoringPdf } from '../../utils/pmsDefrostingPdfGenerator';
import { generateTraceabilityPdf } from '../../utils/pmsTraceabilityPdfGenerator';
import { generateEquipmentTemperatureArchive } from '../../../pms/utils/pmsEquipmentPdfGenerator';
import { generateTempChangeMonitoringPdfForMonth } from '../../../pms/utils/pmsTempChangePdfGenerator';
import { generatePicnicDepartureArchive } from '../../utils/pmsPicnicDeparturePdfGenerator';

// Types
import type { ReceptionEntry, DefrostingEntry } from '../../../pms/types';

interface CloturePmsProps {
  selectedDate: Date;
}

const CloturePms: React.FC<CloturePmsProps> = ({ selectedDate }) => {
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const { toast } = useToast();

  const year = selectedDate.getFullYear().toString();
  const monthLabel = format(selectedDate, "MMMM", { locale: fr });
  const formattedMonth = format(selectedDate, "MMMM yyyy", { locale: fr });

  const getDefrostingEntries = async (date: Date): Promise<DefrostingEntry[]> => {
      const startOfMonth = Timestamp.fromDate(new Date(date.getFullYear(), date.getMonth(), 1));
      const endOfMonth = Timestamp.fromDate(new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59));
      const q = query(collection(firestore, "pmsDefrostingLog"), where("defrostStartDate", ">=", startOfMonth), where("defrostStartDate", "<=", endOfMonth), orderBy("defrostStartDate", "asc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => {
          const data = doc.data();
          return {
              id: doc.id,
              ...data,
              defrostStartDate: (data.defrostStartDate as Timestamp).toDate().toISOString(),
              useDate: data.useDate ? (data.useDate as Timestamp).toDate().toISOString() : null,
          } as DefrostingEntry;
      });
  };

  const getTraceabilityEntries = async (date: Date): Promise<ReceptionEntry[]> => {
      const startOfMonth = Timestamp.fromDate(new Date(date.getFullYear(), date.getMonth(), 1));
      const endOfMonth = Timestamp.fromDate(new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59));
      const q = query(collection(firestore, "pmsReceptionLog"), where("dateTime", ">=", startOfMonth), where("dateTime", "<=", endOfMonth), orderBy("dateTime", "asc"));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
              id: docSnap.id,
              ...data,
              dateTime: (data.dateTime as Timestamp).toDate().toISOString(),
          } as ReceptionEntry;
      });
  };

  const generateTemperaturesArchive = async (date: Date): Promise<Blob | null> => {
    const zip = new JSZip();
    let hasContent = false;
    const equipmentTempBlob = await generateEquipmentTemperatureArchive(date);
    if (equipmentTempBlob) {
        zip.file(`1 - Relevés Températures Équipements.zip`, equipmentTempBlob);
        hasContent = true;
    }
    const tempChangeBlob = await generateTempChangeMonitoringPdfForMonth(date);
    if (tempChangeBlob) {
        zip.file(`2 - Suivi Baisse et Remise en Température.pdf`, tempChangeBlob);
        hasContent = true;
    }
    const serviceTempBlob = await generateTemperatureMonitoringPdf(date);
    if (serviceTempBlob) {
        zip.file(`3 - Suivi des températures de service (menus).pdf`, serviceTempBlob);
        hasContent = true;
    }
    const defrostingEntries = await getDefrostingEntries(date);
    const defrostingBlob = await generateDefrostingMonitoringPdf(defrostingEntries, date);
    if (defrostingBlob) {
        zip.file(`4 - Suivi de décongélation.pdf`, defrostingBlob);
        hasContent = true;
    }
    if (!hasContent) return null;
    return zip.generateAsync({ type: "blob" });
  };

  const handleGenerateSingleReport = async (pdfType: string, pdfName: string) => {
    setIsGenerating(pdfType);
    try {
        let blob: Blob | null = null;
        let filename: string = '';

        switch (pdfType) {
            case 'temperatures_archive':
                blob = await generateTemperaturesArchive(selectedDate);
                filename = `1 - Suivi des Températures - ${monthLabel} ${year}.zip`;
                break;
            case 'fryer_oil':
                blob = await generateFryingOilsPdf(selectedDate);
                filename = `2 - Suivi des Huiles de Friture - ${monthLabel} ${year}.pdf`;
                break;
            case 'picnic_departure':
                blob = await generatePicnicDepartureArchive(selectedDate);
                filename = `3 - Suivi des Paniers-Repas (PN) - ${monthLabel} ${year}.zip`;
                break;
            case 'cleaning':
                // **APPEL AU NOUVEAU GÉNÉRATEUR**
                blob = await generateCombinedCleaningPlanPdfs(selectedDate);
                filename = `4 - Plan de Nettoyage - ${monthLabel} ${year}.zip`;
                break;
            case 'reception':
                const traceabilityEntries = await getTraceabilityEntries(selectedDate);
                blob = await generateTraceabilityPdf(traceabilityEntries, selectedDate);
                filename = `6 - Suivi de Réception - ${monthLabel} ${year}.pdf`;
                break;
        }

        if (blob) {
            saveAs(blob, filename);
            toast({ title: "Rapport généré !", description: `Le fichier ${filename} a été téléchargé.` });
        } else {
            toast({ title: "Aucune donnée à exporter pour ce rapport.", variant: "default" });
        }

    } catch (error: any) {
        console.error(`Erreur lors de la génération du rapport ${pdfName}:`, error);
        toast({ title: "Erreur de Génération", description: error.message, variant: "destructive" });
    } finally {
        setIsGenerating(null);
    }
  };
  
  const handleGenerateAll = async () => {
    setIsGenerating('all');
    toast({ title: "Génération globale en cours...", description: "La préparation des fichiers peut prendre un moment." });
    try {
        const mainZip = new JSZip();
        const mainFolderName = `Cloture_PMS_${monthLabel}_${year}`;
        const mainFolder = mainZip.folder(mainFolderName);
        if (!mainFolder) throw new Error("Impossible de créer le dossier ZIP principal.");

        const tempArchiveBlob = await generateTemperaturesArchive(selectedDate);
        if (tempArchiveBlob) mainFolder.file(`1 - Suivi des Températures.zip`, tempArchiveBlob);

        const oilsBlob = await generateFryingOilsPdf(selectedDate);
        if (oilsBlob) mainFolder.file(`2 - Suivi des Huiles de Friture.pdf`, oilsBlob);
        
        const picnicBlob = await generatePicnicDepartureArchive(selectedDate);
        if (picnicBlob) mainFolder.file(`3 - Suivi des Paniers-Repas (PN).zip`, picnicBlob);

        // **APPEL AU NOUVEAU GÉNÉRATEUR**
        const cleaningBlob = await generateCombinedCleaningPlanPdfs(selectedDate);
        if (cleaningBlob) mainFolder.file(`4 - Plan de Nettoyage.zip`, cleaningBlob);

        const receptionEntries = await getTraceabilityEntries(selectedDate);
        const receptionBlob = await generateTraceabilityPdf(receptionEntries, selectedDate);
        if (receptionBlob) mainFolder.file(`6 - Suivi de Réception.pdf`, receptionBlob);

        const mainZipBlob = await mainZip.generateAsync({ type: "blob" });
        saveAs(mainZipBlob, `${mainFolderName}.zip`);
        toast({ title: "Archive Globale Générée !", description: "Le ZIP contenant tous les rapports a été téléchargé." });

    } catch(error: any) {
        console.error("Erreur (archive globale):", error);
        toast({ title: "Erreur de l'archive globale", description: error.message, variant: "destructive" });
    } finally {
        setIsGenerating(null);
    }
  }

  const pmsReports = [
    { id: 'temperatures_archive', label: 'Suivi des Températures (ZIP)', icon: <Thermometer className="mr-2 h-4 w-4" />, order: 1 },
    { id: 'fryer_oil', label: 'Suivi des Huiles de Friture', icon: <CookingPot className="mr-2 h-4 w-4" />, order: 2 },
    { id: 'picnic_departure', label: 'Suivi des Paniers-Repas (PN)', icon: <ShoppingBasket className="mr-2 h-4 w-4" />, order: 3 },
    { id: 'cleaning', label: 'Plan de Nettoyage', icon: <WashingMachine className="mr-2 h-4 w-4" />, order: 4 },
    { id: 'reception', label: 'Suivi de Réception', icon: <UtensilsCrossed className="mr-2 h-4 w-4" />, order: 6 },
  ];

  return (
    <Card>
        <div className="bg-muted/30 px-6 py-5 border-b border-border/80">
            <div className="flex justify-between items-start">
                <div>
                    <CardTitle className="text-xl font-semibold capitalize">
                        Clôture PMS de {formattedMonth}
                    </CardTitle>
                    <CardDescription className="mt-1 text-sm text-muted-foreground">
                        Générez et archivez ici tous les rapports mensuels du Plan de Maîtrise Sanitaire.
                    </CardDescription>
                </div>
                <Button onClick={handleGenerateAll} disabled={!!isGenerating} className="ml-4 whitespace-nowrap">
                    {isGenerating === 'all' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
                    Tout Générer (ZIP)
                </Button>
            </div>
        </div>
      <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pmsReports.sort((a, b) => a.order - b.order).map(report => (
          <Button
            key={report.id}
            variant="outline"
            onClick={() => handleGenerateSingleReport(report.id, report.label)}
            disabled={!!isGenerating}
            className="w-full justify-start text-left h-11"
          >
            {isGenerating === report.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (report.icon)}
            {report.label}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
};

export default CloturePms;
