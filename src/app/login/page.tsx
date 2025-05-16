
"use client";

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { User, LockKeyhole, ArrowLeft } from 'lucide-react';
import { CurrentDate } from '@/components/current-date';
import { useToast } from '@/hooks/use-toast';

// Key used in UserManagement to store defined users
const APP_USERS_STORAGE_KEY = 'app_defined_users_v1';

// Simplified user type for login purposes
interface LoginAppUser {
  id: string;
  username: string;
  passwordRequired: boolean;
  // permissions are not needed for login logic
}

export default function LoginPage() {
  const [definedUsers, setDefinedUsers] = useState<LoginAppUser[]>([]);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<LoginAppUser | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [error, setError] = useState('');
  const [isClient, setIsClient] = useState(false);
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

      let users: LoginAppUser[] = [];
      try {
        const storedUsersRaw = localStorage.getItem(APP_USERS_STORAGE_KEY);
        if (storedUsersRaw) {
          const parsedUsers = JSON.parse(storedUsersRaw);
          // Ensure parsedUsers is an array and items have expected props
          if (Array.isArray(parsedUsers)) {
            users = parsedUsers.filter(
              (u: any) => u && typeof u.id === 'string' && typeof u.username === 'string' && typeof u.passwordRequired === 'boolean'
            ).map((u: any) => ({
              id: u.id,
              username: u.username,
              passwordRequired: u.passwordRequired,
            }));
          }
        }
      } catch (e) {
        console.error("Error loading users from localStorage:", e);
        toast({ title: "Erreur de chargement des utilisateurs", variant: "destructive"});
      }

      // Ensure 'chef' user is always available for login
      const chefUserExists = users.some(u => u.username.toLowerCase() === 'chef');
      if (!chefUserExists) {
        users.push({ id: 'default_chef', username: 'Chef', passwordRequired: true });
      }
      setDefinedUsers(users);
    }
  }, [isClient, router, toast]);

  const performLogin = (username: string) => {
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('loggedInUsername', username);
    router.push('/dashboard');
  };

  const handleUserButtonClick = (user: LoginAppUser) => {
    setError('');
    if (!user.passwordRequired) {
      performLogin(user.username);
    } else {
      setSelectedUserForPassword(user);
      setPasswordInput(''); // Clear password field when a new user is selected
    }
  };

  const handlePasswordLogin = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedUserForPassword) return;

    if (selectedUserForPassword.username.toLowerCase() === 'chef' && passwordInput === '000') {
      performLogin(selectedUserForPassword.username);
    } else if (selectedUserForPassword.username.toLowerCase() !== 'chef' && selectedUserForPassword.passwordRequired && passwordInput.length > 0) {
      // For other users requiring password, accept any non-empty password (simulation)
      performLogin(selectedUserForPassword.username);
      toast({ title: "Connexion Réussie (Simulation)", description: `Mot de passe simulé accepté pour ${selectedUserForPassword.username}.`});
    } else if (selectedUserForPassword.username.toLowerCase() === 'chef') {
      setError('Mot de passe incorrect pour Chef.');
    } else {
      setError('Mot de passe requis ou incorrect (simulation).');
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
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <h1 className="text-4xl font-serif font-bold text-foreground title-glow mb-2">
            Gestion par l'excellence
          </h1>
          <CurrentDate />
        </CardHeader>
        <CardContent className="mt-4">
          {!selectedUserForPassword ? (
            <>
              <CardDescription className="text-center mb-6">
                Veuillez sélectionner un utilisateur pour vous connecter.
              </CardDescription>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {definedUsers.length > 0 ? (
                  definedUsers.map(user => (
                    <Button
                      key={user.id}
                      variant="outline"
                      className="w-full justify-start text-left py-3 h-auto"
                      onClick={() => handleUserButtonClick(user)}
                    >
                      <User className="mr-3 h-5 w-5 text-muted-foreground" />
                      <span className="flex flex-col">
                        <span className="font-medium">{user.username}</span>
                        <span className="text-xs text-muted-foreground">
                          {user.passwordRequired ? "Mot de passe requis" : "Accès direct"}
                        </span>
                      </span>
                    </Button>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground col-span-full">Chargement des utilisateurs...</p>
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
            {selectedUserForPassword && selectedUserForPassword.username.toLowerCase() === 'chef' 
              ? "Mot de passe par défaut pour Chef : 000" 
              : selectedUserForPassword && selectedUserForPassword.passwordRequired 
              ? "Simulation : Entrez n'importe quel mot de passe."
              : "Sélectionnez un utilisateur."
            }
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}
