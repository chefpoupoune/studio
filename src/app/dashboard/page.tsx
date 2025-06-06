
"use client"; // Add this if not already present

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Archive, Settings, FileSpreadsheet, Users, ClipboardList, DollarSign, BookOpenText, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import WeeklyMenuSummary from './components/WeeklyMenuSummary';
import OngoingTasksSummary from './components/OngoingTasksSummary';
import EmployeeHoursSummary from './components/EmployeeHoursSummary';
import PendingPurchaseOrdersSummary from './components/PendingPurchaseOrdersSummary';
import PendingRequestsAlert from './components/PendingRequestsAlert'; // New Import
import { CurrentDate } from '@/components/current-date';
import React, { useState, useEffect } from 'react'; // Added useEffect and useState

const LOGGED_IN_USERNAME_KEY = 'loggedInUsername';

export default function DashboardPage() {
  const [isClient, setIsClient] = useState(false);
  const [loggedInUsername, setLoggedInUsername] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
      setLoggedInUsername(localStorage.getItem(LOGGED_IN_USERNAME_KEY));
    }
  }, []);

  if (!isClient) {
    // Optional: Return a loading state or null if you don't want to show anything pre-hydration
    return (
      <div className="flex flex-col min-h-screen p-4 md:p-6 lg:p-8">
        <p className="text-muted-foreground">Chargement du tableau de bord...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground title-glow mb-2">
          {loggedInUsername ? `Bonjour ${loggedInUsername}` : 'Bonjour'}
        </h1>
        <p className="text-lg text-muted-foreground mb-3">Bon courage pour cette journée !</p>
        <CurrentDate />
      </div>

      <PendingRequestsAlert loggedInUsername={loggedInUsername} /> {/* Added new component */}

      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <WeeklyMenuSummary />
        <OngoingTasksSummary />
        <EmployeeHoursSummary />
        <PendingPurchaseOrdersSummary />
      </div>

      <p className="mb-6 text-md text-muted-foreground max-w-2xl">
        Utilisez la barre de navigation latérale pour accéder aux différentes sections de l'application.
      </p>
      
    </div>
  );
}
