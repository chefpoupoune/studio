
"use client";

import React, { useState, useMemo } from 'react';
import type { Product, ProductFamily } from '../types';
import { PRODUCT_FAMILIES } from '../types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ListChecks, Printer, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

interface GenerateInventoryProps {
  products: Product[];
}

export default function GenerateInventory({ products }: GenerateInventoryProps) {
  const [generatedInventory, setGeneratedInventory] = useState<Product[] | null>(null);
  const [generationDate, setGenerationDate] = useState<Date | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const { toast } = useToast();

  const handleGenerateInventory = () => {
    setGeneratedInventory([...products]); 
    setGenerationDate(new Date());
    toast({ title: "Inventaire Généré", description: "L'inventaire actuel a été capturé." });
  };

  const groupedInventory = useMemo(() => {
    if (!generatedInventory) return {};
    const grouped = generatedInventory.reduce((acc, product) => {
      const family = product.family && PRODUCT_FAMILIES.includes(product.family)
        ? product.family
        : 'Non classé';
      if (!acc[family]) {
        acc[family] = [];
      }
      acc[family].push(product);
      return acc;
    }, {} as Record<ProductFamily | 'Non classé', Product[]>);

    const familyOrder: (ProductFamily | 'Non classé')[] = [...PRODUCT_FAMILIES, 'Non classé'];
    const sortedGroups: Record<string, Product[]> = {};
    familyOrder.forEach(family => {
      if (grouped[family]) {
        sortedGroups[family] = grouped[family];
      }
    });
    return sortedGroups;
  }, [generatedInventory]);

    const handlePrintInventory = async () => {
    if (!generatedInventory || !generationDate) {
      toast({ title: "Erreur Impression", description: "Aucun inventaire généré à imprimer.", variant: "destructive" });
      return;
    }
    setIsPrinting(true);
    try {
      const pdfSettings = await getPdfLayoutSettings('inventory_report');

      const doc = new jsPDF({
        orientation: pdfSettings.orientation,
        unit: 'pt',
        format: pdfSettings.pageSize,
      }) as jsPDFWithAutoTable;
      doc.setFont(pdfSettings.fontFamily);
      const generationDateFormatted = format(generationDate, "dd MMMM yyyy 'à' HH:mm", { locale: fr });
      
      let currentY = pdfSettings.marginTop;
      const pageContentWidth = doc.internal.pageSize.width - pdfSettings.marginLeft - pdfSettings.marginRight;
      
      if (pdfSettings.headerText) {
          const headerRows = pdfSettings.headerText.split('\n');
          doc.setFontSize(pdfSettings.headerFontSize);

          for (const row of headerRows) {
              const cells = row.split('|');
              if (cells.length === 0) continue;
              
              const cellWidth = pageContentWidth / cells.length;
              let maxHeightInRow = 0;
              
              cells.forEach(cell => {
                  const cellText = cell.trim();
                  if (cellText === '{logo}' && pdfSettings.logoUrl) {
                      maxHeightInRow = Math.max(maxHeightInRow, 30);
                  } else {
                      const textLines = doc.splitTextToSize(cellText, cellWidth - 6);
                      const textHeight = textLines.length * pdfSettings.headerFontSize * 0.7;
                      maxHeightInRow = Math.max(maxHeightInRow, textHeight);
                  }
              });
              maxHeightInRow += 6;

              let currentX = pdfSettings.marginLeft;
              for (const cell of cells) {
                  const cellText = cell.trim();
                  doc.rect(currentX, currentY, cellWidth, maxHeightInRow, 'S');

                  if (cellText === '{logo}' && pdfSettings.logoUrl && pdfSettings.logoUrl.startsWith('data:image')) {
                      try {
                          const imgProps = doc.getImageProperties(pdfSettings.logoUrl);
                          const formatType = imgProps.fileType.toUpperCase();
                          const desiredImgHeight = Math.min(maxHeightInRow - 6, 40);
                          const imgWidth = (imgProps.width * desiredImgHeight) / imgProps.height;
                          const imgX = currentX + (cellWidth - imgWidth) / 2;
                          const imgY = currentY + (maxHeightInRow - desiredImgHeight) / 2;
                          doc.addImage(pdfSettings.logoUrl, formatType, imgX, imgY, imgWidth, desiredImgHeight);
                      } catch (e) {
                          console.error("Error adding logo to PDF header cell:", e);
                      }
                  } else {
                      doc.text(cellText, currentX + 3, currentY + pdfSettings.headerFontSize * 0.8, {
                          maxWidth: cellWidth - 6,
                          align: 'left'
                      });
                  }
                  currentX += cellWidth;
              }
              currentY += maxHeightInRow;
          }
          currentY += 10;
      }
      
      const moduleDefaultTitle = "Inventaire des Stocks";
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
        doc.text(finalTitle, doc.internal.pageSize.width / 2, currentY, { align: 'center', maxWidth: pageContentWidth }); 
        currentY += doc.getTextDimensions(finalTitle, { fontSize: pdfSettings.documentTitleFontSize, maxWidth: pageContentWidth }).h + 10;
      }
      
      doc.setFontSize(pdfSettings.defaultFontSize);
      doc.text(`Inventaire généré le: ${generationDateFormatted}`, pdfSettings.marginLeft, currentY);
      currentY += pdfSettings.defaultFontSize + 5;


      const headStyles: { fillColor?: [number, number, number], textColor?: [number, number, number], fontSize?: number, fontStyle?: string } = { fontSize: pdfSettings.tableHeaderFontSize, fontStyle: 'bold' };
      if (pdfSettings.primaryColor) {
        const primaryColorRgb = hexToRgb(pdfSettings.primaryColor);
        if (primaryColorRgb) {
          headStyles.fillColor = [primaryColorRgb.r, primaryColorRgb.g, primaryColorRgb.b];
          const brightness = (primaryColorRgb.r * 299 + primaryColorRgb.g * 587 + primaryColorRgb.b * 114) / 1000;
          headStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
        }
      }

       for (const family of Object.keys(groupedInventory)) {
        const familyProducts = groupedInventory[family];
        const body = familyProducts.map(p => {
          const alertThreshold = p.alertThreshold || 2;
          const cellStyles: any = { fontStyle: 'bold', halign: 'right' };
          if (p.quantity === 0) {
            cellStyles.fillColor = [220, 38, 38]; // Red
            cellStyles.textColor = [255, 255, 255];
          } else if (p.quantity <= alertThreshold) {
            cellStyles.fillColor = [249, 115, 22]; // Orange
            cellStyles.textColor = [255, 255, 255];
          } else {
            cellStyles.fillColor = [22, 163, 74]; // Green
            cellStyles.textColor = [255, 255, 255];
          }
          return [
            p.name,
            p.references?.join(', ') || '',
            { content: p.quantity.toString(), styles: cellStyles },
            '', 
            '',
          ];
        });

        doc.autoTable({
          startY: currentY,
          head: [[{ content: family, colSpan: 5, styles: { halign: 'center', fontStyle: 'bold', fillColor: [230, 230, 230], textColor: [0,0,0] } }]],
          body: [],
          theme: 'grid',
          margin: { left: pdfSettings.marginLeft, right: pdfSettings.marginRight },
        });

        doc.autoTable({
          startY: (doc as any).autoTable.previous.finalY,
          head: [['Nom du Produit', 'Références', 'Quantité en Stock', 'stock réel','Différence ']],
          body: body,
          theme: 'grid',
          headStyles: headStyles,
          styles: { fontSize: pdfSettings.tableBodyFontSize, font: pdfSettings.fontFamily },
          columnStyles: { 3: { cellWidth: 100 } },
          margin: { left: pdfSettings.marginLeft, right: pdfSettings.marginRight, bottom: pdfSettings.marginBottom },
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
        currentY = (doc as any).autoTable.previous.finalY + 10;
      }

      doc.save(`Inventaire_${format(generationDate, "yyyyMMdd_HHmm")}.pdf`);
      toast({ title: "PDF d'Inventaire Généré", description: "Le fichier PDF a été téléchargé." });
    } catch (error) {
      console.error("Error generating inventory PDF:", error);
      toast({ title: "Erreur PDF", description: "La génération du PDF d'inventaire a échoué.", variant: "destructive" });
    } finally {
      setIsPrinting(false);
    }
  };


  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle>Créer un Inventaire</CardTitle>
        <CardDescription>Générez un aperçu instantané de l'état actuel de vos stocks.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <Button onClick={handleGenerateInventory} className="w-full sm:w-auto" disabled={isPrinting}>
            <ListChecks className="mr-2 h-4 w-4" /> Générer l'Inventaire Actuel
          </Button>
          {generatedInventory && (
            <Button onClick={handlePrintInventory} variant="outline" className="w-full sm:w-auto" disabled={isPrinting}>
              {isPrinting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Printer className="mr-2 h-4 w-4" />} 
              Imprimer l'Inventaire
            </Button>
          )}
        </div>

        {generatedInventory && generationDate && (
          <div>
            <h3 className="text-xl font-semibold mb-2 text-foreground">
              Inventaire du {format(generationDate, "dd MMMM yyyy 'à' HH:mm", { locale: fr })}
            </h3>
            {Object.keys(groupedInventory).length === 0 ? (
              <p className="text-muted-foreground text-center py-8">L'inventaire est vide.</p>
            ) : (
              <div className="space-y-8">
                {Object.entries(groupedInventory).map(([family, familyProducts]) => (
                  <div key={family}>
                    <h2 className="text-xl font-bold tracking-tight mb-2">{family} ({familyProducts.length})</h2>
                    <div className="overflow-x-auto border rounded-md max-h-[400px]">
                      <Table>
                        <TableHeader className="sticky top-0 bg-card">
                          <TableRow>
                            <TableHead>Nom du Produit</TableHead>
                            <TableHead>Références</TableHead>
                            <TableHead className="text-right">Quantité en Stock</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {familyProducts.map((product) => (
                            <TableRow key={product.id}>
                              <TableCell className="font-medium">{product.name}</TableCell>
                              <TableCell>{product.references?.join(', ')}</TableCell>
                              <TableCell className="text-right">
                                <span className={`font-bold ${product.quantity === 0 ? 'text-destructive' : product.quantity <= (product.alertThreshold || 2) ? 'text-orange-500' : 'text-green-600'}`}>
                                  {product.quantity}
                                </span>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {!generatedInventory && (
             <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
              <ListChecks className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Prêt à faire le point ?</h3>
              <p className="mt-2 text-sm text-muted-foreground">Cliquez sur "Générer l'Inventaire Actuel" pour afficher l'état de vos stocks ici.</p>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
