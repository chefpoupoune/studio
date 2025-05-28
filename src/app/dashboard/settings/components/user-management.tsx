
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Users, AlertTriangle, PlusCircle, Edit2, Trash2, KeyRound, Eye, CalendarClock, FileClock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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

const APP_USERS_STORAGE_KEY = 'app_defined_users_v2';
const BRIGADE_MEMBERS_STORAGE_KEY = 'time_tracking_members_v2';

export const RUBRICS = [
  { id: 'dashboard', label: 'Tableau de Bord Principal' },
  { id: 'inventory', label: 'Gestion Stocks' },
  { id: 'benefits', label: 'Avantages Nature' },
  { id: 'declarationHeure', label: "Déclaration d'Heures" },
  { id: 'taskManagement', label: 'Gestion Tâches' },
  { id: 'costManagement', label: 'Gestion Coûts' },
  { id: 'menuPlanning', label: 'Planification Menus' },
  { id: 'picnic', label: 'Pique Nique' },
  { id: 'pms', label: 'PMS' },
  { id: 'settings', label: 'Paramètres' },
] as const;

export const TIME_TRACKING_SUB_RUBRICS = [
  { id: 'timeTracking_personnel', label: 'Gestion Personnel (Brigade)' },
  { id: 'timeTracking_recording', label: 'Saisie & Historique des Heures' },
  { id: 'timeTracking_summary', label: 'Relevés & PDF Individuels' },
  { id: 'timeTracking_schedules', label: 'Modèles d\'Horaires Hebdomadaires' },
] as const;

export type RubricId = typeof RUBRICS[number]['id'] | typeof TIME_TRACKING_SUB_RUBRICS[number]['id'];

export interface ViewableHourSummaryConfig {
  type: 'none' | 'own' | 'all' | 'specific';
  specificMemberId?: string;
}

export interface AppUser {
  id: string;
  username: string;
  brigadeMemberId?: string;
  passwordRequired: boolean;
  simulatedStoredPassword?: string;
  permissions: Partial<Record<RubricId, boolean>>;
  viewableHourSummaryConfig?: ViewableHourSummaryConfig;
}

export const ALL_RUBRIC_IDS: RubricId[] = [
  ...RUBRICS.map(r => r.id),
  ...TIME_TRACKING_SUB_RUBRICS.map(sr => sr.id),
];

const basePermissionsSchema = RUBRICS.reduce((acc, rubric) => {
  acc[rubric.id] = z.boolean().default(false);
  return acc;
}, {} as Record<typeof RUBRICS[number]['id'], z.ZodBoolean>);

const timeTrackingPermissionsSchema = TIME_TRACKING_SUB_RUBRICS.reduce((acc, subRubric) => {
  acc[subRubric.id] = z.boolean().default(false);
  return acc;
}, {} as Record<typeof TIME_TRACKING_SUB_RUBRICS[number]['id'], z.ZodBoolean>);

const userFormSchema = z.object({
  selectedBrigadeMemberId: z.string().min(1, "Veuillez sélectionner un membre de la brigade.").optional(),
  passwordRequired: z.boolean().default(false),
  newPassword: z.string().optional(),
  confirmNewPassword: z.string().optional(),
  permissions: z.object({
    ...basePermissionsSchema,
    ...timeTrackingPermissionsSchema,
  }).default(ALL_RUBRIC_IDS.reduce((acc, id) => ({ ...acc, [id]: false }), {})),
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
    message: "Veuillez sélectionner un employé spécifique pour la vue des heures.",
    path: ['viewableHourSummary_specificMemberId']
});

type UserFormData = z.infer<typeof userFormSchema>;

const simulatedHash = (password: string): string => `sim_hashed_${password}_!`;
const DEFAULT_CHEF_ID = 'default_chef_user_id';

