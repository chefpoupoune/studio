"use client"; // Add this if not already present

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Archive, Settings, FileSpreadsheet, Users, ClipboardList, DollarSign, BookOpenText, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import WeeklyMenuSummary from './components/WeeklyMenuSummary';
import OngoingTasksSummary from './components/OngoingTasksSummary';
import EmployeeHoursSummary from './components/EmployeeHoursSummary';
import PendingPurchaseOrdersSummary from './components/PendingPurchaseOrdersSummary';
import PendingRequestsAlert from './components/PendingRequestsAlert'; 
import ChefNotepad from './components/ChefNotepad'; // Import the new component
import UserNotificationAlerts from './components/UserNotificationAlerts'; // New import for notifications
import { CurrentDate } from '@/components/current-date';
import React, { useState, useEffect, useMemo } from 'react'; 
import { firestore } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import type { BrigadeMember } from './time-tracking/types';


const LOGGED_IN_USERNAME_KEY = 'loggedInUsername';

export default function DashboardPage() {
  const [isClient, setIsClient] = useState(false);
  const [loggedInUsername, setLoggedInUsername] = useState<string | null>(null);
  const [currentBrigadeMember, setCurrentBrigadeMember] = useState<BrigadeMember | null>(null);

  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
      setLoggedInUsername(localStorage.getItem(LOGGED_IN_USERNAME_KEY));
    }
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const fetchBrigadeMemberData = async () => {
      if (!loggedInUsername) {
          setCurrentBrigadeMember(null);
          return;
      };
      
      try {
        const membersCollectionRef = collection(firestore, 'brigadeMembers');
        const q = query(membersCollectionRef, orderBy("name"));
        const querySnapshot = await getDocs(q);
        const membersList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BrigadeMember));
        const matchingMember = membersList.find(m => m.name.toLowerCase() === loggedInUsername.toLowerCase());
        
        if (matchingMember) {
          setCurrentBrigadeMember(matchingMember);
        } else if (loggedInUsername.toLowerCase() === 'chef' || loggedInUsername.toLowerCase() === 'chef de service') {
          // The Chef or CDS might not have a direct brigade member entry. We can use a special ID.
          // Or we can just pass their username and let components decide what to do.
          // For notifications, we need a stable ID. Let's assume Chef/CDS also have a brigadeMember entry if they need personal notifications.
          // If not, we can create a virtual one.
          // For now, let's assume they might not have a member ID, and the component will handle it.
           setCurrentBrigadeMember({ id: loggedInUsername, name: loggedInUsername, role: "Admin", assignedScheduleTemplateIds: [] });
        } else {
           setCurrentBrigadeMember(null);
        }

      } catch (e) {
        console.error("Error fetching current user's brigade member data:", e);
        setCurrentBrigadeMember(null);
      }
    };
    
    fetchBrigadeMemberData();

  }, [isClient, loggedInUsername]);

  if (!isClient) {
    // Optional: Return a loading state or null if you don't want to show anything pre-hydration
    return (
      <div className="flex flex-col min-h-screen p-4 md:p-6 lg:p-8">
        <p className="text-muted-foreground">Chargement du tableau de bord...</p>
      </div>
    );
  }

  const isChef = loggedInUsername?.toLowerCase() === 'chef';

  return (
    <div className="flex flex-col min-h-screen p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground title-glow mb-2">
          {loggedInUsername ? `Bonjour ${loggedInUsername}` : 'Bonjour'}
        </h1>
        <p className="text-lg text-muted-foreground mb-3">Bon courage pour cette journée !</p>
        <CurrentDate />
      </div>

      <PendingRequestsAlert loggedInUsername={loggedInUsername} />
      <UserNotificationAlerts brigadeMemberId={currentBrigadeMember?.id} />

      {/* Grid for summaries and notepad */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {isChef && <ChefNotepad />}
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
