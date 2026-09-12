'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { firestore } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Recipe, RecipeCategory, recipeCategories } from './recipe-management';

interface RecipePickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectRecipe: (recipe: Recipe) => void;
  categoryFilter?: RecipeCategory;
}

const RecipePickerModal: React.FC<RecipePickerModalProps> = ({ open, onOpenChange, onSelectRecipe, categoryFilter }) => {
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<RecipeCategory | 'all'>('all');

    useEffect(() => {
      if (categoryFilter) {
        setSelectedCategory(categoryFilter);
      }
      else {
        setSelectedCategory('all');
      }
    }, [categoryFilter]);

    const filteredRecipes = useMemo(() => {
        return recipes
            .filter(recipe => selectedCategory === 'all' || recipe.category === selectedCategory)
            .filter(recipe => recipe.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [recipes, searchQuery, selectedCategory]);

    const fetchRecipes = useCallback(async () => {
        setIsLoading(true);
        try {
            const recipesQuery = query(collection(firestore, 'recipes'), orderBy("name"));
            const recipesSnapshot = await getDocs(recipesQuery);
            const recipesList = recipesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Recipe));
            setRecipes(recipesList);
        } catch (error) {
            console.error("Error fetching recipes:", error);
            toast({ title: "Erreur de chargement des recettes", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
      if (open) {
        fetchRecipes();
      }
    }, [open, fetchRecipes]);

    const handleSelect = (recipe: Recipe) => {
        onSelectRecipe(recipe);
        onOpenChange(false);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* Let the entire content area scroll */}
            <DialogContent className="max-w-4xl w-full h-[90vh] p-0 overflow-y-auto gap-0">
                
                {/* Sticky container for the header and filters */}
                <div className="sticky top-0 bg-card z-10">
                    <DialogHeader className="p-6 pb-4 border-b">
                        <DialogTitle>Sélectionner une recette</DialogTitle>
                    </DialogHeader>

                    <div className="flex flex-col sm:flex-row gap-4 p-6 border-b">
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
                            <SelectTrigger className="w-full sm:w-[200px]">
                                <SelectValue placeholder="Filtrer par catégorie" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Toutes les catégories</SelectItem>
                                {recipeCategories.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Scrollable Content Area */}
                <div className="p-8">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full py-24">
                            <Loader2 className="h-8 w-8 animate-spin text-primary"/>
                        </div>
                    ) : filteredRecipes.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">Aucune recette trouvée.</p>
                    ) : (
                        <div className="flex flex-col gap-2">
                            {filteredRecipes.map(recipe => (
                                <div 
                                    key={recipe.id} 
                                    className="p-3 border rounded-md cursor-pointer hover:bg-muted"
                                    onClick={() => handleSelect(recipe)}
                                >
                                    <p className="text-sm font-medium">{recipe.name}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default RecipePickerModal;
