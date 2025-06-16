
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { IngredientPN, MealTypePN } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { PlusCircle, Edit2, Trash2, FileText, Loader2, Apple, Salad } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const ingredientSchema = z.object({
  name: z.string().min(1, "Le nom de l'ingrédient est requis."),
  unit: z.string().min(1, "L'unité est requise (ex: kg, g, L, pièce)."),
  unitPrice: z.coerce.number().min(0, "Le prix unitaire doit être positif ou nul."),
  quantityPerMeal: z.coerce.number().min(0.001, "La quantité par repas doit être supérieure à zéro."),
});
type IngredientFormData = z.infer<typeof ingredientSchema>;

const initialIngredientData = (): IngredientFormData => ({
  name: '',
  unit: '',
  unitPrice: 0,
  quantityPerMeal: 0.1,
});

export default function PicnicCostAnalysis() {
  const [selectedMealType, setSelectedMealType] = useState<MealTypePN>('picnic');
  const [picnicIngredients, setPicnicIngredients] = useState<IngredientPN[]>([]);
  const [saladIngredients, setSaladIngredients] = useState<IngredientPN[]>([]);
  
  const [isIngredientDialogOpen, setIsIngredientDialogOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<IngredientPN | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { toast } = useToast();

  const ingredientForm = useForm<IngredientFormData>({
    resolver: zodResolver(ingredientSchema),
    defaultValues: initialIngredientData(),
  });

  const getLocalStorageKey = useCallback((mealType: MealTypePN) => `cost_pn_${mealType}_ingredients`, []);

  useEffect(() => {
    setIsLoading(true);
    try {
      const storedPicnic = localStorage.getItem(getLocalStorageKey('picnic'));
      if (storedPicnic) setPicnicIngredients(JSON.parse(storedPicnic));

      const storedSalad = localStorage.getItem(getLocalStorageKey('salad'));
      if (storedSalad) setSaladIngredients(JSON.parse(storedSalad));
    } catch (error) {
      console.error("Error loading PN ingredients from localStorage:", error);
      toast({ title: "Erreur de chargement", description: "Données d'ingrédients corrompues.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [getLocalStorageKey, toast]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(getLocalStorageKey('picnic'), JSON.stringify(picnicIngredients));
    }
  }, [picnicIngredients, getLocalStorageKey, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(getLocalStorageKey('salad'), JSON.stringify(saladIngredients));
    }
  }, [saladIngredients, getLocalStorageKey, isLoading]);

  const currentIngredients = useMemo(() => {
    return selectedMealType === 'picnic' ? picnicIngredients : saladIngredients;
  }, [selectedMealType, picnicIngredients, saladIngredients]);

  const setCurrentIngredients = useCallback((newIngredients: IngredientPN[]) => {
    if (selectedMealType === 'picnic') {
      setPicnicIngredients(newIngredients);
    } else {
      setSaladIngredients(newIngredients);
    }
  }, [selectedMealType]);

  const totalMealCost = useMemo(() => {
    return currentIngredients.reduce((total, ingredient) => {
      return total + (ingredient.unitPrice * ingredient.quantityPerMeal);
    }, 0);
  }, [currentIngredients]);

  const handleOpenIngredientDialog = (ingredient?: IngredientPN) => {
    setEditingIngredient(ingredient || null);
    if (ingredient) {
      ingredientForm.reset(ingredient);
    } else {
      ingredientForm.reset(initialIngredientData());
    }
    setIsIngredientDialogOpen(true);
  };

  const handleIngredientFormSubmit = (data: IngredientFormData) => {
    if (editingIngredient) {
      setCurrentIngredients(currentIngredients.map(ing => ing.id === editingIngredient.id ? { ...editingIngredient, ...data } : ing));
      toast({ title: "Ingrédient Modifié", description: `L'ingrédient "${data.name}" a été mis à jour.` });
    } else {
      const newIngredient: IngredientPN = { ...data, id: `ing_${Date.now()}` };
      setCurrentIngredients([...currentIngredients, newIngredient]);
      toast({ title: "Ingrédient Ajouté", description: `L'ingrédient "${data.name}" a été ajouté.` });
    }
    setIsIngredientDialogOpen(false);
    setEditingIngredient(null);
  };

  const handleDeleteIngredient = (ingredientId: string) => {
    const ingredientName = currentIngredients.find(ing => ing.id === ingredientId)?.name || "L'ingrédient";
    if (confirm(`Êtes-vous sûr de vouloir supprimer "${ingredientName}" ?`)) {
      setCurrentIngredients(currentIngredients.filter(ing => ing.id !== ingredientId));
      toast({ title: "Ingrédient Supprimé", description: `"${ingredientName}" a été supprimé.`, variant: "destructive" });
    }
  };
  
  const mealTypeLabel = selectedMealType === 'picnic' ? 'Pique-Nique' : 'Salade';

  const generatePdf = () => {
    if (currentIngredients.length === 0) {
      toast({ title: "Aucun Ingrédient", description: `Veuillez ajouter des ingrédients pour le repas ${mealTypeLabel}.`, variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const pdfSettings = getPdfLayoutSettings('picnic_cost');
      const doc = new jsPDF() as jsPDFWithAutoTable;
      doc.setFont(pdfSettings.fontFamily);
      const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });
      
      let currentY = pdfSettings.marginTop;
      if (pdfSettings.headerText) {
        doc.setFontSize(pdfSettings.headerFontSize);
        doc.text(pdfSettings.headerText, pdfSettings.marginLeft, currentY);
        currentY += pdfSettings.headerFontSize + 5;
      }

      if (pdfSettings.logoUrl) {
        doc.setFontSize(pdfSettings.defaultFontSize -2); 
        doc.text(`Logo: ${pdfSettings.logoUrl}`, pdfSettings.marginLeft, currentY);
        currentY += (pdfSettings.defaultFontSize -2) + 5; 
      }

      const moduleDefaultTitle = `Coût de Revient - Repas ${mealTypeLabel}`;
      let title;
      if (pdfSettings.showDocumentBaseTitle && pdfSettings.documentBaseTitle && pdfSettings.documentBaseTitle.trim() !== "") {
        title = `${pdfSettings.documentBaseTitle} - ${moduleDefaultTitle}`;
      } else {
        title = moduleDefaultTitle;
      }
      doc.setFontSize(pdfSettings.documentTitleFontSize);
      doc.text(title, pdfSettings.marginLeft, currentY);
      currentY += pdfSettings.documentTitleFontSize * 0.7 + 5;
      doc.setFontSize(pdfSettings.defaultFontSize);
      doc.text(`Généré le: ${generationDateFormatted}`, pdfSettings.marginLeft, currentY);
      currentY += pdfSettings.defaultFontSize + 7;

      const headStyles: { fillColor?: [number, number, number], textColor?: [number, number, number], fontSize?: number } = { fontSize: pdfSettings.tableHeaderFontSize };
      if (pdfSettings.primaryColor) {
        const primaryColorRgb = hexToRgb(pdfSettings.primaryColor);
        if (primaryColorRgb) {
          headStyles.fillColor = primaryColorRgb;
           const brightness = (primaryColorRgb[0] * 299 + primaryColorRgb[1] * 587 + primaryColorRgb[2] * 114) / 1000;
          headStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
        }
      }

      const head = [['Ingrédient', 'Unité', 'Prix/Unité (€)', 'Qté/Repas', 'Coût/Repas (€)']];
      const body = currentIngredients.map(ing => [
        ing.name,
        ing.unit,
        ing.unitPrice.toFixed(2),
        ing.quantityPerMeal.toFixed(3), 
        (ing.unitPrice * ing.quantityPerMeal).toFixed(2),
      ]);
      
      const footer = [
        [
          { content: `TOTAL COÛT REPAS ${mealTypeLabel.toUpperCase()}`, colSpan: 4, styles: { fontStyle: 'bold', halign: 'right' } },
          { content: totalMealCost.toFixed(2), styles: { fontStyle: 'bold', halign: 'right' } },
        ],
      ];

      doc.autoTable({
        head: head,
        body: body,
        foot: footer,
        startY: currentY,
        theme: 'grid',
        headStyles: headStyles, 
        styles: { fontSize: pdfSettings.tableBodyFontSize, font: pdfSettings.fontFamily },
        footStyles: { fillColor: [220, 220, 220], textColor: [0,0,0], fontSize: pdfSettings.tableBodyFontSize },
        columnStyles: {
            0: { cellWidth: 'auto' }, 
            1: { cellWidth: 'auto' },
            2: { cellWidth: 'auto', halign: 'right' },
            3: { cellWidth: 'auto', halign: 'right' },
            4: { cellWidth: 'auto', halign: 'right' },
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

      doc.save(`cout_repas_${selectedMealType}_${format(new Date(), "yyyyMMdd")}.pdf`);
      toast({ title: "PDF Généré", description: `Le PDF du coût pour ${mealTypeLabel} a été téléchargé.` });
    } catch (error) {
      console.error(`Error generating PDF for ${selectedMealType}:`, error);
      toast({ title: "Erreur PDF", description: `La génération du PDF pour ${mealTypeLabel} a échoué.`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        <div>
          <Label htmlFor="meal-type-select">Type de Repas</Label>
          <Select value={selectedMealType} onValueChange={(value) => setSelectedMealType(value as MealTypePN)}>
            <SelectTrigger id="meal-type-select">
              <SelectValue placeholder="Sélectionner un type de repas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="picnic"><div className="flex items-center"><Apple className="mr-2 h-4 w-4" />Pique-Nique</div></SelectItem>
              <SelectItem value="salad"><div className="flex items-center"><Salad className="mr-2 h-4 w-4" />Salade</div></SelectItem>
            </SelectContent>
          </Select>
        </div>
         <Dialog open={isIngredientDialogOpen} onOpenChange={setIsIngredientDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenIngredientDialog()} className="w-full sm:w-auto sm:justify-self-end mt-4 sm:mt-0">
                <PlusCircle className="mr-2 h-4 w-4" /> Ajouter Ingrédient
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{editingIngredient ? "Modifier l'Ingrédient" : "Nouvel Ingrédient"} pour {mealTypeLabel}</DialogTitle>
              </DialogHeader>
              <Form {...ingredientForm}>
                <form onSubmit={ingredientForm.handleSubmit(handleIngredientFormSubmit)} className="space-y-4 py-4">
                  <FormField control={ingredientForm.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Nom</FormLabel><FormControl><Input placeholder="Ex: Pain de mie" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={ingredientForm.control} name="unit" render={({ field }) => (
                    <FormItem><FormLabel>Unité</FormLabel><FormControl><Input placeholder="Ex: tranche, kg, L, pièce" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={ingredientForm.control} name="unitPrice" render={({ field }) => (
                    <FormItem><FormLabel>Prix Unitaire (€)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="Ex: 2.50" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={ingredientForm.control} name="quantityPerMeal" render={({ field }) => (
                    <FormItem><FormLabel>Quantité par Repas</FormLabel><FormControl><Input type="number" step="0.001" placeholder="Ex: 0.1" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
                    <Button type="submit">{editingIngredient ? "Enregistrer" : "Ajouter"}</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Chargement des ingrédients...</span>
        </div>
      ) : currentIngredients.length > 0 ? (
        <div className="overflow-x-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ingrédient</TableHead>
                <TableHead>Unité</TableHead>
                <TableHead className="text-right">Prix/Unité (€)</TableHead>
                <TableHead className="text-right">Qté/Repas</TableHead>
                <TableHead className="text-right">Coût/Repas (€)</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentIngredients.map(ing => (
                <TableRow key={ing.id}>
                  <TableCell className="font-medium">{ing.name}</TableCell>
                  <TableCell>{ing.unit}</TableCell>
                  <TableCell className="text-right">{ing.unitPrice.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{ing.quantityPerMeal.toFixed(3)}</TableCell>
                  <TableCell className="text-right font-semibold">{(ing.unitPrice * ing.quantityPerMeal).toFixed(2)}</TableCell>
                  <TableCell className="text-center space-x-1">
                    <Button variant="outline" size="icon" onClick={() => handleOpenIngredientDialog(ing)} className="h-8 w-8">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => handleDeleteIngredient(ing.id)} className="h-8 w-8">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="font-bold bg-muted text-foreground">
                <TableCell colSpan={4} className="text-right">COÛT TOTAL DU REPAS {mealTypeLabel.toUpperCase()}</TableCell>
                <TableCell className="text-right text-lg">{totalMealCost.toFixed(2)} €</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-10">
          Aucun ingrédient pour le repas {mealTypeLabel}. Cliquez sur "Ajouter Ingrédient" pour commencer.
        </p>
      )}

      <Button onClick={generatePdf} disabled={isLoading || currentIngredients.length === 0} className="w-full sm:w-auto mt-4">
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
        Générer PDF pour {mealTypeLabel}
      </Button>
    </div>
  );
}


    
