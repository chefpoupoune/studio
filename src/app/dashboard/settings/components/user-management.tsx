
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Users, AlertTriangle, PlusCircle, Edit2, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
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

const APP_USERS_STORAGE_KEY = 'app_defined_users_v1';

const RUBRICS = [
  { id: 'dashboard', label: 'Tableau de Bord Principal' },
  { id: 'inventory', label: 'Gestion Stocks' },
  { id: 'benefits', label: 'Avantages Nature' },
  { id: 'timeTracking', label: 'Suivi Heures' },
  { id: 'taskManagement', label: 'Gestion Tâches' },
  { id: 'costManagement', label: 'Gestion Coûts' },
  { id: 'menuPlanning', label: 'Planification Menus' },
  { id: 'pms', label: 'PMS' },
  { id: 'settings', label: 'Paramètres' },
] as const;

type RubricId = typeof RUBRICS[number]['id'];

interface AppUser {
  id: string;
  username: string;
  passwordRequired: boolean;
  permissions: Partial<Record<RubricId, boolean>>; // true if has access
}

const userFormSchema = z.object({
  username: z.string().min(3, "Le nom d'utilisateur doit contenir au moins 3 caractères."),
  passwordRequired: z.boolean().default(false),
  password: z.string().optional(), // Not stored, just for UI simulation
  permissions: z.object(
    RUBRICS.reduce((acc, rubric) => {
      acc[rubric.id] = z.boolean().default(false);
      return acc;
    }, {} as Record<RubricId, z.ZodBoolean>)
  ).default({}),
}).refine(data => {
    if (data.passwordRequired && (!data.password || data.password.length < 3)) {
        // This validation won't actually prevent submission if password field is not actively part of the form schema for storage
        // But it's good for concept
        return false;
    }
    return true;
}, {
    message: "Un mot de passe d'au moins 3 caractères est requis si 'Mot de passe requis' est coché.",
    path: ['password'],
});

type UserFormData = z.infer<typeof userFormSchema>;

