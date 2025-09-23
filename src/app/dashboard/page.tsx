"use client"; // Add this if not already present

// import Link from 'next/link'; // Removed unused import
import { Button } from '@/components/ui/button';
import { Archive, Settings, FileSpreadsheet, Users, ClipboardList, DollarSign, BookOpenText, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import WeeklyMenuSummary from './components/WeeklyMenuSummary';
import OngoingTasksSummary from './components/OngoingTasksSummary';
import EmployeeHoursSummary from './components/EmployeeHoursSummary';
import PendingPurchaseOrdersSummary from './components/PendingPurchaseOrdersSummary';
import PendingRequestsAlert from './components/PendingRequestsAlert'; 
import ChefNotepad from './components/ChefNotepad'; // Import the new component
import ChefAnnouncementManager from './components/ChefAnnouncementManager'; // Import the new component
import ChefAnnouncementSender from './components/ChefAnnouncementSender'; // Import the new component
import UserNotificationAlerts from './components/UserNotificationAlerts'; // New import for notifications
import { CurrentDate } from '@/components/current-date';
import React, { useState, useEffect, useMemo } from 'react';
import { firestore } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, onSnapshot } from 'firebase/firestore'; // Import onSnapshot
import type { BrigadeMember } from './time-tracking/types';


const LOGGED_IN_USERNAME_KEY = 'loggedInUsername';

export default function DashboardPage() {
  const [isClient, setIsClient] = useState(false);
  const [loggedInUsername, setLoggedInUsername] = useState<string | null>(null);
  const [currentBrigadeMember, setCurrentBrigadeMember] = useState<BrigadeMember | null>(null);
  const [announcements, setAnnouncements] = useState([]); // State for announcements

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

  // Effect to listen for announcements
  useEffect(() => {
    if (!isClient) return;

    const announcementsCollectionRef = collection(firestore, 'announcements');
    const q = query(announcementsCollectionRef, orderBy('timestamp', 'desc')); // Order by timestamp descending

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const announcementsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAnnouncements(announcementsList);
    });

    // Unsubscribe from the listener when the component unmounts
    return () => unsubscribe();

  }, [isClient]); // No dependency on loggedInUsername needed for fetching all announcements

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
          {loggedInUsername ? `Bonjour et Bienvenue ${loggedInUsername}` : 'Bonjour'}
        </h1>
        <p className="text-lg text-muted-foreground mb-3">Bon courage pour cette Nouvelle belle journée !</p>
        <CurrentDate />
      </div>

      <PendingRequestsAlert loggedInUsername={loggedInUsername} />
      <UserNotificationAlerts brigadeMemberId={currentBrigadeMember?.id} />

      {/* Display Announcements */}
      {announcements.length > 0 && (
        <div className="mb-8 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700">
          <div className="flex items-center mb-2">
            <span className="flex-shrink-0 mr-2 text-yellow-600 animate-pulse"> {/* Blinking attention icon */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
            <h2 className="text-lg font-semibold">Annonces importantes :</h2>
          </div>
          {announcements.map((announcement: any) => ( // Add type annotation for announcement
            <p key={announcement.id} className="mb-1 text-sm">- {announcement.content} (par {announcement.sender})</p>
          ))}
        </div>
      )}
      {/* Grid for summaries and notepad */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {isChef && <ChefNotepad />}
        <WeeklyMenuSummary />
        <OngoingTasksSummary />
        <EmployeeHoursSummary />
        <PendingPurchaseOrdersSummary />
      </div>
      
      {/* Conditional rendering of the announcement sender */}
      {isChef && <ChefAnnouncementSender />}
      
      {/* Conditional rendering of the announcement manager */}
      {isChef && <ChefAnnouncementManager />}

      <p className="mb-6 text-md text-muted-foreground max-w-2xl">
        Utilisez la barre de navigation latérale pour accéder aux différentes sections de l'application.
      </p>
      
    </div>
  );
}
