'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import WeeklyMenuSummary from './components/WeeklyMenuSummary';
import OngoingTasksSummary from './components/OngoingTasksSummary';
import EmployeeHoursSummary from './components/EmployeeHoursSummary';
import PendingPurchaseOrdersSummary from './components/PendingPurchaseOrdersSummary';
import PendingRequestsAlert from './components/PendingRequestsAlert';
import DailyPlanningSummary from './components/DailyPlanningSummary';
import ChefNotepad from './components/ChefNotepad';
import ChefReminders from './components/ChefReminders';
import ChefAnnouncementManager from './components/ChefAnnouncementManager';
import ChefAnnouncementSender from './components/ChefAnnouncementSender';
import UserNotificationAlerts from './components/UserNotificationAlerts';
import UpcomingAbsences from './components/UpcomingAbsences';
import { CurrentDate } from '@/components/current-date';
import { firestore } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, onSnapshot } from 'firebase/firestore';
import type { BrigadeMember } from './time-tracking/types';
import EffectifForm from './effectifs/components/EffectifForm';
import { getEffectifsForMonth } from './effectifs/services';
import type { Effectif } from './effectifs/types';
import { useMediaQuery } from '@/hooks/use-media-query';

const LOGGED_IN_USERNAME_KEY = 'loggedInUsername';

export default function DashboardPage() {
  const [isClient, setIsClient] = useState(false);
  const [loggedInUsername, setLoggedInUsername] = useState<string | null>(null);
  const [currentBrigadeMember, setCurrentBrigadeMember] = useState<BrigadeMember | null>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  const [isEffectifDialogOpen, setIsEffectifDialogOpen] = useState(false);
  const [effectifs, setEffectifs] = useState<Effectif[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const isMobile = useMediaQuery('(max-width: 768px)');

  const fetchEffectifs = async () => {
    const data = await getEffectifsForMonth(selectedDate);
    setEffectifs(data);
  };

  const handleEffectifSave = () => {
    fetchEffectifs();
    // La fermeture est déjà gérée ici, mais le setOpen dans le formulaire
    // permet une fermeture plus fluide dès la réponse du serveur.
    setIsEffectifDialogOpen(false);
  };

  useEffect(() => {
    if (isEffectifDialogOpen) {
      fetchEffectifs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEffectifDialogOpen]);

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
      }

      try {
        const membersCollectionRef = collection(firestore, 'brigadeMembers');
        const q = query(membersCollectionRef, orderBy("name"));
        const querySnapshot = await getDocs(q);
        const membersList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BrigadeMember));
        const matchingMember = membersList.find(m => m.name.toLowerCase() === loggedInUsername.toLowerCase());

        if (matchingMember) {
          setCurrentBrigadeMember(matchingMember);
        } else if (loggedInUsername.toLowerCase() === 'chef' || loggedInUsername.toLowerCase() === 'chef de service') {
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

  useEffect(() => {
    if (!isClient) return;

    const announcementsCollectionRef = collection(firestore, 'announcements');
    const q = query(announcementsCollectionRef, orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const announcementsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAnnouncements(announcementsList);
    });

    return () => unsubscribe();

  }, [isClient]);

  if (!isClient) {
    return (
      <div className="flex flex-col min-h-screen p-4 md:p-6 lg:p-8">
        <p className="text-muted-foreground">Chargement du tableau de bord...</p>
      </div>
    );
  }

  const isChef = loggedInUsername?.toLowerCase() === 'chef';
  const isMarieLegrand = loggedInUsername?.toLowerCase() === 'marie legrand';

  return (
    <div className="flex flex-col min-h-screen p-4 md:p-6 lg:p-8">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground title-glow mb-2">
            {loggedInUsername ? `Bonjour et Bienvenue ${loggedInUsername}` : 'Bonjour'}
          </h1>
          <p className="text-lg text-muted-foreground mb-3">Bon courage pour cette Nouvelle belle journée !</p>
          <CurrentDate />
        </div>
        <div className="flex items-start space-x-4">
          {!isMobile && <UpcomingAbsences />}
          {(isChef || isMarieLegrand) && (
            <Dialog open={isEffectifDialogOpen} onOpenChange={setIsEffectifDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                  <UserPlus className="h-6 w-6" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Saisie des Effectifs</DialogTitle>
                </DialogHeader>
                {/* AJOUT DE setOpen={setIsEffectifDialogOpen} ICI */}
                <EffectifForm 
                  onEffectifSave={handleEffectifSave} 
                  setOpen={setIsEffectifDialogOpen} 
                  initialDate={selectedDate} 
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <PendingRequestsAlert loggedInUsername={loggedInUsername} />
      <UserNotificationAlerts brigadeMemberId={currentBrigadeMember?.id} />

      {/* ... reste du code identique ... */}
      {announcements.length > 0 && (
        <div className="mb-8 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700">
          <div className="flex items-center mb-2">
            <span className="flex-shrink-0 mr-2 text-yellow-600 animate-pulse">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
            <h2 className="text-lg font-semibold">Annonces importantes :</h2>
          </div>
          {announcements.map((announcement: any) => (
            <p key={announcement.id} className="mb-1 text-sm">- {announcement.content} (par {announcement.sender})</p>
          ))}
        </div>
      )}

      {isChef && (
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <DailyPlanningSummary />
          <ChefNotepad />
          <ChefReminders />
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <WeeklyMenuSummary />
        {isMobile && <UpcomingAbsences />}
        <div className="lg:col-span-2">
          <OngoingTasksSummary />
        </div>
        <EmployeeHoursSummary />
        <PendingPurchaseOrdersSummary />
      </div>

      {isChef && <ChefAnnouncementSender />}
      {isChef && <ChefAnnouncementManager />}

      <p className="mb-6 text-md text-muted-foreground max-w-2xl">
        Utilisez la barre de navigation latérale pour accéder aux différentes sections de l'application.
      </p>
    </div>
  );
}