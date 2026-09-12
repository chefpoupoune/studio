'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  PlusCircle,
  Trash2,
  Loader2,
  Search,
  Pencil,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { firestore } from '@/lib/firebase';
import {
  collection,
  getDocs,
  addDoc,
  doc,
  deleteDoc,
  setDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';

// --- Types ---
export type RecipeCategory = 'Entrée' | 'Plat' | 'Féculent' | 'Légumes' | 'Sauce' | 'Fromage' | 'Dessert' | 'PN';
export const recipeCategories: RecipeCategory[] = [
  'Entrée',
  'Plat',
  'Féculent',
  'Légumes',
  'Sauce',
  'Fromage',
  'Dessert',
  'PN',
];

export type IngredientCategory = 'Fruits et Légumes' | 'Frais' | 'Surgelé' | 'Viande' | 'Sec' | 'Autres';
export const ingredientCategories: IngredientCategory[] = [
  'Fruits et Légumes',
  'Frais',
  'Surgelé',
  'Viande',
  'Sec',
  'Autres',
];

export interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
  category?: IngredientCategory;
}

export interface Recipe {
  id: string;
  name: string;
  category: RecipeCategory;
  numberOfGuests: number;
  ingredients: Ingredient[];
}

// --- Form Component (Refactored) ---
type RecipeFormData = Omit<Recipe, 'id'> | Recipe;

interface RecipeFormProps {
  recipe: RecipeFormData;
  setRecipe: React.Dispatch<React.SetStateAction<any>>;
  onSave: () => Promise<void>;
  isSaving: boolean;
  formTitle: string;
  saveButtonText: string;
}