export default function UserManagement() {
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [isUserFormOpen, setIsUserFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const { toast } = useToast();

  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: '',
      passwordRequired: false,
      password: '',
      permissions: RUBRICS.reduce((acc, rubric) => ({ ...acc, [rubric.id]: false }), {}),
    },
  });

  useEffect(() => {
    try {
      const storedUsers = localStorage.getItem(APP_USERS_STORAGE_KEY);
      if (storedUsers) {
        setAppUsers(JSON.parse(storedUsers));
      }
    } catch (error) {
      console.error("Error loading users:", error);
      toast({ title: "Erreur de chargement des utilisateurs", variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    localStorage.setItem(APP_USERS_STORAGE_KEY, JSON.stringify(appUsers));
  }, [appUsers]);

  const handleOpenUserForm = (user?: AppUser) => {
    setEditingUser(user || null);
    if (user) {
      form.reset({
        username: user.username,
        passwordRequired: user.passwordRequired,
        password: '', // Password is not re-loaded for editing
        permissions: RUBRICS.reduce((acc, rubric) => ({ ...acc, [rubric.id]: !!user.permissions[rubric.id] }), {}),
      });
    } else {
      form.reset({
        username: '',
        passwordRequired: false,
        password: '',
        permissions: RUBRICS.reduce((acc, rubric) => ({ ...acc, [rubric.id]: false }), {}),
      });
    }
    setIsUserFormOpen(true);
  };

  const handleUserFormSubmit = (data: UserFormData) => {
    if (editingUser) {
      setAppUsers(prev => prev.map(u => u.id === editingUser.id ? { ...editingUser, ...data } : u));
      toast({ title: "Utilisateur Modifié", description: `L'utilisateur "${data.username}" a été mis à jour.` });
    } else {
      const newUser: AppUser = { ...data, id: `user_${Date.now()}` };
      setAppUsers(prev => [...prev, newUser]);
      toast({ title: "Utilisateur Créé", description: `L'utilisateur "${data.username}" a été créé.` });
    }
    setIsUserFormOpen(false);
  };

  const handleDeleteUser = (userId: string) => {
    const userToDelete = appUsers.find(u => u.id === userId);
    if (userToDelete?.username === 'chef') {
      toast({ title: "Suppression Interdite", description: "L'utilisateur 'chef' ne peut pas être supprimé.", variant: "destructive" });
      return;
    }
    setAppUsers(prev => prev.filter(u => u.id !== userId));
    toast({ title: "Utilisateur Supprimé", description: "L'utilisateur a été supprimé.", variant: "destructive" });
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-6 h-6 text-primary"/>
          Gestion des Utilisateurs (Simulation)
        </CardTitle>
        <CardDescription>
          Définissez des utilisateurs et leurs permissions d'accès aux rubriques.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <AlertTitle className="text-amber-700 dark:text-amber-500 font-semibold">Fonctionnalité en Développement</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-600">
            Cette interface permet de définir des utilisateurs et leurs permissions à des fins de conception.
            Le système de connexion actuel ne gère que l'utilisateur 'chef' (mdp: '000').
            Les mots de passe saisis ici ne sont pas stockés de manière sécurisée et les permissions ne sont pas encore appliquées.
          </AlertDescription>
        </Alert>

        <Button onClick={() => handleOpenUserForm()}>
          <PlusCircle className="mr-2 h-4 w-4" /> Créer un Nouvel Utilisateur (Simulation)
        </Button>

        <Dialog open={isUserFormOpen} onOpenChange={setIsUserFormOpen}>
          <DialogContent className="sm:max-w-lg md:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingUser ? "Modifier" : "Créer"} Utilisateur (Simulation)</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleUserFormSubmit)} className="space-y-4 py-4">
                <ScrollArea className="h-[60vh] pr-4">
                  <div className="space-y-4">
                    <FormField control={form.control} name="username" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom d'utilisateur</FormLabel>
                        <FormControl><Input placeholder="Ex: jdupont" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="passwordRequired" render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Mot de passe requis ?</FormLabel>
                          <FormDescription className="text-xs">
                            Si coché, un mot de passe sera conceptuellement nécessaire.
                          </FormDescription>
                        </div>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      </FormItem>
                    )} />
                    {form.watch('passwordRequired') && (
                      <FormField control={form.control} name="password" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mot de passe (Simulation)</FormLabel>
                          <FormControl><Input type="password" placeholder="Saisir un mot de passe..." {...field} /></FormControl>
                          <FormDescription className="text-xs">Ne sera pas utilisé pour la connexion réelle à ce stade.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />
                    )}
                    
                    <div>
                      <h3 className="text-md font-semibold mb-2">Permissions d'accès aux rubriques :</h3>
                      <div className="space-y-2">
                        {RUBRICS.map(rubric => (
                          <FormField
                            key={rubric.id}
                            control={form.control}
                            name={`permissions.${rubric.id}`}
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    disabled={rubric.id === 'settings' && form.getValues('username') !== 'chef'}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal text-sm">{rubric.label}</FormLabel>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
                <DialogFooter className="pt-4">
                  <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
                  <Button type="submit">{editingUser ? "Enregistrer Modifications" : "Créer Utilisateur"}</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {appUsers.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-md font-semibold">Utilisateurs Définis :</h3>
            {appUsers.map(user => (
              <Card key={user.id} className="bg-card/70">
                <CardHeader className="pb-2 pt-3 px-4">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{user.username}</CardTitle>
                    <div className="space-x-1">
                       <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenUserForm(user)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                       <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" disabled={user.username === 'chef'}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer "{user.username}"?</AlertDialogTitle>
                            <AlertDialogDescription>Cette action est conceptuelle et ne supprimera pas un vrai compte.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteUser(user.id)}>Supprimer</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  <CardDescription className="text-xs">
                    Mot de passe requis : {user.passwordRequired ? "Oui" : "Non"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <p className="text-xs font-medium mb-1">Permissions accordées :</p>
                  <ul className="list-disc list-inside pl-2 text-xs space-y-0.5">
                    {RUBRICS.filter(rubric => user.permissions[rubric.id]).map(rubric => (
                      <li key={rubric.id}>{rubric.label}</li>
                    ))}
                    {RUBRICS.filter(rubric => user.permissions[rubric.id]).length === 0 && (
                        <li className="italic text-muted-foreground">Aucune permission spécifique.</li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-6">Aucun utilisateur (autre que 'chef') défini.</p>
        )}
      </CardContent>
    </Card>
  );
}
