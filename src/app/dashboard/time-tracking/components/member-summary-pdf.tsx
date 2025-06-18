
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
import { format, getYear, getMonth, startOfMonth, isBefore } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';

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

export default function MemberSummaryPdf({
  members,
  timeEntries,
  loggedInUsername,
  userPermissions
}: MemberSummaryPdfProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>(getYear(new Date()).toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(getMonth(new Date()).toString());
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const isChef = useMemo(() => loggedInUsername?.toLowerCase() === 'chef', [loggedInUsername]);
  const currentUserBrigadeMember = useMemo(() => {
    if (isClient && !isChef && loggedInUsername) {
      return members.find(m => m.name.toLowerCase() === loggedInUsername.toLowerCase());
    }
    return null;
  }, [isClient, isChef, loggedInUsername, members]);

  useEffect(() => {
    if (!isChef && currentUserBrigadeMember) {
      setSelectedMemberId(currentUserBrigadeMember.id);
    } else if (isChef && !selectedMemberId && members.length > 0) {
      // For Chef, default to the first member or keep null to force selection
      // setSelectedMemberId(members[0].id); 
    } else if (!isChef && !currentUserBrigadeMember) {
      setSelectedMemberId(null);
    }
  }, [isChef, currentUserBrigadeMember, members, selectedMemberId]);

  const selectedMember = useMemo(() => {
    return members.find(m => m.id === selectedMemberId) || null;
  }, [selectedMemberId, members]);

  const allMemberTimeEntries = useMemo(() => {
    if (!selectedMemberId) return [];
    return timeEntries.filter(entry => entry.memberId === selectedMemberId)
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort oldest to newest for cumulative calculation
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
        if (entry.type === 'addition') {
          balance += entry.hours;
        } else if (entry.type === 'deduction') {
          balance -= entry.hours;
        }
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
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort most recent first for display
  }, [allMemberTimeEntries, selectedYear, selectedMonth, selectedMemberId]);


  const statsForSelectedMonth = useMemo(() => {
    if (!selectedMemberId) return { totalAddedThisMonth: 0, totalDeductedThisMonth: 0, netHoursThisMonth: 0 };
    
    const totalAddedThisMonth = entriesForSelectedMonth
      .filter(e => e.type === 'addition')
      .reduce((sum, e) => sum + e.hours, 0);
      
    const totalDeductedThisMonth = entriesForSelectedMonth
      .filter(e => e.type === 'deduction')
      .reduce((sum, e) => sum + e.hours, 0);
      
    return {
      totalAddedThisMonth,
      totalDeductedThisMonth,
      netHoursThisMonth: totalAddedThisMonth - totalDeductedThisMonth,
    };
  }, [entriesForSelectedMonth, selectedMemberId]);

  const cumulativeBalance = useMemo(() => {
    return previousBalance + statsForSelectedMonth.netHoursThisMonth;
  }, [previousBalance, statsForSelectedMonth.netHoursThisMonth]);


  const generatePdf = () => {
    if (!selectedMember || entriesForSelectedMonth.length === 0) {
      toast({ title: "Données Insuffisantes", description: "Sélectionnez un membre avec des entrées d'heures pour la période choisie afin de générer un PDF.", variant: "destructive" });
      return;
    }
    setIsGeneratingPdf(true);

    try {
      const pdfSettings = getPdfLayoutSettings('time_tracking_summary');
      const doc = new jsPDF({
        orientation: pdfSettings.orientation,
        unit: 'pt',
        format: pdfSettings.pageSize,
      }) as jsPDFWithAutoTable;
      doc.setFont(pdfSettings.fontFamily || 'helvetica');
      const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });
      const selectedMonthLabel = monthsArray.find(m => m.value === selectedMonth)?.label || '';

      let currentY = pdfSettings.marginTop;
      
      if (pdfSettings.headerText) {
        doc.setFontSize(pdfSettings.headerFontSize);
        const headerLines = pdfSettings.headerText.split('\n');
        headerLines.forEach(line => {
            doc.text(line, pdfSettings.marginLeft, currentY);
            currentY += pdfSettings.headerFontSize * 0.7 + 2;
        });
        currentY += 5;
      } else if (pdfSettings.logoUrl && pdfSettings.logoUrl.startsWith('data:image')) {
        try {
          const imgProps = doc.getImageProperties(pdfSettings.logoUrl);
          const formatType = imgProps.fileType.toUpperCase();
          const desiredHeight = 30;
          const imgWidth = (imgProps.width * desiredHeight) / imgProps.height;
          doc.addImage(pdfSettings.logoUrl, formatType, pdfSettings.marginLeft, currentY, imgWidth, desiredHeight);
          currentY += desiredHeight + 5;
        } catch (e) { console.error("Error drawing logo in PDF:", e); }
      }

      const moduleDefaultTitle = `Relevé d'Heures - ${selectedMember.name} (${selectedMember.role}) - ${selectedMonthLabel} ${selectedYear}`;
      let finalTitle = "";
      if (pdfSettings.showDocumentBaseTitle && pdfSettings.documentBaseTitle && pdfSettings.documentBaseTitle.trim() !== "") {
        finalTitle = pdfSettings.documentBaseTitle.trim();
      }
      if (pdfSettings.showModuleTitle) {
        if (finalTitle) {
          finalTitle += ` - ${moduleDefaultTitle}`;
        } else {
          finalTitle = moduleDefaultTitle;
        }
      }

      if(finalTitle) {
        doc.setFontSize(pdfSettings.documentTitleFontSize);
        doc.text(finalTitle, pdfSettings.marginLeft, currentY);
        currentY += pdfSettings.documentTitleFontSize * 0.7 + 5;
      }
      
      doc.setFontSize(pdfSettings.defaultFontSize);
      doc.text(`Généré le: ${generationDateFormatted}`, pdfSettings.marginLeft, currentY);
      currentY += pdfSettings.defaultFontSize + 10;

      doc.setFontSize(pdfSettings.defaultFontSize + 2);
      doc.text("Récapitulatif des Heures pour la période:", pdfSettings.marginLeft, currentY);
      currentY += (pdfSettings.defaultFontSize + 2) * 0.7 + 3;
      doc.setFontSize(pdfSettings.defaultFontSize);
      
      doc.text(`Solde Reporté (fin ${format(startOfMonth(new Date(parseInt(selectedYear), parseInt(selectedMonth), 1)), "MMMM yyyy", {locale: fr})} précédent): ${previousBalance.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 2})} h`, pdfSettings.marginLeft, currentY);
      currentY += pdfSettings.defaultFontSize * 0.7 + 2;
      doc.text(`Total Heures Ajoutées (${selectedMonthLabel} ${selectedYear}): ${statsForSelectedMonth.totalAddedThisMonth.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 2})} h`, pdfSettings.marginLeft, currentY);
      currentY += pdfSettings.defaultFontSize * 0.7 + 2;
      doc.text(`Total Heures Déduites (${selectedMonthLabel} ${selectedYear}): ${statsForSelectedMonth.totalDeductedThisMonth.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 2})} h`, pdfSettings.marginLeft, currentY);
      currentY += pdfSettings.defaultFontSize * 0.7 + 2;
      doc.text(`Solde du Mois (${selectedMonthLabel} ${selectedYear}): ${statsForSelectedMonth.netHoursThisMonth.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 2})} h`, pdfSettings.marginLeft, currentY);
      currentY += pdfSettings.defaultFontSize * 0.7 + 2;
      
      doc.setFontSize(pdfSettings.defaultFontSize + 1);
      doc.setFont(undefined, 'bold');
      doc.text(`Nouveau Solde Cumulé (fin ${selectedMonthLabel} ${selectedYear}): ${cumulativeBalance.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 2})} h`, pdfSettings.marginLeft, currentY);
      currentY += (pdfSettings.defaultFontSize + 1) * 0.7 + 7;
      doc.setFont(undefined, 'normal');

      const headStyles: any = { fontStyle: 'bold', fontSize: pdfSettings.tableHeaderFontSize };
      if (pdfSettings.primaryColor) {
        const primaryColorRgb = hexToRgb(pdfSettings.primaryColor);
        if (primaryColorRgb) {
          headStyles.fillColor = primaryColorRgb;
          const brightness = (primaryColorRgb[0] * 299 + primaryColorRgb[1] * 587 + primaryColorRgb[2] * 114) / 1000;
          headStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
        }
      }

      doc.autoTable({
        startY: currentY,
        head: [['Date', 'Type', 'Heures', 'Raison']],
        body: entriesForSelectedMonth.map(entry => [
          format(new Date(entry.date), "dd/MM/yyyy", { locale: fr }),
          entry.type === 'addition' ? 'Ajout' : 'Déduction',
          entry.hours.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 2}),
          entry.reason,
        ]),
        theme: 'grid',
        headStyles: headStyles,
        styles: { fontSize: pdfSettings.tableBodyFontSize, font: pdfSettings.fontFamily },
        margin: {
          top: pdfSettings.marginTop,
          right: pdfSettings.marginRight,
          bottom: pdfSettings.marginBottom,
          left: pdfSettings.marginLeft,
        },
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          if (pdfSettings.footerText) {
            let footerStr = pdfSettings.footerText
              .replace('{date}', generationDateFormatted)
              .replace('{pageNumber}', data.pageNumber.toString())
              .replace('{totalPages}', pageCount.toString());
            doc.setFontSize(pdfSettings.footerFontSize);
            doc.text(footerStr, data.settings.margin.left, doc.internal.pageSize.height - (pdfSettings.marginBottom / 2));
          }
        }
      });

      doc.save(`Releve_Heures_${selectedMember.name.replace(/\s+/g, '_')}_${selectedMonthLabel}_${selectedYear}.pdf`);
      toast({ title: "PDF Généré", description: `Le relevé d'heures pour ${selectedMember.name} (${selectedMonthLabel} ${selectedYear}) a été téléchargé.` });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Erreur PDF", description: "La génération du PDF a échoué.", variant: "destructive" });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const membersForSelect = isChef ? members : (currentUserBrigadeMember ? [currentUserBrigadeMember] : []);

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-primary"/>
            Relevés Individuels et PDF
        </CardTitle>
        <CardDescription>Consultez le récapitulatif des heures par membre pour une période donnée et générez des relevés PDF.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2">
            <Label htmlFor="member-select-summary">Membre de la Brigade</Label>
            <Select 
                onValueChange={setSelectedMemberId} 
                value={selectedMemberId || ""}
                disabled={!isChef && !!currentUserBrigadeMember}
            >
              <SelectTrigger id="member-select-summary">
                <SelectValue placeholder={!isChef && !currentUserBrigadeMember ? "Aucun membre assigné" : "Sélectionner un membre"} />
              </SelectTrigger>
              <SelectContent>
                {membersForSelect.length > 0 ? membersForSelect.map(member => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name} ({member.role})
                  </SelectItem>
                )) : <SelectItem value="disabled" disabled>
                        {!isChef && !currentUserBrigadeMember ? "Votre compte n'est pas lié à un membre" : "Aucun membre à afficher"}
                    </SelectItem>}
              </SelectContent>
            </Select>
          </div>
           <div>
            <Label htmlFor="year-select-summary">Année</Label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger id="year-select-summary"><SelectValue placeholder="Année" /></SelectTrigger>
              <SelectContent>{yearsArray.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="month-select-summary">Mois</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger id="month-select-summary"><SelectValue placeholder="Mois" /></SelectTrigger>
              <SelectContent>{monthsArray.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button 
            onClick={generatePdf} 
            disabled={!selectedMember || entriesForSelectedMonth.length === 0 && previousBalance === 0 || isGeneratingPdf} // Also check previousBalance for PDF generation
            className="w-full md:col-start-4"
          >
            {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileText className="mr-2 h-4 w-4" />}
            Générer PDF du Relevé
          </Button>
        </div>

        {selectedMember ? (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-foreground">
              Récapitulatif pour {selectedMember.name} - {monthsArray.find(m=>m.value === selectedMonth)?.label} {selectedYear}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Solde Reporté</CardTitle><Scale className="h-4 w-4 text-muted-foreground" /></CardHeader>
                    <CardContent><div className="text-2xl font-bold">{previousBalance.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 2})} h</div></CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Ajouté (ce mois)</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-green-600">{statsForSelectedMonth.totalAddedThisMonth.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 2})} h</div></CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Déduit (ce mois)</CardTitle><TrendingDown className="h-4 w-4 text-muted-foreground" /></CardHeader>
                    <CardContent><div className="text-2xl font-bold text-red-600">{statsForSelectedMonth.totalDeductedThisMonth.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 2})} h</div></CardContent>
                </Card>
                 <Card className="md:col-span-1 lg:col-span-1">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Solde du Mois</CardTitle><Scale className="h-4 w-4 text-muted-foreground" /></CardHeader>
                    <CardContent><div className={`text-2xl font-bold ${statsForSelectedMonth.netHoursThisMonth >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{statsForSelectedMonth.netHoursThisMonth.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 2})} h</div></CardContent>
                </Card>
                <Card className="md:col-span-2 lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Nouveau Solde Cumulé</CardTitle><Scale className="h-4 w-4 text-muted-foreground" /></CardHeader>
                    <CardContent><div className={`text-2xl font-bold ${cumulativeBalance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{cumulativeBalance.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 2})} h</div></CardContent>
                </Card>
            </div>

            {entriesForSelectedMonth.length > 0 ? (
              <div className="overflow-x-auto border rounded-md max-h-[400px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Heures</TableHead>
                      <TableHead>Raison</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entriesForSelectedMonth.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{format(new Date(entry.date), "dd/MM/yyyy", { locale: fr })}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${entry.type === 'addition' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {entry.type === 'addition' ? 'Ajout' : 'Déduction'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{entry.hours.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 2})}</TableCell>
                        <TableCell className="text-sm text-muted-foreground truncate max-w-[200px] sm:max-w-xs">{entry.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
               <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
                <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">
                    Aucune entrée d'heures pour {selectedMember.name} pour {monthsArray.find(m=>m.value === selectedMonth)?.label} {selectedYear}.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
             <p className="text-muted-foreground mt-2 text-sm">
              {isChef ? "Sélectionnez un membre pour afficher son récapitulatif d'heures." : 
               !currentUserBrigadeMember ? "Votre compte utilisateur n'est pas lié à un membre de la brigade." :
               "Chargement de vos données..."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

    
