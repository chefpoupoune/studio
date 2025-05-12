
"use client";

import React, { useState, useMemo } from 'react';
import type { BrigadeMember, TimeEntry } from '../types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, UserCheck, TrendingUp, TrendingDown, Scale, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable'; 
import { format } from 'date-fns';
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
}

export default function MemberSummaryPdf({ members, timeEntries }: MemberSummaryPdfProps) {
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const { toast } = useToast();

  const selectedMember = useMemo(() => {
    return members.find(m => m.id === selectedMemberId) || null;
  }, [selectedMemberId, members]);

  const memberTimeEntries = useMemo(() => {
    if (!selectedMemberId) return [];
    return timeEntries
      .filter(entry => entry.memberId === selectedMemberId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedMemberId, timeEntries]);

  const summaryStats = useMemo(() => {
    if (!selectedMemberId) return { totalAdded: 0, totalDeducted: 0, netHours: 0 };
    
    const totalAdded = memberTimeEntries
      .filter(e => e.type === 'addition')
      .reduce((sum, e) => sum + e.hours, 0);
      
    const totalDeducted = memberTimeEntries
      .filter(e => e.type === 'deduction')
      .reduce((sum, e) => sum + e.hours, 0);
      
    return {
      totalAdded,
      totalDeducted,
      netHours: totalAdded - totalDeducted,
    };
  }, [memberTimeEntries, selectedMemberId]);

  const generatePdf = () => {
    if (!selectedMember || memberTimeEntries.length === 0) {
      toast({ title: "Données Insuffisantes", description: "Sélectionnez un membre avec des entrées d'heures pour générer un PDF.", variant: "destructive" });
      return;
    }
    setIsGeneratingPdf(true);

    try {
      const pdfSettings = getPdfLayoutSettings('time_tracking_summary');
      const doc = new jsPDF() as jsPDFWithAutoTable;
      const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });

      let currentY = 15;
      if (pdfSettings.headerText) {
        doc.setFontSize(10);
        doc.text(pdfSettings.headerText, 14, currentY);
        currentY += 10;
      }

      const title = `Relevé d'Heures - ${selectedMember.name} (${selectedMember.role})`;
      doc.setFontSize(18);
      doc.text(title, 14, currentY);
      currentY += 8;
      doc.setFontSize(10);
      doc.text(`Généré le: ${generationDateFormatted}`, 14, currentY);
      currentY += 10;

      doc.setFontSize(12);
      doc.text("Récapitulatif des Heures:", 14, currentY);
      currentY += 6;
      doc.setFontSize(10);
      doc.text(`Total Heures Ajoutées: ${summaryStats.totalAdded.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 2})} h`, 14, currentY);
      currentY += 6;
      doc.text(`Total Heures Déduites: ${summaryStats.totalDeducted.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 2})} h`, 14, currentY);
      currentY += 6;
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text(`Solde d'Heures: ${summaryStats.netHours.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 2})} h`, 14, currentY);
      currentY += 7;
      doc.setFont(undefined, 'normal');

      const headStyles: { fillColor?: [number, number, number], textColor?: [number, number, number] } = {};
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
        body: memberTimeEntries.map(entry => [
          format(new Date(entry.date), "dd/MM/yyyy", { locale: fr }),
          entry.type === 'addition' ? 'Ajout' : 'Déduction',
          entry.hours.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 2}),
          entry.reason,
        ]),
        theme: 'grid',
        headStyles: headStyles,
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          if (pdfSettings.footerText) {
            let footerStr = pdfSettings.footerText
              .replace('{date}', generationDateFormatted)
              .replace('{pageNumber}', data.pageNumber.toString())
              .replace('{totalPages}', pageCount.toString());
            doc.setFontSize(9);
            doc.text(footerStr, data.settings.margin.left, doc.internal.pageSize.height - 10);
          }
        }
      });

      doc.save(`Releve_Heures_${selectedMember.name.replace(/\s+/g, '_')}_${format(new Date(), "yyyyMMdd")}.pdf`);
      toast({ title: "PDF Généré", description: `Le relevé d'heures pour ${selectedMember.name} a été téléchargé.` });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Erreur PDF", description: "La génération du PDF a échoué.", variant: "destructive" });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-primary"/>
            Relevés Individuels et PDF
        </CardTitle>
        <CardDescription>Consultez le récapitulatif des heures par membre et générez des relevés PDF.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="w-full sm:w-1/2">
            <Label htmlFor="member-select-summary">Membre de la Brigade</Label>
            <Select onValueChange={setSelectedMemberId} value={selectedMemberId || ""}>
              <SelectTrigger id="member-select-summary">
                <SelectValue placeholder="Sélectionner un membre" />
              </SelectTrigger>
              <SelectContent>
                {members.length > 0 ? members.map(member => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name} ({member.role})
                  </SelectItem>
                )) : <SelectItem value="disabled" disabled>Aucun membre à afficher</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <Button 
            onClick={generatePdf} 
            disabled={!selectedMember || memberTimeEntries.length === 0 || isGeneratingPdf} 
            className="w-full sm:w-auto"
          >
            {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileText className="mr-2 h-4 w-4" />}
            Générer PDF du Relevé
          </Button>
        </div>

        {selectedMember ? (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-foreground">
              Récapitulatif pour {selectedMember.name}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Heures Ajoutées</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{summaryStats.totalAdded.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 2})} h</div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Heures Déduites</CardTitle>
                        <TrendingDown className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{summaryStats.totalDeducted.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 2})} h</div>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Solde d'Heures</CardTitle>
                        <Scale className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${summaryStats.netHours >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                            {summaryStats.netHours.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 2})} h
                        </div>
                    </CardContent>
                </Card>
            </div>

            {memberTimeEntries.length > 0 ? (
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
                    {memberTimeEntries.map((entry) => (
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
              <p className="text-muted-foreground text-center py-8">Aucune entrée d'heures pour ce membre.</p>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">Sélectionnez un membre pour afficher son récapitulatif d'heures.</p>
        )}
      </CardContent>
    </Card>
  );
}

