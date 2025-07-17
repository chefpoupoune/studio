
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

// Define and EXPORT the constants here at the top level
export const LOGGED_IN_USER_PERMISSIONS_KEY = 'loggedInUserPermissions';
export const LOGGED_IN_USER_HOUR_VIEW_CONFIG_KEY = 'loggedInUserHourViewConfig';

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
  specificMemberId?: string | null; // Allow null
}

export interface AppUser {
  id: string; // Firestore document ID
  username: string;
  brigadeMemberId?: string;
  passwordRequired: boolean;
  simulatedStoredPassword?: string | null; // Allow null
  permissions: Partial<Record<RubricId, boolean>>;
  viewableHourSummaryConfig?: ViewableHourSummaryConfig;
}

export const ALL_RUBRIC_IDS: RubricId[] = [
  ...RUBRICS.map(r => r.id),
  ...TIME_TRACKING_SUB_RUBRICS.map(sr => sr.id),
];

const basePermissionsSchemaObject = RUBRICS.reduce((acc, rubric) => {
  acc[rubric.id] = z.boolean().default(false);
  return acc;
}, {} as Record<typeof RUBRICS[number]['id'], z.ZodBoolean>);

const timeTrackingPermissionsSchemaObject = TIME_TRACKING_SUB_RUBRICS.reduce((acc, subRubric) => {
  acc[subRubric.id] = z.boolean().default(false);
  return acc;
}, {} as Record<typeof TIME_TRACKING_SUB_RUBRICS[number]['id'], z.ZodBoolean>);