export default function UserManagement() {
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [brigadeMembers, setBrigadeMembers] = useState<BrigadeMember[]>([]);
  const [availableBrigadeMembers, setAvailableBrigadeMembers] = useState<BrigadeMember[]>([]);
  const [isUserFormOpen, setIsUserFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const { toast } = useToast();

  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      selectedBrigadeMemberId: undefined,
      passwordRequired: false,
      newPassword: '',
      confirmNewPassword: '',
      permissions: ALL_RUBRIC_IDS.reduce((acc, rubricId) => ({ ...acc, [rubricId]: false }), {}),
      viewableHourSummary_type: 'none',
      viewableHourSummary_specificMemberId: undefined,
    },
  });

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    console.log("UserManagement [EFFECT LOAD]: Attempting to load initial data from localStorage.");
    let loadedUsers: AppUser[] = [];
    let loadedMembers: BrigadeMember[] = [];
    
    try {
      const storedUsersRaw = localStorage.getItem(APP_USERS_STORAGE_KEY);
      if (storedUsersRaw) {
        const parsedUsers = JSON.parse(storedUsersRaw);
        if (Array.isArray(parsedUsers)) {
          loadedUsers = parsedUsers.map((u: any) => ({ // Basic mapping
            id: u.id || `imported_user_${Math.random().toString(36).substring(7)}`,
            username: u.username || "Utilisateur Inconnu",
            brigadeMemberId: u.brigadeMemberId,
            passwordRequired: typeof u.passwordRequired === 'boolean' ? u.passwordRequired : false,
            simulatedStoredPassword: u.simulatedStoredPassword,
            permissions: u.permissions || {},
            viewableHourSummaryConfig: u.viewableHourSummaryConfig || { type: 'none' },
          }));
        }
        console.log(`UserManagement [EFFECT LOAD]: Loaded ${loadedUsers.length} users from localStorage.`);
      } else {
        console.log("UserManagement [EFFECT LOAD]: No users found in localStorage, will create default Chef if needed.");
      }

      // Ensure Chef user exists and has correct defaults
      const chefUserIndex = loadedUsers.findIndex(u => u.username.toLowerCase() === 'chef');
      const defaultChefPermissions = ALL_RUBRIC_IDS.reduce((acc, rubricId) => {
        acc[rubricId] = true;
        return acc;
      }, {} as Partial<Record<RubricId, boolean>>);

      if (chefUserIndex !== -1) {
        console.log("UserManagement [EFFECT LOAD]: Chef user found, standardizing.");
        loadedUsers[chefUserIndex] = {
          ...loadedUsers[chefUserIndex],
          id: loadedUsers[chefUserIndex].id || DEFAULT_CHEF_ID,
          username: 'Chef', // Normalize case
          passwordRequired: true,
          simulatedStoredPassword: loadedUsers[chefUserIndex].simulatedStoredPassword || simulatedHash('000'),
          permissions: defaultChefPermissions,
          viewableHourSummaryConfig: { type: 'all' as const },
        };
      } else {
        console.log("UserManagement [EFFECT LOAD]: Chef user NOT found, creating default Chef.");
        loadedUsers.unshift({
          id: DEFAULT_CHEF_ID,
          username: 'Chef',
          passwordRequired: true,
          simulatedStoredPassword: simulatedHash('000'),
          permissions: defaultChefPermissions,
          viewableHourSummaryConfig: { type: 'all' as const },
        });
      }
      setAppUsers(loadedUsers.sort((a,b) => a.username.localeCompare(b.username)));
      console.log(`UserManagement [EFFECT LOAD]: Final appUsers state set. Count: ${loadedUsers.length}`);


      const storedBrigadeMembersRaw = localStorage.getItem(BRIGADE_MEMBERS_STORAGE_KEY);
      if (storedBrigadeMembersRaw) {
        loadedMembers = JSON.parse(storedBrigadeMembersRaw);
      }
      setBrigadeMembers(loadedMembers);
      console.log(`UserManagement [EFFECT LOAD]: Loaded ${loadedMembers.length} brigade members.`);

    } catch (error) {
      console.error("UserManagement [EFFECT LOAD]: Error loading data:", error);
      toast({ title: "Erreur de chargement des données utilisateurs/brigade", variant: "destructive" });
      // Fallback: Ensure at least Chef user exists if everything fails
      const defaultChefPermissions = ALL_RUBRIC_IDS.reduce((acc, rubricId) => ({ ...acc, [rubricId]: true }), {});
      setAppUsers([{
        id: DEFAULT_CHEF_ID, username: 'Chef', passwordRequired: true,
        simulatedStoredPassword: simulatedHash('000'), permissions: defaultChefPermissions,
        viewableHourSummaryConfig: { type: 'all' }
      }]);
      setBrigadeMembers([]);
    } finally {
      setDataLoaded(true);
      console.log("UserManagement [EFFECT LOAD]: Initial data load process finished. dataLoaded set to true.");
    }
  }, [isClient, toast]);


  useEffect(() => {
    if (isClient && dataLoaded && appUsers.length > 0) { // Only save if there's something to save
      console.log(`UserManagement [EFFECT SAVE Users]: Attempting to save ${appUsers.length} appUsers to localStorage.`);
      try {
        localStorage.setItem(APP_USERS_STORAGE_KEY, JSON.stringify(appUsers));
        console.log("UserManagement [EFFECT SAVE Users]: appUsers successfully saved to localStorage.");
      } catch (error) {
        console.error("UserManagement [EFFECT SAVE Users]: Error saving appUsers to localStorage:", error);
        toast({ title: "Erreur de sauvegarde des utilisateurs", variant: "destructive" });
      }
    } else if (isClient && dataLoaded && appUsers.length === 0) {
      console.log("UserManagement [EFFECT SAVE Users]: appUsers is empty, removing from localStorage.");
      localStorage.removeItem(APP_USERS_STORAGE_KEY); // Clean up if all users are deleted
    }
  }, [appUsers, isClient, dataLoaded, toast]);

  useEffect(() => {
    if (isClient && dataLoaded) {
      const linkedMemberIds = appUsers.map(user => user.brigadeMemberId).filter(id => !!id);
      const updatedAvailableMembers = brigadeMembers.filter(member => !linkedMemberIds.includes(member.id));
      setAvailableBrigadeMembers(updatedAvailableMembers);
    }
  }, [appUsers, brigadeMembers, isClient, dataLoaded]);


  const handleOpenUserForm = (user?: AppUser) => {
    setEditingUser(user || null);
    const isCurrentUserChef = user?.username.toLowerCase() === 'chef';
    
    let defaultPermissions = ALL_RUBRIC_IDS.reduce((acc, rubricId) => ({ ...acc, [rubricId]: false }), {});
    if (user) {
      defaultPermissions = ALL_RUBRIC_IDS.reduce((acc, rubricId) => {
        acc[rubricId] = isCurrentUserChef ? true : !!user.permissions[rubricId];
        return acc;
      }, {} as Partial<Record<RubricId, boolean>>);
    }

    form.reset({
      selectedBrigadeMemberId: user?.brigadeMemberId,
      passwordRequired: isCurrentUserChef ? true : (user?.passwordRequired || false),
      newPassword: '',
      confirmNewPassword: '',
      permissions: defaultPermissions,
      viewableHourSummary_type: isCurrentUserChef ? 'all' : (user?.viewableHourSummaryConfig?.type || 'none'),
      viewableHourSummary_specificMemberId: isCurrentUserChef ? undefined : (user?.viewableHourSummaryConfig?.specificMemberId || undefined),
    });
    setIsUserFormOpen(true);
  };

  const handleUserFormSubmit = (data: UserFormData) => {
    let passwordToStore: string | undefined = undefined;
    if (data.passwordRequired && data.newPassword) {
        passwordToStore = simulatedHash(data.newPassword);
    }

    let summaryConfig: ViewableHourSummaryConfig = {
        type: data.viewableHourSummary_type,
        specificMemberId: data.viewableHourSummary_type === 'specific' ? data.viewableHourSummary_specificMemberId : undefined,
    };
    
    let permissionsToSave = data.permissions;
    const isCurrentEditingUserChef = editingUser?.username.toLowerCase() === 'chef';

    if (isCurrentEditingUserChef) {
        permissionsToSave = ALL_RUBRIC_IDS.reduce((acc, rubricId) => {
            acc[rubricId] = true;
            return acc;
        }, {} as Partial<Record<RubricId, boolean>>);
        summaryConfig = { type: 'all' };
    }
    
    const baseUserData: Omit<AppUser, 'id' | 'username' | 'brigadeMemberId'> = {
      passwordRequired: isCurrentEditingUserChef ? true : data.passwordRequired,
      permissions: permissionsToSave,
      viewableHourSummaryConfig: summaryConfig,
    };

    if (editingUser) {
      const updatedSimulatedPassword = 
        (baseUserData.passwordRequired && passwordToStore) 
          ? passwordToStore 
          : baseUserData.passwordRequired 
            ? editingUser.simulatedStoredPassword // Keep old if not changing and still required
            : undefined; // No password if not required

      setAppUsers(prev => prev.map(u => u.id === editingUser.id ? { 
          ...editingUser, 
          ...baseUserData,
          simulatedStoredPassword: updatedSimulatedPassword,
          username: editingUser.username, 
          brigadeMemberId: editingUser.brigadeMemberId,
        } : u).sort((a,b) => a.username.localeCompare(b.username)));
      toast({ title: "Utilisateur Modifié", description: `L'utilisateur "${editingUser.username}" a été mis à jour.` });
    } else {
      if (!data.selectedBrigadeMemberId) {
        toast({ title: "Erreur", description: "Veuillez sélectionner un membre de la brigade pour le nouvel utilisateur.", variant: "destructive" });
        form.setError("selectedBrigadeMemberId", {message: "Sélection requise."});
        return;
      }
      const selectedMember = brigadeMembers.find(bm => bm.id === data.selectedBrigadeMemberId);
      if (!selectedMember) {
        toast({ title: "Erreur", description: "Membre de la brigade non trouvé.", variant: "destructive" });
        return;
      }
      if (appUsers.some(u => u.username.toLowerCase() === selectedMember.name.toLowerCase())) {
        toast({ title: "Erreur", description: `Un utilisateur nommé "${selectedMember.name}" existe déjà.`, variant: "destructive" });
        return;
      }

      const newUser: AppUser = { 
        id: `user_${Date.now()}_${Math.random().toString(36).substring(2,7)}`, 
        username: selectedMember.name,
        brigadeMemberId: selectedMember.id,
        ...baseUserData,
        simulatedStoredPassword: passwordToStore,
      };
      setAppUsers(prev => [...prev, newUser].sort((a,b) => a.username.localeCompare(b.username)));
      toast({ title: "Utilisateur Créé", description: `L'utilisateur "${newUser.username}" a été créé.` });
    }
    setIsUserFormOpen(false);
  };

  const handleDeleteUser = (userId: string) => {
    const userToDelete = appUsers.find(u => u.id === userId);
    if (userToDelete?.username.toLowerCase() === 'chef') {
      toast({ title: "Suppression Interdite", description: "L'utilisateur 'Chef' ne peut pas être supprimé.", variant: "destructive" });
      return;
    }
    setAppUsers(prev => prev.filter(u => u.id !== userId));
    toast({ title: "Utilisateur Supprimé", description: `L'utilisateur "${userToDelete?.username || 'ID: '+userId}" a été supprimé.`, variant: "destructive" });
  };

  const currentSelectedSummaryType = form.watch('viewableHourSummary_type');
  
  const hasAnyTimeTrackingPermission = (permissions: Partial<Record<RubricId, boolean>> | undefined) => {
    if (!permissions) return false;
    return TIME_TRACKING_SUB_RUBRICS.some(sr => !!permissions[sr.id]);
  };
  
  const formTimeTrackingPermissions = form.watch('permissions');
  const currentFormHasTimeTrackingPermission = hasAnyTimeTrackingPermission(formTimeTrackingPermissions);
  const isEditingChef = editingUser?.username.toLowerCase() === 'chef';

  if (!isClient || !dataLoaded) { // Check dataLoaded here
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="w-6 h-6 text-primary"/>Gestion des Utilisateurs</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-6">Chargement des données utilisateurs...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-6 h-6 text-primary"/>
          Gestion des Utilisateurs
        </CardTitle>
        <CardDescription>
          Définissez des utilisateurs en les liant aux membres de la brigade, leurs mots de passe (simulés) et leurs permissions d'accès aux différentes sections de l'application.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <AlertTitle className="text-destructive font-semibold">Avertissement de Sécurité</AlertTitle>
          <AlertDescription className="text-destructive/90">
            Ce système est pour la démonstration. Les mots de passe ne sont pas stockés de manière sécurisée (simulation).
            L'utilisateur 'Chef' est le compte administrateur avec tous les accès. Son mot de passe par défaut est '000' s'il n'a pas été modifié.
          </AlertDescription>
        </Alert>

        <Button onClick={() => handleOpenUserForm()} disabled={availableBrigadeMembers.length === 0 && !appUsers.some(u => u.username.toLowerCase() === 'chef' && !u.brigadeMemberId)}>
          <PlusCircle className="mr-2 h-4 w-4" /> Créer un Nouvel Utilisateur
        </Button>
        {availableBrigadeMembers.length === 0 && !appUsers.some(u => u.username.toLowerCase() === 'chef' && !u.brigadeMemberId) && (
             <p className="text-sm text-muted-foreground">Veuillez d'abord ajouter des membres à la brigade dans "Suivi des Heures &gt; Gestion Personnel" pour pouvoir créer de nouveaux utilisateurs liés.</p>
        )}

        <Dialog open={isUserFormOpen} onOpenChange={setIsUserFormOpen}>
          <DialogContent className="sm:max-w-lg md:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingUser ? `Modifier l'Utilisateur : ${editingUser.username}` : "Créer un Nouvel Utilisateur"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleUserFormSubmit)} className="space-y-4 py-4">
                <ScrollArea className="h-[70vh] pr-4">
                  <div className="space-y-4">
                    {editingUser ? (
                      <FormItem>
                        <FormLabel>Nom d'utilisateur</FormLabel>
                        <Input value={editingUser.username} disabled className="bg-muted/50"/>
                        <FormDescription className="text-xs">Le nom d'utilisateur est lié au membre de la brigade (si applicable) et ne peut être modifié ici. L'utilisateur 'Chef' est un compte spécial.</FormDescription>
                      </FormItem>
                    ) : (
                      <FormField control={form.control} name="selectedBrigadeMemberId" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Membre de la Brigade à lier</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value || undefined} 
                            defaultValue={field.value || undefined}
                          >
                            <FormControl><SelectTrigger>
                                <SelectValue placeholder="Sélectionner un membre..." />
                            </SelectTrigger></FormControl>
                            <SelectContent>
                              {availableBrigadeMembers.length > 0 ? (
                                availableBrigadeMembers.map(member => (
                                  <SelectItem key={member.id} value={member.id}>{member.name} ({member.role})</SelectItem>
                                ))
                              ) : (
                                <SelectItem value="disabled" disabled>Aucun membre de brigade disponible pour un nouveau compte.</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                    )}

                    <FormField control={form.control} name="passwordRequired" render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Mot de passe requis ?</FormLabel>
                          <FormDescription className="text-xs">
                            Si coché, un mot de passe sera nécessaire pour se connecter. (Obligatoire pour Chef)
                          </FormDescription>
                        </div>
                        <FormControl><Switch checked={isEditingChef ? true : field.value} onCheckedChange={field.onChange} disabled={isEditingChef} /></FormControl>
                      </FormItem>
                    )} />
                    
                    {form.watch('passwordRequired') && (
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
                                    checked={isEditingChef ? true : field.value}
                                    onCheckedChange={field.onChange}
                                    disabled={isEditingChef || (rubric.id === 'settings' && !isEditingChef)}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal text-sm cursor-pointer flex-grow">{rubric.label}</FormLabel>
                              </FormItem>
                            )}
                          />
                        ))}
                        <div className="pl-4 border-l-2 border-muted-foreground/30 ml-2 mt-2 space-y-2">
                            <Label className="text-sm font-semibold text-muted-foreground">Permissions détaillées pour "Suivi des Heures":</Label>
                            {TIME_TRACKING_SUB_RUBRICS.map(subRubric => (
                                <FormField
                                key={subRubric.id}
                                control={form.control}
                                name={`permissions.${subRubric.id}`}
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 hover:bg-muted/20">
                                    <FormControl>
                                        <Checkbox
                                        checked={isEditingChef ? true : field.value}
                                        onCheckedChange={field.onChange}
                                        disabled={isEditingChef}
                                        />
                                    </FormControl>
                                    <FormLabel className="font-normal text-sm cursor-pointer flex-grow">{subRubric.label}</FormLabel>
                                    </FormItem>
                                )}
                                />
                            ))}
                        </div>
                      </div>
                    </div>

                    {(currentFormHasTimeTrackingPermission || isEditingChef) && (
                        <>
                        <div className="pt-4 border-t">
                          <h3 className="text-md font-semibold mb-2 mt-2 flex items-center gap-1"><Eye className="w-4 h-4"/> Vue des Relevés d'Heures & Modèles Horaires</h3>
                           <FormDescription className="text-xs mb-2">
                            Définir quels relevés d'heures et modèles d'horaires cet utilisateur peut consulter. (Chef voit tout par défaut)
                          </FormDescription>
                          <FormField control={form.control} name="viewableHourSummary_type" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Type de vue</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value} disabled={isEditingChef}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Choisir type de vue..." /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="none">Aucun</SelectItem>
                                    <SelectItem value="own">Ses propres données uniquement</SelectItem>
                                    <SelectItem value="all">Données de tous les employés</SelectItem>
                                    <SelectItem value="specific">Données d'un employé spécifique</SelectItem>
                                </SelectContent>
                                </Select>
                                {isEditingChef && <FormDescription className="text-xs">Le Chef a toujours accès à toutes les données.</FormDescription>}
                                <FormMessage />
                            </FormItem>
                            )}
                          />
                          {currentSelectedSummaryType === 'specific' && !isEditingChef && (
                            <FormField control={form.control} name="viewableHourSummary_specificMemberId" render={({ field }) => (
                                <FormItem className="mt-2">
                                <FormLabel>Employé spécifique à visualiser</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value || undefined}>
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
                        </>
                    )}
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

        {!dataLoaded ? null : appUsers.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-md font-semibold">Utilisateurs Définis :</h3>
            {appUsers.map(user => (
              <Card key={user.id} className="bg-card/70">
                <CardHeader className="pb-2 pt-3 px-4">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{user.username}
                      {user.username.toLowerCase() === 'chef' && <span className="text-xs text-primary ml-1">(Admin)</span>}
                    </CardTitle>
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
                    Lié à Brigade: {user.brigadeMemberId ? (brigadeMembers.find(bm => bm.id === user.brigadeMemberId)?.name || <span className="text-destructive">Membre introuvable</span>) : 'Non'}
                    <br/>
                    Mot de passe requis : {user.passwordRequired ? "Oui" : "Non"}
                    {user.passwordRequired && user.simulatedStoredPassword && <span className="ml-2 text-green-600">(Mot de passe défini)</span>}
                    {user.passwordRequired && !user.simulatedStoredPassword && user.username.toLowerCase() !== 'chef' && <span className="ml-2 text-destructive">(Aucun mdp défini !)</span>}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                    <div>
                        <p className="text-xs font-medium mb-1">Permissions rubriques :</p>
                        <ul className="list-disc list-inside pl-2 text-xs space-y-0.5">
                            {RUBRICS.filter(rubric => user.permissions[rubric.id] || user.username.toLowerCase() === 'chef').map(rubric => (
                            <li key={rubric.id}>{rubric.label}</li>
                            ))}
                            {TIME_TRACKING_SUB_RUBRICS.filter(subRubric => user.permissions[subRubric.id] || user.username.toLowerCase() === 'chef').map(subRubric => (
                            <li key={subRubric.id} className="ml-4">{subRubric.label} (Suivi Heures)</li>
                            ))}
                            {[...RUBRICS, ...TIME_TRACKING_SUB_RUBRICS].filter(r => user.permissions[r.id]).length === 0 &&
                             user.username.toLowerCase() !== 'chef' && (
                                <li className="italic text-muted-foreground">Aucune permission de rubrique.</li>
                            )}
                        </ul>
                    </div>
                    <div>
                        <p className="text-xs font-medium mb-1">Vue Relevés d'Heures & Modèles Horaires :</p>
                        <p className="text-xs">
                            {user.username.toLowerCase() === 'chef' ? "Tous (Admin)" :
                             user.viewableHourSummaryConfig?.type === 'none' ? "Aucun" :
                             user.viewableHourSummaryConfig?.type === 'own' ? "Ses propres données uniquement" :
                             user.viewableHourSummaryConfig?.type === 'all' ? "Données de tous les employés" :
                             user.viewableHourSummaryConfig?.type === 'specific' ? 
                                `Données de: ${brigadeMembers.find(bm => bm.id === user.viewableHourSummaryConfig?.specificMemberId)?.name || 'N/D'}` :
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
          <p className="text-muted-foreground text-center py-6">Aucun utilisateur défini (autre que 'Chef' implicite). Cliquez sur "Créer un Nouvel Utilisateur" pour commencer.</p>
        )}
      </CardContent>
    </Card>
  );
}

