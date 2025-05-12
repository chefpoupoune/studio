
"use client";

import React, { useMemo, useState } from 'react';
import type { DailyMenu } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Loader2, CalendarRange, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { groupMenusByWeek, type WeekData } from '../utils';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

interface WeeklyOrderSheetsProps {
  year: number;
  month: number; // 0-indexed
  menuData: DailyMenu[];
  isLoading: boolean;
}

export default function WeeklyOrderSheets({ year, month, menuData, isLoading }: WeeklyOrderSheetsProps) {
  const { toast } = useToast();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<number | null>(null); // Store week index being generated

  const weeklyGroupedMenus = useMemo(() => {
    // This grouping is still useful for the UI part and for knowing week start/end dates for PDF title
    return groupMenusByWeek(year, month, menuData);
  }, [year, month, menuData]);

  const generatePdfForWeek = (week: WeekData, weekIndex: number) => {
    setIsGeneratingPdf(weekIndex);

    try {
      const doc = new jsPDF('landscape') as jsPDFWithAutoTable;
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 14;

      // Header
      doc.setFontSize(16);
      doc.text("Fiche de Commande Cuisine", pageWidth / 2, margin + 5, { align: 'center' });
      
      doc.setFontSize(10);
      const semaineText = `Semaine du: ${format(week.startDate, "dd/MM/yyyy", { locale: fr })}  Au: ${format(week.endDate, "dd/MM/yyyy", { locale: fr })}`;
      doc.text(semaineText, margin, margin + 15);
      doc.text(`Généré le: ${format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}`, pageWidth - margin, margin + 15, { align: 'right'});

      let currentY = margin + 25;

      // First Table (Days of the week)
      const daysHeader = [['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']];
      const daysBody = Array(3).fill(Array(6).fill('')); // 3 empty rows

      doc.autoTable({
        startY: currentY,
        head: daysHeader,
        body: daysBody,
        theme: 'grid',
        headStyles: { fillColor: [220, 220, 220], textColor: [0,0,0], fontStyle: 'bold', halign: 'center' },
        styles: { cellPadding: 3, minCellHeight: 10 },
        tableWidth: 'auto',
        margin: { left: margin, right: margin },
      });
      currentY = (doc as any).lastAutoTable.finalY + 5;

      // Black bar separator
      doc.setFillColor(0, 0, 0);
      doc.rect(margin, currentY, pageWidth - (2 * margin), 2, 'F');
      currentY += 7;
      
      // IME Brebières Info
      doc.setFontSize(9);
      const imeInfo = "IME Brebières / 46 chemin du bois des Caures / 62117 Brebières  03.21.50.00.36";
      const apiInfo = "API 771";
      const imeInfoWidth = doc.getTextWidth(imeInfo);
      const apiInfoWidth = doc.getTextWidth(apiInfo);
      doc.text(imeInfo, (pageWidth - imeInfoWidth - apiInfoWidth - 10) / 2 + margin, currentY); // Center main part
      doc.text(apiInfo, pageWidth - margin - apiInfoWidth, currentY); // API info to the right
      currentY += 5;

      // Another Black bar separator
      doc.setFillColor(0, 0, 0);
      doc.rect(margin, currentY, pageWidth - (2 * margin), 2, 'F');
      currentY += 10;
      
      // Second Table (Categories)
      const categoriesHeader = [['Fruits et Légumes', 'Frais', 'Surgeler', 'Viande', 'Sec', 'Autres']];
      const categoriesBody = Array(15).fill(Array(6).fill(' ')); // 15 empty rows, use ' ' to ensure cell borders render

      doc.autoTable({
        startY: currentY,
        head: categoriesHeader,
        body: categoriesBody,
        theme: 'grid',
        headStyles: { fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          0: { fillColor: [200, 230, 201] }, // Light Green for Fruits et Légumes
          1: { fillColor: [173, 216, 230] }, // Light Blue for Frais
          2: { fillColor: [173, 216, 230] }, // Light Blue for Surgeler
          3: { fillColor: [255, 192, 203] }, // Light Red/Pink for Viande
          4: { fillColor: [220, 220, 220] }, // Light Grey for Sec
          5: { fillColor: [220, 220, 220] }, // Light Grey for Autres
        },
        styles: { cellPadding: 2, minCellHeight: 8, fontSize: 9, cellWidth: 'wrap' },
        tableWidth: 'auto',
        margin: { left: margin, right: margin },
        didDrawPage: (data) => {
          // Footer for page number
          doc.setFontSize(10);
          doc.text(`Page ${data.pageNumber}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
        }
      });
      
      doc.save(`Fiche_Commande_Vierge_${format(week.startDate, "yyyy-MM-dd")}_${format(week.endDate, "yyyy-MM-dd")}.pdf`);
      toast({ title: "PDF de Commande Vierge Généré", description: `Fiche de commande pour la semaine du ${format(week.startDate, "dd/MM", { locale: fr })} téléchargée.` });

    } catch (error) {
      console.error("Error generating PDF for week:", error);
      toast({ title: "Erreur PDF", description: "La génération du PDF a échoué.", variant: "destructive" });
    } finally {
      setIsGeneratingPdf(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Chargement des données hebdomadaires...</span>
      </div>
    );
  }

  if (weeklyGroupedMenus.length === 0) {
    return (
      <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
          <CalendarRange className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
              Aucune semaine à afficher pour {format(new Date(year, month), "MMMM yyyy", { locale: fr })}.
          </p>
          <p className="text-xs text-muted-foreground/70">
              Vérifiez que des menus sont planifiés pour ce mois dans l'onglet "Planification Mensuelle".
          </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {weeklyGroupedMenus.map((week, index) => (
        <Card key={index} className="shadow-md">
          <CardHeader className="flex flex-row justify-between items-center">
            <div>
              <CardTitle>
                Semaine {week.weekNumberInMonth}: {format(week.startDate, "dd LLLL", { locale: fr })} - {format(week.endDate, "dd LLLL yyyy", { locale: fr })}
              </CardTitle>
              <CardDescription>
                {/* This description might need update as PDF is now a template */}
                Générez une fiche de commande vierge pour cette semaine.
                {/* {week.menus.length} jour{week.menus.length > 1 ? 's' : ''} avec menu planifié cette semaine. */}
              </CardDescription>
            </div>
            <Button 
              onClick={() => generatePdfForWeek(week, index)} 
              disabled={isGeneratingPdf === index}
              size="sm"
            >
              {isGeneratingPdf === index ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Générer PDF Commande
            </Button>
          </CardHeader>
          <CardContent>
            {/* The UI display of menus for the week is kept as is. The PDF generation is what changes. */}
            {week.menus.length > 0 ? (
              <div className="overflow-x-auto border rounded-md max-h-[300px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/20">
                    <TableRow>
                      <TableHead className="w-[80px]">Date</TableHead>
                      <TableHead className="w-[100px]">Jour</TableHead>
                      <TableHead>Entrée</TableHead>
                      <TableHead>Plat</TableHead>
                      <TableHead>Féculent</TableHead>
                      <TableHead>Légume</TableHead>
                      <TableHead>Sauce</TableHead>
                      <TableHead>Dessert</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {week.menus.map(menu => (
                      <TableRow key={menu.date}>
                        <TableCell>{format(parseISO(menu.date), "dd/MM", { locale: fr })}</TableCell>
                        <TableCell>{menu.dayName}</TableCell>
                        <TableCell className="truncate max-w-[150px] text-xs" title={menu.entree}>{menu.entree || "-"}</TableCell>
                        <TableCell className="truncate max-w-[150px] text-xs" title={menu.plat}>{menu.plat || "-"}</TableCell>
                        <TableCell className="truncate max-w-[150px] text-xs" title={menu.feculent}>{menu.feculent || "-"}</TableCell>
                        <TableCell className="truncate max-w-[150px] text-xs" title={menu.legume}>{menu.legume || "-"}</TableCell>
                        <TableCell className="truncate max-w-[150px] text-xs" title={menu.sauce}>{menu.sauce || "-"}</TableCell>
                        <TableCell className="truncate max-w-[150px] text-xs" title={menu.dessert}>{menu.dessert || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground flex items-center justify-center gap-2">
                <AlertCircle className="w-5 h-5" /> Aucun menu planifié pour cette semaine. La fiche de commande sera vierge.
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

