
"use client";

import React, { useState } from 'react';
import type { BenefitEmployee } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlusCircle, Edit2, Trash2, Users } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
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

const employeeSchema = z.object({
  name: z.string().min(1, "Le nom de l'employé est requis.").max(100, "Le nom ne peut excéder 100 caractères."),
});
type EmployeeFormData = z.infer<typeof employeeSchema>;

interface ManageBenefitEmployeesProps {
  employees: BenefitEmployee[];
  onAddEmployee: (name: string) => void;
  onUpdateEmployee: (employee: BenefitEmployee) => void;
  onDeleteEmployee: (employeeId: string) => void;
}

export default function ManageBenefitEmployees({ employees, onAddEmployee, onUpdateEmployee, onDeleteEmployee }: ManageBenefitEmployeesProps) {
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<BenefitEmployee | null>(null);

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: { name: '' },
  });

  const handleOpenFormDialog = (employee?: BenefitEmployee) => {
    setEditingEmployee(employee || null);
    if (employee) {
      form.reset({ name: employee.name });
    } else {
      form.reset({ name: '' });
    }
    setIsFormDialogOpen(true);
  };

  const handleFormSubmit = (data: EmployeeFormData) => {
    if (editingEmployee) {
      onUpdateEmployee({ ...editingEmployee, name: data.name });
    } else {
      onAddEmployee(data.name);
    }
    setIsFormDialogOpen(false);
  };

  return (
    <Card className="shadow-lg">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
            <CardTitle className="flex items-center gap-2">
                <Users className="w-6 h-6 text-primary"/>
                Gestion des Employés (Avantages)
            </CardTitle>
            <CardDescription>Ajoutez, modifiez ou supprimez les employés pour le suivi des avantages.</CardDescription>
        </div>
        <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenFormDialog()} className="w-full sm:w-auto">
              <PlusCircle className="mr-2 h-4 w-4" /> Ajouter Employé
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingEmployee ? "Modifier l'Employé" : "Nouvel Employé"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom de l'Employé</FormLabel>
                    <FormControl><Input placeholder="Ex: Jean Dupont" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <DialogFooter>
                  <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
                  <Button type="submit">{editingEmployee ? "Enregistrer" : "Ajouter"}</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {employees.length === 0 ? (
          <p className="text-muted-foreground text-center py-6">Aucun employé. Cliquez sur "Ajouter Employé" pour commencer.</p>
        ) : (
          <div className="overflow-x-auto border rounded-md max-h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom de l'Employé</TableHead>
                  <TableHead className="text-center w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map(emp => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.name}</TableCell>
                    <TableCell className="text-center space-x-1">
                      <Button variant="outline" size="icon" onClick={() => handleOpenFormDialog(emp)} className="h-8 w-8">
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="icon" className="h-8 w-8">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer cet employé ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Cette action est irréversible. L'employé "{emp.name}" sera supprimé.
                              Ses données d'avantages pourraient être conservées mais l'employé sera retiré de la liste de saisie.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onDeleteEmployee(emp.id)}>
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
