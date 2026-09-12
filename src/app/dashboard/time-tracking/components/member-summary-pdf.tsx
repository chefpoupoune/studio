"use client";

import React, { useState, useMemo, useEffect } from 'react';
import type { BrigadeMember, TimeEntry } from '../types';
import type { RubricId } from '@/app/dashboard/settings/components/user-management';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, UserCheck, TrendingUp, TrendingDown, Scale, Loader2, AlertCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format, getYear, getMonth, startOfMonth, isBefore, eachMonthOfInterval, isWithinInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import { formatHours } from '@/lib/time-utils';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

interface MemberSummaryPdfProps {
  members: BrigadeMember[];
  timeEntries: TimeEntry[];
  loggedInUsername: string | null;
  userPermissions: Partial<Record<RubricId, boolean>>;
}

const currentFullYear = new Date().getFullYear();
const yearsArray = Array.from({ length: 10 }, (_, i) => currentFullYear - 5 + i);
const monthsArray = Array.from({ length: 12 }, (_, i) => ({
  value: i.toString(),
  label: format(new Date(currentFullYear, i), "MMMM", { locale: fr }),
}));

const academicYears = Array.from({ length: 10 }, (_, i) => {
    const startYear = currentFullYear - 5 + i;
    return {
        value: startYear.toString(),
        label: `${startYear}-${startYear + 1}`,
    };
});

