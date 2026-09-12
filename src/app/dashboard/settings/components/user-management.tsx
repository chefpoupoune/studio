
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Users, AlertTriangle, PlusCircle, Edit2, Trash2, KeyRound, Eye, Loader2, FileClock } from 'lucide-react';
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
import { firestore } from '@/lib/firebase';
import { collection, getDocs, addDoc, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';

// --- VRAIE SOURCE DE VÉRITÉ POUR LES PERMISSIONS -- -
export const LOGGED_IN_USER_PERMISSIONS_KEY = 'loggedInUserPermissions';
export const LOGGED_IN_USER_HOUR_VIEW_CONFIG_KEY = 'loggedInUserHourViewConfig';

export const RUBRICS = [
  { id: 'canAccessDashboard', label: 'Tableau de Bord' },
  { id: 'canAccessInventory', label: 'Gestion Stocks' },
  { id: 'canAccessBenefits', label: 'Avantages Nature' },
  { id: 'canAccessDeclarationHeure', label: "Déclaration d'Heures" },
  { id: 'canAccessTaskManagement', label: 'Gestion des Tâches' },
  { id: 'canAccessCostManagement', label: 'Gestion des Coûts' },
  { id: 'canAccessMenuPlanning', label: 'Planification Menus' },
  { id: 'canAccessPicnic', label: 'Pique Nique' },
  { id: 'canAccessPms', label: 'PMS' },
  { id: 'canAccessFinDuMois', label: 'Fin du Mois !' },
  { id: 'canAccessFinDeSemaine', label: 'Fin de Semaine' },
  { id: 'canAccessTimeTracking', label: 'Suivi des Heures (Accès général)' },
  { id: 'canAccessSettings', label: 'Paramètres (Accès général)' },
] as const;

export const TIME_TRACKING_SUB_RUBRICS = [
  { id: 'timeTracking_personnel', label: '— Gestion du Personnel (Brigade)' },
  { id: 'timeTracking_recording', label: '— Saisie & Historique des Heures' },
  { id: 'timeTracking_summary', label: '— Relevés & PDF Individuels' },
  { id: 'timeTracking_schedules', label: '— Modèles d\'Horaires' },
] as const;

export const MENU_PLANNING_SUB_RUBRICS = [
  { id: 'menuPlanning_recipes', label: '— Gestion des Recettes' },
  { id: 'menuPlanning_temperatureSheet', label: '— Fiche de Température' },
] as const;

export const PICNIC_SUB_RUBRICS = [
  { id: 'picnic_recapPn', label: '— Recap PN' },
] as const;

export type RubricId = typeof RUBRICS[number]['id'] | typeof TIME_TRACKING_SUB_RUBRICS[number]['id'] | typeof MENU_PLANNING_SUB_RUBRICS[number]['id'] | typeof PICNIC_SUB_RUBRICS[number]['id'];

export interface ViewableHourSummaryConfig {
  type: 'none' | 'own' | 'all' | 'specific';
  specificMemberId?: string | null;
}

export interface AppUser {
  id: string;
  username: string;
  brigadeMemberId?: string | null;
  passwordRequired: boolean;
  simulatedStoredPassword?: string | null;
  permissions: Partial<Record<RubricId, boolean>>;
  viewableHourSummaryConfig?: ViewableHourSummaryConfig;
  role?: 'admin' | 'superviseur' | 'user';
}

export const ALL_RUBRIC_IDS: RubricId[] = [
  ...RUBRICS.map(r => r.id),
  ...TIME_TRACKING_SUB_RUBRICS.map(sr => sr.id),
  ...MENU_PLANNING_SUB_RUBRICS.map(sr => sr.id),
  ...PICNIC_SUB_RUBRICS.map(sr => sr.id),
];

const permissionsSchemaObject = ALL_RUBRIC_IDS.reduce((acc, id) => {
  acc[id] = z.boolean().default(false);
  return acc;
}, {} as Record<RubricId, z.ZodBoolean>);

const userFormSchema = z.object({
  selectedBrigadeMemberId: z.string().nullable().optional(),
  passwordRequired: z.boolean().default(false),
  newPassword: z.string().optional(),
  confirmNewPassword: z.string().optional(),
  permissions: z.object(permissionsSchemaObject).default({}),
  viewableHourSummary_type: z.enum(['none', 'own', 'all', 'specific']).default('none'),
  viewableHourSummary_specificMemberId: z.string().optional(),
}).refine(data => {
    if (data.passwordRequired && data.newPassword && data.newPassword.length < 3) return false;
    return true;
}, { message: "Le mot de passe doit faire au moins 3 caractères.", path: ['newPassword'] })
  .refine(data => data.newPassword === data.confirmNewPassword, { message: "Les mots de passe ne correspondent pas.", path: ['confirmNewPassword'] });

type UserFormData = z.infer<typeof userFormSchema>;

const simulatedHash = (password: string): string => `sim_hashed_${password}_!`;

export default function UserManagement() {
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [brigadeMembers, setBrigadeMembers] = useState<BrigadeMember[]>([]);
  const [isUserFormOpen, setIsUserFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: { permissions: {} },
  });

  const fetchUsersAndMembers = useCallback(async () => {
    setIsLoading(true);
    try {
      const membersQuery = query(collection(firestore, 'brigadeMembers'), orderBy("name"));
      const membersSnapshot = await getDocs(membersQuery);
      const members = membersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BrigadeMember));
      setBrigadeMembers(members);

      const usersQuery = query(collection(firestore, 'appUsers'), orderBy("username"));
      const usersSnapshot = await getDocs(usersQuery);
      const users = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
      setAppUsers(users);

    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ title: "Erreur de chargement des données", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUsersAndMembers();
  }, [fetchUsersAndMembers]);

  const handleOpenUserForm = (user?: AppUser) => {
    setEditingUser(user || null);
    const isSpecialRole = user?.role === 'admin' || user?.role === 'superviseur';

    form.reset({
      selectedBrigadeMemberId: user?.brigadeMemberId || null,
      passwordRequired: isSpecialRole ? true : user?.passwordRequired || false,
      newPassword: '',
      confirmNewPassword: '',
      permissions: user?.permissions || {},
      viewableHourSummary_type: isSpecialRole ? 'all' : user?.viewableHourSummaryConfig?.type || 'none',
      viewableHourSummary_specificMemberId: user?.viewableHourSummaryConfig?.specificMemberId || undefined,
    });
    setIsUserFormOpen(true);
  };

  const handleUserFormSubmit = async (data: UserFormData) => {
    let permissionsToSave = { ...data.permissions };

    const summaryConfig: ViewableHourSummaryConfig = {
        type: data.viewableHourSummary_type,
        specificMemberId: data.viewableHourSummary_type === 'specific' ? (data.viewableHourSummary_specificMemberId || null) : null,
    };

    let passwordToStore = editingUser?.simulatedStoredPassword || null;
    if (data.passwordRequired && data.newPassword) {
      passwordToStore = simulatedHash(data.newPassword);
    } else if (!data.passwordRequired) {
      passwordToStore = null;
    }

    if (editingUser) {
      const userRef = doc(firestore, "appUsers", editingUser.id);
      await setDoc(userRef, {
        ...editingUser,
        passwordRequired: editingUser.role === 'admin' || editingUser.role === 'superviseur' ? true : data.passwordRequired,
        simulatedStoredPassword: passwordToStore,
        permissions: permissionsToSave,
        viewableHourSummaryConfig: editingUser.role === 'admin' ? { type: 'all' } : summaryConfig,
      }, { merge: true });
      toast({ title: "Utilisateur mis à jour" });
    } else {
      const selectedMember = brigadeMembers.find(bm => bm.id === data.selectedBrigadeMemberId);
      if (!selectedMember) {
        toast({ title: "Membre de brigade non trouvé", variant: "destructive" });
        return;
      }
      if (appUsers.some(u => u.brigadeMemberId === selectedMember.id)) {
        toast({ title: "Cet employé a déjà un compte utilisateur.", variant: "destructive" });
        return;
      }

      await addDoc(collection(firestore, "appUsers"), {
        username: selectedMember.name,
        brigadeMemberId: selectedMember.id,
        role: 'user',
        passwordRequired: data.passwordRequired,
        simulatedStoredPassword: passwordToStore,
        permissions: permissionsToSave,
        viewableHourSummaryConfig: summaryConfig,
      });
      toast({ title: "Utilisateur créé" });
    }
    
    fetchUsersAndMembers();
    setIsUserFormOpen(false);
  };

  const handleDeleteUser = async (userId: string) => {
    const userToDelete = appUsers.find(u => u.id === userId);
    if (!userToDelete) return;
    if (userToDelete.role === 'admin' || userToDelete.role === 'superviseur') {
      toast({ title: "Suppression interdite", description: "Les comptes spéciaux ne peuvent pas être supprimés.", variant: "destructive" });
      return;
    }
    await deleteDoc(doc(firestore, "appUsers", userId));
    toast({ title: "Utilisateur Supprimé", variant: "destructive" });
    fetchUsersAndMembers();
  };
  
  const availableBrigadeMembers = brigadeMembers.filter(
    member => !appUsers.some(user => user.brigadeMemberId === member.id)
  );
  
  if (isLoading) {
      return <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary mr-2"/> Chargement...</div>
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users />Gestion des Utilisateurs</CardTitle>
        <CardDescription>Créez, modifiez et assignez les permissions aux utilisateurs de l'application.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Button onClick={() => handleOpenUserForm()} disabled={availableBrigadeMembers.length === 0}>
          <PlusCircle className="mr-2" /> Créer un Utilisateur
        </Button>
        {availableBrigadeMembers.length === 0 && <p className="text-sm text-muted-foreground">Tous les membres de la brigade ont déjà un compte utilisateur.</p>}

        <div className="space-y-3">
          {appUsers.map(user => (
            <Card key={user.id}>
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{user.username} {user.role && `(${user.role})`}</CardTitle>
                    <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenUserForm(user)}><Edit2 /></Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" disabled={!!user.role}><Trash2 /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Supprimer "{user.username}" ?</AlertDialogTitle></AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteUser(user.id)}>Supprimer</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3 text-sm">
                  <p>Permissions: {ALL_RUBRIC_IDS.filter(id => user.permissions[id]).length || (user.role ? 'Toutes' : 0)}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={isUserFormOpen} onOpenChange={setIsUserFormOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingUser ? `Modifier: ${editingUser.username}` : "Créer un Utilisateur"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleUserFormSubmit)} className="space-y-4 py-4">
                <ScrollArea className="h-[70vh] pr-4">
                  <div className="space-y-4">
                    {!editingUser && (
                      <FormField control={form.control} name="selectedBrigadeMemberId" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Lier à l'employé</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger></FormControl>
                            <SelectContent>
                              {availableBrigadeMembers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}/>
                    )}

                    <FormField control={form.control} name="passwordRequired" render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <FormLabel>Mot de passe requis</FormLabel>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} disabled={!!editingUser?.role} /></FormControl>
                      </FormItem>
                    )} />
                    
                    {form.watch('passwordRequired') && (
                      <div className="p-3 border rounded-md space-y-3">
                        <FormField control={form.control} name="newPassword" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nouveau mot de passe {editingUser ? '(laisser vide pour ne pas changer)' : ''}</FormLabel>
                            <FormControl><Input type="password" {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}/>
                        <FormField control={form.control} name="confirmNewPassword" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirmer</FormLabel>
                            <FormControl><Input type="password" {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}/>
                      </div>
                    )}
                    
                    <h3 className="text-md font-semibold mb-2 mt-3">Permissions</h3>
                    {RUBRICS.map(rubric => (
                      <React.Fragment key={rubric.id}>
                        <FormField control={form.control} name={`permissions.${rubric.id}`} render={({ field }) => (
                          <FormItem className="flex items-center space-x-3 space-y-0 rounded-md border p-3">
                            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={editingUser?.role === 'admin'} /></FormControl>
                            <FormLabel className="font-normal flex-grow">{rubric.label}</FormLabel>
                          </FormItem>
                        )}/>
                        {rubric.id === 'canAccessMenuPlanning' && (
                          <div className="pl-6 border-l-2 ml-2 mt-2 space-y-2">
                            {MENU_PLANNING_SUB_RUBRICS.map(subRubric => (
                              <FormField key={subRubric.id} control={form.control} name={`permissions.${subRubric.id}`} render={({ field }) => (
                                <FormItem className="flex items-center space-x-3 space-y-0 rounded-md border p-3">
                                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={!!editingUser?.role} /></FormControl>
                                  <FormLabel className="font-normal flex-grow">{subRubric.label}</FormLabel>
                                </FormItem>
                              )}/>
                            ))}
                          </div>
                        )}
                        {rubric.id === 'canAccessPicnic' && (
                          <div className="pl-6 border-l-2 ml-2 mt-2 space-y-2">
                            {PICNIC_SUB_RUBRICS.map(subRubric => (
                              <FormField key={subRubric.id} control={form.control} name={`permissions.${subRubric.id}`} render={({ field }) => (
                                <FormItem className="flex items-center space-x-3 space-y-0 rounded-md border p-3">
                                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={!!editingUser?.role} /></FormControl>
                                  <FormLabel className="font-normal flex-grow">{subRubric.label}</FormLabel>
                                </FormItem>
                              )}/>
                            ))}
                          </div>
                        )}
                        {rubric.id === 'canAccessTimeTracking' && (
                          <div className="pl-6 border-l-2 ml-2 mt-2 space-y-2">
                            {TIME_TRACKING_SUB_RUBRICS.map(subRubric => (
                              <FormField key={subRubric.id} control={form.control} name={`permissions.${subRubric.id}`} render={({ field }) => (
                                <FormItem className="flex items-center space-x-3 space-y-0 rounded-md border p-3">
                                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={!!editingUser?.role} /></FormControl>
                                  <FormLabel className="font-normal flex-grow">{subRubric.label}</FormLabel>
                                </FormItem>
                              )}/>
                            ))}
                          </div>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </ScrollArea>
                <DialogFooter className="pt-4">
                  <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
                  <Button type="submit">Enregistrer</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
