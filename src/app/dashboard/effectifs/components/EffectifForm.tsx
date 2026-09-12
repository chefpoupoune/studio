'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveEffectif } from '../services';
import { Effectif } from '../types';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface EffectifFormProps {
    initialDate?: Date;
    onEffectifSave?: (effectif: Effectif) => void;
    // Cette prop est la clé : elle permet de fermer la fenêtre parente
    setOpen?: (open: boolean) => void; 
}

export default function EffectifForm({ 
    initialDate, 
    onEffectifSave = () => {},
    setOpen 
}: EffectifFormProps) {
    const [date, setDate] = useState(() => {
        const d = initialDate ? new Date(initialDate) : new Date();
        d.setHours(12, 0, 0, 0);
        return d.toISOString().split('T')[0];
    });
    
    const [formData, setFormData] = useState({
        imp: 0, impPn: 0, saj: 0, sajPn: 0, ime: 0,
        imePn: 0, esat: 0, esatPn: 0, repasExceptionnel: 0, nous: 0,
    });
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    const totalEffectif = useMemo(() => {
        return Object.values(formData).reduce((acc, curr) => acc + (Number(curr) || 0), 0);
    }, [formData]);

    const monthLabel = useMemo(() => {
        if (!date) return '';
        const dateObj = new Date(date + 'T00:00:00');
        return format(dateObj, 'MMMM yyyy', { locale: fr });
    }, [date]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value === '' ? 0 : Number(value) }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        try {
            // @ts-ignore
            const savedEffectif = await saveEffectif({ date, ...formData });
            toast({ title: "Succès", description: "L'effectif a été enregistré." });
            
            onEffectifSave(savedEffectif);
            
            // ICI : On dit à la fenêtre de se fermer
            if (setOpen) {
                setOpen(false);
            }
            
        } catch (error) {
            toast({ title: "Erreur", description: "Échec de l'enregistrement.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="text-center font-semibold text-lg">
                Recap effectif ({monthLabel})
            </div>
            
            <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="date">Date</Label>
                    <Input
                        id="date" type="date" value={date}
                        onChange={(e) => setDate(e.target.value)} required
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t pt-4">
                <div className="space-y-2">
                    <Label>IMP</Label>
                    <Input name="imp" type="number" value={formData.imp} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                    <Label>PN</Label>
                    <Input name="impPn" type="number" value={formData.impPn} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                    <Label>SAJ</Label>
                    <Input name="saj" type="number" value={formData.saj} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                    <Label>PN</Label>
                    <Input name="sajPn" type="number" value={formData.sajPn} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                    <Label>IME</Label>
                    <Input name="ime" type="number" value={formData.ime} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                    <Label>PN</Label>
                    <Input name="imePn" type="number" value={formData.imePn} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                    <Label>ESAT</Label>
                    <Input name="esat" type="number" value={formData.esat} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                    <Label>PN</Label>
                    <Input name="esatPn" type="number" value={formData.esatPn} onChange={handleInputChange} />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div className="space-y-2">
                    <Label>Repas Except.</Label>
                    <Input name="repasExceptionnel" type="number" value={formData.repasExceptionnel} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                    <Label>Nous</Label>
                    <Input name="nous" type="number" value={formData.nous} onChange={handleInputChange} />
                </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
                <p className="font-bold">Total: {totalEffectif}</p>
                <Button type="submit" disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Enregistrer
                </Button>
            </div>
        </form>
    );
}