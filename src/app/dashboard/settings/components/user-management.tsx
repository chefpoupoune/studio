
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Users, AlertTriangle, PlusCircle, Edit2, Trash2, KeyRound, Eye } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { BrigadeMember } from '@/app/dashboard/time-tracking/types';
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
const BRIGADE_MEMBERS_STORAGE_KEY = 'time_tracking_members';

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

export type RubricId = typeof RUBRICS[number]['id'];

export interface ViewableHourSummaryConfig {
  type: 'none' | 'own' | 'all' | 'specific';
  specificMemberId?: string;
}

export interface AppUser {
  id: string;
  username: string;
  passwordRequired: boolean;
  simulatedStoredPassword?: string;
  permissions: Partial<Record<RubricId, boolean>>;
  viewableHourSummaryConfig?: ViewableHourSummaryConfig;
}

const userFormSchema = z.object({
  username: z.string().min(3, "Le nom d'utilisateur doit contenir au moins 3 caractères.").max(50, "Le nom d'utilisateur ne peut excéder 50 caractères."),
  passwordRequired: z.boolean().default(false),
  newPassword: z.string().optional(),
  confirmNewPassword: z.string().optional(),
  permissions: z.object(
    RUBRICS.reduce((acc, rubric) => {
      acc[rubric.id] = z.boolean().default(false);
      return acc;
    }, {} as Record<RubricId, z.ZodBoolean>)
  ).default({}),
  viewableHourSummary_type: z.enum(['none', 'own', 'all', 'specific']).default('none'),
  viewableHourSummary_specificMemberId: z.string().optional(),
}).refine(data => {
    if (data.passwordRequired && data.newPassword && data.newPassword.length < 3) {
        return false;
    }
    return true;
}, {
    message: "Le nouveau mot de passe doit contenir au moins 3 caractères.",
    path: ['newPassword'],
}).refine(data => data.newPassword === data.confirmNewPassword, {
    message: "Les nouveaux mots de passe ne correspondent pas.",
    path: ['confirmNewPassword'],
}).refine(data => {
    if (data.viewableHourSummary_type === 'specific' && !data.viewableHourSummary_specificMemberId) {
        return false;
    }
    return true;
}, {
    message: "Veuillez sélectionner un employé spécifique.",
    path: ['viewableHourSummary_specificMemberId']
});

type UserFormData = z.infer<typeof userFormSchema>;

const simulatedHash = (password: string): string => `sim_hashed_${password}_!`;