export default function MemberSummaryPdf({
  members,
  timeEntries,
  loggedInUsername,
  userPermissions
}: MemberSummaryPdfProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>(getYear(new Date()).toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(getMonth(new Date()).toString());
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>(() => {
    const currentMonth = getMonth(new Date());
    return (currentMonth < 8 ? getYear(new Date()) - 1 : getYear(new Date())).toString();
  });
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingYearlyPdf, setIsGeneratingYearlyPdf] = useState(false);
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const currentUserBrigadeMember = useMemo(() => {
    if (isClient && loggedInUsername) {
      return members.find(m => m.name.toLowerCase() === loggedInUsername.toLowerCase());
    }
    return null;
  }, [isClient, loggedInUsername, members]);

  const hasFullAccess = useMemo(() => {
      if (!isClient) return false;
      if (loggedInUsername?.toLowerCase() === 'chef') return true;
      return currentUserBrigadeMember?.role?.toLowerCase() === 'chef de service';
  }, [isClient, loggedInUsername, currentUserBrigadeMember]);

  useEffect(() => {
    if (!hasFullAccess && currentUserBrigadeMember) {
      setSelectedMemberId(currentUserBrigadeMember.id);
    } else if (hasFullAccess && !selectedMemberId && members.length > 0) {
    } else if (!hasFullAccess && !currentUserBrigadeMember) {
      setSelectedMemberId(null);
    }
  }, [hasFullAccess, currentUserBrigadeMember, members, selectedMemberId]);

  const selectedMember = useMemo(() => {
    return members.find(m => m.id === selectedMemberId) || null;
  }, [selectedMemberId, members]);

  const allMemberTimeEntries = useMemo(() => {
    if (!selectedMemberId) return [];
    return timeEntries.filter(entry => entry.memberId === selectedMemberId)
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [selectedMemberId, timeEntries]);

  const previousBalance = useMemo(() => {
    if (!selectedMemberId) return 0;
    const yearNum = parseInt(selectedYear, 10);
    const monthNum = parseInt(selectedMonth, 10);
    const firstDayOfSelectedMonth = startOfMonth(new Date(yearNum, monthNum, 1));

    let balance = 0;
    allMemberTimeEntries.forEach(entry => {
      const entryDate = new Date(entry.date);
      if (isBefore(entryDate, firstDayOfSelectedMonth)) {
        const hoursAsFloat = parseFloat(entry.hours as any) || 0;
        balance += (entry.type === 'addition' ? hoursAsFloat : -hoursAsFloat);
      }
    });
    return balance;
  }, [allMemberTimeEntries, selectedYear, selectedMonth, selectedMemberId]);

  const entriesForSelectedMonth = useMemo(() => {
    if (!selectedMemberId) return [];
    const yearNum = parseInt(selectedYear, 10);
    const monthNum = parseInt(selectedMonth, 10);

    return allMemberTimeEntries
      .filter(entry => {
        const entryDate = new Date(entry.date);
        return getYear(entryDate) === yearNum && getMonth(entryDate) === monthNum;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allMemberTimeEntries, selectedYear, selectedMonth, selectedMemberId]);

  const statsForSelectedMonth = useMemo(() => {
    return entriesForSelectedMonth.reduce((acc, e) => {
        const hours = parseFloat(e.hours as any) || 0;
        if (e.type === 'addition') {
            acc.totalAddedThisMonth += hours;
        } else {
            acc.totalDeductedThisMonth += hours;
        }
        acc.netHoursThisMonth = acc.totalAddedThisMonth - acc.totalDeductedThisMonth;
        return acc;
    }, { totalAddedThisMonth: 0, totalDeductedThisMonth: 0, netHoursThisMonth: 0 });
  }, [entriesForSelectedMonth]);

  const cumulativeBalance = useMemo(() => {
    return previousBalance + statsForSelectedMonth.netHoursThisMonth;
  }, [previousBalance, statsForSelectedMonth.netHoursThisMonth]);

  const generatePdf = async () => {
    if (!selectedMember) {
      toast({ title: "Données Insuffisantes", description: "Sélectionnez un membre.", variant: "destructive" });
      return;
    }
    if (entriesForSelectedMonth.length === 0 && previousBalance === 0) {
      toast({ title: "Données Insuffisantes", description: "Aucune donnée pour cette période.", variant: "destructive" });
      return;
    }
    setIsGeneratingPdf(true);

    try {
      const pdfSettings = await getPdfLayoutSettings('time_tracking_summary');
      const doc = new jsPDF({ orientation: pdfSettings.orientation as any, unit: 'pt', format: pdfSettings.pageSize as any }) as jsPDFWithAutoTable;
      
      const headStyles: any = { fontStyle: 'bold', fontSize: pdfSettings.tableHeaderFontSize || 10, halign: 'center' };
      if (pdfSettings.primaryColor) {
          const rgb = hexToRgb(pdfSettings.primaryColor);
          if (rgb) {
              headStyles.fillColor = [rgb.r, rgb.g, rgb.b];
              headStyles.textColor = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 125 ? [0, 0, 0] : [255, 255, 255];
          }
      }
      const greenFillColor = [204, 255, 204];
      const redFillColor = [255, 204, 204];

      // ... (Header, Title, and other setup logic) ...

       const monthlyBody = entriesForSelectedMonth.map(entry => {
        const isAddition = entry.type === 'addition';
        const cellStyle = { fillColor: isAddition ? greenFillColor : redFillColor };
        return [
            format(new Date(entry.date), "dd/MM/yyyy", { locale: fr }),
            { content: isAddition ? 'Ajout' : 'Déduction', styles: cellStyle },
            { content: formatHours(entry.hours), styles: cellStyle },
            entry.reason
        ];
      });

      doc.autoTable({
        head: [['Date', 'Type', 'Heures', 'Raison']],
        body: monthlyBody,
        theme: 'grid',
        headStyles: headStyles,
      });

      const selectedMonthLabel = monthsArray.find(m => m.value === selectedMonth)?.label || '';
      doc.save(`Releve_Heures_${selectedMember.name.replace(/\s+/g, '_')}_${selectedMonthLabel}_${selectedYear}.pdf`);
      toast({ title: "PDF Généré", description: `Le relevé d'heures a été téléchargé.` });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Erreur PDF", description: "La génération du PDF a échoué.", variant: "destructive" });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const generateYearlyPdf = async () => {
    if (!selectedMember) {
        toast({ title: "Données Insuffisantes", description: "Sélectionnez un membre.", variant: "destructive" });
        return;
    }
    setIsGeneratingYearlyPdf(true);

    try {
        const yearStart = parseInt(selectedAcademicYear, 10);
        const academicYearLabel = `${yearStart}-${yearStart + 1}`;
        const startDate = new Date(yearStart, 8, 1);
        const endDate = new Date(yearStart + 1, 8, 0);

        const yearlyEntries = allMemberTimeEntries.filter(entry => isWithinInterval(new Date(entry.date), { start: startDate, end: endDate }));

        if (yearlyEntries.length === 0) {
            toast({ title: "Données Insuffisantes", description: `Aucune donnée pour l'année ${academicYearLabel}.`, variant: "destructive" });
            setIsGeneratingYearlyPdf(false);
            return;
        }

        const startOfYearBalance = allMemberTimeEntries
            .filter(entry => isBefore(new Date(entry.date), startDate))
            .reduce((bal, entry) => bal + (entry.type === 'addition' ? 1 : -1) * (parseFloat(entry.hours as any) || 0), 0);

        const pdfSettings = await getPdfLayoutSettings('time_tracking_summary');
        const doc = new jsPDF({ orientation: pdfSettings.orientation as any, unit: 'pt', format: pdfSettings.pageSize as any }) as jsPDFWithAutoTable;
        
        const headStyles: any = { fontStyle: 'bold', fontSize: pdfSettings.tableHeaderFontSize || 10, halign: 'center' };
        if (pdfSettings.primaryColor) {
            const rgb = hexToRgb(pdfSettings.primaryColor);
            if (rgb) {
                headStyles.fillColor = [rgb.r, rgb.g, rgb.b];
                headStyles.textColor = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 125 ? [0, 0, 0] : [255, 255, 255];
            }
        }
        const greenTextColor = [0, 128, 0];
        const redTextColor = [255, 0, 0];
        const defaultTextColor = [0, 0, 0];
        const greenFillColor = [204, 255, 204];
        const redFillColor = [255, 204, 204];

        let tableStartY = pdfSettings.marginTop; 
        doc.text(`Récapitulatif Annuel - ${selectedMember.name} - ${academicYearLabel}`, doc.internal.pageSize.width / 2, tableStartY, { align: 'center' });
        tableStartY += 20;

        let currentBalance = startOfYearBalance;
        const monthlySummaries = eachMonthOfInterval({ start: startDate, end: endDate }).map(month => {
            const monthEntries = yearlyEntries.filter(e => getMonth(new Date(e.date)) === getMonth(month) && getYear(new Date(e.date)) === getYear(month));
            const totalAdded = monthEntries.filter(e => e.type === 'addition').reduce((sum, e) => sum + (parseFloat(e.hours as any) || 0), 0);
            const totalDeducted = monthEntries.filter(e => e.type === 'deduction').reduce((sum, e) => sum + (parseFloat(e.hours as any) || 0), 0);
            const startOfMonthBalance = currentBalance;
            currentBalance += (totalAdded - totalDeducted);
            return { monthLabel: format(month, "MMMM yyyy", { locale: fr }), startOfMonthBalance, totalAdded, totalDeducted, endOfMonthBalance: currentBalance };
        });

        const summaryBody = monthlySummaries.map(s => {
            return [
                s.monthLabel,
                formatHours(s.startOfMonthBalance),
                { content: formatHours(s.totalAdded), styles: { textColor: s.totalAdded > 0 ? greenTextColor : defaultTextColor } },
                { content: formatHours(s.totalDeducted), styles: { textColor: s.totalDeducted > 0 ? redTextColor : defaultTextColor } },
                { content: formatHours(s.endOfMonthBalance), styles: { textColor: s.endOfMonthBalance >= 0 ? greenTextColor : redTextColor } }
            ];
        });

        doc.setFontSize(pdfSettings.defaultFontSize);
        doc.text(`Solde au 1er Septembre ${yearStart}: ${formatHours(startOfYearBalance)}`, pdfSettings.marginLeft, tableStartY);
        tableStartY += 20;

        doc.autoTable({
            startY: tableStartY,
            head: [["Mois", "Solde Début Mois", "Heures Ajoutées", "Heures Déduites", "Solde Fin Mois"]],
            body: summaryBody,
            headStyles: headStyles,
            theme: 'grid',
        });
        
        doc.addPage();
        let detailTableY = pdfSettings.marginTop;
        doc.text(`Détail des écritures - ${academicYearLabel}`, doc.internal.pageSize.width / 2, detailTableY, { align: 'center' });
        detailTableY += 20;

        const yearlyDetailedBody = yearlyEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(entry => {
            const isAddition = entry.type === 'addition';
            const cellStyle = { fillColor: isAddition ? greenFillColor : redFillColor };
            return [
                format(new Date(entry.date), "dd/MM/yyyy"),
                { content: isAddition ? 'Ajout' : 'Déduction', styles: cellStyle },
                { content: formatHours(entry.hours), styles: cellStyle },
                entry.reason
            ];
        });

        doc.autoTable({
            startY: detailTableY,
            head: [['Date', 'Type', 'Heures', 'Raison']],
            body: yearlyDetailedBody,
            headStyles: headStyles,
            theme: 'grid',
        });

        doc.save(`Recap_Annuel_${selectedMember.name.replace(/\s+/g, '_')}_${academicYearLabel}.pdf`);
        toast({ title: "PDF Annuel Généré", description: `Le récapitulatif pour ${academicYearLabel} a été créé.` });

    } catch (error) {
        console.error("Error generating yearly PDF:", error);
        toast({ title: "Erreur PDF", description: "La génération du PDF annuel a échoué.", variant: "destructive" });
    } finally {
        setIsGeneratingYearlyPdf(false);
    }
  };
  
  const membersForSelect = hasFullAccess ? members : (currentUserBrigadeMember ? [currentUserBrigadeMember] : []);

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-primary"/>
            Relevés Individuels et PDF
        </CardTitle>
        <CardDescription>Consultez le récapitulatif des heures par membre et générez des relevés PDF mensuels ou annuels.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-4">
            <Label htmlFor="member-select-summary">Membre de la Brigade</Label>
            <Select onValueChange={setSelectedMemberId} value={selectedMemberId || ""} disabled={!hasFullAccess}>
              <SelectTrigger id="member-select-summary">
                <SelectValue placeholder={!hasFullAccess && !currentUserBrigadeMember ? "Aucun membre assigné" : "Sélectionner un membre"} />
              </SelectTrigger>
              <SelectContent>
                {membersForSelect.length > 0 ? membersForSelect.map(member => (
                  <SelectItem key={member.id} value={member.id}>{member.name} ({member.role})</SelectItem>
                )) : <SelectItem value="disabled" disabled>{!hasFullAccess && !currentUserBrigadeMember ? "Votre compte n'est pas lié" : "Aucun membre"}</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Monthly Report Section */}
        <div className="border-t pt-4">
          <h3 className="font-semibold text-lg mb-2">Relevé Mensuel</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-4 items-end">
            <div className="sm:col-span-1"><Label htmlFor="year-select-summary">Année</Label><Select value={selectedYear} onValueChange={setSelectedYear}><SelectTrigger id="year-select-summary"><SelectValue placeholder="Année" /></SelectTrigger><SelectContent>{yearsArray.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent></Select></div>
            <div className="sm:col-span-1"><Label htmlFor="month-select-summary">Mois</Label><Select value={selectedMonth} onValueChange={setSelectedMonth}><SelectTrigger id="month-select-summary"><SelectValue placeholder="Mois" /></SelectTrigger><SelectContent>{monthsArray.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select></div>
            <Button onClick={generatePdf} disabled={!selectedMember || (entriesForSelectedMonth.length === 0 && previousBalance === 0) || isGeneratingPdf} className="w-full md:col-start-4">{isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileText className="mr-2 h-4 w-4" />}Générer PDF Mensuel</Button>
          </div>
        </div>

        {/* Yearly Report Section */}
        <div className="border-t pt-4">
          <h3 className="font-semibold text-lg mb-2">Relevé Annuel (Septembre-Août)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-4 items-end">
            <div className="sm:col-span-2"><Label htmlFor="academic-year-select">Année Académique</Label><Select value={selectedAcademicYear} onValueChange={setSelectedAcademicYear}><SelectTrigger id="academic-year-select"><SelectValue placeholder="Sélectionner une année" /></SelectTrigger><SelectContent>{academicYears.map(y => (<SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>))}</SelectContent></Select></div>
            <Button onClick={generateYearlyPdf} disabled={!selectedMember || isGeneratingYearlyPdf} className="w-full md:col-start-4">{isGeneratingYearlyPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileText className="mr-2 h-4 w-4" />}Générer PDF Annuel</Button>
          </div>
        </div>

        {selectedMember ? (
          <div className="space-y-4 pt-6">
            <h3 className="text-xl font-semibold text-foreground">Aperçu rapide pour {selectedMember.name} - {monthsArray.find(m=>m.value === selectedMonth)?.label} {selectedYear}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Solde Reporté</CardTitle><Scale className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatHours(previousBalance)}</div></CardContent></Card>
                <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Ajouté (ce mois)</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{formatHours(statsForSelectedMonth.totalAddedThisMonth)}</div></CardContent></Card>
                 <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Déduit (ce mois)</CardTitle><TrendingDown className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">{formatHours(statsForSelectedMonth.totalDeductedThisMonth)}</div></CardContent></Card>
                 <Card className="md:col-span-1 lg:col-span-1"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Solde du Mois</CardTitle><Scale className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className={`text-2xl font-bold ${statsForSelectedMonth.netHoursThisMonth >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{formatHours(statsForSelectedMonth.netHoursThisMonth)}</div></CardContent></Card>
                <Card className="md:col-span-2 lg:col-span-2"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Nouveau Solde Cumulé</CardTitle><Scale className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className={`text-2xl font-bold ${cumulativeBalance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{formatHours(cumulativeBalance)}</div></CardContent></Card>
            </div>

            {entriesForSelectedMonth.length > 0 ? (
              <div className="overflow-x-auto border rounded-md max-h-[400px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-card"><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Heures</TableHead><TableHead>Raison</TableHead></TableRow></TableHeader>
                  <TableBody>{entriesForSelectedMonth.map((entry) => (<TableRow key={entry.id}><TableCell>{format(new Date(entry.date), "dd/MM/yyyy", { locale: fr })}</TableCell><TableCell><span className={`px-2 py-1 rounded-full text-xs font-semibold ${entry.type === 'addition' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{entry.type === 'addition' ? 'Ajout' : 'Déduction'}</span></TableCell><TableCell className="text-right">{formatHours(entry.hours)}</TableCell><TableCell className="text-sm text-muted-foreground truncate max-w-[200px] sm:max-w-xs">{entry.reason}</TableCell></TableRow>))}</TableBody>
                </Table>
              </div>
            ) : (<div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg"><AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" /><p className="mt-2 text-sm text-muted-foreground">Aucune entrée d'heures pour {selectedMember.name} pour {monthsArray.find(m=>m.value === selectedMonth)?.label} {selectedYear}.</p></div>)}
          </div>
        ) : (<div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg"><AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" /><p className="text-muted-foreground mt-2 text-sm">{hasFullAccess ? "Sélectionnez un membre pour afficher son récapitulatif." : !currentUserBrigadeMember ? "Votre compte n'est pas lié à un membre." : "Chargement..."}</p></div>)}
      </CardContent>
    </Card>
  );
}
