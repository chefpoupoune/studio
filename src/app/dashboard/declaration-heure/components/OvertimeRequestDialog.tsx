
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { OvertimeRequestStub } from '../types';
import { ScrollArea } from '@/components/ui/scroll-area';

const formSchema = z.object({
  reasonStub: z.string().min(5, "Veuillez fournir un bref motif (min. 5 caractères).").max(500, "Le motif ne peut excéder 500 caractères."),
  position: z.string().optional(),
  prestationTypeNotes: z.string().max(200, "Notes prestation max 200 caractères.").optional(),
  overtimeDetailsNotes: z.string().max(500, "Détails heures supp max 500 caractères.").optional(),
  totalOvertimeHours: z.string().max(50, "Total heures max 50 caractères.").optional(),
});

type FormData = z.infer<typeof formSchema>;

interface OvertimeRequestDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmitRequest: (data: Omit<FormData, 'employeeName'>) => void;
  editingRequest?: OvertimeRequestStub | null;
  currentUser?: { name: string; role: string } | null;
}

export default function OvertimeRequestDialog({
  isOpen,
  onOpenChange,
  onSubmitRequest,
  editingRequest,
  currentUser,
}: OvertimeRequestDialogProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reasonStub: '',
      position: '',
      prestationTypeNotes: '',
      overtimeDetailsNotes: '',
      totalOvertimeHours: '',
    },
  });

  React.useEffect(() => {
    if (isOpen) {
      if (editingRequest) {
        form.reset({
          reasonStub: editingRequest.reasonStub || '',
          position: editingRequest.position || '', // For editing, always load from the request
          prestationTypeNotes: editingRequest.prestationTypeNotes || '',
          overtimeDetailsNotes: editingRequest.overtimeDetailsNotes || '',
          totalOvertimeHours: editingRequest.totalOvertimeHours || '',
        });
      } else { // New request
        form.reset({
          reasonStub: '',
          position: currentUser?.role || '', // Pre-fill with current user's role
          prestationTypeNotes: 'logistique', // Default to 'logistique'
          overtimeDetailsNotes: '',
          totalOvertimeHours: '',
        });
      }
    }
  }, [isOpen, editingRequest, currentUser, form]);

  const handleSubmit = (data: FormData) => {
    onSubmitRequest(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg md:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editingRequest ? "Modifier la" : "Nouvelle"} Demande de Dépassement d'Horaire</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
            <ScrollArea className="h-[60vh] pr-5">
              <div className="space-y-4">
                <FormItem>
                  <FormLabel>Nom et prénom du salarié</FormLabel>
                  <FormControl>
                    <Input value={currentUser?.name || editingRequest?.employeeName || "Non identifié"} disabled className="bg-muted/50" />
                  </FormControl>
                </FormItem>

                <FormField
                  control={form.control}
                  name="position"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Poste occupé à l'IME</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Ex: Éducateur spécialisé"
                          {...field}
                          // Disable only for new requests if currentUser.role is available.
                          // Allows editing the position if it was previously set, even if the current user has a different role.
                          disabled={!editingRequest && !!currentUser?.role}
                          className={(!editingRequest && !!currentUser?.role) ? "bg-muted/50" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="prestationTypeNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prestation correspondante (notes)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Ex: Accompagnement sortie, Remplacement imprévu..." {...field} rows={2} />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground">Sera remplacé par des cases à cocher ultérieurement.</p>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reasonStub"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Motif de la demande</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Entrez le motif principal de votre demande..." {...field} rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="overtimeDetailsNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Détail des heures supplémentaires (descriptif)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Ex: Lundi 20/05 de 17h à 19h, Mardi 21/05 de 8h à 9h..." {...field} rows={3} />
                      </FormControl>
                      <FormMessage />
                       <p className="text-xs text-muted-foreground">Sera remplacé par un tableau structuré ultérieurement.</p>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="totalOvertimeHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total des heures en plus de l'horaire prévu</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: 3.5 heures" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <p className="text-xs text-muted-foreground pt-2">
                  D'autres champs (Signatures, dates spécifiques, etc.) seront ajoutés pour correspondre au document officiel.
                </p>
              </div>
            </ScrollArea>
            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">Annuler</Button>
              </DialogClose>
              <Button type="submit">{editingRequest ? "Enregistrer" : "Soumettre la Demande"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
