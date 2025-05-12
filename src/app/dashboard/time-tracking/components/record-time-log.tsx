
"use client";

import React, { useState } from 'react';
import type { BrigadeMember, TimeEntry } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, CalendarIcon, History, Clock } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

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
}

export default function RecordTimeLog({ members, timeEntries, onAddTimeEntry }: RecordTimeLogProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
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

  const onSubmit = (data: TimeEntryFormData) => {
    onAddTimeEntry(data);
    form.reset({ memberId: '', date: new Date(), hours: 1, type: 'addition', reason: '' });
    setIsDialogOpen(false);
  };

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
              <Button className="w-full sm:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" /> Nouvelle Entrée d'Heures
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Nouvelle Entrée d'Heures</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                  <FormField
                    control={form.control}
                    name="memberId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Membre de la Brigade</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={members.length === 0}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un membre" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {members.length > 0 ? members.map(member => (
                              <SelectItem key={member.id} value={member.id}>
                                {member.name} ({member.role})
                              </SelectItem>
                            )) : <SelectItem value="disabled" disabled>Aucun membre disponible</SelectItem>}
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
                    <Button type="submit" disabled={members.length === 0}>Enregistrer l'Entrée</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
         <CardContent>
           <p className="text-sm text-muted-foreground">
            {members.length === 0 ? "Veuillez d'abord ajouter des membres à la brigade dans l'onglet 'Gestion du Personnel'." : "Cliquez sur 'Nouvelle Entrée d'Heures' pour enregistrer les heures."}
           </p>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-6 h-6 text-primary"/>
            Historique des Saisies d'Heures
          </CardTitle>
          <CardDescription>Liste des 20 dernières entrées d'heures enregistrées, triées par date.</CardDescription>
        </CardHeader>
        <CardContent>
          {timeEntries.length === 0 ? (
             <p className="text-muted-foreground text-center py-8">Aucune entrée d'heures enregistrée.</p>
          ) : (
            <div className="overflow-x-auto border rounded-md max-h-[500px]">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Membre</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Heures</TableHead>
                    <TableHead>Raison</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeEntries.slice(0, 20).map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{format(new Date(entry.date), "dd/MM/yyyy", { locale: fr })}</TableCell>
                      <TableCell className="font-medium">{entry.memberName}</TableCell>
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
      </Card>
    </div>
  );
}
