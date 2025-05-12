
"use client";

import React, { useState } from 'react';
import type { Product } from '../types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ListChecks, Printer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface GenerateInventoryProps {
  products: Product[];
}

export default function GenerateInventory({ products }: GenerateInventoryProps) {
  const [generatedInventory, setGeneratedInventory] = useState<Product[] | null>(null);
  const [generationDate, setGenerationDate] = useState<Date | null>(null);
  const { toast } = useToast();

  const handleGenerateInventory = () => {
    setGeneratedInventory([...products]); // Create a snapshot
    setGenerationDate(new Date());
    toast({ title: "Inventaire Généré", description: "L'inventaire actuel a été capturé." });
  };

  const handlePrintInventory = () => {
    // Basic print functionality
    const printWindow = window.open('', '_blank');
    if (printWindow && generatedInventory && generationDate) {
      const productRows = generatedInventory.map(p => `
        <tr>
          <td style="border: 1px solid #ddd; padding: 8px;">${p.name}</td>
          <td style="border: 1px solid #ddd; padding: 8px;">${p.reference}</td>
          <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${p.quantity}</td>
        </tr>
      `).join('');

      printWindow.document.write(`
        <html>
          <head>
            <title>Inventaire du ${format(generationDate, "dd MMMM yyyy 'à' HH:mm", { locale: fr })}</title>
            <style>
              body { font-family: sans-serif; margin: 20px; }
              table { width: 100%; border-collapse: collapse; }
              th, td { text-align: left; padding: 8px; border: 1px solid #ddd; }
              th { background-color: #f2f2f2; }
              h1 { text-align: center; }
            </style>
          </head>
          <body>
            <h1>Inventaire des Stocks</h1>
            <p>Généré le: ${format(generationDate, "dd MMMM yyyy 'à' HH:mm", { locale: fr })}</p>
            <table>
              <thead>
                <tr>
                  <th>Nom du Produit</th>
                  <th>Référence</th>
                  <th style="text-align: right;">Quantité en Stock</th>
                </tr>
              </thead>
              <tbody>
                ${productRows}
              </tbody>
            </table>
            <script>
              window.onload = function() {
                window.print();
                // window.onafterprint = function() { window.close(); } // Optional: close after print dialog
              }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
       toast({ title: "Erreur Impression", description: "Impossible d'ouvrir la fenêtre d'impression ou aucun inventaire généré.", variant: "destructive" });
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
          <Button onClick={handleGenerateInventory} className="w-full sm:w-auto">
            <ListChecks className="mr-2 h-4 w-4" /> Générer l'Inventaire Actuel
          </Button>
          {generatedInventory && (
            <Button onClick={handlePrintInventory} variant="outline" className="w-full sm:w-auto">
              <Printer className="mr-2 h-4 w-4" /> Imprimer l'Inventaire
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
              <div className="overflow-x-auto border rounded-md">
                <Table>
                  <TableHeader>
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
