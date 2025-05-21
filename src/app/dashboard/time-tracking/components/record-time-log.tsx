
"use client";

import React, { useState, useEffect, useMemo } from 'react'; // Added useEffect, useMemo
import type { BrigadeMember, TimeEntry } from '../types';
import type { RubricId } from '@/app/dashboard/settings/components/user-management'; // New import
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, CalendarIcon, History, Clock, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const timeEntrySchema = z.object({
  memberId: z.string().min(1, "Veuillez sélectionner un membre."),
  date: z.date({ required_error: "La date est requise." }),
  hours: z.coerce.number().min(0.1, "Les heures doivent être supérieures à 0.").max(24, "Les heures ne peuvent excéder 24 par jour."),
  type: z.enum(['addition', 'deduction'], { required_error: "Veuillez sélectionner un type d'entrée." }),
  reason: z.string().min(1, "La raison est requise.").max(200, "La raison ne peut excéder 200 caractères."),
});

type TimeEntryFormData = z.infer<typeof timeEntrySchema>;

interface RecordTimeLogProps {
  members: BrigadeMember[];
  timeEntries: TimeEntry[];
  onAddTimeEntry: (entry: Omit<TimeEntry, 'id' | 'memberName'>) => void;
  onDeleteAllTimeEntries: () => void;
  loggedInUsername: string | null;
  userPermissions: Partial<Record<RubricId, boolean>>;
}

