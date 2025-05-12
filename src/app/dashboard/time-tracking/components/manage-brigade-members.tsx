
"use client";

import React, { useState } from 'react';
import type { BrigadeMember } from '../types';
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

const memberSchema = z.object({
  name: z.string().min(1, "Le nom est requis."),
  role: z.string().min(1, "Le rôle est requis."),
});

type MemberFormData = z.infer<typeof memberSchema>;

interface ManageBrigadeMembersProps {
  members: BrigadeMember[];
  onAddMember: (member: Omit<BrigadeMember, 'id'>) => void;
  onUpdateMember: (member: BrigadeMember) => void;
  onDeleteMember: (memberId: string) => void;
}

export default function ManageBrigadeMembers({ members, onAddMember, onUpdateMember, onDeleteMember }: ManageBrigadeMembersProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<BrigadeMember | null>(null);

  const form = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      name: '',
      role: '',
    },
  });

  React.useEffect(() => {
    if (editingMember) {
      form.reset({
        name: editingMember.name,
        role: editingMember.role,
      });
    } else {
      form.reset({ name: '', role: '' });
    }
  }, [editingMember, form, isDialogOpen]);

  const onSubmit = (data: MemberFormData) => {
    if (editingMember) {
      onUpdateMember({ ...editingMember, ...data });
    } else {
      onAddMember(data);
    }
    setIsDialogOpen(false);
    setEditingMember(null);
    form.reset();
  };

  const handleOpenDialog = (member?: BrigadeMember) => {
    setEditingMember(member || null);
    setIsDialogOpen(true);
  };
  
  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingMember(null);
    form.reset();
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Gestion du Personnel de Brigade
          </CardTitle>
          <CardDescription>Ajoutez, modifiez ou supprimez des membres de votre brigade.</CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="w-full sm:w-auto">
              <PlusCircle className="mr-2 h-4 w-4" /> Ajouter Membre
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
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
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">{member.name}</TableCell>
                    <TableCell>{member.role}</TableCell>
                    <TableCell className="text-center space-x-2">
                      <Button variant="outline" size="icon" onClick={() => handleOpenDialog(member)}>
                        <Edit2 className="h-4 w-4" />
                        <span className="sr-only">Modifier</span>
                      </Button>
                      <Button variant="destructive" size="icon" onClick={() => onDeleteMember(member.id)}>
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Supprimer</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