const RecipeForm: React.FC<RecipeFormProps> = ({ recipe, setRecipe, onSave, isSaving, formTitle, saveButtonText }) => {
  const handleIngredientChange = (index: number, field: keyof Ingredient, value: string | number) => {
    const updatedIngredients = [...recipe.ingredients];
    const newIngredient = { ...updatedIngredients[index], [field]: value };
    if (field === 'quantity') {
      newIngredient.quantity = Number(value) < 0 ? 0 : Number(value);
    }
    updatedIngredients[index] = newIngredient;
    setRecipe({ ...recipe, ingredients: updatedIngredients });
  };

  const addIngredient = () => {
    setRecipe({
      ...recipe,
      ingredients: [...recipe.ingredients, { name: '', quantity: 0, unit: '', category: 'Autres' }],
    });
  };

  const removeIngredient = (index: number) => {
    if (recipe.ingredients.length <= 1) return; // Must have at least one ingredient
    const updatedIngredients = recipe.ingredients.filter((_, i) => i !== index);
    setRecipe({ ...recipe, ingredients: updatedIngredients });
  };

  return (
    <div className='space-y-4'>
      <DialogHeader>
        <DialogTitle>{formTitle}</DialogTitle>
      </DialogHeader>
      <div className='grid sm:grid-cols-3 gap-4'>
        <Input
          placeholder='Nom de la recette'
          value={recipe.name}
          onChange={(e) => setRecipe({ ...recipe, name: e.target.value })}
        />
        <Select
          value={recipe.category}
          onValueChange={(value: RecipeCategory) => setRecipe({ ...recipe, category: value })}
        >
          <SelectTrigger><SelectValue placeholder='Catégorie' /></SelectTrigger>
          <SelectContent>
            {recipeCategories.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          type='number'
          placeholder='Nombre de convives'
          value={recipe.numberOfGuests}
          onChange={(e) => setRecipe({ ...recipe, numberOfGuests: Number(e.target.value) })}
        />
      </div>

      <h3 className='font-semibold pt-4'>Ingrédients</h3>
      <div className='space-y-2 max-h-60 overflow-y-auto pr-2'>
        {recipe.ingredients.map((ing, index) => (
          <div key={index} className='flex items-center gap-2'>
            <Input placeholder='Nom' value={ing.name} onChange={(e) => handleIngredientChange(index, 'name', e.target.value)} className='flex-grow' />
            <Input type='number' placeholder='Qté' value={ing.quantity} onChange={(e) => handleIngredientChange(index, 'quantity', e.target.value)} className='w-20' />
            <Input placeholder='Unité' value={ing.unit} onChange={(e) => handleIngredientChange(index, 'unit', e.target.value)} className='w-28' />
             <Select
                value={ing.category || 'Autres'}
                onValueChange={(value: IngredientCategory) => handleIngredientChange(index, 'category', value)}
            >
                <SelectTrigger className='w-48'>
                    <SelectValue placeholder='Catégorie' />
                </SelectTrigger>
                <SelectContent>
                    {ingredientCategories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Button disabled={recipe.ingredients.length <= 1} variant='ghost' size='icon' onClick={() => removeIngredient(index)}>
              <Trash2 className='h-4 w-4' />
            </Button>
          </div>
        ))}
      </div>
      <Button onClick={addIngredient} variant='outline' size='sm' className='mt-2'>
        <PlusCircle className='h-4 w-4 mr-2' />
        Ajouter un ingrédient
      </Button>

      <DialogFooter className='pt-4'>
        <DialogClose asChild><Button variant='outline'>Annuler</Button></DialogClose>
        <Button onClick={onSave} disabled={isSaving}>
          {isSaving && <Loader2 className='mr-2 h-4 w-4 animate-spin' />} 
          {saveButtonText}
        </Button>
      </DialogFooter>
    </div>
  );
}

// --- Main Component ---
const RecipeManagement = () => {
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [newRecipe, setNewRecipe] = useState<Omit<Recipe, 'id'>>({
        name: '',
        category: 'Plat',
        numberOfGuests: 240,
        ingredients: [{ name: '', quantity: 0, unit: '', category: 'Autres' }]
    });
    const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<RecipeCategory | 'all'>('all');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const filteredAndGroupedRecipes = useMemo(() => {
        const filtered = recipes
            .filter(recipe => selectedCategory === 'all' || recipe.category === selectedCategory)
            .filter(recipe => recipe.name.toLowerCase().includes(searchQuery.toLowerCase()));

        return recipeCategories.reduce((acc, category) => {
          const recipesInCategory = filtered.filter(recipe => recipe.category === category);
          if (recipesInCategory.length > 0) {
            acc[category] = recipesInCategory;
          }
          return acc;
        }, {} as Record<RecipeCategory, Recipe[]>);
    }, [recipes, searchQuery, selectedCategory]);

    const fetchRecipes = useCallback(async () => {
        setIsLoading(true);
        try {
            const recipesQuery = query(collection(firestore, 'recipes'), orderBy('name'));
            const recipesSnapshot = await getDocs(recipesQuery);
            const recipesList = recipesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recipe));
            setRecipes(recipesList);
        } catch (error) {
            console.error('Error fetching recipes:', error);
            toast({ title: 'Erreur de chargement des recettes', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchRecipes();
    }, [fetchRecipes]);

    const handleAddRecipe = async () => {
        if (!newRecipe.name || newRecipe.ingredients.some(i => !i.name)) {
            toast({ title: 'Champs incomplets', description: 'Veuillez nommer la recette et tous les ingrédients.', variant: 'destructive' });
            return;
        }
        setIsSaving(true);
        try {
            await addDoc(collection(firestore, 'recipes'), newRecipe);
            toast({ title: 'Recette ajoutée avec succès !' });
            setNewRecipe({
                name: '',
                category: 'Plat',
                numberOfGuests: 240,
                ingredients: [{ name: '', quantity: 0, unit: '', category: 'Autres' }]
            });
            setIsAddModalOpen(false);
            fetchRecipes(); // Refresh list
        } catch (error) {
            console.error('Error adding recipe: ', error);
            toast({ title: 'Erreur lors de l\'ajout', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleUpdateRecipe = async () => {
      if (!editingRecipe) return;
      if (!editingRecipe.name || editingRecipe.ingredients.some(i => !i.name)) {
          toast({ title: 'Champs incomplets', description: 'Veuillez nommer la recette et tous les ingrédients.', variant: 'destructive' });
          return;
      }
      setIsSaving(true);
      try {
          const recipeRef = doc(firestore, 'recipes', editingRecipe.id);
          // Make sure to save the category for each ingredient
          const recipeToSave = {
            ...editingRecipe,
            ingredients: editingRecipe.ingredients.map(ing => ({
              ...ing,
              category: ing.category || 'Autres' // Ensure category has a default value
            }))
          };
          await setDoc(recipeRef, recipeToSave);
          toast({ title: 'Recette modifiée avec succès !' });
          setEditingRecipe(null);
          fetchRecipes();
      } catch (error) {
          console.error('Error updating recipe: ', error);
          toast({ title: 'Erreur lors de la modification', variant: 'destructive' });
      } finally {
          setIsSaving(false);
      }
    };

    const handleDeleteRecipe = async (id: string) => {
        try {
            await deleteDoc(doc(firestore, 'recipes', id));
            toast({ title: 'Recette supprimée' });
            fetchRecipes();
        } catch (error) {
            console.error('Error deleting recipe: ', error);
            toast({ title: 'Erreur lors de la suppression', variant: 'destructive' });
        }
    };

  return (
    <div className='space-y-6'>
        {/* --- Add Recipe Modal --- */}
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogContent className='sm:max-w-3xl'>
                <RecipeForm 
                    recipe={newRecipe} 
                    setRecipe={setNewRecipe} 
                    onSave={handleAddRecipe}
                    isSaving={isSaving}
                    formTitle='Ajouter une nouvelle recette'
                    saveButtonText='Ajouter la recette'
                />
            </DialogContent>
        </Dialog>
        
        {/* --- Edit Recipe Modal --- */}
        <Dialog open={!!editingRecipe} onOpenChange={(isOpen) => !isOpen && setEditingRecipe(null)}>
            <DialogContent className='sm:max-w-3xl'>
                {editingRecipe && (
                    <RecipeForm 
                        recipe={editingRecipe} 
                        setRecipe={setEditingRecipe} 
                        onSave={handleUpdateRecipe}
                        isSaving={isSaving}
                        formTitle='Modifier la recette'
                        saveButtonText='Enregistrer les modifications'
                    />
                )}
            </DialogContent>
        </Dialog>

        <Card>
            <CardHeader>
                <CardTitle>Liste des recettes</CardTitle>
                <CardDescription>Consultez, ajoutez, modifiez ou supprimez vos recettes.</CardDescription>
            </CardHeader>
            <CardContent>
                 <div className="flex flex-col sm:flex-row gap-4 mb-4">
                    <div className="relative flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Rechercher une recette..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as RecipeCategory | 'all')}>
                        <SelectTrigger className="w-full sm:w-[220px]">
                            <SelectValue placeholder="Filtrer par catégorie" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Toutes les catégories</SelectItem>
                            {recipeCategories.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button onClick={() => setIsAddModalOpen(true)} className='w-full sm:w-auto'>
                      <PlusCircle className='mr-2 h-4 w-4' />
                      Ajouter une recette
                    </Button>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary"/>
                    </div>
                ) : recipes.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Aucune recette pour le moment. Cliquez sur 'Ajouter' pour commencer.</p>
                ) : Object.keys(filteredAndGroupedRecipes).length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Aucune recette ne correspond à votre recherche ou filtre.</p> 
                ) : (
                    <div className="space-y-6">
                        {Object.entries(filteredAndGroupedRecipes).map(([category, recipesInCategory]) => (
                                <div key={category}>
                                    <h3 className="text-xl font-bold mb-3 border-b pb-2 capitalize">{category}</h3>
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        {recipesInCategory.map(recipe => (
                                            <Card key={recipe.id}>
                                                <CardHeader className="pb-2">
                                                    <div className='flex justify-between items-start gap-2'>
                                                        <div className='flex-1'>
                                                            <CardTitle className="text-lg">{recipe.name}</CardTitle>
                                                            <p className="text-sm text-muted-foreground">Pour {recipe.numberOfGuests} convives</p>
                                                        </div>
                                                        <div className='flex'>
                                                            <Button variant='ghost' size='icon' onClick={() => setEditingRecipe(recipe)}>
                                                                <Pencil className='h-4 w-4 text-blue-500'/>
                                                            </Button>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant='ghost' size='icon'><Trash2 className='h-4 w-4 text-destructive' /></Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Supprimer la recette "{recipe.name}" ?</AlertDialogTitle>
                                                                        <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleDeleteRecipe(recipe.id)}>Supprimer</AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </div>
                                                    </div>
                                                </CardHeader>
                                                <CardContent>
                                                    <ul className="list-disc pl-5 text-sm space-y-1 max-h-32 overflow-y-auto">
                                                        {recipe.ingredients.map((ing, i) => (
                                                            <li key={i}>
                                                              <span className='font-medium'>{ing.name}:</span> {ing.quantity} {ing.unit}
                                                              {ing.category && <span className='text-xs text-muted-foreground ml-2'>({ing.category})</span>}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    </div>
  );
};

export default RecipeManagement;
