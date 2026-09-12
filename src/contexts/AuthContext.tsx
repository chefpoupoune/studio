"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { firestore } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { AppUser } from '@/app/dashboard/settings/components/user-management';

interface AuthContextType {
  currentUser: AppUser | null;
  isLoading: boolean;
  isReadOnly: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const pathname = usePathname(); // Hook pour détecter les changements d'URL

  useEffect(() => {
    setIsClient(true);
    
    const fetchUser = async () => {
      setIsLoading(true); // On commence le chargement
      const loggedInUsername = localStorage.getItem('loggedInUsername');

      if (!loggedInUsername) {
        setCurrentUser(null); // S'assurer que l'utilisateur est bien déconnecté
        setIsLoading(false);
        return;
      }

      try {
        const usersRef = collection(firestore, 'appUsers');
        const q = query(usersRef, where("username", "==", loggedInUsername));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          const userData = { id: userDoc.id, ...userDoc.data() } as AppUser;
          setCurrentUser(userData);
        } else {
          setCurrentUser(null); // Si l'utilisateur n'est pas trouvé en DB
        }
      } catch (error) {
        console.error("Failed to fetch user data from Firestore:", error);
        setCurrentUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [pathname]); // <-- Dépendance au changement de page

  const isReadOnly = isLoading || !currentUser || currentUser.role !== 'admin';

  if (!isClient) {
      return null;
  }

  return (
    <AuthContext.Provider value={{ currentUser, isLoading, isReadOnly }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
