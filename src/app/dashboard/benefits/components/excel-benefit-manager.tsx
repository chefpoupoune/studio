
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Label} from "@/components/ui/label";
import { FileText, Loader2, Trash2, Users, Save } from 'lucide-react';
import { format, getDaysInMonth, getDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { BenefitEmployee, BenefitDailyStatusCode, FullMonthlyBenefitData, BenefitPdfData } from '../types';
import { BENEFIT_STATUS_CODES, BENEFIT_STATUS_LEGEND, frenchShortDays } from '../types';
import { generateBenefitPdf } from '../utils/benefitPdfGenerator'; // Import the generator
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
import { firestore } from '@/lib/firebase';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);
const months = Array.from({ length: 12 }, (_, i) => ({
  value: i.toString(),
  label: format(new Date(currentYear, i), "MMMM", { locale: fr }),
}));

const SELECT_EMPTY_VALUE_PLACEHOLDER = "_SELECT_EMPTY_";

interface BenefitTrackingTableProps {
  employees: BenefitEmployee[];
}

export default function BenefitTrackingTable({ employees: employeesToRender }: BenefitTrackingTableProps) {
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
  const [benefitData, setBenefitData] = useState<FullMonthlyBenefitData>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [initialDocExists, setInitialDocExists] = useState<boolean | null>(null);
  const [isSuperviseur, setIsSuperviseur] = useState(false);
  const { toast } = useToast();

  const getFirestoreDocId = useCallback(() => `benefit_tracking_${selectedYear}_${selectedMonth}`, [selectedYear, selectedMonth]);

  const daysInSelectedMonth = useMemo(() => {
    const year = parseInt(selectedYear);
    const month = parseInt(selectedMonth);
    const numDays = getDaysInMonth(new Date(year, month));
    return Array.from({ length: numDays }, (_, i) => {
      const date = new Date(year, month, i + 1);
      return { dayNumber: i + 1, dayLetter: frenchShortDays[getDay(date)], isWeekend: getDay(date) === 0 || getDay(date) === 6 };
    });
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    const userPermissionsString = localStorage.getItem('LOGGED_IN_USER_PERMISSIONS_KEY');
    if (userPermissionsString) {
      const userPermissions = JSON.parse(userPermissionsString);
      setIsSuperviseur(userPermissions.role === 'superviseur');
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const docId = getFirestoreDocId();
      const docRef = doc(firestore, "monthlyBenefitData", docId);
      try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setBenefitData(docSnap.data() as FullMonthlyBenefitData);
          setInitialDocExists(true);
        } else {
          const initialData: FullMonthlyBenefitData = {};
          employeesToRender.forEach(employee => {
            initialData[employee.id] = {};
            daysInSelectedMonth.forEach(day => {
              const dateKey = `${selectedYear}-${(parseInt(selectedMonth) + 1).toString().padStart(2, '0')}-${day.dayNumber.toString().padStart(2, '0')}`;
              initialData[employee.id][dateKey] = { planning: "X", repasPris: "" };
            });
          });
          setBenefitData(initialData);
          setInitialDocExists(false);
        }
      } catch (error) {
        console.error("Error loading benefit data:", error);
        toast({ title: "Erreur de chargement", description: "Les données n'ont pu être chargées.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [selectedYear, selectedMonth, getFirestoreDocId, toast, employeesToRender, daysInSelectedMonth]);

  const saveData = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    const docId = getFirestoreDocId();
    const docRef = doc(firestore, "monthlyBenefitData", docId);
    try {
      await setDoc(docRef, benefitData, { merge: true });
      setInitialDocExists(true);
      toast({ title: "Données enregistrées", description: "Les modifications ont été sauvegardées." });
    } catch (error) {
      console.error("Error saving benefit data:", error);
      toast({ title: "Erreur de sauvegarde", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [benefitData, isSaving, getFirestoreDocId, toast]);

  const handleStatusChange = (employeeId: string, dayNumber: number, type: 'planning' | 'repasPris', value: string) => {
    const actualValue = value === SELECT_EMPTY_VALUE_PLACEHOLDER ? "" : value as BenefitDailyStatusCode;
    const dateKey = `${selectedYear}-${(parseInt(selectedMonth) + 1).toString().padStart(2, '0')}-${dayNumber.toString().padStart(2, '0')}`;
    setBenefitData(prev => ({ ...prev, [employeeId]: { ...prev[employeeId], [dateKey]: { ...(prev[employeeId]?.[dateKey] || {}), [type]: actualValue } } }));
  };

  const calculateTotal = (employeeId: string, type: 'planning' | 'repasPris'): number => {
    const entries = benefitData[employeeId];
    return entries ? Object.values(entries).reduce((sum, entry) => sum + (entry[type] === "X" ? 1 : 0), 0) : 0;
  };

  const handleConfirmClearMonthData = async () => {
    setIsSaving(true);
    const docId = getFirestoreDocId();
    try {
      await deleteDoc(doc(firestore, "monthlyBenefitData", docId));
      const initialData: FullMonthlyBenefitData = {};
      employeesToRender.forEach(employee => {
        initialData[employee.id] = {};
        daysInSelectedMonth.forEach(day => {
          const dateKey = `${selectedYear}-${(parseInt(selectedMonth) + 1).toString().padStart(2, '0')}-${day.dayNumber.toString().padStart(2, '0')}`;
          initialData[employee.id][dateKey] = { planning: "X", repasPris: "" };
        });
      });
      setBenefitData(initialData);
      setInitialDocExists(false);
      toast({ title: "Données Effacées" });
    } catch (error) {
      console.error("Error deleting data:", error);
      toast({ title: "Erreur de suppression", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleGeneratePdf = async () => {
    setIsGeneratingPdf(true);
    try {
        const pdfData: BenefitPdfData = {
            selectedYear,
            selectedMonth,
            benefitData,
            employeesToRender,
            daysInSelectedMonth,
            months
        };
        const success = await generateBenefitPdf(pdfData);
        if (success) {
            toast({ title: "PDF Généré", description: "Le fichier a été téléchargé avec succès." });
        }
    } catch (error) {
        console.error("PDF Generation Failed", error);
        toast({ title: "Erreur de Génération", description: "La création du PDF a échoué.", variant: "destructive" });
    } finally {
        setIsGeneratingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
        <p className="text-lg text-muted-foreground">Chargement des données...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end">
        <div>
          <Label htmlFor="year-select-benefits">Année</Label>
          <Select value={selectedYear} onValueChange={setSelectedYear}><SelectTrigger id="year-select-benefits"><SelectValue /></SelectTrigger><SelectContent>{years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent></Select>
        </div>
        <div>
          <Label htmlFor="month-select-benefits">Mois</Label>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}><SelectTrigger id="month-select-benefits"><SelectValue /></SelectTrigger><SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 md:col-span-1 md:justify-self-end pt-2">
          <Button onClick={handleGeneratePdf} disabled={isSaving || isGeneratingPdf || !employeesToRender.length} className="w-full sm:w-auto">
            {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}Générer PDF
          </Button>
          <Button onClick={saveData} disabled={isSuperviseur || isSaving} className="w-full sm:w-auto">{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Sauvegarder</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="destructive" disabled={isSaving || !initialDocExists} className="w-full sm:w-auto"><Trash2 className="mr-2 h-4 w-4" />Effacer Mois</Button></AlertDialogTrigger>
            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmer la suppression</AlertDialogTitle><AlertDialogDescription>Effacer les données pour {months[parseInt(selectedMonth)].label} {selectedYear} ?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={handleConfirmClearMonthData}>Effacer</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <div className="my-4 p-3 border rounded-md bg-muted/50"><p className="font-semibold text-sm mb-2">Légende :</p><div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">{BENEFIT_STATUS_LEGEND.map(item => <div key={item.code} className="flex items-center gap-1.5"><span className={cn("px-1.5 py-0.5 rounded-sm text-xs font-medium", item.displayClass)}>{item.code || "-"}</span><span>: {item.label}</span></div>)}</div></div>
      {!employeesToRender.length ? (
        <div className="text-center py-10 border-2 border-dashed rounded-lg"><Users className="mx-auto h-12 w-12 text-muted-foreground" /><p className="mt-2 text-sm">Aucun membre de la brigade.</p></div>
      ) : (
        <div className="overflow-x-auto border rounded-md shadow-sm">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Employé</TableHead>
                <TableHead className="w-[100px]">Type</TableHead>
                {daysInSelectedMonth.map(day => <TableHead key={`header-num-${day.dayNumber}`} className={cn("w-[60px] text-center p-1 text-xs", day.isWeekend && "bg-muted")}>{day.dayNumber}</TableHead>)}
                <TableHead className="w-[70px] text-center">TOTAL</TableHead>
              </TableRow>
              <TableRow>
                <TableHead></TableHead>
                <TableHead></TableHead>
                {daysInSelectedMonth.map(day => <TableHead key={`header-letter-${day.dayNumber}`} className={cn("text-center p-1 text-xs font-semibold", day.isWeekend && "bg-muted")}>{day.dayLetter}</TableHead>)}
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employeesToRender.map(employee => (
                <React.Fragment key={employee.id}>
                  {(['planning', 'repasPris'] as const).map((type, typeIndex) => (
                    <TableRow key={type} className={typeIndex === 0 ? "border-t-2" : ""}>
                      {typeIndex === 0 && <TableCell rowSpan={2} className="font-medium align-middle">{employee.name}</TableCell>}
                      <TableCell className="text-xs">{type === 'planning' ? 'Planning' : 'Repas Pris'}</TableCell>
                      {daysInSelectedMonth.map(day => {
                        const dateKey = `${selectedYear}-${(parseInt(selectedMonth) + 1).toString().padStart(2, '0')}-${day.dayNumber.toString().padStart(2, '0')}`;
                        const value = benefitData[employee.id]?.[dateKey]?.[type] || "";
                        const config = BENEFIT_STATUS_LEGEND.find(c => c.code === value);
                        return (
                          <TableCell key={day.dayNumber} className={cn("p-0.5 text-center", day.isWeekend && "bg-muted/50")}>
                            <Select value={value || SELECT_EMPTY_VALUE_PLACEHOLDER} onValueChange={(v) => handleStatusChange(employee.id, day.dayNumber, type, v)} disabled={isSuperviseur || isSaving}>
                              <SelectTrigger className={cn("h-7 text-xs justify-center", config?.displayClass)}><SelectValue placeholder="-" /></SelectTrigger>
                              <SelectContent>{BENEFIT_STATUS_CODES.map(code => <SelectItem key={code || SELECT_EMPTY_VALUE_PLACEHOLDER} value={code || SELECT_EMPTY_VALUE_PLACEHOLDER} className="text-xs">{code || "-"}</SelectItem>)}</SelectContent>
                            </Select>
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center font-bold">{calculateTotal(employee.id, type)}</TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
