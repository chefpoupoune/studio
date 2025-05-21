
"use client";

import React, { useState, useEffect } from 'react';
import type { BrigadeMember, WeeklyWorkSchedule } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit2, Trash2, Users } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form'; // Added Controller
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox'; // Added Checkbox
import { ScrollArea } from '@/components/ui/scroll-area'; // Added ScrollArea
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
import { Badge } from '@/components/ui/badge';

const memberSchema = z.object({
  name: z.string().min(1, "Le nom est requis."),
  role: z.string().min(1, "Le rôle est requis."),
  assignedScheduleTemplateIds: z.array(z.string()).optional().default([]), // Changed to array
});

type MemberFormData = z.infer<typeof memberSchema>;

interface ManageBrigadeMembersProps {
  members: BrigadeMember[];
  scheduleTemplates: WeeklyWorkSchedule[];
  onAddMember: (member: Omit<BrigadeMember, 'id'>) => void;
  onUpdateMember: (member: BrigadeMember) => void;
  onDeleteMember: (memberId: string) => void;
}

export default function ManageBrigadeMembers({ members, scheduleTemplates, onAddMember, onUpdateMember, onDeleteMember }: ManageBrigadeMembersProps) {
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<BrigadeMember | null>(null);

  const form = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      name: '',
      role: '',
      assignedScheduleTemplateIds: [],
    },
  });

  useEffect(() => {
    if (isFormDialogOpen) {
      if (editingMember) {
        form.reset({
          name: editingMember.name,
          role: editingMember.role,
          assignedScheduleTemplateIds: editingMember.assignedScheduleTemplateIds || [],
        });
      } else {
        form.reset({ name: '', role: '', assignedScheduleTemplateIds: [] });
      }
    } else {
      setEditingMember(null);
      form.reset({ name: '', role: '', assignedScheduleTemplateIds: [] });
    }
  }, [editingMember, form, isFormDialogOpen]);

  const onSubmit = (data: MemberFormData) => {
    const memberDataToSave: Partial<BrigadeMember> = {
      name: data.name,
      role: data.role,
      assignedScheduleTemplateIds: data.assignedScheduleTemplateIds || [],
    };

    if (editingMember) {
      onUpdateMember({ ...editingMember, ...memberDataToSave });
    } else {
      onAddMember(memberDataToSave as Omit<BrigadeMember, 'id'>);
    }
    setIsFormDialogOpen(false);
  };

  const handleOpenFormDialog = (member?: BrigadeMember) => {
    setEditingMember(member || null);
    setIsFormDialogOpen(true);
  };
  
  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Gestion du Personnel de Brigade
          </CardTitle>
          <CardDescription>Ajoutez, modifiez ou supprimez des membres de votre brigade et assignez-leur des modèles d'horaires.</CardDescription>
        </div>
        <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenFormDialog()} className="w-full sm:w-auto">
              <PlusCircle className="mr-2 h-4 w-4" /> Ajouter Membre
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingMember ? 'Modifier Membre' : 'Ajouter un Nouveau Membre'}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom du Membre</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Jean Dupont" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rôle</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Cuisinier, Chef de Partie" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormItem>
                  <FormLabel>Modèles d'Horaires Attribués</FormLabel>
                  {scheduleTemplates.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucun modèle d'horaire disponible. Veuillez en créer dans l'onglet "Modèles d'Horaires".</p>
                  ) : (
                    <ScrollArea className="h-[200px] border rounded-md p-2">
                      <div className="space-y-2">
                        {scheduleTemplates.map((template) => (
                          <FormField
                            key={template.id}
                            control={form.control}
                            name="assignedScheduleTemplateIds"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md p-2 hover:bg-muted/50">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(template.id)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...(field.value || []), template.id])
                                        : field.onChange(
                                            (field.value || []).filter(
                                              (value) => value !== template.id
                                            )
                                          );
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal text-sm cursor-pointer">
                                  {template.name} ({template.weeklyTotal}h)
                                </FormLabel>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </FormItem>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">Annuler</Button>
                  </DialogClose>
                  <Button type="submit">{editingMember ? 'Enregistrer Modifications' : 'Ajouter Membre'}</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Aucun membre dans la brigade. Commencez par en ajouter un.</p>
        ) : (
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Modèles d'Horaires Attribués</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const assignedTemplates = scheduleTemplates.filter(st => member.assignedScheduleTemplateIds?.includes(st.id));
                  return (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.name}</TableCell>
                      <TableCell>{member.role}</TableCell>
                      <TableCell className="text-xs">
                        {assignedTemplates.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {assignedTemplates.map(template => (
                              <Badge key={template.id} variant="secondary" className="font-normal">
                                {template.name} ({template.weeklyTotal}h)
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="italic text-muted-foreground">Aucun</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center space-x-1">
                        <Button variant="outline" size="icon" onClick={() => handleOpenFormDialog(member)} className="h-8 w-8">
                          <Edit2 className="h-4 w-4" />
                          <span className="sr-only">Modifier</span>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                             <Button variant="destructive" size="icon" className="h-8 w-8">
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Supprimer</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer ce membre ?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action est irréversible. Le membre "{member.name}" sera supprimé.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onDeleteMember(member.id)}>
                                Supprimer
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
