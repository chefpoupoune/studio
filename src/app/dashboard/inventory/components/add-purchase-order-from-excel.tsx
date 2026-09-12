
"use client";

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { FileUp, Loader2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import type { PurchaseOrderItem, Product, PurchaseOrderUnit } from '../types';

interface AddPurchaseOrderFromExcelProps {
  products: Product[];
  onAddPurchaseOrder: (items: PurchaseOrderItem[]) => void;
}

export default function AddPurchaseOrderFromExcel({ products, onAddPurchaseOrder }: AddPurchaseOrderFromExcelProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) {
      return;
    }
    const file = acceptedFiles[0];
    setIsLoading(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'buffer' });
      const worksheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[worksheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      const orderItems: PurchaseOrderItem[] = [];

      json.forEach((row) => {
        // Ensure row has at least a quantity and a reference
        if (!row || row.length < 2 || !row[0] || !row[1]) return;

        const quantity = row[0];
        const reference = row[1];
        const name = row[2]; // From Column C
        const unit: PurchaseOrderUnit = 'Pièce';

        if (reference && quantity && Number(quantity) > 0) {
          const product = products.find(p => p.references && p.references.includes(String(reference)));
          
          if (product) {
            orderItems.push({
              productId: product.id,
              productName: product.name,
              reference: String(reference),
              quantity: Number(quantity),
              unit: unit,
            });
          } else {
            // If product is not found, create a new item using data from the Excel file.
            // The product name will be the value from column C. If column C is empty, 
            // we will use the reference from column B as the name as a fallback.
            const itemReference = String(reference);
            const itemName = name ? String(name) : itemReference;

            orderItems.push({
              productId: `unlinked_${itemReference}_${Date.now()}`,
              productName: itemName,
              reference: itemReference,
              quantity: Number(quantity),
              unit: unit,
              isUnlinked: true,
            });
          }
        }
      });

      if (orderItems.length > 0) {
        onAddPurchaseOrder(orderItems);
        toast({
          title: "Bon de commande traité",
          description: `${orderItems.length} article(s) ont été ajoutés.`,
        });
      } else {
        toast({
            title: "Fichier vide ou incompatible",
            description: "Aucun article valide trouvé. Vérifiez le format: Col A: Qté, Col B: Réf, Col C: Nom.",
            variant: "destructive",
        });
      }

    } catch (error) {
      console.error("Error processing Excel file:", error);
      toast({
        title: "Erreur de lecture du fichier",
        description: "Le format du fichier semble incorrect ou corrompu.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsDialogOpen(false);
    }
  }, [products, onAddPurchaseOrder, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'application/vnd.ms-excel': ['.xls', '.xlsx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    }
  });

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileUp className="mr-2 h-4 w-4" /> Importer depuis Excel
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importer un Bon de Commande depuis Excel</DialogTitle>
        </DialogHeader>
        <div 
          {...getRootProps()} 
          className={`mt-4 border-2 border-dashed rounded-lg p-10 text-center cursor-pointer
            ${isDragActive ? 'border-primary bg-primary/10' : 'border-muted-foreground/30 hover:border-primary'}`}
        >
          <input {...getInputProps()} />
          {isLoading ? (
            <div className="flex flex-col items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <p>Traitement en cours...</p>
            </div>
          ) : (
            isDragActive ?
              <p>Déposez le fichier ici...</p> :
              <p>Faites glisser un fichier Excel ici, ou cliquez pour en sélectionner un.</p>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Format requis : <strong>Colonne A:</strong> Quantité, <strong>Colonne B:</strong> Référence, <strong>Colonne C:</strong> Nom du produit.
        </p>
        <DialogFooter className="mt-4">
            <DialogClose asChild>
                <Button variant="outline">Fermer</Button>
            </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
