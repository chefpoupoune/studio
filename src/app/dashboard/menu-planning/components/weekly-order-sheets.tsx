import React, { useMemo, useState } from 'react';
import type { DailyMenu } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Loader2, CalendarRange, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format, parseISO, getDay } from 'date-fns';
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
    console.log('WeeklyOrderSheets component rendering - Map Test');
    console.log('isLoading prop:', isLoading);
    const { toast } = useToast();
    const [isGeneratingPdf, setIsGeneratingPdf] = useState<number | null>(null);
  
    const weeklyGroupedMenus = useMemo(() => {
      return groupMenusByWeek(year, month, menuData);
    }, [year, month, menuData]);
  
    console.log('weeklyGroupedMenus calculated. Length:', weeklyGroupedMenus.length);
  
    const generatePdfForWeek = (week: WeekData, weekIndex: number) => {
      console.log('generatePdfForWeek called for week', week.weekNumberInMonth);
      setIsGeneratingPdf(weekIndex);
    
      try {
        const pdfSettings = getPdfLayoutSettings('weekly_order_sheet');
        const doc = new jsPDF({
          orientation: pdfSettings.orientation,
          unit: 'pt',
          format: pdfSettings.pageSize
        }) as jsPDFWithAutoTable;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let currentY = pdfSettings.marginTop;
        doc.setFont(pdfSettings.fontFamily);
    
        // *** Section En-tête et Titre du Document ***
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
                      const formatType = imgProps.fileType.toUpperCase();
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
                      doc.addImage(pdfSettings.logoUrl, formatType, imgX, imgY, imgWidth, imgHeight);
                  } catch (e: any) {
                      console.error(`Error drawing logo in PDF header table: ${e.message || e}. Cell:`, data.cell, {logoUrl: pdfSettings.logoUrl ? pdfSettings.logoUrl.substring(0, 50) + "..." : "N/A"});
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
              const formatType = imgProps.fileType.toUpperCase();
              const desiredHeight = 30;
              const imgWidth = (imgProps.width * desiredHeight) / imgProps.height;
              doc.addImage(pdfSettings.logoUrl, formatType, pdfSettings.marginLeft, currentY, imgWidth, desiredHeight);
              currentY += desiredHeight + 5;
          } catch(e: any) {
              console.error(`Error drawing standalone logo in PDF: ${e.message || e}.`, {logoUrl: pdfSettings.logoUrl ? pdfSettings.logoUrl.substring(0, 50) + "..." : "N/A"});
              doc.setFontSize(pdfSettings.headerFontSize); doc.text(`[Logo Error]`, pdfSettings.marginLeft, currentY); currentY += pdfSettings.headerFontSize + 5;
          }
        } else if (pdfSettings.logoUrl) {
           doc.setFontSize(pdfSettings.headerFontSize); doc.text(`[Logo URL: ${pdfSettings.logoUrl}]`, pdfSettings.marginLeft, currentY); currentY += pdfSettings.headerFontSize + 5;
        }
    
        const moduleDefaultTitle = "Fiche de Commande Cuisine";
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
    
        if (finalTitle) {
          doc.setFontSize(pdfSettings.documentTitleFontSize);
          doc.text(finalTitle, pageWidth / 2, currentY + 5, { align: 'center' });
          currentY += (pdfSettings.documentTitleFontSize || 14) + 5;
        }
    
        doc.setFontSize(pdfSettings.defaultFontSize);
        const semaineText = `Semaine du: ${format(week.startDate, "dd/MM/yyyy", { locale: fr })}  Au: ${format(week.endDate, "dd/MM/yyyy", { locale: fr })}`;
        doc.text(semaineText, pdfSettings.marginLeft, currentY + 10);
        currentY += (pdfSettings.defaultFontSize * 1.2) + 10;
    
        // *** Section Tableaux des Menus et Catégories ***
    
        // Prepare data for the weekly menu table
        const weeklyMenuHeader = [['Date', 'Jour', 'Entrée', 'Plat', 'Féculent', 'Légume', 'Sauce', 'Dessert']];
        const weeklyMenuBody = week.menus.map(menu => [
          format(parseISO(menu.date), 'dd/MM', { locale: fr }),
          menu.dayName,
          menu.entree || '-',
          menu.plat || '-',
          menu.feculent || '-',
          menu.legume || '-',
          menu.sauce || '-',
          menu.dessert || '-',
        ]);
    
        // Add the weekly menu table to the PDF (maintenant le premier autoTable)
        doc.autoTable({
          startY: currentY, // Commencez après l'en-tête/titre
          head: weeklyMenuHeader,
          body: weeklyMenuBody,
          theme: 'grid', // Use 'grid' theme for borders
          headStyles: { fontStyle: 'bold', fontSize: pdfSettings.tableHeaderFontSize, halign: 'center',fillColor: [109,7,26],textColor: [255,255,255]}, // Basic header style
          styles: {
            fontSize: pdfSettings.tableBodyFontSize,
            cellPadding: 2,
            valign: 'middle',
            font: pdfSettings.fontFamily,
            lineWidth: 0.1, // Ajoutez cette ligne pour l'épaisseur
            lineColor: [0, 0, 0], // Ajoutez cette ligne pour la couleur noire (RGB)
            minCellHeight: 20,
            textColor: [0, 0, 0]
        },
        
          columnStyles: {
            0: { cellWidth: 40 }, // Date
            1: { cellWidth: 40 }, // Jour
            2: { cellWidth: 'auto' }, // Entrée
            3: { cellWidth: 'auto' }, // Plat
            4: { cellWidth: 'auto' }, // Féculent
            5: { cellWidth: 'auto' }, // Légume
            6: { cellWidth: 'auto' }, // Sauce
            7: { cellWidth: 'auto' }, // Dessert
          },
          margin: { left: pdfSettings.marginLeft, right: pdfSettings.marginRight },
          // Conservez le didDrawPage si vous l'aviez ici pour les numéros de page, etc.
          didDrawPage: (data) => {
              // Redefine generationDateFormatted inside the callback or ensure it's accessible
              const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr }); // Redefine here
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
        console.log('Weekly menu table added'); // Log après l'ajout du premier tableau
    
        // Add a vertical space after the weekly menu table
        currentY = (doc as any).lastAutoTable.finalY + 15; // Commencez après la fin du premier tableau
    
        // Prepare data for the categories table
        const categoriesHeader = [['Fruits et Légumes','QTD' , 'Frais', 'QTD' , 'Surgeler', 'QTD', 'Viande','QTD', 'Sec','QTD', 'Autres','QTD']];
        // categoriesBody is left empty as per the original structure, assuming it's for manual filling
        const categoriesBody = Array(26).fill(Array(12).fill(' '));
    
        // Add the categories table to the PDF (maintenant le deuxième autoTable)
        doc.autoTable({
          startY: currentY, // Commencez après la fin du premier tableau
          head: categoriesHeader,
          body: categoriesBody,
          theme: 'grid',
      

          headStyles: { // Styles pour l'en-tête du tableau des menus
            fontStyle: 'bold',
            fontSize:10,
            halign: 'center', // Centrage horizontal de l'en-tête
            fillColor: [109,7,26]},
        
          columnStyles: {
            0: { fillColor: [200, 230, 201], cellWidth: 150, }, // Commented out: categoryCellWidth largeur colone
            1: { fillColor: [200, 230, 201], cellWidth: 50, }, // Commented out: categoryCellWidth largeur colone
            2: { fillColor: [173, 216, 230], cellWidth: 150 }, // Commented out: categoryCellWidth is not defined
            3: { fillColor: [173, 216, 230], cellWidth: 50  }, // Commented out: categoryCellWidth is not defined
            4: { fillColor: [173, 216, 230], cellWidth: 150 }, // Commented out: categoryCellWidth is not defined
            5: { fillColor: [173, 216, 230], cellWidth: 50 }, // Commented out: categoryCellWidth is not defined
            6: { fillColor: [255, 192, 203], cellWidth: 150 }, // Commented out: categoryCellWidth is not defined
            7: { fillColor: [255, 192, 203], cellWidth: 50 }, // Commented out: categoryCellWidth is not defined
            8: { fillColor: [220, 220, 220], cellWidth: 150 }, // Commented out: categoryCellWidth is not defined
            9: { fillColor: [220, 220, 220], cellWidth: 50 }, // Commented out: categoryCellWidth is not defined
            10: { fillColor: [220, 220, 220], cellWidth: 100 }, // Commented out: categoryCellWidth is not defined
            11: { fillColor: [220, 220, 220], cellWidth: 50 }, // Commented out: categoryCellWidth is not defined
          },
          styles: {
            cellPadding: 2,
            minCellHeight: 20,
            fontSize: pdfSettings.tableBodyFontSize,
            font: pdfSettings.fontFamily,
            lineWidth: 0.1, // Ajoutez cette ligne pour l'épaisseur
            lineColor: [0, 0, 0] // Ajoutez cette ligne pour la couleur noire (RGB)
  
        },
        
          tableWidth: 'auto',
          margin: { left: pdfSettings.marginLeft, right: pdfSettings.marginRight },
          // Conservez le didDrawPage si vous l'aviez ici (probablement pas nécessaire s'il est déjà dans le premier autoTable)
        });
        console.log('Categories table added'); // Log après l'ajout du deuxième tableau
    
    
        console.log('Attempting to save PDF for week', week.weekNumberInMonth);
        doc.save(`Fiche_Commande_Semaine_${weekIndex + 1}.pdf`);
        toast({ title: "PDF Fiche de Commande Généré", description: `La fiche de commande pour la Semaine ${week.weekNumberInMonth} a été téléchargée.` });
    
      } catch (e: any) {
        console.error('Error during PDF generation:', e);
        toast({ title: "Erreur PDF", description: "La génération du PDF de la fiche de commande a échoué.", variant: "destructive" });
      } finally {
        console.log('generatePdfForWeek finally block completed for week', week.weekNumberInMonth);
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
      console.log('weeklyGroupedMenus is empty, showing no weeks message.');
      return (
        <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
            <CalendarRange className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
                Aucune semaine à afficher pour {format(new Date(year, month), "MMMM yyyy", { locale: fr })}.
            </p>
            <p className="text-xs text-muted-foreground/70">
                Vérifiez que des menus sont planifiés pour ce mois dans l\'onglet \"Planification Mensuelle\".
            </p>
        </div>
      );
    }
  
    console.log('Before map loop, weeklyGroupedMenus length:', weeklyGroupedMenus.length);
  
    return (
      <>
        <div className="space-y-6">
        {/* Testing interation and basic rendering with actual data */}
        {Array.from(weeklyGroupedMenus).map((week, index) => ( // <-- Boucle map commence ici
          <Card key={week.weekNumberInMonth || index} className="shadow-md">
            <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <CardTitle>
                  Semaine {week.weekNumberInMonth}: {format(week.startDate, "dd LLLL", { locale: fr })} - {format(week.endDate, "dd LLLL yyyy", { locale: fr })}
                </CardTitle>
                <CardDescription>
                  ...
                </CardDescription>
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
              {/* Rétablir la logique conditionnelle et le message "Aucun menu planifié..." */}
              {week.menus && week.menus.length > 0 ? (
               <> {/* Using Fragment to group elements */}
               {console.log("Condition is true for week", week.weekNumberInMonth, "Rendering Table")} {/* Optional: keep this log for confirmation */}
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
                   {week.menus.map((menu, menuIndex) => (
                     <TableRow key={menuIndex}> {/* Using menuIndex as key for simplicity here */}
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
             </>
             
              ) : (
                <div className="text-center py-6 text-muted-foreground flex items-center justify-center gap-2">
                  <AlertCircle className="w-5 h-5" /> Aucun menu planifié pour cette semaine. La fiche de commande sera vierge.
                </div>
              )}
            </CardContent>
          </Card>
        ))} {/* <-- Boucle map se termine ici */}
      </div> {/* Fermeture du div space-y-6 */}
        </>
      ); // Parenthèse de fin du return
    } // Fin de la fonction
    
  