export default function RecordTimeLog({
  members,
  timeEntries,
  onAddTimeEntry,
  onDeleteAllTimeEntries,
  loggedInUsername,
  userPermissions
}: RecordTimeLogProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const isChef = useMemo(() => loggedInUsername?.toLowerCase() === 'chef', [loggedInUsername]);
  const currentUserBrigadeMember = useMemo(() => {
    if (isClient && !isChef && loggedInUsername) {
      return members.find(m => m.name.toLowerCase() === loggedInUsername.toLowerCase());
    }
    return null;
  }, [isClient, isChef, loggedInUsername, members]);
  
  const form = useForm<TimeEntryFormData>({
    resolver: zodResolver(timeEntrySchema),
    defaultValues: {
      memberId: '',
      date: new Date(),
      hours: 1,
      type: 'addition',
      reason: '',
    },
  });

  useEffect(() => {
    if (isDialogOpen) { // Reset form when dialog opens
        if (!isChef && currentUserBrigadeMember) {
        form.reset({
            memberId: currentUserBrigadeMember.id,
            date: new Date(),
            hours: 1,
            type: 'addition',
            reason: '',
        });
        } else { // Chef or no specific user context
        form.reset({
            memberId: '',
            date: new Date(),
            hours: 1,
            type: 'addition',
            reason: '',
        });
        }
    }
  }, [isDialogOpen, isChef, currentUserBrigadeMember, form]);


  const onSubmit = (data: TimeEntryFormData) => {
    if (!isChef && currentUserBrigadeMember && data.memberId !== currentUserBrigadeMember.id) {
        // This case should ideally be prevented by disabling the select, but as a safeguard:
        alert("Vous ne pouvez enregistrer des heures que pour vous-même.");
        return;
    }
    onAddTimeEntry(data);
    // form.reset() will be handled by useEffect on isDialogOpen change
    setIsDialogOpen(false);
  };

  const displayedTimeEntries = useMemo(() => {
    if (isChef) {
      return timeEntries.slice(0, 20);
    }
    if (currentUserBrigadeMember) {
      return timeEntries.filter(entry => entry.memberId === currentUserBrigadeMember.id).slice(0, 20);
    }
    return [];
  }, [timeEntries, isChef, currentUserBrigadeMember]);

  const canCurrentUserRecord = !isChef ? !!currentUserBrigadeMember : true;


  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
                <Clock className="w-6 h-6 text-primary"/>
                Saisie des Heures
            </CardTitle>
            <CardDescription>Enregistrez les heures (ajouts/déductions) pour les membres de la brigade.</CardDescription>
          </div>
           <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto" disabled={!canCurrentUserRecord && !isChef}>
                <PlusCircle className="mr-2 h-4 w-4" /> Nouvelle Entrée d'Heures
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Nouvelle Entrée d'Heures</DialogTitle>
                {!isChef && currentUserBrigadeMember && (
                    <CardDescription>Saisie pour : {currentUserBrigadeMember.name}</CardDescription>
                )}
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                  <FormField
                    control={form.control}
                    name="memberId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Membre de la Brigade</FormLabel>
                        <Select 
                            onValueChange={field.onChange} 
                            value={isChef ? field.value : (currentUserBrigadeMember?.id || '')} 
                            defaultValue={isChef ? field.value : (currentUserBrigadeMember?.id || '')} 
                            disabled={!isChef || members.length === 0}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={!isChef && currentUserBrigadeMember ? currentUserBrigadeMember.name : "Sélectionner un membre"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {isChef ? (
                                members.length > 0 ? members.map(member => (
                                <SelectItem key={member.id} value={member.id}>
                                    {member.name} ({member.role})
                                </SelectItem>
                                )) : <SelectItem value="disabled" disabled>Aucun membre disponible</SelectItem>
                            ) : currentUserBrigadeMember ? (
                                <SelectItem value={currentUserBrigadeMember.id}>
                                    {currentUserBrigadeMember.name} ({currentUserBrigadeMember.role})
                                </SelectItem>
                            ) : (
                                <SelectItem value="disabled" disabled>Aucun membre assigné</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP", { locale: fr })
                                ) : (
                                  <span>Choisir une date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date > new Date() || date < new Date("1900-01-01")
                              }
                              initialFocus
                              locale={fr}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="hours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre d'Heures</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.25" placeholder="Ex: 8.5" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Type d'Entrée</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex space-x-4"
                          >
                            <FormItem className="flex items-center space-x-2">
                              <FormControl><RadioGroupItem value="addition" /></FormControl>
                              <FormLabel className="font-normal">Ajout (Ex: Heures travaillées)</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2">
                              <FormControl><RadioGroupItem value="deduction" /></FormControl>
                              <FormLabel className="font-normal">Déduction (Ex: Absence)</FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Raison/Motif</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Ex: Service du soir, Absence justifiée..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                     <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
                    <Button type="submit" disabled={members.length === 0 && isChef || !canCurrentUserRecord && !isChef}>Enregistrer l'Entrée</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
         <CardContent>
           <p className="text-sm text-muted-foreground">
            {members.length === 0 && isChef ? "Veuillez d'abord ajouter des membres à la brigade dans l'onglet 'Gestion du Personnel'." : 
             !canCurrentUserRecord && !isChef ? "Votre compte utilisateur n'est pas lié à un membre de la brigade. Saisie impossible." :
             "Cliquez sur 'Nouvelle Entrée d'Heures' pour enregistrer les heures."}
           </p>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-6 h-6 text-primary"/>
            Historique des Saisies d'Heures
          </CardTitle>
          <CardDescription>
            {isChef ? "Liste des 20 dernières entrées d'heures enregistrées pour tous les membres, triées par date." : 
            currentUserBrigadeMember ? `Liste de vos 20 dernières entrées d'heures, triées par date.` :
            "Aucun historique à afficher."}
            </CardDescription>
        </CardHeader>
        <CardContent>
          {displayedTimeEntries.length === 0 ? (
             <p className="text-muted-foreground text-center py-8">
                {isChef ? "Aucune entrée d'heures enregistrée pour l'ensemble du personnel." : 
                 currentUserBrigadeMember ? "Aucune entrée d'heures enregistrée pour vous." :
                 "Impossible d'afficher l'historique (utilisateur non lié à la brigade)."}
            </p>
          ) : (
            <div className="overflow-x-auto border rounded-md max-h-[500px]">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    {isChef && <TableHead>Membre</TableHead>}
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Heures</TableHead>
                    <TableHead>Raison</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedTimeEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{format(new Date(entry.date), "dd/MM/yyyy", { locale: fr })}</TableCell>
                      {isChef && <TableCell className="font-medium">{entry.memberName}</TableCell>}
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${entry.type === 'addition' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {entry.type === 'addition' ? 'Ajout' : 'Déduction'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{entry.hours.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 2})}</TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate max-w-[200px] sm:max-w-xs">{entry.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {isChef && timeEntries.length > 0 && (
          <CardFooter className="flex justify-end pt-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Supprimer Tout l'Historique
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer tout l'historique ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est irréversible et supprimera toutes les entrées d'heures enregistrées.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={onDeleteAllTimeEntries}>
                    Supprimer Tout
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
