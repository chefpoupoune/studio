
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, User, Hourglass, Library } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { doc, getDoc, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { getDaysInMonth, getDay } from 'date-fns';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import { formatHours } from '@/lib/time-utils';
import { generateBenefitPdf } from '../../../benefits/utils/benefitPdfGenerator';
import { generateTimeSummaryPdf } from '../../../time-tracking/utils/summaryPdfGenerator';
import type { TimeSummaryPdfData } from '../../../time-tracking/utils/summaryPdfGenerator';
import { frenchShortDays, BenefitEmployee } from '../../../benefits/types';
import type { BenefitPdfData } from '../../../benefits/utils/benefitPdfGenerator';
import type { FullMonthlyBenefitData } from '../../../benefits/types';
import type { TimeEntry, BrigadeMember } from '../../../time-tracking/types';

const LOGGED_IN_USERNAME_KEY = 'loggedInUsername';
const VIRTUAL_CHEF_ID = 'chef_virtual_user_id';

interface AdministratifProps {
  selectedDate: Date;
}

interface jsPDFWithAutoTable extends jsPDF {
    autoTable: (options: any) => jsPDF;
}

const months = Array.from({ length: 12 }, (_, i) => ({
  value: i.toString(),
  label: format(new Date(2000, i), "MMMM", { locale: fr }),
}));

// Helper to ensure date is a JS Date object and is valid
const ensureValidDate = (date: any): Date | null => {
    let d: Date;
    if (date instanceof Date) {
        d = date;
    } else if (date && typeof date.toDate === 'function') {
        d = date.toDate(); // Convert Firestore Timestamp
    } else {
        d = new Date(date); // Fallback for strings/numbers
    }
    return isNaN(d.getTime()) ? null : d;
};


const Administratif: React.FC<AdministratifProps> = ({ selectedDate }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isBenefitDataLoading, setIsBenefitDataLoading] = useState(true);
  const [isGeneratingBenefits, setIsGeneratingBenefits] = useState(false);
  const [generatingMemberId, setGeneratingMemberId] = useState<string | null>(null);
  const [isGeneratingCombined, setIsGeneratingCombined] = useState(false);
  const [benefitData, setBenefitData] = useState<FullMonthlyBenefitData>({});
  const [employeesForPdf, setEmployeesForPdf] = useState<BenefitEmployee[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || !selectedDate) return;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const membersQuery = query(collection(firestore, 'brigadeMembers'), orderBy("name"));
        const membersSnapshot = await getDocs(membersQuery);
        let membersList: BenefitEmployee[] = membersSnapshot.docs.map(docSnap => ({
          id: docSnap.id,
          name: docSnap.data().name,
          role: docSnap.data().role || ''
        }));

        const loggedInUsername = localStorage.getItem(LOGGED_IN_USERNAME_KEY);
        if (loggedInUsername?.toLowerCase() === 'chef' && !membersList.some(m => m.name.toLowerCase() === 'chef')) {
            membersList.push({ id: VIRTUAL_CHEF_ID, name: 'Chef', role: 'Chef' });
        }

        membersList.sort((a, b) => a.name.localeCompare(b.name));
        setEmployeesForPdf(membersList);

        const timeEntriesSnapshot = await getDocs(collection(firestore, 'timeTrackingEntries'));
        const entriesList = timeEntriesSnapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return { id: docSnap.id, ...data, date: data.date.toDate() } as TimeEntry;
          }).filter(Boolean);
        setTimeEntries(entriesList);

      } catch (e) {
        console.error("Error loading administrative data:", e);
        toast({ title: "Erreur de chargement des données", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [isClient, selectedDate, toast]);

  useEffect(() => {
    if (!selectedDate || employeesForPdf.length === 0) {
        setBenefitData({});
        setIsBenefitDataLoading(false);
        return;
    }

    const yearStr = selectedDate.getFullYear().toString();
    const monthStr = selectedDate.getMonth().toString();
    const docId = `benefit_tracking_${yearStr}_${monthStr}`;
    const docRef = doc(firestore, "monthlyBenefitData", docId);

    const loadAndReconcileData = async () => {
      setIsBenefitDataLoading(true);
      try {
        const docSnap = await getDoc(docRef);
        const loadedData = docSnap.exists() ? (docSnap.data() as FullMonthlyBenefitData) : {};
        
        employeesForPdf.forEach(employee => {
          if (!loadedData[employee.id]) {
            loadedData[employee.id] = {};
          }
        });

        setBenefitData(loadedData);
      } catch (error) {
        console.error("Error loading or reconciling benefit data:", error);
        toast({ title: "Erreur de chargement des avantages", variant: "destructive" });
        setBenefitData({});
      } finally {
        setIsBenefitDataLoading(false);
      }
    };

    loadAndReconcileData();
  }, [selectedDate, employeesForPdf, toast]);


  const handleGenerateTimeSummary = async (memberId: string) => {
    if (!selectedDate) return;
    if (memberId === VIRTUAL_CHEF_ID) {
        toast({ title: "Information", description: "Le Chef n'a pas de relevé d'heures individuel." });
        return;
    }
    const member = employeesForPdf.find(m => m.id === memberId);
    if (!member) return;
    setGeneratingMemberId(memberId);
    try {
      await generateTimeSummaryPdf({
        member: { id: member.id, name: member.name, email: '' },
        timeEntries,
        year: selectedDate.getFullYear().toString(),
        month: selectedDate.getMonth().toString(),
      });
      toast({ title: "PDF Généré", description: `Le relevé d'heures pour ${member.name} a été téléchargé.` });
    } catch (error: any) {
      toast({ title: `Erreur pour ${member.name}`, description: `La génération a échoué: ${error.message || 'Erreur inconnue'}.`, variant: "destructive" });
    } finally {
      setGeneratingMemberId(null);
    }
  };

  const handleGenerateBenefitsPdf = async () => {
    if (!selectedDate || employeesForPdf.length === 0) return;
    setIsGeneratingBenefits(true);
    try {
      const data: BenefitPdfData = {
        selectedYear: selectedDate.getFullYear().toString(),
        selectedMonth: selectedDate.getMonth().toString(),
        benefitData,
        employeesToRender: employeesForPdf,
        daysInSelectedMonth: Array.from({ length: getDaysInMonth(selectedDate) }, (_, i) => {
            const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), i + 1);
            return { dayNumber: i + 1, dayLetter: frenchShortDays[getDay(date)], isWeekend: getDay(date) === 0 || getDay(date) === 6 };
        }),
        months,
      };

      await generateBenefitPdf(data);
      toast({ title: "PDF des Avantages en Nature Généré", description: "Le fichier a été téléchargé avec succès." });
    } catch (error: any) {
      console.error("Error generating benefits PDF:", error);
      toast({ title: "Erreur de Génération", description: `La génération du PDF a échoué: ${error.message || 'Erreur inconnue'}.`, variant: "destructive" });
    } finally {
      setIsGeneratingBenefits(false);
    }
  };

  const handleGenerateCombinedTimeSummary = async () => {
    if (!selectedDate) return;
    const membersToInclude = employeesForPdf.filter(m => m.id !== VIRTUAL_CHEF_ID);

    if (membersToInclude.length === 0) {
        toast({ title: "Aucun membre trouvé", description: "Il n'y a personne dans la brigade pour qui générer un rapport." });
        return;
    }

    setIsGeneratingCombined(true);
    try {
        const pdfSettings = await getPdfLayoutSettings('time_tracking_summary');
        const doc = new jsPDF({ orientation: pdfSettings.orientation as any, unit: 'pt', format: pdfSettings.pageSize as any }) as jsPDFWithAutoTable;
        const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });

        for (let i = 0; i < membersToInclude.length; i++) {
            const member = membersToInclude[i];
            if (i > 0) doc.addPage();

            const year = selectedDate.getFullYear().toString();
            const month = selectedDate.getMonth().toString();
            const yearNum = parseInt(year, 10);
            const monthNum = parseInt(month, 10);

            const allValidMemberEntries = timeEntries
                .filter(entry => entry.memberId === member.id)
                .map(entry => {
                    const validDate = ensureValidDate(entry.date);
                    return validDate ? { ...entry, date: validDate } : null;
                })
                .filter((entry): entry is (TimeEntry & { date: Date }) => entry !== null)
                .sort((a, b) => a.date.getTime() - b.date.getTime());

            const startOfMonthUTC = Date.UTC(yearNum, monthNum, 1, 0, 0, 0, 0);
            const startOfNextMonthUTC = Date.UTC(yearNum, monthNum + 1, 1, 0, 0, 0, 0);

            const previousBalance = allValidMemberEntries
                .filter(entry => entry.date.getTime() < startOfMonthUTC)
                .reduce((balance, entry) => {
                    if (entry.type === 'addition') return balance + entry.hours;
                    if (entry.type === 'deduction') return balance - entry.hours;
                    return balance;
                }, 0);

            const entriesForSelectedMonth = allValidMemberEntries.filter(entry => {
                const entryTime = entry.date.getTime();
                return entryTime >= startOfMonthUTC && entryTime < startOfNextMonthUTC;
            });

            const stats = {
                added: entriesForSelectedMonth.filter(e => e.type === 'addition').reduce((s, e) => s + e.hours, 0),
                deducted: entriesForSelectedMonth.filter(e => e.type === 'deduction').reduce((s, e) => s + e.hours, 0),
            };
            const netThisMonth = stats.added - stats.deducted;
            const cumulativeBalance = previousBalance + netThisMonth;
            const selectedMonthLabel = months.find(m => m.value === month)?.label || '';

            doc.setFont(pdfSettings.fontFamily || 'helvetica');
            let tableStartY = pdfSettings.marginTop;
            const pageContentWidth = doc.internal.pageSize.width - pdfSettings.marginLeft - pdfSettings.marginRight;

            const roleDisplay = member.role ? ` (${member.role})` : '';
            const title = `Relevé d'Heures - ${member.name}${roleDisplay} - ${selectedMonthLabel} ${year}`;
            doc.setFontSize(pdfSettings.documentTitleFontSize);
            const titleDims = doc.getTextDimensions(title, { fontSize: pdfSettings.documentTitleFontSize, maxWidth: pageContentWidth });
            doc.text(title, doc.internal.pageSize.width / 2, tableStartY, { align: 'center', maxWidth: pageContentWidth });
            tableStartY += titleDims.h + 20;

            doc.setFontSize(pdfSettings.defaultFontSize);
            doc.text(`Solde Reporté (avant ${selectedMonthLabel}): ${formatHours(previousBalance)}`, pdfSettings.marginLeft, tableStartY); tableStartY += 15;
            doc.text(`Heures Ajoutées (ce mois): ${formatHours(stats.added)}`, pdfSettings.marginLeft, tableStartY); tableStartY += 15;
            doc.text(`Heures Déduites (ce mois): ${formatHours(stats.deducted)}`, pdfSettings.marginLeft, tableStartY); tableStartY += 15;
            doc.setFont(undefined, 'bold');
            doc.text(`Nouveau Solde Cumulé (fin ${selectedMonthLabel}): ${formatHours(cumulativeBalance)}`, pdfSettings.marginLeft, tableStartY); tableStartY += 25;
            doc.setFont(undefined, 'normal');

            const headStyles: any = { fontStyle: 'bold', fontSize: pdfSettings.tableHeaderFontSize, halign: 'center' };
            if (pdfSettings.primaryColor) {
                const rgb = hexToRgb(pdfSettings.primaryColor);
                if (rgb) { headStyles.fillColor = [rgb.r, rgb.g, rgb.b]; headStyles.textColor = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 125 ? [0,0,0] : [255,255,255]; }
            }

            doc.autoTable({
                startY: tableStartY,
                head: [['Date', 'Type', 'Heures', 'Raison']],
                body: entriesForSelectedMonth.sort((a, b) => b.date.getTime() - a.date.getTime()).map(e => [
                    format(e.date, "dd/MM/yyyy", { locale: fr }),
                    e.type === 'addition' ? 'Ajout' : 'Déduction',
                    formatHours(e.hours),
                    e.reason,
                ]),
                theme: 'grid', headStyles, styles: { fontSize: pdfSettings.tableBodyFontSize, font: pdfSettings.fontFamily },
                margin: { top: pdfSettings.marginTop, right: pdfSettings.marginRight, bottom: pdfSettings.marginBottom, left: pdfSettings.marginLeft },
            });
        }

        const totalPages = doc.internal.getNumberOfPages();
        if (pdfSettings.footerText) {
            for (let i = 1; i <= totalPages; i++) {
                doc.setPage(i);
                const footerStr = pdfSettings.footerText
                    .replace('{date}', generationDateFormatted)
                    .replace('{pageNumber}', i.toString())
                    .replace('{totalPages}', totalPages.toString());
                doc.setFontSize(pdfSettings.footerFontSize);
                doc.text(footerStr, pdfSettings.marginLeft, doc.internal.pageSize.height - (pdfSettings.marginBottom / 2));
            }
        }
        const monthLabel = months.find(m => m.value === selectedDate.getMonth().toString())?.label;
        doc.save(`Releves_Heures_Global_${monthLabel}_${selectedDate.getFullYear()}.pdf`);
        toast({ title: "PDF Global des Heures Généré", description: "Le fichier unique a été téléchargé avec succès." });
    } catch (error: any) {
        console.error("Error generating combined time summary PDF:", error);
        toast({ title: "Erreur de Génération", description: `La génération du PDF global a échoué: ${error.message || 'Erreur inconnue'}.`, variant: "destructive" });
    } finally {
        setIsGeneratingCombined(false);
    }
  };

  const anyGenerationRunning = isGeneratingBenefits || generatingMemberId !== null || isGeneratingCombined;
  const isDataLoading = isLoading || isBenefitDataLoading;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rapport Administratif Mensuel</CardTitle>
        <CardDescription>Générez les rapports PDF pour la clôture administrative du mois sélectionné.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-start space-y-4 p-4 border rounded-md">
          <p className="font-semibold">Avantages en Nature (PDF Global)</p>
          <p className="text-sm text-muted-foreground">Ce rapport est basé sur les données de la section "Gestion des Avantages en Nature".</p>
          <Button onClick={handleGenerateBenefitsPdf} disabled={anyGenerationRunning || isDataLoading}>
            {isGeneratingBenefits ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            Générer PDF Avantages en Nature
          </Button>
        </div>

        <div className="flex flex-col items-start space-y-4 p-4 border rounded-md">
            <div className="w-full flex justify-between items-start">
                <div>
                    <p className="font-semibold">Récapitulatifs des Heures</p>
                    <p className="text-sm text-muted-foreground">Générez le relevé d'heures, soit pour toute la brigade dans un seul fichier, soit individuellement.</p>
                </div>
                <Button onClick={handleGenerateCombinedTimeSummary} disabled={anyGenerationRunning || isDataLoading} variant="secondary">
                    {isGeneratingCombined ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Library className="mr-2 h-4 w-4" />}
                    Générer PDF Global
                </Button>
            </div>
          
          {isDataLoading ? (
            <div className="flex w-full items-center justify-center py-5 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span>Chargement des données...</span>
            </div>
          ) : employeesForPdf.filter(m => m.id !== VIRTUAL_CHEF_ID).length === 0 ? (
            <div className="w-full text-center py-5 border-2 border-dashed border-muted-foreground/20 rounded-lg">
                <Hourglass className="mx-auto h-10 w-10 text-muted-foreground/80" />
                <p className="mt-2 font-semibold text-muted-foreground">Aucun membre de la brigade trouvé.</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {employeesForPdf.map(member => {
                if (member.id === VIRTUAL_CHEF_ID) return null;
                return (
                    <Button key={member.id} variant="outline" onClick={() => handleGenerateTimeSummary(member.id)} disabled={anyGenerationRunning} className="flex items-center gap-2">
                    {generatingMemberId === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <User className="h-4 w-4" />}
                    {member.name}
                    </Button>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default Administratif;
