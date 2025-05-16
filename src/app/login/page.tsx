
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { LockKeyhole } from 'lucide-react'; // Using a relevant icon

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  // If already logged in, redirect to dashboard
  useEffect(() => {
    if (localStorage.getItem('isLoggedIn') === 'true') {
      router.push('/dashboard');
    }
  }, [router]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'chef' && password === '000') {
      localStorage.setItem('isLoggedIn', 'true');
      router.push('/dashboard');
    } else {
      setError('Nom d\'utilisateur ou mot de passe incorrect.');
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-8 bg-background">
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <LockKeyhole className="w-16 h-16 text-primary" />
          </div>
          <CardTitle className="text-2xl font-serif title-glow">Connexion Requise</CardTitle>
          <CardDescription>Veuillez vous connecter pour accéder au tableau de bord.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username">Nom d'utilisateur</Label>
              <Input
                id="username"
                type="text"
                placeholder="chef"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="bg-card-foreground/5 dark:bg-card-foreground/5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="•••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-card-foreground/5 dark:bg-card-foreground/5"
              />
            </div>
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <Button type="submit" className="w-full">
              Se Connecter
            </Button>
          </form>
        </CardContent>
        <CardFooter className="text-center text-xs text-muted-foreground pt-4">
            <p>Pour la démo, utilisez 'chef' et '000'.</p>
        </CardFooter>
      </Card>
    </main>
  );
}
