
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
  // prestationTypeNotes is removed from schema as it's fixed
  overtimeDetailsNotes: z.string().max(500, "Détails heures supp max 500 caractères.").optional(),
  totalOvertimeHours: z.string().max(50, "Total heures max 50 caractères.").optional(),
});

// FormData no longer includes prestationTypeNotes
type FormData = Omit<z.infer<typeof formSchema>, 'prestationTypeNotes'>;

interface OvertimeRequestDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  // onSubmitRequest prop type updated
  onSubmitRequest: (data: FormData) => void;
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
      overtimeDetailsNotes: '',
      totalOvertimeHours: '',
    },
  });

  React.useEffect(() => {
    if (isOpen) {
      if (editingRequest) {
        form.reset({
          reasonStub: editingRequest.reasonStub || '',
          position: editingRequest.position || (currentUser?.role || ''),
          // prestationTypeNotes is no longer part of form state
          overtimeDetailsNotes: editingRequest.overtimeDetailsNotes || '',
          totalOvertimeHours: editingRequest.totalOvertimeHours || '',
        });
      } else { // New request
        form.reset({
          reasonStub: '',
          position: currentUser?.role || '',
          // prestationTypeNotes is no longer part of form state
          overtimeDetailsNotes: '',
          totalOvertimeHours: '',
        });
      }
    }
  }, [isOpen, editingRequest, currentUser, form]);

  const handleSubmit = (data: FormData) => {
    onSubmitRequest(data); // Data passed no longer contains prestationTypeNotes
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
                    <Input value={editingRequest?.employeeName || currentUser?.name || "Non identifié"} disabled className="bg-muted/50" />
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
                          disabled={!editingRequest && !!currentUser?.role}
                          className={(!editingRequest && !!currentUser?.role) ? "bg-muted/50" : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormItem>
                  <FormLabel>Prestation correspondante</FormLabel>
                  <FormControl>
                    <Input value="Logistique" disabled className="bg-muted/50" />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Sera remplacé par des cases à cocher ultérieurement.</p>
                </FormItem>


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
