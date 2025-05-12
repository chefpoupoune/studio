"use client";

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function CurrentDate() {
  const [currentDate, setCurrentDate] = useState<string>('');

  useEffect(() => {
    // Set date only on client-side after mount
    setCurrentDate(format(new Date(), "EEEE d MMMM yyyy", { locale: fr }));
  }, []);

  if (!currentDate) {
    return (
      <p className="text-lg md:text-xl font-light text-muted-foreground animate-pulse">
        Chargement de la date...
      </p>
    );
  }

  return (
    <p className="text-lg md:text-xl font-light text-muted-foreground">
      {currentDate}
    </p>
  );
}
