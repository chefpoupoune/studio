
"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { OvertimeRequestStub } from '../types';

const formSchema = z.object({
  reasonStub: z.string().min(5, "Veuillez fournir un bref motif (min. 5 caractères)."),
  // More fields will be added later based on the full form
});

type FormData = z.infer<typeof formSchema>;

interface OvertimeRequestDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmitRequest: (data: FormData) => void;
  // editingRequest?: OvertimeRequestStub | null; // For future edit functionality
}

export default function OvertimeRequestDialog({
  isOpen,
  onOpenChange,
  onSubmitRequest,
}: OvertimeRequestDialogProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      reasonStub: '',
    },
  });

  const handleSubmit = (data: FormData) => {
    onSubmitRequest(data);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle Demande de Dépassement d'Horaire</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="reasonStub"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motif de la demande (simplifié)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Entrez le motif principal de votre demande..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* More form fields will be added here to match the image */}
            <p className="text-xs text-muted-foreground">
              Ceci est un formulaire simplifié. D'autres champs seront ajoutés pour correspondre au document officiel.
            </p>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Annuler</Button>
              </DialogClose>
              <Button type="submit">Soumettre la Demande</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
