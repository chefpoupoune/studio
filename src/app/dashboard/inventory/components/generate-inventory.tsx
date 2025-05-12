
"use client";

import React, { useState } from 'react';
import type { Product } from '../types';
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

  const handlePrintInventory = () => {
    if (!generatedInventory || !generationDate) {
      toast({ title: "Erreur Impression", description: "Aucun inventaire généré à imprimer.", variant: "destructive" });
      return;
    }
    setIsPrinting(true);
    try {
      const pdfSettings = getPdfLayoutSettings('inventory_report');
      const doc = new jsPDF() as jsPDFWithAutoTable;
      const generationDateFormatted = format(generationDate, "dd MMMM yyyy 'à' HH:mm", { locale: fr });

      let currentY = 15;
      if (pdfSettings.headerText) {
        doc.setFontSize(10);
        doc.text(pdfSettings.headerText, 14, currentY);
        currentY += 10;
      }

      // Add Logo URL if available
      if (pdfSettings.logoUrl) {
        doc.setFontSize(8); 
        doc.text(`Logo: ${pdfSettings.logoUrl}`, 14, currentY);
        currentY += 5; 
      }

      doc.setFontSize(18);
      doc.text("Inventaire des Stocks", 14, currentY);
      currentY += 8;
      doc.setFontSize(10);
      doc.text(`Généré le: ${generationDateFormatted}`, 14, currentY);
      currentY += 7;

      const headStyles: { fillColor?: [number, number, number], textColor?: [number, number, number] } = {};
      if (pdfSettings.primaryColor) {
        const primaryColorRgb = hexToRgb(pdfSettings.primaryColor);
        if (primaryColorRgb) {
          headStyles.fillColor = primaryColorRgb;
          const brightness = (primaryColorRgb[0] * 299 + primaryColorRgb[1] * 587 + primaryColorRgb[2] * 114) / 1000;
          headStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
        }
      }

      const body = generatedInventory.map(p => [
        p.name,
        p.reference,
        p.quantity.toString(),
      ]);

      doc.autoTable({
        startY: currentY,
        head: [['Nom du Produit', 'Référence', 'Quantité en Stock']],
        body: body,
        theme: 'grid',
        headStyles: headStyles,
        columnStyles: { 2: { halign: 'right' } },
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
            {generatedInventory.length === 0 ? (
               <p className="text-muted-foreground text-center py-8">L'inventaire est vide.</p>
            ) : (
              <div className="overflow-x-auto border rounded-md max-h-[400px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-card">
                    <TableRow>
                      <TableHead>Nom du Produit</TableHead>
                      <TableHead>Référence</TableHead>
                      <TableHead className="text-right">Quantité en Stock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {generatedInventory.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.name}</TableCell>
                        <TableCell>{product.reference}</TableCell>
                        <TableCell className="text-right">{product.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
        {!generatedInventory && (
            <p className="text-muted-foreground text-center py-8">Cliquez sur "Générer l'Inventaire Actuel" pour afficher l'état des stocks.</p>
        )}
      </CardContent>
    </Card>
  );
}

    