export default function UserManagement() {
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [brigadeMembers, setBrigadeMembers] = useState<BrigadeMember[]>([]);
  const [isUserFormOpen, setIsUserFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const { toast } = useToast();

  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: '',
      passwordRequired: false,
      newPassword: '',
      confirmNewPassword: '',
      permissions: RUBRICS.reduce((acc, rubric) => ({ ...acc, [rubric.id]: false }), {}),
      viewableHourSummary_type: 'none',
      viewableHourSummary_specificMemberId: undefined,
    },
  });

  useEffect(() => {
    try {
      const storedUsers = localStorage.getItem(APP_USERS_STORAGE_KEY);
      if (storedUsers) setAppUsers(JSON.parse(storedUsers));
      
      const storedBrigadeMembers = localStorage.getItem(BRIGADE_MEMBERS_STORAGE_KEY);
      if (storedBrigadeMembers) setBrigadeMembers(JSON.parse(storedBrigadeMembers));
    } catch (error) {
      console.error("Error loading data:", error);
      toast({ title: "Erreur de chargement des données de configuration utilisateurs", variant: "destructive" });
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
        newPassword: '',
        confirmNewPassword: '',
        permissions: RUBRICS.reduce((acc, rubric) => ({ ...acc, [rubric.id]: !!user.permissions[rubric.id] }), {}),
        viewableHourSummary_type: user.viewableHourSummaryConfig?.type || 'none',
        viewableHourSummary_specificMemberId: user.viewableHourSummaryConfig?.specificMemberId || undefined,
      });
    } else {
      form.reset({ /* defaultValues already set */ });
    }
    setIsUserFormOpen(true);
  };

  const handleUserFormSubmit = (data: UserFormData) => {
    let passwordToStore: string | undefined = undefined;
    if (data.passwordRequired && data.newPassword) {
        passwordToStore = simulatedHash(data.newPassword);
    }

    const summaryConfig: ViewableHourSummaryConfig = {
        type: data.viewableHourSummary_type,
        specificMemberId: data.viewableHourSummary_type === 'specific' ? data.viewableHourSummary_specificMemberId : undefined,
    };

    if (editingUser) {
      setAppUsers(prev => prev.map(u => u.id === editingUser.id ? { 
          ...editingUser, 
          username: data.username,
          passwordRequired: data.passwordRequired,
          simulatedStoredPassword: data.passwordRequired ? (passwordToStore || editingUser.simulatedStoredPassword) : undefined,
          permissions: data.permissions,
          viewableHourSummaryConfig: summaryConfig,
        } : u));
      toast({ title: "Utilisateur Modifié", description: `L'utilisateur "${data.username}" a été mis à jour.` });
    } else {
      const newUser: AppUser = { 
        id: `user_${Date.now()}`, 
        username: data.username,
        passwordRequired: data.passwordRequired,
        simulatedStoredPassword: passwordToStore,
        permissions: data.permissions,
        viewableHourSummaryConfig: summaryConfig,
      };
      setAppUsers(prev => [...prev, newUser]);
      toast({ title: "Utilisateur Créé", description: `L'utilisateur "${data.username}" a été créé.` });
    }
    setIsUserFormOpen(false);
  };

  const handleDeleteUser = (userId: string) => {
    const userToDelete = appUsers.find(u => u.id === userId);
    if (userToDelete?.username.toLowerCase() === 'chef') {
      toast({ title: "Suppression Interdite", description: "L'utilisateur 'chef' ne peut pas être supprimé.", variant: "destructive" });
      return;
    }
    setAppUsers(prev => prev.filter(u => u.id !== userId));
    toast({ title: "Utilisateur Supprimé", description: "L'utilisateur a été supprimé.", variant: "destructive" });
  };

  const currentSelectedSummaryType = form.watch('viewableHourSummary_type');
  const isChefEditing = editingUser?.username.toLowerCase() === 'chef';


  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-6 h-6 text-primary"/>
          Gestion des Utilisateurs
        </CardTitle>
        <CardDescription>
          Définissez des utilisateurs, leurs mots de passe (simulés) et leurs permissions d'accès.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <AlertTitle className="text-destructive font-semibold">Avertissement de Sécurité</AlertTitle>
          <AlertDescription className="text-destructive/90">
            Ce système est pour la démonstration. Les mots de passe ne sont pas stockés de manière sécurisée.
            L'utilisateur 'chef' (mdp: '000') est le compte administrateur par défaut.
          </AlertDescription>
        </Alert>

        <Button onClick={() => handleOpenUserForm()}>
          <PlusCircle className="mr-2 h-4 w-4" /> Créer un Nouvel Utilisateur
        </Button>

        <Dialog open={isUserFormOpen} onOpenChange={setIsUserFormOpen}>
          <DialogContent className="sm:max-w-lg md:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingUser ? "Modifier" : "Créer"} Utilisateur</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleUserFormSubmit)} className="space-y-4 py-4">
                <ScrollArea className="h-[70vh] pr-4">
                  <div className="space-y-4">
                    <FormField control={form.control} name="username" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom d'utilisateur</FormLabel>
                        <FormControl><Input placeholder="Ex: jdupont" {...field} disabled={isChefEditing} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="passwordRequired" render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Mot de passe requis ?</FormLabel>
                          <FormDescription className="text-xs">
                            Si coché, un mot de passe sera nécessaire.
                          </FormDescription>
                        </div>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={isChefEditing} /></FormControl>
                      </FormItem>
                    )} />
                    
                    {form.watch('passwordRequired') && !isChefEditing && (
                      <div className="p-3 border rounded-md space-y-3 bg-muted/30">
                         <FormField control={form.control} name="newPassword" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1"><KeyRound className="w-4 h-4" />Nouveau mot de passe {editingUser ? '(Laisser vide pour ne pas changer)' : ''}</FormLabel>
                            <FormControl><Input type="password" placeholder="Saisir un mot de passe..." {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="confirmNewPassword" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirmer nouveau mot de passe</FormLabel>
                            <FormControl><Input type="password" placeholder="Confirmer le mot de passe..." {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                    )}
                    
                    <div>
                      <h3 className="text-md font-semibold mb-2 mt-3">Permissions d'accès aux rubriques :</h3>
                      <div className="space-y-2">
                        {RUBRICS.map(rubric => (
                          <FormField
                            key={rubric.id}
                            control={form.control}
                            name={`permissions.${rubric.id}`}
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 hover:bg-muted/20">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    disabled={isChefEditing || (rubric.id === 'settings' && form.getValues('username').toLowerCase() !== 'chef')}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal text-sm cursor-pointer flex-grow">{rubric.label}</FormLabel>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                    </div>

                    {!isChefEditing && (
                        <div className="pt-4 border-t">
                          <h3 className="text-md font-semibold mb-2 mt-2 flex items-center gap-1"><Eye className="w-4 h-4"/> Vue des Relevés d'Heures</h3>
                          <FormField control={form.control} name="viewableHourSummary_type" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Type de vue</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Choisir type de vue..." /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="none">Aucun relevé</SelectItem>
                                    <SelectItem value="own">Son propre relevé uniquement</SelectItem>
                                    <SelectItem value="all">Tous les relevés</SelectItem>
                                    <SelectItem value="specific">Relevé d'un employé spécifique</SelectItem>
                                </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                          />
                          {currentSelectedSummaryType === 'specific' && (
                            <FormField control={form.control} name="viewableHourSummary_specificMemberId" render={({ field }) => (
                                <FormItem className="mt-2">
                                <FormLabel>Employé spécifique</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Choisir un employé..." /></SelectTrigger></FormControl>
                                    <SelectContent>
                                    {brigadeMembers.length > 0 ? brigadeMembers.map(member => (
                                        <SelectItem key={member.id} value={member.id}>{member.name} ({member.role})</SelectItem>
                                    )) : <SelectItem value="disabled" disabled>Aucun membre de brigade</SelectItem>}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                          )}
                        </div>
                    )}


                  </div>
                </ScrollArea>
                <DialogFooter className="pt-4">
                  <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
                  <Button type="submit" disabled={isChefEditing && form.getValues('username').toLowerCase() !== 'chef'}>{editingUser ? "Enregistrer Modifications" : "Créer Utilisateur"}</Button>
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
                           <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" disabled={user.username.toLowerCase() === 'chef'}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer "{user.username}"?</AlertDialogTitle>
                            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
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
                    {user.passwordRequired && user.simulatedStoredPassword && <span className="ml-2 text-green-600">(Mot de passe défini)</span>}
                    {user.passwordRequired && !user.simulatedStoredPassword && <span className="ml-2 text-destructive">(Aucun mot de passe défini !)</span>}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="grid grid-cols-2 gap-x-4">
                    <div>
                        <p className="text-xs font-medium mb-1">Permissions rubriques :</p>
                        <ul className="list-disc list-inside pl-2 text-xs space-y-0.5">
                            {RUBRICS.filter(rubric => user.permissions[rubric.id]).map(rubric => (
                            <li key={rubric.id}>{rubric.label}</li>
                            ))}
                            {RUBRICS.filter(rubric => user.permissions[rubric.id]).length === 0 && (
                                <li className="italic text-muted-foreground">Aucune permission rubrique.</li>
                            )}
                        </ul>
                    </div>
                    <div>
                        <p className="text-xs font-medium mb-1">Vue Relevés d'Heures :</p>
                        <p className="text-xs">
                            {user.username.toLowerCase() === 'chef' ? "Tous les relevés (Admin)" :
                             user.viewableHourSummaryConfig?.type === 'none' ? "Aucun relevé" :
                             user.viewableHourSummaryConfig?.type === 'own' ? "Son propre relevé uniquement" :
                             user.viewableHourSummaryConfig?.type === 'all' ? "Tous les relevés" :
                             user.viewableHourSummaryConfig?.type === 'specific' ? 
                                `Relevé de: ${brigadeMembers.find(bm => bm.id === user.viewableHourSummaryConfig?.specificMemberId)?.name || 'N/D'}` :
                                "Non configuré"
                            }
                        </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-6">Aucun utilisateur défini (autre que 'chef' implicite).</p>
        )}
      </CardContent>
    </Card>
  );
}

    