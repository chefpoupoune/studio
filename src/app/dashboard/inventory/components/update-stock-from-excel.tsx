
"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';

interface StockUpdate {
  reference: string;
  quantityToAdd: number;
  productName?: string; // Optional product name from column C
}

interface UpdateStockFromExcelProps {
  onUpdateStock: (updates: StockUpdate[]) => Promise<void>;
}

export default function UpdateStockFromExcel({ onUpdateStock }: UpdateStockFromExcelProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const json: (string | number)[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      const stockUpdates: StockUpdate[] = [];
      for (let i = 0; i < json.length; i++) {
        const row = json[i];
        const quantity = Number(row[0]);
        const reference = String(row[1]);
        const productName = String(row[2] || ''); // Get product name from column C

        if (reference && !isNaN(quantity) && quantity > 0) {
          stockUpdates.push({ reference, quantityToAdd: quantity, productName });
        } else {
          // If the row is not empty but invalid, notify the user.
          if (row.some(cell => cell !== null && cell !== undefined && cell !== '')) {
            console.warn(`Ligne ${i + 1} ignorée: format invalide. Quantité: ${row[0]}, Référence: ${row[1]}`);
          }
        }
      }

      if (stockUpdates.length > 0) {
        await onUpdateStock(stockUpdates);
      } else {
        toast({
          title: "Aucune donnée valide trouvée",
          description: "Le fichier Excel ne semble pas contenir de lignes valides (Quantité en colonne A, Référence en colonne B).",
          variant: "warning",
        });
      }

    } catch (error) {
      console.error("Erreur lors du traitement du fichier Excel:", error);
      toast({
        title: "Erreur de traitement",
        description: "Un problème est survenu lors de la lecture du fichier Excel.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      // Reset file input
      event.target.value = '';
    }
  };

  return (
    <Card className="max-w-xl mx-auto mt-10">
      <CardHeader>
        <CardTitle>Mise à jour des stocks par Excel</CardTitle>
        <CardDescription>
          Importez un fichier Excel pour ajouter des quantités aux stocks de vos produits.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="p-4 border-dashed border-2 rounded-md">
            <p className="text-sm font-medium">Format du fichier Excel :</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground">
              <li><strong>Colonne A:</strong> Quantité à ajouter (nombre)</li>
              <li><strong>Colonne B:</strong> Référence du produit (texte)</li>
              <li><strong>Colonne C:</strong> Nom du produit (optionnel, pour le rapport)</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-2">
              Le fichier ne doit contenir que ces trois colonnes, sans en-tête.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Input
              id="excel-upload"
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              disabled={isProcessing}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
            />
          </div>
          {isProcessing && (
            <div className="flex items-center text-sm text-muted-foreground">
              <Upload className="mr-2 h-4 w-4 animate-pulse" />
              <span>Traitement du fichier en cours...</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
