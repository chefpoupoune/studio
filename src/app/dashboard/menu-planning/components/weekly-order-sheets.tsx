
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
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';

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
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<number | null>(null); 

  const weeklyGroupedMenus = useMemo(() => {
    return groupMenusByWeek(year, month, menuData);
  }, [year, month, menuData]);

  const generatePdfForWeek = (week: WeekData, weekIndex: number) => {
    setIsGeneratingPdf(weekIndex);

    try {
      const pdfSettings = getPdfLayoutSettings('weekly_order_sheet');
      const doc = new jsPDF({ orientation: 'landscape', format: 'a3' }) as jsPDFWithAutoTable;
      doc.setFont(pdfSettings.fontFamily);

      const pageHeight = doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.getWidth();
      const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });

      let currentY = pdfSettings.marginTop;

      if (pdfSettings.headerText) {
        const headerRows = pdfSettings.headerText.split('\n').map(rowText => 
          rowText.split('|').map(cellText => cellText.trim())
        );
        const headerTableBody = headerRows.map(row => row.map(cell => cell === '{logo}' ? '' : cell));
        
        doc.autoTable({
          body: headerTableBody,
          startY: currentY,
          theme: 'plain',
          styles: { fontSize: pdfSettings.headerFontSize, cellPadding: 1, font: pdfSettings.fontFamily },
          columnStyles: { 0: { cellWidth: 'auto'} }, 
          margin: { top: pdfSettings.marginTop, left: pdfSettings.marginLeft, right: pdfSettings.marginRight },
          didDrawCell: (data) => {
            if (pdfSettings.logoUrl && pdfSettings.logoUrl.startsWith('data:image') && headerRows[data.row.index][data.column.index] === '{logo}') {
                try {
                    const imgProps = doc.getImageProperties(pdfSettings.logoUrl);
                    const cellPadding = 2;
                    let imgWidth = data.cell.width - 2 * cellPadding;
                    let imgHeight = data.cell.height - 2 * cellPadding;
                    const cellAspectRatio = data.cell.width / data.cell.height;
                    const imgAspectRatio = imgProps.width / imgProps.height;

                    if (imgAspectRatio > cellAspectRatio) {
                        imgHeight = imgWidth / imgAspectRatio;
                    } else {
                        imgWidth = imgHeight * imgAspectRatio;
                    }
                    const imgX = data.cell.x + (data.cell.width - imgWidth) / 2;
                    const imgY = data.cell.y + (data.cell.height - imgHeight) / 2;
                    doc.addImage(pdfSettings.logoUrl, imgProps.fileType, imgX, imgY, imgWidth, imgHeight);
                } catch (e) { 
                    console.error("Error drawing logo in PDF header table:", e);
                    doc.setFillColor(230, 230, 230); doc.rect(data.cell.x + 2, data.cell.y + 2, data.cell.width - 4, data.cell.height - 4, 'F');
                    doc.setFontSize(8); doc.setTextColor(100); doc.text("LOGO_ERR", data.cell.x + data.cell.width/2, data.cell.y + data.cell.height/2, {align: 'center', baseline: 'middle'});
                }
            } else if (pdfSettings.logoUrl && headerRows[data.row.index][data.column.index] === '{logo}') {
                doc.setFillColor(230, 230, 230); doc.rect(data.cell.x + 2, data.cell.y + 2, data.cell.width - 4, data.cell.height - 4, 'F');
                doc.setFontSize(8); doc.setTextColor(100); doc.text("LOGO", data.cell.x + data.cell.width/2, data.cell.y + data.cell.height/2, {align: 'center', baseline: 'middle'});
            }
          },
        });
        currentY = (doc as any).lastAutoTable.finalY + 5;
      } else if (pdfSettings.logoUrl && pdfSettings.logoUrl.startsWith('data:image')) { 
        try {
            const imgProps = doc.getImageProperties(pdfSettings.logoUrl);
            const desiredHeight = 30; 
            const imgWidth = (imgProps.width * desiredHeight) / imgProps.height;
            doc.addImage(pdfSettings.logoUrl, imgProps.fileType, pdfSettings.marginLeft, currentY, imgWidth, desiredHeight);
            currentY += desiredHeight + 5;
        } catch(e) {
            console.error("Error drawing standalone logo in PDF:", e);
            doc.setFontSize(pdfSettings.headerFontSize); doc.text(`[Logo Error]`, pdfSettings.marginLeft, currentY); currentY += pdfSettings.headerFontSize + 5;
        }
      } else if (pdfSettings.logoUrl) {
         doc.setFontSize(pdfSettings.headerFontSize); doc.text(`[Logo URL: ${pdfSettings.logoUrl}]`, pdfSettings.marginLeft, currentY); currentY += pdfSettings.headerFontSize + 5;
      }
      
      doc.setFontSize(pdfSettings.headerFontSize + 4); 
      doc.text("Fiche de Commande Cuisine", pageWidth / 2, currentY + 5, { align: 'center' });
      currentY += pdfSettings.headerFontSize + 5;
      
      doc.setFontSize(pdfSettings.defaultFontSize);
      const semaineText = `Semaine du: ${format(week.startDate, "dd/MM/yyyy", { locale: fr })}  Au: ${format(week.endDate, "dd/MM/yyyy", { locale: fr })}`;
      doc.text(semaineText, pdfSettings.marginLeft, currentY + 10);
      doc.text(`Généré le: ${generationDateFormatted}`, pageWidth - pdfSettings.marginRight, currentY + 10, { align: 'right'});
      currentY += (pdfSettings.defaultFontSize * 1.2) + 10;


      const tableHeadStyles: { fillColor?: [number, number, number], textColor?: [number, number, number], fontStyle?: string, halign?: string, fontSize?: number } = { 
        fontStyle: 'bold', 
        halign: 'center',
        fontSize: pdfSettings.tableHeaderFontSize,
      };
      if (pdfSettings.primaryColor) {
        const primaryColorRgb = hexToRgb(pdfSettings.primaryColor);
        if (primaryColorRgb) {
          tableHeadStyles.fillColor = primaryColorRgb;
          const brightness = (primaryColorRgb[0] * 299 + primaryColorRgb[1] * 587 + primaryColorRgb[2] * 114) / 1000;
          tableHeadStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
        }
      }


      const daysHeader = [['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']];
      const daysBody = Array(3).fill(Array(6).fill('')); 

      doc.autoTable({
        startY: currentY,
        head: daysHeader,
        body: daysBody,
        theme: 'grid',
        headStyles: tableHeadStyles,
        styles: { cellPadding: 3, minCellHeight: 10, fontSize: pdfSettings.tableBodyFontSize, font: pdfSettings.fontFamily },
        tableWidth: 'auto',
        margin: { left: pdfSettings.marginLeft, right: pdfSettings.marginRight },
      });
      currentY = (doc as any).lastAutoTable.finalY + 5;

      doc.setFillColor(0, 0, 0);
      doc.rect(pdfSettings.marginLeft, currentY, pageWidth - (pdfSettings.marginLeft + pdfSettings.marginRight), 2, 'F');
      currentY += 7;
      
      doc.setFontSize(pdfSettings.defaultFontSize - 1); 
      const imeInfo = "IME Brebières / 46 chemin du bois des Caures / 62117 Brebières  03.21.50.00.36";
      const apiInfo = "API 771";
      const imeInfoWidth = doc.getTextWidth(imeInfo);
      const apiInfoWidth = doc.getTextWidth(apiInfo);
      doc.text(imeInfo, (pageWidth - imeInfoWidth - apiInfoWidth - 10) / 2 + pdfSettings.marginLeft, currentY); 
      doc.text(apiInfo, pageWidth - pdfSettings.marginRight - apiInfoWidth, currentY); 
      currentY += pdfSettings.defaultFontSize * 0.7 + 2;

      doc.setFillColor(0, 0, 0);
      doc.rect(pdfSettings.marginLeft, currentY, pageWidth - (pdfSettings.marginLeft + pdfSettings.marginRight), 2, 'F');
      currentY += 10;
      
      const categoriesHeader = [['Fruits et Légumes', 'Frais', 'Surgeler', 'Viande', 'Sec', 'Autres']];
      const categoriesBody = Array(26).fill(Array(6).fill(' ')); 

      const categoryCellWidth = (pageWidth - (pdfSettings.marginLeft + pdfSettings.marginRight)) / 6;
      
      doc.autoTable({
        startY: currentY,
        head: categoriesHeader,
        body: categoriesBody,
        theme: 'grid',
        headStyles: tableHeadStyles, 
        columnStyles: {
          0: { fillColor: [200, 230, 201], cellWidth: categoryCellWidth }, 
          1: { fillColor: [173, 216, 230], cellWidth: categoryCellWidth }, 
          2: { fillColor: [173, 216, 230], cellWidth: categoryCellWidth }, 
          3: { fillColor: [255, 192, 203], cellWidth: categoryCellWidth }, 
          4: { fillColor: [220, 220, 220], cellWidth: categoryCellWidth }, 
          5: { fillColor: [220, 220, 220], cellWidth: categoryCellWidth }, 
        },
        styles: { cellPadding: 2, minCellHeight: 8, fontSize: pdfSettings.tableBodyFontSize, font: pdfSettings.fontFamily },
        tableWidth: 'auto',
        margin: { left: pdfSettings.marginLeft, right: pdfSettings.marginRight },
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          if (pdfSettings.footerText) {
            let footerStr = pdfSettings.footerText
              .replace('{date}', generationDateFormatted)
              .replace('{pageNumber}', data.pageNumber.toString())
              .replace('{totalPages}', pageCount.toString());
            doc.setFontSize(pdfSettings.footerFontSize);
            doc.text(footerStr, pdfSettings.marginLeft, pageHeight - (pdfSettings.marginBottom / 2));
          }
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
          <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <CardTitle>
                Semaine {week.weekNumberInMonth}: {format(week.startDate, "dd LLLL", { locale: fr })} - {format(week.endDate, "dd LLLL yyyy", { locale: fr })}
              </CardTitle>
              <CardDescription>
                Générez une fiche de commande vierge pour cette semaine.
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

