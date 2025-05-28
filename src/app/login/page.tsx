
"use client";

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { User, LockKeyhole, ArrowLeft, Utensils } from 'lucide-react';
import { CurrentDate } from '@/components/current-date';
import { useToast } from '@/hooks/use-toast';
import type { AppUser, RubricId, ViewableHourSummaryConfig } from '@/app/dashboard/settings/components/user-management';
import { RUBRICS, TIME_TRACKING_SUB_RUBRICS, ALL_RUBRIC_IDS } from '@/app/dashboard/settings/components/user-management';


const APP_USERS_STORAGE_KEY = 'app_defined_users_v2';
const LOGGED_IN_USER_PERMISSIONS_KEY = 'loggedInUserPermissions';
const LOGGED_IN_USER_HOUR_VIEW_CONFIG_KEY = 'loggedInUserHourViewConfig';
const APP_LOGO_STORAGE_KEY = "app_config_app_logo_url_v1";

const simulatedHash = (password: string): string => `sim_hashed_${password}_!`;


export default function LoginPage() {
  const [definedUsers, setDefinedUsers] = useState<AppUser[]>([]);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<AppUser | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [error, setError] = useState('');
  const [isClient, setIsClient] = useState(false);
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

      const storedAppLogo = localStorage.getItem(APP_LOGO_STORAGE_KEY);
      if (storedAppLogo) {
          setAppLogoUrl(storedAppLogo);
      }

      let users: AppUser[] = [];
      try {
        const storedUsersRaw = localStorage.getItem(APP_USERS_STORAGE_KEY);
        if (storedUsersRaw) {
          const parsedUsers = JSON.parse(storedUsersRaw);
          if (Array.isArray(parsedUsers)) {
            users = parsedUsers.map((u: any) => ({ 
              id: u.id || `imported_user_${Math.random().toString(36).substring(7)}`,
              username: u.username || "Utilisateur Inconnu",
              brigadeMemberId: u.brigadeMemberId,
              passwordRequired: typeof u.passwordRequired === 'boolean' ? u.passwordRequired : false,
              simulatedStoredPassword: u.simulatedStoredPassword,
              permissions: u.permissions || {},
              viewableHourSummaryConfig: u.viewableHourSummaryConfig || { type: 'none' },
            }));
          }
        }
      } catch (e) {
        console.error("Error loading users from localStorage:", e);
        toast({ title: "Erreur de chargement des utilisateurs", variant: "destructive"});
      }

      const chefUserExists = users.some(u => u.username.toLowerCase() === 'chef');
      const defaultChefPermissions = ALL_RUBRIC_IDS.reduce((acc, rubricId) => {
          acc[rubricId] = true;
          return acc;
      }, {} as Partial<Record<RubricId, boolean>>);
      

      if (!chefUserExists) {
        users.unshift({ 
          id: 'default_chef', 
          username: 'Chef', 
          passwordRequired: true, 
          simulatedStoredPassword: simulatedHash('000'),
          permissions: defaultChefPermissions,
          viewableHourSummaryConfig: { type: 'all' },
        });
      } else {
         users = users.map(u => {
            if (u.username.toLowerCase() === 'chef') {
                return {
                    ...u,
                    passwordRequired: true, 
                    simulatedStoredPassword: u.simulatedStoredPassword || simulatedHash('000'),
                    permissions: defaultChefPermissions, 
                    viewableHourSummaryConfig: { type: 'all' },
                };
            }
            return u;
        });
      }
      setDefinedUsers(users.sort((a,b) => a.username.localeCompare(b.username)));
    }
  }, [isClient, router, toast]);

  const performLogin = (user: AppUser) => {
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('loggedInUsername', user.username);
    
    let permissionsToStore = { ...user.permissions };
    let hourViewConfigToStore = user.viewableHourSummaryConfig || { type: 'none' as const };

    if (user.username.toLowerCase() === 'chef') {
        permissionsToStore = ALL_RUBRIC_IDS.reduce((acc, rubricId) => {
            acc[rubricId] = true;
            return acc;
        }, {} as Partial<Record<RubricId, boolean>>);
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


  if (!isClient) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-8 bg-background">
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
            className="rounded-lg object-contain"
            data-ai-hint="application logo"
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
            Bienvenue ! Veuillez sélectionner un utilisateur pour vous connecter.
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
                      disabled={user.passwordRequired && !user.simulatedStoredPassword && user.username.toLowerCase() !== 'chef'}
                    >
                      <User className="mr-3 h-5 w-5 text-muted-foreground" />
                      <span className="flex flex-col">
                        <span className="font-medium">{user.username}</span>
                        <span className="text-xs text-muted-foreground">
                          {user.passwordRequired ? "Mot de passe requis" : "Accès direct"}
                          {user.passwordRequired && !user.simulatedStoredPassword && user.username.toLowerCase() !== 'chef' && 
                           <span className="text-destructive text-xs">(Aucun mdp défini)</span>
                          }
                        </span>
                      </span>
                    </Button>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground col-span-full">Aucun utilisateur défini. Contactez un administrateur.</p>
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
            {selectedUserForPassword && selectedUserForPassword.username.toLowerCase() === 'chef' && !definedUsers.find(u => u.username.toLowerCase() === 'chef')?.simulatedStoredPassword
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
