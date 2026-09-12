'use client';

import { useState, useEffect, useCallback } from 'react';
import MonthSelector from './components/MonthSelector';
import EffectifTable from './components/EffectifTable';
import { getEffectifsForMonth, deleteEffectif } from './services';
import { Effectif } from './types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import EffectifForm from './components/EffectifForm';
import { PlusCircle } from 'lucide-react';
import useMobile from '@/hooks/use-mobile';

export default function EffectifsPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [effectifs, setEffectifs] = useState<Effectif[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const { toast } = useToast();
    const isMobile = useMobile();

    const fetchEffectifs = useCallback(async (date: Date) => {
        setIsLoading(true);
        try {
            const data = await getEffectifsForMonth(date);
            setEffectifs(data);
        } catch (error) {
            console.error("Error fetching effectifs:", error);
            toast({ title: "Erreur", description: "Impossible de charger les données.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchEffectifs(currentDate);
    }, [currentDate, fetchEffectifs]);

    const handleEffectifUpdate = useCallback((updatedEffectif: Effectif) => {
        setEffectifs(prevEffectifs => {
            const index = prevEffectifs.findIndex(e => e.id === updatedEffectif.id);
            if (index !== -1) {
                const newEffectifs = [...prevEffectifs];
                newEffectifs[index] = updatedEffectif;
                return newEffectifs;
            } else {
                return [...prevEffectifs, updatedEffectif];
            }
        });
    }, []);

    const handleEffectifDelete = useCallback(async (id: string) => {
        const originalEffectifs = [...effectifs];
        setEffectifs(prev => prev.filter(e => e.id !== id));
        try {
            await deleteEffectif(id);
            toast({ title: "Succès", description: "L\'entrée a été supprimée." });
        } catch (error) {
            console.error('Failed to delete effectif', error);
            toast({ title: "Erreur", description: "La suppression a échoué.", variant: "destructive" });
            setEffectifs(originalEffectifs);
        }
    }, [effectifs, toast]);

    if (isMobile) {
        return (
            <div className="container mx-auto p-4 text-center">
                <h1 className="text-2xl font-bold mb-4">Gestion des Effectifs</h1>
                <p className="text-muted-foreground">
                    Cette page n'est pas disponible sur les appareils mobiles. Veuillez utiliser un ordinateur.
                </p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-3xl font-bold mb-6">Gestion des Effectifs</h1>
            
            <div className="flex justify-between items-center mb-6">
                <MonthSelector
                    currentDate={currentDate}
                    onDateChange={setCurrentDate}
                />
                <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                    <DialogTrigger asChild>
                         <Button>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Ajouter une date
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px]">
                        <DialogHeader>
                            <DialogTitle>Ajouter un effectif journalier</DialogTitle>
                        </DialogHeader>
                        <EffectifForm
                            initialDate={currentDate}
                            onEffectifSave={(newEffectif) => {
                                const newDate = new Date(newEffectif.date);
                                if (newDate.getMonth() === currentDate.getMonth() && newDate.getFullYear() === currentDate.getFullYear()) {
                                    handleEffectifUpdate(newEffectif);
                                }
                                setIsFormOpen(false);
                            }}
                        />
                    </DialogContent>
                </Dialog>
            </div>

            {isLoading ? (
                <p>Chargement...</p>
            ) : effectifs.length > 0 ? (
                <EffectifTable effectifs={effectifs} onUpdate={handleEffectifUpdate} onDelete={handleEffectifDelete} />
            ) : (
                 <div className="text-center py-12 rounded-lg bg-card text-card-foreground p-4 shadow-md">
                    <p className="text-muted-foreground">Aucun effectif enregistré pour ce mois.</p>
                    <p className="text-sm text-muted-foreground mt-2">
                        Cliquez sur "Ajouter une date" pour commencer à saisir des données.
                    </p>
                </div>
            )}
        </div>
    );
}