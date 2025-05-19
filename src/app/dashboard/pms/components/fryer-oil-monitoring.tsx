
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, FileText, Trash2, AlertCircle, ListFilter, Droplet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, getYear, getMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import type { SimplifiedTaskRecord, SimplifiedMonthlyKitchenCleaningRecord as SimplifiedMonthlyFryerLog, PmsZoneWithTasksDefinition as PmsFryerDefinition } from '../types';
import { PMS_FRYER_OIL_MONITORING_KEY, PMS_CONFIG_STORAGE_KEY } from '@/app/dashboard/settings/types';
import { NO_STATUS_SELECT_VALUE } from '../types';
import { getMonthDays, type DayData } from '../utils';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const currentFullYear = new Date().getFullYear();
const yearsArray = Array.from({ length: 10 }, (_, i) => currentFullYear - 5 + i);
const monthsArray = Array.from({ length: 12 }, (_, i) => ({
  value: i.toString(),
  label: format(new Date(currentFullYear, i), "MMMM", { locale: fr }),
}));

export default function FryerOilMonitoring() {
  const [selectedYear, setSelectedYear] = useState<string>(getYear(new Date()).toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(getMonth(new Date()).toString());
  const [configuredFryers, setConfiguredFryers] = useState<PmsFryerDefinition[]>([]);
  const [selectedFryerId, setSelectedFryerId] = useState<string | undefined>(undefined);
  const [monthData, setMonthData] = useState<DayData[]>([]);
  const [oilRecords, setOilRecords] = useState<SimplifiedMonthlyFryerLog>({});
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const getLocalStorageKeyForRecords = useCallback(() => `pms_fryer_oil_records_v1_${selectedYear}_${selectedMonth}`, [selectedYear, selectedMonth]);

  useEffect(() => {
    setIsLoading(true);
    try {
      const pmsSettingsRaw = localStorage.getItem(PMS_CONFIG_STORAGE_KEY);
      if (pmsSettingsRaw) {
        const pmsSettings = JSON.parse(pmsSettingsRaw);
        const fryers = pmsSettings[PMS_FRYER_OIL_MONITORING_KEY] || [];
        setConfiguredFryers(fryers);
        if (!selectedFryerId && fryers.length > 0) {
          setSelectedFryerId(fryers[0].id);
        } else if (selectedFryerId && !fryers.find(f => f.id === selectedFryerId)) {
          setSelectedFryerId(fryers.length > 0 ? fryers[0].id : undefined);
        }
      } else {
        setConfiguredFryers([]);
        setSelectedFryerId(undefined);
      }
    } catch (error) {
      console.error("Error loading PMS configurations for fryers:", error);
      setConfiguredFryers([]);
      setSelectedFryerId(undefined);
    }

    const yearNum = parseInt(selectedYear, 10);
    const monthNum = parseInt(selectedMonth, 10);
    setMonthData(getMonthDays(yearNum, monthNum));

    try {
      const storedData = localStorage.getItem(getLocalStorageKeyForRecords());
      if (storedData) {
        setOilRecords(JSON.parse(storedData));
      } else {
        setOilRecords({});
      }
    } catch (error) {
      console.error("Error loading fryer oil records:", error);
      toast({ title: "Erreur de chargement", description: "Données de suivi des huiles corrompues.", variant: "destructive" });
      setOilRecords({});
    }
    setIsLoading(false);
  }, [selectedYear, selectedMonth, getLocalStorageKeyForRecords, toast, selectedFryerId]);

  useEffect(() => {
    if (!isLoading) {
        localStorage.setItem(getLocalStorageKeyForRecords(), JSON.stringify(oilRecords));
    }
  }, [oilRecords, isLoading, getLocalStorageKeyForRecords]);

  const handleRecordChange = (date: string, fryerId: string, taskId: string, field: keyof SimplifiedTaskRecord, value: string) => {
    const recordKey = `${date}_${fryerId}_${taskId}`;
    setOilRecords(prev => ({
      ...prev,
      [recordKey]: {
        ...(prev[recordKey] || { status: '', operator: '' }),
        [field]: value,
      }
    }));
  };
  
  const getRecord = (date: string, fryerId: string, taskId: string): SimplifiedTaskRecord => {
    const recordKey = `${date}_${fryerId}_${taskId}`;
    return oilRecords[recordKey] || { status: '', operator: '' };
  };

  const handleClearMonthData = () => {
    if (confirm(`Êtes-vous sûr de vouloir effacer toutes les données de suivi des huiles pour ${monthsArray[parseInt(selectedMonth)].label} ${selectedYear} ? Cette action est irréversible.`)) {
      setOilRecords({});
      localStorage.removeItem(getLocalStorageKeyForRecords());
      toast({ title: "Données Effacées", description: `Les données de suivi des huiles pour ${monthsArray[parseInt(selectedMonth)].label} ${selectedYear} ont été effacées.` });
    }
  };
  
  const selectedFryerData = useMemo(() => {
    return configuredFryers.find(fryer => fryer.id === selectedFryerId);
  }, [selectedFryerId, configuredFryers]);

  const generatePdfForFryer = () => {
    if (!selectedFryerData) {
      toast({ title: "Aucune Friteuse Sélectionnée", description: "Veuillez sélectionner une friteuse pour générer le PDF.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const pdfSettings = getPdfLayoutSettings('pms_fryer_oil_monthly'); // Potentially a new key for specific settings
      const doc = new jsPDF('landscape') as jsPDFWithAutoTable;
      const monthLabel = monthsArray.find(m => m.value === selectedMonth)?.label || '';
      const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });

      let currentY = 15;
      if (pdfSettings.headerText) { doc.setFontSize(10); doc.text(pdfSettings.headerText, 14, currentY); currentY += 10; }
      if (pdfSettings.logoUrl) { doc.setFontSize(8); doc.text(`Logo: ${pdfSettings.logoUrl}`, 14, currentY); currentY += 5; }
      
      const title = `Suivi Huiles Friteuse - ${selectedFryerData.name} - ${monthLabel} ${selectedYear}`;
      doc.setFontSize(18); doc.text(title, 14, currentY); currentY += 8;
      doc.setFontSize(10); doc.text(`Généré le: ${generationDateFormatted}`, 14, currentY); currentY += 7;

      const headStyles: { fillColor?: [number, number, number], textColor?: [number, number, number] } = {};
      if (pdfSettings.primaryColor) {
        const primaryColorRgb = hexToRgb(pdfSettings.primaryColor);
        if (primaryColorRgb) {
          headStyles.fillColor = primaryColorRgb;
          const brightness = (primaryColorRgb[0] * 299 + primaryColorRgb[1] * 587 + primaryColorRgb[2] * 114) / 1000;
          headStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
        }
      }
      
      const headBase = ['Date', 'Jour'];
      const taskHeaders: string[] = [];
      selectedFryerData.tasks.forEach(task => {
        taskHeaders.push(`Statut (${task.name})`);
        taskHeaders.push(`Opérateur (${task.name})`);
      });
      const head: any[] = [headBase.concat(taskHeaders)];
      
      const body: any[][] = [];
      monthData.forEach(day => {
        const row: any[] = [
          day.isWeekend ? {content: day.dayOfMonth.toString(), styles: {fillColor: [230,230,230]}} : day.dayOfMonth.toString(),
          day.isWeekend ? {content: day.dayName, styles: {fillColor: [230,230,230]}} : day.dayName,
        ];
        selectedFryerData.tasks.forEach(task => {
          const record = getRecord(day.date, selectedFryerData.id, task.id);
          let statusDisplay = '';
          // Add specific statuses for oil if needed, e.g., "OK", "Testeur > X%", "Changée"
          switch (record.status) {
            case 'fait': statusDisplay = 'Fait/OK'; break;
            case 'non_fait': statusDisplay = 'Non Fait/Contrôler'; break;
            case 'na': statusDisplay = 'N/A'; break;
            default: statusDisplay = '-';
          }
          row.push(day.isWeekend ? {content: statusDisplay, styles: {halign: 'center', fillColor: [230,230,230]}} : {content: statusDisplay, styles: {halign: 'center'}});
          row.push(day.isWeekend ? {content: record.operator || '-', styles: {halign: 'center', fillColor: [230,230,230]}} : {content: record.operator || '-', styles: {halign: 'center'}});
        });
        body.push(row);
      });

      const columnStyles: { [key: number]: { cellWidth: 'auto' | number, halign?: 'left' | 'center' | 'right' } } = {
        0: { cellWidth: 15, halign: 'center' }, 
        1: { cellWidth: 25 }, 
      };
      let currentColumnIndex = 2;
      selectedFryerData.tasks.forEach(() => {
        columnStyles[currentColumnIndex++] = { cellWidth: 30, halign: 'center' }; // Statut
        columnStyles[currentColumnIndex++] = { cellWidth: 30, halign: 'center' }; // Opérateur
      });

      doc.autoTable({
        startY: currentY,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { ...headStyles, halign: 'center', fontSize: 8, cellPadding: 1 },
        styles: { fontSize: 7, cellPadding: 1 },
        columnStyles: columnStyles,
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          if (pdfSettings.footerText) {
            let footerStr = pdfSettings.footerText.replace('{date}', generationDateFormatted).replace('{pageNumber}', data.pageNumber.toString()).replace('{totalPages}', pageCount.toString());
            doc.setFontSize(9); doc.text(footerStr, data.settings.margin.left, doc.internal.pageSize.height - 10);
          }
        },
      });
      doc.save(`Suivi_Huiles_Friteuse_${selectedFryerData.name.replace(/\s+/g, '_')}_${monthLabel}_${selectedYear}.pdf`);
      toast({ title: "PDF Friteuse Généré", description: `Le PDF pour la friteuse "${selectedFryerData.name}" a été téléchargé.` });
    } catch (error) {
      console.error("Error generating PDF for fryer:", error);
      toast({ title: "Erreur PDF", description: "La génération du PDF a échoué.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Droplet className="w-6 h-6 text-primary"/>
          Suivi Mensuel des Huiles de Friteuse
        </CardTitle>
        <CardDescription>
          Sélectionnez une année, un mois, puis une friteuse pour enregistrer et visualiser le suivi. Les friteuses et leurs points de contrôle sont configurables dans les Paramètres PMS.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end mb-4">
          <div>
            <Label htmlFor="year-select-fryer-oil">Année</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger id="year-select-fryer-oil"><SelectValue placeholder="Année" /></SelectTrigger>
              <SelectContent>{yearsArray.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="month-select-fryer-oil">Mois</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger id="month-select-fryer-oil"><SelectValue placeholder="Mois" /></SelectTrigger>
              <SelectContent>{monthsArray.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 md:col-span-1 md:justify-self-end">
             <Button onClick={generatePdfForFryer} disabled={isLoading || !selectedFryerData || monthData.length === 0 || configuredFryers.length === 0} className="w-full sm:w-auto">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Générer PDF Friteuse
            </Button>
            <Button variant="destructive" onClick={handleClearMonthData} disabled={isLoading || Object.keys(oilRecords).length === 0} className="w-full sm:w-auto">
                <Trash2 className="mr-2 h-4 w-4" />
                Effacer Mois
            </Button>
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /> Chargement...</div>
        ) : configuredFryers.length === 0 ? (
           <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
                Aucune friteuse n'a été configurée.
            </p>
            <p className="text-xs text-muted-foreground/70">
                Veuillez définir des friteuses et leurs points de contrôle dans "Paramètres" &gt; "Paramètres PMS" pour commencer.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <Label className="text-sm font-medium mb-2 block">Sélectionner une Friteuse :</Label>
              <div className="flex flex-wrap gap-2">
                {configuredFryers.map(fryer => (
                  <Button
                    key={fryer.id}
                    variant={selectedFryerId === fryer.id ? "default" : "outline"}
                    onClick={() => setSelectedFryerId(fryer.id)}
                    size="sm"
                  >
                    {fryer.name}
                  </Button>
                ))}
              </div>
            </div>

            {!selectedFryerId ? (
              <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
                  <ListFilter className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                      Veuillez sélectionner une friteuse ci-dessus pour afficher le tableau de suivi.
                  </p>
              </div>
            ) : selectedFryerData && monthData.length > 0 ? (
              <div className="overflow-x-auto border rounded-md max-h-[70vh]">
                <Table className="min-w-full table-fixed">
                  <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                    <TableRow>
                      <TableHead className="w-[60px] min-w-[60px] text-center px-1">Date</TableHead>
                      <TableHead className="w-[100px] min-w-[100px] px-1">Jour</TableHead>
                      {selectedFryerData.tasks.map(task => (
                        <TableHead key={task.id} className="w-[200px] min-w-[200px] text-center px-1 border-l">
                          {task.name}
                          <div className="grid grid-cols-2 gap-px mt-1 text-xs font-normal text-muted-foreground">
                            <span>Statut</span>
                            <span>Opérateur</span>
                          </div>
                        </TableHead>
                      ))}
                      {selectedFryerData.tasks.length === 0 && (
                        <TableHead className="w-full text-center px-1 border-l">Aucun point de contrôle défini pour cette friteuse</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthData.map((day) => (
                      <TableRow key={day.date} className={cn(day.isWeekend && "bg-muted/30")}>
                        <TableCell className="text-center font-medium px-1 align-top py-2">{day.dayOfMonth}</TableCell>
                        <TableCell className="px-1 align-top py-2">{day.dayName}</TableCell>
                        {selectedFryerData.tasks.length > 0 ? selectedFryerData.tasks.map(task => {
                          const record = getRecord(day.date, selectedFryerData.id, task.id);
                          return (
                            <TableCell key={task.id} className="p-1 align-top border-l">
                              <div className="grid grid-cols-2 gap-1">
                                <Select
                                  value={record.status === '' ? NO_STATUS_SELECT_VALUE : record.status}
                                  onValueChange={(valueFromSelect) => {
                                    const valueToStore = valueFromSelect === NO_STATUS_SELECT_VALUE ? '' : valueFromSelect as 'fait' | 'non_fait' | 'na'; // Add more specific oil statuses if needed
                                    handleRecordChange(day.date, selectedFryerData.id, task.id, 'status', valueToStore);
                                  }}
                                  disabled={day.isWeekend}
                                >
                                  <SelectTrigger className="h-7 text-xs text-foreground/80">
                                    <SelectValue placeholder="Statut" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={NO_STATUS_SELECT_VALUE}>-</SelectItem>
                                    <SelectItem value="fait">OK/Conforme</SelectItem>
                                    <SelectItem value="non_fait">Non Conforme/À Changer</SelectItem>
                                    <SelectItem value="na">N/A</SelectItem>
                                    {/* Add other relevant statuses like "Changée", "Test > X%" */}
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="text"
                                  placeholder="Op."
                                  value={record.operator}
                                  onChange={(e) => handleRecordChange(day.date, selectedFryerData.id, task.id, 'operator', e.target.value)}
                                  className="h-7 text-xs"
                                  disabled={day.isWeekend}
                                  maxLength={15}
                                />
                              </div>
                            </TableCell>
                          );
                        }) : (
                          <TableCell className="p-1 align-top border-l text-center text-xs text-muted-foreground italic" colSpan={1}>
                            Aucun point de contrôle.
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
                <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                  {selectedFryerId ? "Aucune donnée à afficher pour la période ou friteuse sélectionnée." : "Veuillez d'abord sélectionner une friteuse."}
                </p>
                 {selectedFryerData && selectedFryerData.tasks.length === 0 && (
                   <p className="text-xs text-muted-foreground/70 mt-1">
                     La friteuse "{selectedFryerData.name}" n'a pas de points de contrôle définis. Ajoutez-en via les Paramètres PMS.
                   </p>
                 )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

