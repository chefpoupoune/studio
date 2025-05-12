
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { IngredientOccasional, OccasionalMealPartType } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { PlusCircle, Edit2, Trash2, FileText, Loader2, Utensils, Users, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const ingredientSchema = z.object({
  name: z.string().min(1, "Le nom de l'ingrédient est requis."),
  unit: z.string().min(1, "L'unité est requise (ex: kg, g, L, pièce)."),
  unitPrice: z.coerce.number().min(0, "Le prix unitaire doit être positif ou nul."),
  quantityPerSingleMeal: z.coerce.number().min(0.001, "La quantité par repas individuel doit être supérieure à zéro."),
});
type IngredientFormData = z.infer<typeof ingredientSchema>;

const initialIngredientData = (): IngredientFormData => ({
  name: '', unit: '', unitPrice: 0, quantityPerSingleMeal: 0.1,
});

const mealPartLabels: Record<OccasionalMealPartType, string> = {
  starter: 'Entrée',
  main: 'Plat Principal',
  dessert: 'Dessert',
};

export default function OccasionalMealCostAnalysis() {
  const [numberOfPeople, setNumberOfPeople] = useState<number>(1);
  const [starterIngredients, setStarterIngredients] = useState<IngredientOccasional[]>([]);
  const [mainIngredients, setMainIngredients] = useState<IngredientOccasional[]>([]);
  const [dessertIngredients, setDessertIngredients] = useState<IngredientOccasional[]>([]);
  
  const [isIngredientDialogOpen, setIsIngredientDialogOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<IngredientOccasional | null>(null);
  const [currentEditingMealPart, setCurrentEditingMealPart] = useState<OccasionalMealPartType | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { toast } = useToast();

  const ingredientForm = useForm<IngredientFormData>({
    resolver: zodResolver(ingredientSchema),
    defaultValues: initialIngredientData(),
  });

  const getLocalStorageKey = useCallback((mealPart: OccasionalMealPartType | 'num_people') => {
    if (mealPart === 'num_people') return 'occasional_meal_num_people';
    return `occasional_meal_${mealPart}_ingredients`;
  }, []);

  useEffect(() => {
    setIsLoading(true);
    try {
      const storedStarter = localStorage.getItem(getLocalStorageKey('starter'));
      if (storedStarter) setStarterIngredients(JSON.parse(storedStarter));
      const storedMain = localStorage.getItem(getLocalStorageKey('main'));
      if (storedMain) setMainIngredients(JSON.parse(storedMain));
      const storedDessert = localStorage.getItem(getLocalStorageKey('dessert'));
      if (storedDessert) setDessertIngredients(JSON.parse(storedDessert));
      const storedNumPeople = localStorage.getItem(getLocalStorageKey('num_people'));
      if (storedNumPeople) setNumberOfPeople(parseInt(storedNumPeople, 10) || 1);
    } catch (error) {
      console.error("Error loading occasional meal data:", error);
      toast({ title: "Erreur de chargement", description: "Données de repas occasionnel corrompues.", variant: "destructive" });
    }
    setIsLoading(false);
  }, [getLocalStorageKey, toast]);

  useEffect(() => { if (!isLoading) localStorage.setItem(getLocalStorageKey('starter'), JSON.stringify(starterIngredients)); }, [starterIngredients, getLocalStorageKey, isLoading]);
  useEffect(() => { if (!isLoading) localStorage.setItem(getLocalStorageKey('main'), JSON.stringify(mainIngredients)); }, [mainIngredients, getLocalStorageKey, isLoading]);
  useEffect(() => { if (!isLoading) localStorage.setItem(getLocalStorageKey('dessert'), JSON.stringify(dessertIngredients)); }, [dessertIngredients, getLocalStorageKey, isLoading]);
  useEffect(() => { if (!isLoading) localStorage.setItem(getLocalStorageKey('num_people'), numberOfPeople.toString()); }, [numberOfPeople, getLocalStorageKey, isLoading]);

  const getIngredientsList = (mealPart: OccasionalMealPartType): IngredientOccasional[] => {
    if (mealPart === 'starter') return starterIngredients;
    if (mealPart === 'main') return mainIngredients;
    return dessertIngredients;
  };

  const setIngredientsList = (mealPart: OccasionalMealPartType, ingredients: IngredientOccasional[]) => {
    if (mealPart === 'starter') setStarterIngredients(ingredients);
    else if (mealPart === 'main') setMainIngredients(ingredients);
    else setDessertIngredients(ingredients);
  };

  const calculatePartCost = (ingredients: IngredientOccasional[]): number => {
    return ingredients.reduce((total, ing) => total + (ing.unitPrice * ing.quantityPerSingleMeal), 0);
  };

  const starterCostPerPerson = useMemo(() => calculatePartCost(starterIngredients), [starterIngredients]);
  const mainCostPerPerson = useMemo(() => calculatePartCost(mainIngredients), [mainIngredients]);
  const dessertCostPerPerson = useMemo(() => calculatePartCost(dessertIngredients), [dessertIngredients]);
  const totalCostPerPerson = useMemo(() => starterCostPerPerson + mainCostPerPerson + dessertCostPerPerson, [starterCostPerPerson, mainCostPerPerson, dessertCostPerPerson]);
  const totalCostForAllPeople = useMemo(() => totalCostPerPerson * numberOfPeople, [totalCostPerPerson, numberOfPeople]);

  const handleOpenIngredientDialog = (mealPart: OccasionalMealPartType, ingredient?: IngredientOccasional) => {
    setCurrentEditingMealPart(mealPart);
    setEditingIngredient(ingredient || null);
    ingredientForm.reset(ingredient ? ingredient : initialIngredientData());
    setIsIngredientDialogOpen(true);
  };

  const handleIngredientFormSubmit = (data: IngredientFormData) => {
    if (!currentEditingMealPart) return;
    const currentList = getIngredientsList(currentEditingMealPart);
    if (editingIngredient) {
      setIngredientsList(currentEditingMealPart, currentList.map(ing => ing.id === editingIngredient.id ? { ...editingIngredient, ...data } : ing));
      toast({ title: "Ingrédient Modifié", description: `L'ingrédient "${data.name}" a été mis à jour pour ${mealPartLabels[currentEditingMealPart]}.` });
    } else {
      const newIngredient: IngredientOccasional = { ...data, id: `occ_ing_${Date.now()}` };
      setIngredientsList(currentEditingMealPart, [...currentList, newIngredient]);
      toast({ title: "Ingrédient Ajouté", description: `L'ingrédient "${data.name}" a été ajouté à ${mealPartLabels[currentEditingMealPart]}.` });
    }
    setIsIngredientDialogOpen(false);
  };

  const handleDeleteIngredient = (mealPart: OccasionalMealPartType, ingredientId: string) => {
    const currentList = getIngredientsList(mealPart);
    const ingredientName = currentList.find(ing => ing.id === ingredientId)?.name || "L'ingrédient";
    if (confirm(`Êtes-vous sûr de vouloir supprimer "${ingredientName}" de ${mealPartLabels[mealPart]} ?`)) {
      setIngredientsList(mealPart, currentList.filter(ing => ing.id !== ingredientId));
      toast({ title: "Ingrédient Supprimé", description: `"${ingredientName}" a été supprimé de ${mealPartLabels[mealPart]}.`, variant: "destructive" });
    }
  };

  const generatePdf = () => {
    if (starterIngredients.length === 0 && mainIngredients.length === 0 && dessertIngredients.length === 0) {
      toast({ title: "Aucun Ingrédient", description: "Veuillez ajouter des ingrédients.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const doc = new jsPDF() as jsPDFWithAutoTable;
      const title = `Coût de Revient Repas Occasionnel (${numberOfPeople} personnes)`;
      
      doc.setFontSize(18); doc.text(title, 14, 20);
      doc.setFontSize(10); doc.text(`Généré le: ${format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}`, 14, 28);

      let startY = 35;

      const addSectionToPdf = (partLabel: string, ingredients: IngredientOccasional[], partCost: number) => {
        if (ingredients.length > 0) {
          doc.setFontSize(14); doc.text(partLabel, 14, startY); startY += 7;
          doc.autoTable({
            head: [['Ingrédient', 'Unité', 'Prix/Unité (€)', 'Qté/Pers.', 'Coût/Pers. (€)']],
            body: ingredients.map(ing => [
              ing.name, ing.unit, ing.unitPrice.toFixed(2), ing.quantityPerSingleMeal.toFixed(3),
              (ing.unitPrice * ing.quantityPerSingleMeal).toFixed(2),
            ]),
            foot: [[{ content: `Total ${partLabel} / Pers.`, colSpan: 4, styles: { fontStyle: 'bold', halign: 'right' } }, { content: partCost.toFixed(2), styles: { fontStyle: 'bold', halign: 'right' } }]],
            startY: startY, theme: 'grid', headStyles: { fillColor: [120, 120, 120] }, footStyles: { fillColor: [230, 230, 230], textColor: [0,0,0] }
          });
          startY = (doc as any).lastAutoTable.finalY + 10;
        }
      };
      
      addSectionToPdf("Entrée", starterIngredients, starterCostPerPerson);
      addSectionToPdf("Plat Principal", mainIngredients, mainCostPerPerson);
      addSectionToPdf("Dessert", dessertIngredients, dessertCostPerPerson);

      doc.setFontSize(12);
      doc.text("Récapitulatif:", 14, startY); startY += 7;
      doc.setFontSize(10);
      doc.text(`Nombre de personnes: ${numberOfPeople}`, 14, startY); startY += 6;
      doc.text(`Coût total par personne: ${totalCostPerPerson.toFixed(2)} €`, 14, startY); startY += 6;
      doc.setFontSize(11); doc.setFont(undefined, 'bold');
      doc.text(`Coût total pour ${numberOfPeople} personnes: ${totalCostForAllPeople.toFixed(2)} €`, 14, startY);

      doc.save(`cout_repas_occasionnel_${numberOfPeople}pers_${format(new Date(), "yyyyMMdd")}.pdf`);
      toast({ title: "PDF Généré", description: "Le PDF du coût repas occasionnel a été téléchargé." });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Erreur PDF", description: "La génération du PDF a échoué.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };
  
  const renderMealPartSection = (mealPart: OccasionalMealPartType, ingredients: IngredientOccasional[], costPerPerson: number) => (
    <Card>
      <CardHeader>
        <CardTitle>{mealPartLabels[mealPart]}</CardTitle>
        <Button size="sm" variant="outline" onClick={() => handleOpenIngredientDialog(mealPart)} className="mt-2 sm:mt-0 sm:ml-auto">
          <PlusCircle className="mr-2 h-4 w-4" /> Ajouter Ingrédient à {mealPartLabels[mealPart].toLowerCase()}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : ingredients.length > 0 ? (
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Ingrédient</TableHead><TableHead>Unité</TableHead>
                <TableHead className="text-right">Prix/Unité (€)</TableHead><TableHead className="text-right">Qté/Pers.</TableHead>
                <TableHead className="text-right">Coût/Pers. (€)</TableHead><TableHead className="text-center">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {ingredients.map(ing => (
                  <TableRow key={ing.id}>
                    <TableCell className="font-medium">{ing.name}</TableCell><TableCell>{ing.unit}</TableCell>
                    <TableCell className="text-right">{ing.unitPrice.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{ing.quantityPerSingleMeal.toFixed(3)}</TableCell>
                    <TableCell className="text-right font-semibold">{(ing.unitPrice * ing.quantityPerSingleMeal).toFixed(2)}</TableCell>
                    <TableCell className="text-center space-x-1">
                      <Button variant="outline" size="icon" onClick={() => handleOpenIngredientDialog(mealPart, ing)} className="h-8 w-8"><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDeleteIngredient(mealPart, ing.id)} className="h-8 w-8"><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter><TableRow className="font-bold bg-muted text-foreground">
                <TableCell colSpan={4} className="text-right">COÛT {mealPartLabels[mealPart].toUpperCase()} / PERSONNE</TableCell>
                <TableCell className="text-right text-lg">{costPerPerson.toFixed(2)} €</TableCell><TableCell></TableCell>
              </TableRow></TableFooter>
            </Table>
          </div>
        ) : <p className="text-muted-foreground text-center py-4">Aucun ingrédient.</p>}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><Users className="mr-2 h-5 w-5 text-primary"/>Nombre de Personnes</CardTitle>
        </CardHeader>
        <CardContent>
          <Input 
            type="number" 
            value={numberOfPeople} 
            onChange={(e) => setNumberOfPeople(Math.max(1, parseInt(e.target.value,10) || 1))} 
            min="1"
            className="w-full sm:w-40"
          />
        </CardContent>
      </Card>

      {/* Ingredient Dialog */}
      <Dialog open={isIngredientDialogOpen} onOpenChange={setIsIngredientDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingIngredient ? "Modifier" : "Nouvel"} Ingrédient pour {currentEditingMealPart ? mealPartLabels[currentEditingMealPart].toLowerCase() : ''}</DialogTitle>
          </DialogHeader>
          <Form {...ingredientForm}>
            <form onSubmit={ingredientForm.handleSubmit(handleIngredientFormSubmit)} className="space-y-4 py-4">
              <FormField control={ingredientForm.control} name="name" render={({ field }) => (<FormItem><FormLabel>Nom</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={ingredientForm.control} name="unit" render={({ field }) => (<FormItem><FormLabel>Unité</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={ingredientForm.control} name="unitPrice" render={({ field }) => (<FormItem><FormLabel>Prix Unitaire (€)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={ingredientForm.control} name="quantityPerSingleMeal" render={({ field }) => (<FormItem><FormLabel>Quantité par Repas Individuel</FormLabel><FormControl><Input type="number" step="0.001" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose><Button type="submit">{editingIngredient ? "Enregistrer" : "Ajouter"}</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {renderMealPartSection('starter', starterIngredients, starterCostPerPerson)}
      {renderMealPartSection('main', mainIngredients, mainCostPerPerson)}
      {renderMealPartSection('dessert', dessertIngredients, dessertCostPerPerson)}

      <Card className="mt-6 bg-gradient-to-r from-muted/50 to-muted/20 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center"><Utensils className="mr-2 h-6 w-6 text-primary"/>Récapitulatif Total du Repas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-lg">
          <div className="flex justify-between items-center">
            <span className="font-medium">Coût total par personne:</span>
            <span className="font-bold text-primary">{totalCostPerPerson.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-medium">Nombre de personnes:</span>
            <span className="font-bold">{numberOfPeople}</span>
          </div>
          <hr className="border-border my-2" />
          <div className="flex justify-between items-center text-xl">
            <span className="font-semibold text-foreground">Coût total pour {numberOfPeople} personne{numberOfPeople > 1 ? 's' : ''}:</span>
            <span className="font-extrabold text-accent">{totalCostForAllPeople.toFixed(2)} €</span>
          </div>
        </CardContent>
         <CardFooter>
            <Button onClick={generatePdf} disabled={isLoading || (starterIngredients.length === 0 && mainIngredients.length === 0 && dessertIngredients.length === 0)} className="w-full sm:w-auto mt-4">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Générer PDF Récapitulatif
            </Button>
         </CardFooter>
      </Card>
       { (starterIngredients.length === 0 && mainIngredients.length === 0 && dessertIngredients.length === 0 && !isLoading) && (
        <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
            <Info className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
                Commencez par ajouter des ingrédients à l'entrée, au plat ou au dessert.
            </p>
        </div>
      )}
    </div>
  );
}