const userFormSchema = z.object({
  selectedBrigadeMemberId: z.string().min(1, "Veuillez sélectionner un membre de la brigade.").nullable().optional(),
  passwordRequired: z.boolean().default(false),
  newPassword: z.string().optional(),
  confirmNewPassword: z.string().optional(),
  permissions: z.object({
    ...basePermissionsSchemaObject,
    ...timeTrackingPermissionsSchemaObject,
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
const DEFAULT_CHEF_ID_FIRESTORE = 'default_chef_user_id';
const DEFAULT_CDS_ID_FIRESTORE = 'default_cds_user_id'; // For Chef de service

export default function UserManagement() {
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [brigadeMembers, setBrigadeMembers] = useState<BrigadeMember[]>([]);
  const [availableBrigadeMembers, setAvailableBrigadeMembers] = useState<BrigadeMember[]>([]);
  const [isUserFormOpen, setIsUserFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
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

  const fetchBrigadeMembers = useCallback(async () => {
    if (!isClient) return [];
    try {
      const membersCollectionRef = collection(firestore, 'brigadeMembers');
      const q = query(membersCollectionRef, orderBy("name"));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BrigadeMember));
    } catch (error) {
      console.error("Error fetching brigade members:", error);
      toast({ title: "Erreur de chargement des membres de la brigade", variant: "destructive" });
      return [];
    }
  }, [isClient, toast]);

  const fetchAppUsers = useCallback(async () => {
    if (!isClient) return;
    setIsLoading(true);
    console.log("UserManagement [FETCH USERS]: Fetching app users from Firestore.");
    try {
      const usersCollectionRef = collection(firestore, 'appUsers');
      const q = query(usersCollectionRef, orderBy("username"));
      const querySnapshot = await getDocs(q);
      let loadedUsers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
      
      const allPermissionsTrue = ALL_RUBRIC_IDS.reduce((acc, rubricId) => ({ ...acc, [rubricId]: true }), {});
      const allViewConfig = { type: 'all' as const };

      // Ensure Chef user exists
      let chefUserInDb = loadedUsers.find(u => u.username.toLowerCase() === 'chef');
      if (!chefUserInDb) {
        const defaultChef: Omit<AppUser, 'id'> = {
          username: 'Chef', passwordRequired: true, simulatedStoredPassword: simulatedHash('000'),
          permissions: allPermissionsTrue, viewableHourSummaryConfig: allViewConfig,
        };
        const chefDocRef = await addDoc(collection(firestore, "appUsers"), defaultChef);
        loadedUsers.push({ ...defaultChef, id: chefDocRef.id });
        toast({title: "Utilisateur Chef Initialisé", description: "Mdp: 000."});
      } else {
        // Enforce Chef's permissions and view config
        const chefNeedsUpdate = JSON.stringify(chefUserInDb.permissions) !== JSON.stringify(allPermissionsTrue) || 
                                JSON.stringify(chefUserInDb.viewableHourSummaryConfig) !== JSON.stringify(allViewConfig) ||
                                !chefUserInDb.passwordRequired || !chefUserInDb.simulatedStoredPassword;
        if(chefNeedsUpdate) {
            const chefDocRef = doc(firestore, "appUsers", chefUserInDb.id);
            await setDoc(chefDocRef, { 
                permissions: allPermissionsTrue, 
                viewableHourSummaryConfig: allViewConfig,
                passwordRequired: true,
                simulatedStoredPassword: chefUserInDb.simulatedStoredPassword || simulatedHash('000')
            }, { merge: true });
        }
      }
      
      // Ensure Chef de service user exists
      let cdsUserInDb = loadedUsers.find(u => u.username.toLowerCase() === 'chef de service');
      if (!cdsUserInDb) {
        const defaultCds: Omit<AppUser, 'id'> = {
          username: 'Chef de service', passwordRequired: true, simulatedStoredPassword: simulatedHash('cds000'),
          permissions: allPermissionsTrue, viewableHourSummaryConfig: allViewConfig,
        };
        const cdsDocRef = await addDoc(collection(firestore, "appUsers"), defaultCds);
        loadedUsers.push({ ...defaultCds, id: cdsDocRef.id });
        toast({title: "Utilisateur Chef de service Initialisé", description: "Mdp: cds000."});
      } else {
         // Enforce Chef de service's permissions and view config
         const cdsNeedsUpdate = JSON.stringify(cdsUserInDb.permissions) !== JSON.stringify(allPermissionsTrue) || 
                                JSON.stringify(cdsUserInDb.viewableHourSummaryConfig) !== JSON.stringify(allViewConfig) ||
                                !cdsUserInDb.passwordRequired || !cdsUserInDb.simulatedStoredPassword;

        if(cdsNeedsUpdate) {
            const cdsDocRef = doc(firestore, "appUsers", cdsUserInDb.id);
            await setDoc(cdsDocRef, { 
                permissions: allPermissionsTrue, 
                viewableHourSummaryConfig: allViewConfig,
                passwordRequired: true,
                simulatedStoredPassword: cdsUserInDb.simulatedStoredPassword || simulatedHash('cds000')
            }, { merge: true });
        }
      }
      
      // Apply enforced settings to loaded users for display
      loadedUsers = loadedUsers.map(u => {
        if (u.username.toLowerCase() === 'chef' || u.username.toLowerCase() === 'chef de service') {
            return {
                ...u,
                passwordRequired: true,
                permissions: allPermissionsTrue,
                viewableHourSummaryConfig: allViewConfig,
                simulatedStoredPassword: u.simulatedStoredPassword || (u.username.toLowerCase() === 'chef' ? simulatedHash('000') : simulatedHash('cds000')),
            };
        }
        return u;
      });

      setAppUsers(loadedUsers.sort((a, b) => a.username.localeCompare(b.username)));
      console.log(`UserManagement [FETCH USERS]: Fetched and set ${loadedUsers.length} app users.`);
    } catch (error) {
      console.error("UserManagement [FETCH USERS]: Error fetching/ensuring app users:", error);
      toast({ title: "Erreur de chargement des utilisateurs", variant: "destructive" });
      setAppUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [isClient, toast]);


  useEffect(() => {
    setIsClient(true);
    async function loadInitialData() {
      const members = await fetchBrigadeMembers();
      setBrigadeMembers(members);
      await fetchAppUsers(); 
    }
    loadInitialData();
  }, [fetchBrigadeMembers, fetchAppUsers]); 


  useEffect(() => {
    if (isClient && !isLoading) {
      const linkedMemberIds = appUsers.map(user => user.brigadeMemberId).filter(id => !!id);
      const updatedAvailableMembers = brigadeMembers.filter(member => !linkedMemberIds.includes(member.id));
      setAvailableBrigadeMembers(updatedAvailableMembers);
    }
  }, [appUsers, brigadeMembers, isClient, isLoading]);


  const handleOpenUserForm = (user?: AppUser) => {
    setEditingUser(user || null);
    const isCurrentUserChef = user?.username.toLowerCase() === 'chef';
    const isCurrentUserCds = user?.username.toLowerCase() === 'chef de service';
    
    let defaultPermissions = ALL_RUBRIC_IDS.reduce((acc, rubricId) => ({ ...acc, [rubricId]: false }), {});
    if (user) {
      defaultPermissions = ALL_RUBRIC_IDS.reduce((acc, rubricId) => {
        acc[rubricId] = (isCurrentUserChef || isCurrentUserCds) ? true : !!user.permissions[rubricId];
        return acc;
      }, {} as Partial<Record<RubricId, boolean>>);
    }

    form.reset({
 selectedBrigadeMemberId: user?.brigadeMemberId ?? null, // Use nullish coalescing to handle undefined and set to null
      passwordRequired: (isCurrentUserChef || isCurrentUserCds) ? true : (user?.passwordRequired || false),
      newPassword: '',
      confirmNewPassword: '',
      permissions: defaultPermissions,
      viewableHourSummary_type: (isCurrentUserChef || isCurrentUserCds) ? 'all' : (user?.viewableHourSummaryConfig?.type || 'none'),
      viewableHourSummary_specificMemberId: (isCurrentUserChef || isCurrentUserCds) ? undefined : (user?.viewableHourSummaryConfig?.specificMemberId || undefined),
    });
    setIsUserFormOpen(true);
  };

  const handleUserFormSubmit = async (data: UserFormData) => {
    console.log("handleUserFormSubmit started");
    let passwordToStore: string | null = null;
    if (data.passwordRequired && data.newPassword) {
        passwordToStore = simulatedHash(data.newPassword);
    }

    let summaryConfig: ViewableHourSummaryConfig = {
        type: data.viewableHourSummary_type,
        specificMemberId: data.viewableHourSummary_type === 'specific' ? (data.viewableHourSummary_specificMemberId || null) : null,
    };
    
    const isCurrentEditingUserChef = editingUser?.username.toLowerCase() === 'chef';
    const isCurrentEditingUserCds = editingUser?.username.toLowerCase() === 'chef de service';

    let permissionsToSave = data.permissions;
    let summaryConfigToSave = summaryConfig;

    if (isCurrentEditingUserChef || isCurrentEditingUserCds) {
        permissionsToSave = ALL_RUBRIC_IDS.reduce((acc, rubricId) => ({ ...acc, [rubricId]: true }), {});
        summaryConfigToSave = { type: 'all' };
    }
    
    const userCommonData = {
      passwordRequired: (isCurrentEditingUserChef || isCurrentEditingUserCds) ? true : data.passwordRequired,
      permissions: permissionsToSave,
      viewableHourSummaryConfig: summaryConfigToSave,
    };

    if (editingUser) {
      const updatedSimulatedPassword = 
        (userCommonData.passwordRequired && passwordToStore) 
          ? passwordToStore 
          : userCommonData.passwordRequired 
            ? (editingUser.simulatedStoredPassword || null) 
            : null;

      const userToUpdate: Omit<AppUser, 'id'> = {
          username: editingUser.username,
          brigadeMemberId: editingUser.brigadeMemberId ?? null, // Ensure null if undefined
          ...userCommonData,
          simulatedStoredPassword: updatedSimulatedPassword,
      };
      console.log("UserManagement [UPDATE USER SUBMIT]: Attempting to update user. Data:", userToUpdate);
      try {
        const userDocRef = doc(firestore, "appUsers", editingUser.id);
        await setDoc(userDocRef, userToUpdate, { merge: true }); 
        fetchAppUsers(); 
        localStorage.setItem(LOGGED_IN_USER_HOUR_VIEW_CONFIG_KEY, JSON.stringify(summaryConfigToSave));
        window.dispatchEvent(new CustomEvent('loggedInUserHourViewConfigUpdated'));
        toast({ title: "Utilisateur Modifié", description: `L'utilisateur "${editingUser.username}" a été mis à jour.` });
      } catch (e: any) {
        let errorMessage = 'Erreur inconnue.';
        let errorCode = 'N/A';
        if (e instanceof Error) {
          errorMessage = e.message;
          if ('code' in e) errorCode = (e as any).code;
        } else if (typeof e === 'string') {
          errorMessage = e;
        }
        console.error("UserManagement [UPDATE USER SAVE]: Error updating user in Firestore. Original error object:", e, "Attempted update data:", userToUpdate);
        toast({ title: "Erreur de Modification d'Utilisateur", description: `Erreur: ${errorMessage} ${errorCode !== 'N/A' ? `(Code: ${errorCode})` : ''}. Consultez la console.`, variant: "destructive"});
      }
    } else { 
      if (!data.selectedBrigadeMemberId) {
        form.setError("selectedBrigadeMemberId", { message: "Sélection requise." });
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

      const newUserToSave: Omit<AppUser, 'id'> = { 
        username: selectedMember.name, 
        brigadeMemberId: selectedMember.id,
        ...userCommonData,
        simulatedStoredPassword: passwordToStore,
      };
      console.log("UserManagement [CREATE USER SUBMIT]: Attempting to create user. Data:", newUserToSave);
      try {
        await addDoc(collection(firestore, "appUsers"), newUserToSave);
        fetchAppUsers(); 
        toast({ title: "Utilisateur Créé", description: `L'utilisateur "${newUserToSave.username}" a été créé.` });
      } catch (e: any) {
        let errorMessage = 'Erreur inconnue.';
        let errorCode = 'N/A';
        if (e instanceof Error) {
          errorMessage = e.message;
          if ('code' in e) errorCode = (e as any).code;
        } else if (typeof e === 'string') {
          errorMessage = e;
        }
        console.error("UserManagement [CREATE USER SAVE]: Error adding user to Firestore. Original error object:", e, "Attempted save data:", newUserToSave);
        toast({ 
          title: "Erreur de Création d'Utilisateur", 
          description: `Erreur: ${errorMessage} ${errorCode !== 'N/A' ? `(Code: ${errorCode})` : ''}. Consultez la console.`, 
          variant: "destructive"
        });
      }
    }
    setIsUserFormOpen(false);
  };

  const handleDeleteUser = async (userId: string) => {
    const userToDelete = appUsers.find(u => u.id === userId);
    if (!userToDelete) return;

    if (userToDelete.username.toLowerCase() === 'chef' || userToDelete.username.toLowerCase() === 'chef de service') {
      toast({ title: "Suppression Interdite", description: `L'utilisateur "${userToDelete.username}" ne peut pas être supprimé.`, variant: "destructive" });
      return;
    }

    try {
      await deleteDoc(doc(firestore, "appUsers", userId));
      fetchAppUsers(); 
      toast({ title: "Utilisateur Supprimé", description: `L'utilisateur "${userToDelete.username}" a été supprimé.`, variant: "destructive" });
    } catch (e) {
      console.error("Error deleting user from Firestore:", e);
      toast({ title: "Erreur de suppression", variant: "destructive" });
    }
  };

  const currentSelectedSummaryType = form.watch('viewableHourSummary_type');
  const formTimeTrackingPermissions = form.watch('permissions');
  const currentFormHasTimeTrackingPermission = TIME_TRACKING_SUB_RUBRICS.some(sr => !!formTimeTrackingPermissions[sr.id]);
  const isEditingChef = editingUser?.username.toLowerCase() === 'chef';
  const isEditingCds = editingUser?.username.toLowerCase() === 'chef de service';


  if (!isClient || isLoading) {
    return (
      <Card className="shadow-lg">
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="w-6 h-6 text-primary"/>Gestion des Utilisateurs</CardTitle></CardHeader>
        <CardContent className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2"/> Chargement des données utilisateurs...
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
          Définissez des utilisateurs en les liant aux membres de la brigade, leurs mots de passe (simulés) et leurs permissions d'accès.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <AlertTitle className="text-destructive font-semibold">Avertissement de Sécurité</AlertTitle>
          <AlertDescription className="text-destructive/90">
            Ce système utilise un stockage de mot de passe simulé et non sécurisé. Ne pas utiliser pour des mots de passe réels en production.
            Les comptes 'Chef' (mdp: 000) et 'Chef de service' (mdp: cds000) sont administrateurs avec tous les accès en visualisation.
          </AlertDescription>
        </Alert>

        <Button onClick={() => handleOpenUserForm()} disabled={availableBrigadeMembers.length === 0 && !editingUser}>
          <PlusCircle className="mr-2 h-4 w-4" /> Créer un Nouvel Utilisateur
        </Button>
        {availableBrigadeMembers.length === 0 && !editingUser && ( 
             <p className="text-sm text-muted-foreground">Veuillez d'abord ajouter des membres à la brigade dans "Suivi des Heures &gt; Gestion Personnel" pour pouvoir créer de nouveaux utilisateurs liés.</p>
        )}

        <Dialog open={isUserFormOpen} onOpenChange={setIsUserFormOpen}>
          <DialogContent className="sm:max-w-lg md:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingUser ? `Modifier l'Utilisateur : ${editingUser.username}` : "Créer un Nouvel Utilisateur"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form 
                onSubmit={(e) => { 
                  console.log("Form onSubmit triggered"); 
                  form.handleSubmit(handleUserFormSubmit, (errors) => { console.error("Form validation errors:", errors); })(e); 
                }} 
                className="space-y-4 py-4"
              >
                <ScrollArea className="h-[70vh] pr-4">
                  <div className="space-y-4">
                    {editingUser ? (
                      <FormItem>
                        <FormLabel>Nom d'utilisateur</FormLabel>
                        <Input value={editingUser.username} disabled className="bg-muted/50"/>
                        <FormDescription className="text-xs">Le nom d'utilisateur est lié au membre de la brigade (si applicable) et ne peut être modifié ici. Les utilisateurs 'Chef' et 'Chef de service' sont des comptes spéciaux.</FormDescription>
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
                                <SelectItem value="disabled" disabled>Aucun membre de brigade non lié disponible.</SelectItem>
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
                            Si coché, un mot de passe sera nécessaire pour se connecter. (Obligatoire pour Chef et Chef de service)
                          </FormDescription>
                        </div>
                        <FormControl><Switch checked={(isEditingChef || isEditingCds) ? true : field.value} onCheckedChange={field.onChange} disabled={isEditingChef || isEditingCds} /></FormControl>
                      </FormItem>
                    )} />
                    
                    {form.watch('passwordRequired') && (
                      <div className="p-3 border rounded-md space-y-3 bg-muted/30">
                         <FormField control={form.control} name="newPassword" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1"><KeyRound className="w-4 h-4" />Nouveau mot de passe {editingUser ? '(Laisser vide pour ne pas changer)' : ''}</FormLabel>
                            <FormControl><Input type="password" placeholder="Saisir un mot de passe..." {...field} value={field.value ?? ''} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        <FormField control={form.control} name="confirmNewPassword" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Confirmer nouveau mot de passe</FormLabel>
                            <FormControl><Input type="password" placeholder="Confirmer le mot de passe..." {...field} value={field.value ?? ''} /></FormControl>
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
                                    checked={(isEditingChef || isEditingCds) ? true : field.value}
                                    onCheckedChange={field.onChange}
                                    disabled={(isEditingChef || isEditingCds) || (rubric.id === 'settings' && !isEditingChef && !isEditingCds)} 
                                  />
                                </FormControl>
                                <FormLabel className="font-normal text-sm cursor-pointer flex-grow">{rubric.label}</FormLabel>
                              </FormItem>
                            )}
                          />
                        ))}
                        <div className="pl-4 border-l-2 border-muted-foreground/30 ml-2 mt-2 space-y-2">
                            <Label className="text-sm font-semibold text-muted-foreground flex items-center gap-1">
                                <FileClock className="w-4 h-4" /> Permissions "Suivi des Heures":
                            </Label>
                            {TIME_TRACKING_SUB_RUBRICS.map(subRubric => (
                                <FormField
                                key={subRubric.id}
                                control={form.control}
                                name={`permissions.${subRubric.id}`}
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 hover:bg-muted/20">
                                    <FormControl>
                                        <Checkbox
                                        checked={(isEditingChef || isEditingCds) ? true : field.value}
                                        onCheckedChange={field.onChange}
                                        disabled={(isEditingChef || isEditingCds)}
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

                    {((currentFormHasTimeTrackingPermission || isEditingChef || isEditingCds)) && (
                        <>
                        <div className="pt-4 border-t">
                          <h3 className="text-md font-semibold mb-2 mt-2 flex items-center gap-1"><Eye className="w-4 h-4"/> Vue des Relevés d'Heures & Modèles Horaires</h3>
                           <FormDescription className="text-xs mb-2">
                            Définir quels relevés d'heures et modèles d'horaires cet utilisateur peut consulter. (Chef et Chef de service voient tout par défaut)
                          </FormDescription>
                          <FormField control={form.control} name="viewableHourSummary_type" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Type de vue</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value} disabled={(isEditingChef || isEditingCds)}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Choisir type de vue..." /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="none">Aucun</SelectItem>
                                    <SelectItem value="own">Ses propres données uniquement</SelectItem>
                                    <SelectItem value="all">Données de tous les employés</SelectItem>
                                    <SelectItem value="specific">Données d'un employé spécifique</SelectItem>
                                </SelectContent>
                                </Select>
                                {(isEditingChef || isEditingCds) && <FormDescription className="text-xs">Chef et Chef de service ont toujours accès à toutes les données.</FormDescription>}
                                <FormMessage />
                            </FormItem>
                            )}
                          />
                          {currentSelectedSummaryType === 'specific' && !(isEditingChef || isEditingCds) && (
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

        {appUsers.length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-md font-semibold">Utilisateurs Définis :</h3>
            {appUsers.map(user => (
              <Card key={user.id} className="bg-card/70">
                <CardHeader className="pb-2 pt-3 px-4">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{user.username}
                      {(user.username.toLowerCase() === 'chef' || user.username.toLowerCase() === 'chef de service') && 
                        <span className="text-xs text-primary ml-1">({user.username.toLowerCase() === 'chef' ? 'Admin' : 'Superviseur'})</span>
                      }
                    </CardTitle>
                    <div className="space-x-1">
                       <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenUserForm(user)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                       <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" disabled={user.username.toLowerCase() === 'chef' || user.username.toLowerCase() === 'chef de service'}>
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
                    {user.passwordRequired && !user.simulatedStoredPassword && user.username.toLowerCase() !== 'chef' && user.username.toLowerCase() !== 'chef de service' && <span className="ml-2 text-destructive">(Aucun mdp défini !)</span>}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                    <div>
                        <p className="text-xs font-medium mb-1">Permissions rubriques :</p>
                        <ul className="list-disc list-inside pl-2 text-xs space-y-0.5">
                            {RUBRICS.filter(rubric => user.permissions[rubric.id] || user.username.toLowerCase() === 'chef' || user.username.toLowerCase() === 'chef de service').map(rubric => (
                            <li key={rubric.id}>{rubric.label}</li>
                            ))}
                            {TIME_TRACKING_SUB_RUBRICS.filter(subRubric => user.permissions[subRubric.id] || user.username.toLowerCase() === 'chef' || user.username.toLowerCase() === 'chef de service').map(subRubric => (
                            <li key={subRubric.id} className="ml-4">{subRubric.label} (Suivi Heures)</li>
                            ))}
                            {[...RUBRICS, ...TIME_TRACKING_SUB_RUBRICS].filter(r => user.permissions[r.id]).length === 0 &&
                             user.username.toLowerCase() !== 'chef' && user.username.toLowerCase() !== 'chef de service' && ( 
                                <li className="italic text-muted-foreground">Aucune permission de rubrique.</li>
                            )}
                        </ul>
                    </div>
                    <div>
                        <p className="text-xs font-medium mb-1">Vue Relevés d'Heures & Modèles Horaires :</p>
                        <p className="text-xs">
                            {(user.username.toLowerCase() === 'chef' || user.username.toLowerCase() === 'chef de service') ? "Tous (Admin/Superviseur)" :
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
          <p className="text-muted-foreground text-center py-6">Aucun utilisateur défini. Cliquez sur "Créer un Nouvel Utilisateur" pour commencer.</p>
        )}
      </CardContent>
    </Card>
  );
}
    
