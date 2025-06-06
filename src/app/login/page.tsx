
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
import { collection, getDocs, query, orderBy, doc, setDoc, addDoc, getDoc } from 'firebase/firestore'; // Added getDoc

// Firestore constants for app settings
const APP_SETTINGS_COLLECTION = "appSettings";
const GLOBAL_APP_SETTINGS_DOC_ID = "globalAppSettings";
// APP_LOGO_STORAGE_KEY removed

const simulatedHash = (password: string): string => `sim_hashed_${password}_!`;
const DEFAULT_CHEF_ID_FIRESTORE = 'default_chef_user_id';

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
      if (localStorage.getItem('isLoggedIn') === 'true') {
        router.push('/dashboard');
        return;
      }

      const loadInitialData = async () => {
        setIsLoading(true);
        // Load App Logo from Firestore
        const settingsDocRef = doc(firestore, APP_SETTINGS_COLLECTION, GLOBAL_APP_SETTINGS_DOC_ID);
        try {
          const docSnap = await getDoc(settingsDocRef);
          if (docSnap.exists()) {
            const settingsData = docSnap.data();
            if (settingsData && settingsData.appLogoUrl) {
              setAppLogoUrl(settingsData.appLogoUrl);
            } else {
              setAppLogoUrl(null);
            }
          } else {
            setAppLogoUrl(null); // No settings doc, no logo
          }
        } catch (logoError) {
          console.error("Error loading app logo from Firestore on login page:", logoError);
          setAppLogoUrl(null); // Fallback to no logo on error
        }

        // Fetch Users
        let usersFromDb: AppUser[] = [];
        try {
          const usersCollectionRef = collection(firestore, 'appUsers');
          const q = query(usersCollectionRef, orderBy("username"));
          const querySnapshot = await getDocs(q);
          usersFromDb = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as AppUser));
        } catch (e) {
          console.error("Error loading users from Firestore for login:", e);
          toast({ title: "Erreur de chargement des utilisateurs", variant: "destructive"});
        }

        const defaultChefPermissions = ALL_RUBRIC_IDS.reduce((acc, rubricId) => ({ ...acc, [rubricId]: true }), {});
        let chefUserInDb = usersFromDb.find(u => u.username.toLowerCase() === 'chef');

        if (!chefUserInDb) {
          const defaultChefForCreation: Omit<AppUser, 'id'> = {
            username: 'Chef', 
            passwordRequired: true, 
            simulatedStoredPassword: simulatedHash('000'),
            permissions: defaultChefPermissions,
            viewableHourSummaryConfig: { type: 'all' },
          };
          try {
            const chefDocRef = await addDoc(collection(firestore, "appUsers"), defaultChefForCreation);
            const newChefUser = { ...defaultChefForCreation, id: chefDocRef.id };
            usersFromDb.push(newChefUser); 
            chefUserInDb = newChefUser; 
            toast({ title: "Compte Chef Initialisé", description: "Le compte Chef par défaut (mdp: 000) a été créé."});
          } catch (createError) {
            console.error("Error creating default Chef user in Firestore:", createError);
            toast({ title: "Erreur Initialisation Chef", description: "Impossible de créer le compte Chef par défaut.", variant: "destructive"});
            const defaultChefForDisplay: AppUser = { 
              id: DEFAULT_CHEF_ID_FIRESTORE, 
              username: 'Chef', 
              passwordRequired: true, 
              simulatedStoredPassword: simulatedHash('000'), 
              permissions: defaultChefPermissions,
              viewableHourSummaryConfig: { type: 'all' },
            };
            if (!usersFromDb.find(u => u.username.toLowerCase() === 'chef')) { 
                 usersFromDb.push(defaultChefForDisplay);
            }
            chefUserInDb = defaultChefForDisplay; 
          }
        }
        
        if (chefUserInDb) {
           usersFromDb = usersFromDb.map(u => {
              if (u.username.toLowerCase() === 'chef') {
                  return {
                      ...u,
                      passwordRequired: true, 
                      simulatedStoredPassword: u.simulatedStoredPassword || simulatedHash('000'),
                      permissions: defaultChefPermissions, 
                      viewableHourSummaryConfig: { type: 'all' as const },
                  };
              }
              return u;
          });
        }
        setDefinedUsers(usersFromDb.sort((a,b) => a.username.localeCompare(b.username)));
        setIsLoading(false);
      };

      loadInitialData();
    }
  }, [isClient, router, toast]);

  const performLogin = (user: AppUser) => {
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('loggedInUsername', user.username);
    
    let permissionsToStore: Partial<Record<RubricId, boolean>> = { ...user.permissions };
    let hourViewConfigToStore: ViewableHourSummaryConfig = user.viewableHourSummaryConfig || { type: 'none' as const };

    if (user.username.toLowerCase() === 'chef') {
        permissionsToStore = ALL_RUBRIC_IDS.reduce((acc, rubricId) => ({ ...acc, [rubricId]: true }), {});
        hourViewConfigToStore = { type: 'all' as const };
    }
    
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
          setError(`Aucun mot de passe n'est configuré pour ${user.username}. Veuillez contacter l'administrateur.`);
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
        <p className="text-muted-foreground">Chargement...</p>
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
            className="rounded-lg object-contain max-h-[100px]" // Added max-h for consistency
            data-ai-hint="application logo" // This hint is fine
            unoptimized 
          />
        </div>
      ) : (
         <Utensils className="w-16 h-16 text-primary mx-auto mb-4" data-ai-hint="restaurant utensil" />
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
            <>
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
            </>
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
              : selectedUserForPassword && selectedUserForPassword.passwordRequired && !selectedUserForPassword.simulatedStoredPassword
              ? "Aucun mot de passe défini pour cet utilisateur. Veuillez configurer dans les paramètres."
              : selectedUserForPassword ? "Entrez le mot de passe configuré." : "Sélectionnez un utilisateur."
            }
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}
