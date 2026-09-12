"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

// 1. Définir le type pour la valeur du contexte
interface ReadOnlyContextType {
  isReadOnly: boolean;
}

// 2. Créer le contexte avec une valeur par défaut
const ReadOnlyContext = createContext<ReadOnlyContextType>({ isReadOnly: false });

// 3. Créer le fournisseur de contexte (Provider)
export const ReadOnlyProvider = ({ children }: { children: React.ReactNode }) => {
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Ce code ne s'exécute que côté client
    setIsClient(true);
    const username = localStorage.getItem('loggedInUsername');
    if (username === 'Chef de service') {
      setIsReadOnly(true);
    }
  }, []);

  // Ne pas rendre les enfants tant que le statut côté client n'est pas vérifié
  // pour éviter les incohérences de rendu entre le serveur et le client (hydration mismatch)
  if (!isClient) {
    return null; // Ou un loader global si vous préférez
  }

  return (
    <ReadOnlyContext.Provider value={{ isReadOnly }}>
      {children}
    </ReadOnlyContext.Provider>
  );
};

// 4. Créer le hook personnalisé pour utiliser le contexte
export const useIsReadOnly = () => {
  const context = useContext(ReadOnlyContext);
  if (context === undefined) {
    throw new Error('useIsReadOnly must be used within a ReadOnlyProvider');
  }
  return context.isReadOnly;
};
