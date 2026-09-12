
"use client";

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { User, LockKeyhole, ArrowLeft, Utensils, Loader2 } from 'lucide-react';
import { CurrentDate } from '@/components/current-date';
import { useToast } from '@/hooks/use-toast';
import type { AppUser, RubricId, ViewableHourSummaryConfig } from '@/app/dashboard/settings/components/user-management';
import { ALL_RUBRIC_IDS, LOGGED_IN_USER_PERMISSIONS_KEY, LOGGED_IN_USER_HOUR_VIEW_CONFIG_KEY } from '@/app/dashboard/settings/components/user-management';
import { firestore } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, doc, setDoc, addDoc, getDoc } from 'firebase/firestore';

const APP_SETTINGS_COLLECTION = "appSettings";
const GLOBAL_APP_SETTINGS_DOC_ID = "globalAppSettings";

const simulatedHash = (password: string): string => `sim_hashed_${password}_!`;

export default function LoginPage() {
  const [definedUsers, setDefinedUsers] = useState<AppUser[]>([]);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<AppUser | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [error, setError] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [appLogoUrl, setAppLogoUrl] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      const loadInitialData = async () => {
        setIsLoading(true);
        
        const settingsDocRef = doc(firestore, APP_SETTINGS_COLLECTION, GLOBAL_APP_SETTINGS_DOC_ID);
        try {
          const docSnap = await getDoc(settingsDocRef);
          if (docSnap.exists() && docSnap.data().appLogoUrl) {
            setAppLogoUrl(docSnap.data().appLogoUrl);
          }
        } catch (logoError) {
          console.error("Error loading app logo:", logoError);
        }

        try {
          const usersCollectionRef = collection(firestore, 'appUsers');
          const allPermissions = ALL_RUBRIC_IDS.reduce((acc, rubricId) => ({ ...acc, [rubricId]: true }), {});
          
          // Define read-only permissions for supervisor
          const readOnlyPermissions = ALL_RUBRIC_IDS.reduce((acc, rubricId) => {
              acc[rubricId] = false; // Set all to false initially
              return acc;
          }, {} as { [key in RubricId]?: boolean });
          readOnlyPermissions.dashboard = true; // Allow access to the dashboard

          // --- Chef Logic: Create or Update ---
          const chefQuery = query(usersCollectionRef, where("username", "==", "Chef"));
          const chefSnapshot = await getDocs(chefQuery);
          if (chefSnapshot.empty) {
            const defaultChef: Omit<AppUser, 'id'> = {
              username: 'Chef',
              role: 'admin',
              passwordRequired: true,
              simulatedStoredPassword: simulatedHash('000'),
              permissions: allPermissions,
              viewableHourSummaryConfig: { type: 'all' },
            };
            await addDoc(usersCollectionRef, defaultChef);
            toast({ title: "Compte 'Chef' Initialisé" });
          } else {
            const chefDoc = chefSnapshot.docs[0];
            if (chefDoc.data().role !== 'admin') {
              await setDoc(chefDoc.ref, { role: 'admin', permissions: allPermissions }, { merge: true });
            }
          }

          // --- Chef de service Logic: Create or Update ---
          const cdsQuery = query(usersCollectionRef, where("username", "==", "Chef de service"));
          const cdsSnapshot = await getDocs(cdsQuery);
          if (cdsSnapshot.empty) {
            const defaultCds: Omit<AppUser, 'id'> = {
              username: 'Chef de service',
              role: 'superviseur',
              passwordRequired: true,
              simulatedStoredPassword: simulatedHash('cds000'),
              permissions: readOnlyPermissions, // Use read-only permissions
              viewableHourSummaryConfig: { type: 'all' },
            };
            await addDoc(usersCollectionRef, defaultCds);
            toast({ title: "Compte 'Chef de service' Initialisé (Lecteur)" });
          } else {
            const cdsDoc = cdsSnapshot.docs[0];
            if (cdsDoc.data().role !== 'superviseur') {
              await setDoc(cdsDoc.ref, { role: 'superviseur' }, { merge: true });
            }
          }

          // Refetch all users for the UI
          const finalSnapshot = await getDocs(query(usersCollectionRef, orderBy("username")));
          const finalUsers = finalSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as AppUser));
          setDefinedUsers(finalUsers);

        } catch (e) {
          console.error("Fatal error during user setup:", e);
          toast({ title: "Erreur critique lors du chargement des utilisateurs", variant: "destructive" });
        } finally {
          setIsLoading(false);
        }
      };
      loadInitialData();
    }
  }, [isClient, toast]);

  const performLogin = (user: AppUser) => {
    localStorage.clear(); // Clear all old keys to be safe
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('loggedInUsername', user.username);

    let permissionsToStore: Partial<Record<RubricId, boolean>>;
    
    // Special handling for admin remains
    if (user.role === 'admin') {
      permissionsToStore = ALL_RUBRIC_IDS.reduce((acc, rubricId) => ({ ...acc, [rubricId]: true }), {});
    } else {
      // For all other users, including 'superviseur', use the permissions from the database.
      permissionsToStore = user.permissions || {};
    }

    const hourViewConfigToStore = user.viewableHourSummaryConfig || { type: 'none' as const };

    localStorage.setItem(LOGGED_IN_USER_PERMISSIONS_KEY, JSON.stringify(permissionsToStore));
    localStorage.setItem(LOGGED_IN_USER_HOUR_VIEW_CONFIG_KEY, JSON.stringify(hourViewConfigToStore));
    
    router.push('/dashboard');
  };

  const handleUserButtonClick = (user: AppUser) => {
    setError('');
    if (!user.passwordRequired) {
      performLogin(user);
    } else {
      if (!user.simulatedStoredPassword) {
        setError(`Aucun mot de passe n'est configuré pour ${user.username}.`);
        return;
      }
      setSelectedUserForPassword(user);
      setPasswordInput('');
    }
  };

  const handlePasswordLogin = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedUserForPassword) return;

    const enteredPasswordHash = simulatedHash(passwordInput);

    if (selectedUserForPassword.simulatedStoredPassword === enteredPasswordHash) {
      performLogin(selectedUserForPassword);
    } else {
      setError('Mot de passe incorrect.');
    }
  };

  if (!isClient || isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-8 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
        <p className="text-muted-foreground">Mise à jour des utilisateurs...</p>
      </main>
    );
  }
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-8 bg-background">
      {appLogoUrl ? (
        <div className="mb-6">
          <Image
            src={appLogoUrl}
            alt="Logo de l'application"
            width={100}
            height={100}
            className="rounded-lg object-contain max-h-[100px]"
            unoptimized
          />
        </div>
      ) : (
         <Utensils className="w-16 h-16 text-primary mx-auto mb-4" />
      )}
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
           <h1 className="text-4xl font-serif font-bold text-foreground title-glow">
            Gestion par l'excellence
          </h1>
          <CardDescription className="text-md pt-2">
            Bienvenue ! Veuillez sélectionner votre profil pour vous connecter.
          </CardDescription>
          <CurrentDate />
        </CardHeader>
        <CardContent className="mt-2">
          {!selectedUserForPassword ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {definedUsers.length > 0 ? (
                definedUsers.map(user => (
                  <Button
                    key={user.id}
                    variant="outline"
                    className="w-full justify-start text-left py-3 h-auto"
                    onClick={() => handleUserButtonClick(user)}
                    disabled={user.passwordRequired && !user.simulatedStoredPassword}
                  >
                    <User className="mr-3 h-5 w-5 text-muted-foreground" />
                    <span className="flex flex-col">
                      <span className="font-medium">{user.username}</span>
                      <span className="text-xs text-muted-foreground">
                        {user.passwordRequired ? "Mot de passe requis" : "Accès direct"}
                        {user.passwordRequired && !user.simulatedStoredPassword &&
                         <span className="text-destructive text-xs">(Aucun mdp configuré)</span>
                        }
                      </span>
                    </span>
                  </Button>
                ))
              ) : (
                <p className="text-center text-muted-foreground col-span-full">
                  Aucun utilisateur défini.
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={handlePasswordLogin} className="space-y-6">
              <h2 className="text-lg font-medium text-center text-foreground">
                Connexion pour : <span className="font-bold text-primary">{selectedUserForPassword.username}</span>
              </h2>
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative">
                  <LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Saisir votre mot de passe"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    required
                    className="pl-10 bg-card-foreground/5 dark:bg-card-foreground/5"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-destructive text-center">{error}</p>}
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSelectedUserForPassword(null);
                    setError('');
                  }}
                  className="w-full sm:w-auto"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Retour
                </Button>
                <Button type="submit" className="w-full flex-grow">
                  Se Connecter
                </Button>
              </div>
            </form>
          )}
        </CardContent>
        <CardFooter className="text-center text-xs text-muted-foreground pt-6">
          <p>
            {selectedUserForPassword && selectedUserForPassword.username.toLowerCase() === 'chef' && selectedUserForPassword.simulatedStoredPassword === simulatedHash('000')
              ? "Mot de passe par défaut pour Chef : 000" 
              : selectedUserForPassword && selectedUserForPassword.username.toLowerCase() === 'chef de service' && selectedUserForPassword.simulatedStoredPassword === simulatedHash('cds000')
              ? "Mot de passe par défaut pour Chef de service : cds000"
              : selectedUserForPassword ? "Entrez le mot de passe configuré." : "Sélectionnez un utilisateur."
            }
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}
