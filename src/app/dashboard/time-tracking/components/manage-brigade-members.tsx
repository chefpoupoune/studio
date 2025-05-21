
"use client";

import React, { useState } from 'react';
import type { BrigadeMember, WeeklyWorkSchedule } from '../types'; // Added WeeklyWorkSchedule
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit2, Trash2, Users } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Added Select
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

const memberSchema = z.object({
  name: z.string().min(1, "Le nom est requis."),
  role: z.string().min(1, "Le rôle est requis."),
  assignedScheduleTemplateId: z.string().optional(), // New field for schema
});

type MemberFormData = z.infer<typeof memberSchema>;

interface ManageBrigadeMembersProps {
  members: BrigadeMember[];
  scheduleTemplates: WeeklyWorkSchedule[]; // New prop
  onAddMember: (member: Omit<BrigadeMember, 'id'>) => void;
  onUpdateMember: (member: BrigadeMember) => void;
  onDeleteMember: (memberId: string) => void;
}

const NO_SCHEDULE_SELECTED_VALUE = "_NO_SCHEDULE_";

export default function ManageBrigadeMembers({ members, scheduleTemplates, onAddMember, onUpdateMember, onDeleteMember }: ManageBrigadeMembersProps) {
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<BrigadeMember | null>(null);

  const form = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      name: '',
      role: '',
      assignedScheduleTemplateId: undefined,
    },
  });

  React.useEffect(() => {
    if (isFormDialogOpen) {
      if (editingMember) {
        form.reset({
          name: editingMember.name,
          role: editingMember.role,
          assignedScheduleTemplateId: editingMember.assignedScheduleTemplateId || undefined,
        });
      } else {
        form.reset({ name: '', role: '', assignedScheduleTemplateId: undefined });
      }
    } else {
      setEditingMember(null);
      form.reset({ name: '', role: '', assignedScheduleTemplateId: undefined });
    }
  }, [editingMember, form, isFormDialogOpen]);

  const onSubmit = (data: MemberFormData) => {
    const memberDataToSave: Partial<BrigadeMember> = {
      name: data.name,
      role: data.role,
      assignedScheduleTemplateId: data.assignedScheduleTemplateId || undefined,
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
          <CardDescription>Ajoutez, modifiez ou supprimez des membres de votre brigade et assignez-leur un modèle d'horaire.</CardDescription>
        </div>
        <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenFormDialog()} className="w-full sm:w-auto">
              <PlusCircle className="mr-2 h-4 w-4" /> Ajouter Membre
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
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
                <FormField
                  control={form.control}
                  name="assignedScheduleTemplateId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modèle d'Horaire Attribué</FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value === NO_SCHEDULE_SELECTED_VALUE ? undefined : value);
                        }} 
                        value={field.value === undefined || field.value === "" ? NO_SCHEDULE_SELECTED_VALUE : field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Aucun modèle sélectionné" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NO_SCHEDULE_SELECTED_VALUE}>Aucun modèle</SelectItem>
                          {scheduleTemplates.map(template => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name} ({template.weeklyTotal}h)
                            </SelectItem>
                          ))}
                          {scheduleTemplates.length === 0 && <SelectItem value={NO_SCHEDULE_SELECTED_VALUE + "_disabled"} disabled>Aucun modèle disponible</SelectItem>}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                  <TableHead>Modèle d'Horaire Attribué</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const assignedTemplate = scheduleTemplates.find(st => st.id === member.assignedScheduleTemplateId);
                  return (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.name}</TableCell>
                      <TableCell>{member.role}</TableCell>
                      <TableCell className="text-xs">
                        {assignedTemplate ? `${assignedTemplate.name} (${assignedTemplate.weeklyTotal}h)` : <span className="italic text-muted-foreground">Aucun</span>}
                      </TableCell>
                      <TableCell className="text-center space-x-2">
                        <Button variant="outline" size="icon" onClick={() => handleOpenFormDialog(member)}>
                          <Edit2 className="h-4 w-4" />
                          <span className="sr-only">Modifier</span>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                             <Button variant="destructive" size="icon">
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
