
"use client";

import Link from 'next/link';
import { Users, Clock, UserCheck, FileText, CalendarClock, Loader2 } from 'lucide-react'; 
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ManageBrigadeMembers from './components/manage-brigade-members';
import RecordTimeLog from './components/record-time-log';
import MemberSummaryPdf from './components/member-summary-pdf';
import ManageWorkSchedules from './components/manage-work-schedules';
import type { BrigadeMember, TimeEntry, WeeklyWorkSchedule } from './types';
import React, { useState, useEffect, useCallback } from 'react';
import { CurrentDate } from '@/components/current-date';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { RubricId, ViewableHourSummaryConfig } from '@/app/dashboard/settings/components/user-management';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useIsMobile } from '@/hooks/use-mobile';
import { firestore } from '@/lib/firebase';
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy,
  Timestamp,
  writeBatch
} from 'firebase/firestore';


const LOGGED_IN_USER_PERMISSIONS_KEY = 'loggedInUserPermissions';
const LOGGED_IN_USERNAME_KEY = 'loggedInUsername';
const LOGGED_IN_USER_HOUR_VIEW_CONFIG_KEY = 'loggedInUserHourViewConfig';
const VIRTUAL_CHEF_ID = 'chef_virtual_user_id'; // Consistent virtual ID

interface TimeTrackingTab {
  value: string;
  label: string;
  Icon: React.ElementType;
  component: React.ReactNode;
  permissionKey: RubricId | 'always_visible_for_chef';
}


export default function TimeTrackingPage() {
  const [brigadeMembers, setBrigadeMembers] = useState<BrigadeMember[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [scheduleTemplates, setScheduleTemplates] = useState<WeeklyWorkSchedule[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [userPermissions, setUserPermissions] = useState<Partial<Record<RubricId, boolean>>>({});
  const [loggedInUsername, setLoggedInUsername] = useState<string | null>(null);
  const [loggedInUserHourViewConfig, setLoggedInUserHourViewConfig] = useState<ViewableHourSummaryConfig | null>(null);
  const [isLoadingMembers, setIsLoadingMembers] = useState(true);
  const [isLoadingScheduleTemplates, setIsLoadingScheduleTemplates] = useState(true);
  const [isLoadingTimeEntries, setIsLoadingTimeEntries] = useState(true); 
  const { toast } = useToast();
  const isMobile = useIsMobile();
  

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    if (isClient) {
      try {
        const storedPermissionsRaw = localStorage.getItem(LOGGED_IN_USER_PERMISSIONS_KEY);
        if (storedPermissionsRaw) setUserPermissions(JSON.parse(storedPermissionsRaw));
        
        const username = localStorage.getItem(LOGGED_IN_USERNAME_KEY);
        setLoggedInUsername(username);

        const storedHourViewConfigRaw = localStorage.getItem(LOGGED_IN_USER_HOUR_VIEW_CONFIG_KEY);
        if (storedHourViewConfigRaw) setLoggedInUserHourViewConfig(JSON.parse(storedHourViewConfigRaw));
      } catch (e) {
        console.error("Error loading non-Firestore data from localStorage (Time Tracking)", e);
        toast({ title: "Erreur de chargement des configurations", description: "Certaines données de configuration n'ont pu être chargées.", variant: "destructive" });
      }
    }
  }, [isClient, toast]);

  const fetchBrigadeMembers = useCallback(async () => {
    if (!isClient) return;
    setIsLoadingMembers(true);
    try {
      const membersCollectionRef = collection(firestore, 'brigadeMembers');
      const q = query(membersCollectionRef, orderBy("name"));
      const querySnapshot = await getDocs(q);
      let membersList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BrigadeMember));
      membersList = membersList.map((m: any) => ({ ...m, assignedScheduleTemplateIds: Array.isArray(m.assignedScheduleTemplateIds) ? m.assignedScheduleTemplateIds : [] }));
      
      // Add virtual Chef if loggedInUsername is 'Chef' and Chef is not already in the list
      if (loggedInUsername?.toLowerCase() === 'chef' && !membersList.some(m => m.name.toLowerCase() === 'chef')) {
        const virtualChefMember: BrigadeMember = {
          id: VIRTUAL_CHEF_ID,
          name: 'Chef',
          role: 'Administrateur',
          assignedScheduleTemplateIds: [] 
        };
        membersList.push(virtualChefMember);
      }
      
      setBrigadeMembers(membersList.sort((a,b) => a.name.localeCompare(b.name)));
      console.log("TimeTrackingPage: Brigade members processed (Firestore + virtual Chef if needed):", membersList.length);
    } catch (error) {
      console.error("Error fetching brigade members from Firestore:", error);
      toast({ title: "Erreur de chargement des membres", variant: "destructive" });
      if (loggedInUsername?.toLowerCase() === 'chef') {
        setBrigadeMembers([{ id: VIRTUAL_CHEF_ID, name: 'Chef', role: 'Administrateur', assignedScheduleTemplateIds: [] }]);
      } else {
        setBrigadeMembers([]);
      }
    } finally {
      setIsLoadingMembers(false);
    }
  }, [isClient, toast, loggedInUsername]);

  const fetchScheduleTemplates = useCallback(async () => {
    if (!isClient) return;
    setIsLoadingScheduleTemplates(true);
    try {
      const templatesCollectionRef = collection(firestore, 'timeTrackingScheduleTemplates');
      const q = query(templatesCollectionRef, orderBy("name"));
      const querySnapshot = await getDocs(q);
      const templatesList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WeeklyWorkSchedule));
      setScheduleTemplates(templatesList);
      console.log("TimeTrackingPage: Schedule templates fetched from Firestore:", templatesList.length);
    } catch (error) {
      console.error("Error fetching schedule templates from Firestore:", error);
      toast({ title: "Erreur de chargement des modèles d'horaires", variant: "destructive" });
      setScheduleTemplates([]);
    } finally {
      setIsLoadingScheduleTemplates(false);
    }
  }, [isClient, toast]);

  const fetchTimeEntries = useCallback(async () => {
    if (!isClient) return;
    setIsLoadingTimeEntries(true);
    try {
      const entriesCollectionRef = collection(firestore, 'timeTrackingEntries');
      const q = query(entriesCollectionRef, orderBy("date", "desc")); 
      const querySnapshot = await getDocs(q);
      const entriesList = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          date: (data.date as Timestamp).toDate(), 
        } as TimeEntry;
      });
      setTimeEntries(entriesList);
      console.log("TimeTrackingPage: Time entries fetched from Firestore:", entriesList.length);
    } catch (error) {
      console.error("Error fetching time entries from Firestore:", error);
      toast({ title: "Erreur de chargement des saisies d'heures", variant: "destructive" });
      setTimeEntries([]);
    } finally {
      setIsLoadingTimeEntries(false);
    }
  }, [isClient, toast]);


  useEffect(() => {
    if (isClient) {
      fetchBrigadeMembers(); // fetchBrigadeMembers now depends on loggedInUsername
      fetchScheduleTemplates();
      fetchTimeEntries(); 
    }
  }, [isClient, fetchBrigadeMembers, fetchScheduleTemplates, fetchTimeEntries, loggedInUsername]); // Added loggedInUsername dependency to initial fetch chain

  const addMember = useCallback(async (memberData: Omit<BrigadeMember, 'id'>) => {
    if (memberData.name.toLowerCase() === 'chef') {
        toast({ title: "Nom Réservé", description: "Le nom 'Chef' est réservé et ne peut être ajouté manuellement.", variant: "destructive"});
        return;
    }
    const newMember = { 
      ...memberData, 
      assignedScheduleTemplateIds: Array.isArray(memberData.assignedScheduleTemplateIds) ? memberData.assignedScheduleTemplateIds : [] 
    };
    try {
      await addDoc(collection(firestore, "brigadeMembers"), newMember);
      fetchBrigadeMembers(); 
      window.dispatchEvent(new CustomEvent('brigadeMembersUpdated'));
      toast({ title: "Membre Ajouté", description: `${newMember.name} a été ajouté à Firestore.` });
    } catch (e) {
      console.error("Error adding member to Firestore: ", e);
      toast({ title: "Erreur d'ajout", description: "Le membre n'a pas pu être ajouté.", variant: "destructive" });
    }
  }, [toast, fetchBrigadeMembers]);

  const updateMember = useCallback(async (updatedMember: BrigadeMember) => {
     if (updatedMember.id === VIRTUAL_CHEF_ID) {
        toast({ title: "Non Modifiable", description: "Le Chef virtuel ne peut pas être modifié ici.", variant: "default"});
        return;
    }
    const memberToUpdate = {
      ...updatedMember,
      assignedScheduleTemplateIds: Array.isArray(updatedMember.assignedScheduleTemplateIds) ? updatedMember.assignedScheduleTemplateIds : []
    };
    try {
      const memberDocRef = doc(firestore, "brigadeMembers", memberToUpdate.id);
      const { id, ...dataToSave } = memberToUpdate;
      await setDoc(memberDocRef, dataToSave); 
      fetchBrigadeMembers();
      setTimeEntries(prevEntries => prevEntries.map(entry => 
          entry.memberId === id ? {...entry, memberName: memberToUpdate.name} : entry
      ));
      window.dispatchEvent(new CustomEvent('brigadeMembersUpdated'));
      toast({ title: "Membre Modifié", description: `${memberToUpdate.name} a été mis à jour dans Firestore.` });
    } catch (e) {
      console.error("Error updating member in Firestore: ", e);
      toast({ title: "Erreur de modification", description: "Le membre n'a pas pu être modifié.", variant: "destructive" });
    }
  }, [toast, fetchBrigadeMembers]);
  
  const deleteMember = useCallback(async (memberId: string) => {
    if (memberId === VIRTUAL_CHEF_ID) {
        toast({ title: "Non Supprimable", description: "Le Chef virtuel ne peut pas être supprimé.", variant: "default"});
        return;
    }
    const memberName = brigadeMembers.find(m => m.id === memberId)?.name || "Le membre";
    try {
      await deleteDoc(doc(firestore, "brigadeMembers", memberId));
      fetchBrigadeMembers();
      window.dispatchEvent(new CustomEvent('brigadeMembersUpdated'));
      toast({ title: "Membre Supprimé", description: `${memberName} a été retiré de Firestore.`, variant: "destructive" });
    } catch (e) {
      console.error("Error deleting member from Firestore: ", e);
      toast({ title: "Erreur de suppression", description: "Le membre n'a pas pu être supprimé.", variant: "destructive" });
    }
  }, [brigadeMembers, toast, fetchBrigadeMembers]);

  const addTimeEntry = useCallback(async (entryData: Omit<TimeEntry, 'id' | 'memberName'>) => {
    let memberNameForEntry = "Inconnu";
    if (entryData.memberId === VIRTUAL_CHEF_ID) {
        memberNameForEntry = "Chef";
    } else {
        const member = brigadeMembers.find(m => m.id === entryData.memberId);
        if (!member) {
            toast({ title: "Erreur", description: "Membre non trouvé pour cette entrée d'heures.", variant: "destructive" });
            return;
        }
        memberNameForEntry = member.name;
    }
    
    const newEntryFirestoreData = { 
        ...entryData, 
        memberName: memberNameForEntry,
        date: Timestamp.fromDate(new Date(entryData.date)) 
    };

    try {
      await addDoc(collection(firestore, "timeTrackingEntries"), newEntryFirestoreData);
      fetchTimeEntries(); 
      window.dispatchEvent(new CustomEvent('timeEntriesUpdated')); 
      toast({ title: "Entrée d'heures enregistrée", description: `Entrée pour ${memberNameForEntry} le ${format(new Date(entryData.date), "dd/MM/yyyy", {locale: fr})} enregistrée.` });
    } catch (e) {
      console.error("Error adding time entry to Firestore:", e);
      toast({ title: "Erreur d'enregistrement", description: "L'entrée d'heures n'a pas pu être enregistrée.", variant: "destructive"});
    }
  }, [brigadeMembers, toast, fetchTimeEntries]);

  const handleDeleteAllTimeEntries = useCallback(async () => {
    if (!isClient) return;
    setIsLoadingTimeEntries(true);
    try {
      const entriesCollectionRef = collection(firestore, 'timeTrackingEntries');
      const querySnapshot = await getDocs(entriesCollectionRef);
      const batchDelete = writeBatch(firestore);
      querySnapshot.docs.forEach(docSnapshot => batchDelete.delete(docSnapshot.ref));
      await batchDelete.commit();
      fetchTimeEntries(); 
      window.dispatchEvent(new CustomEvent('timeEntriesUpdated'));
      toast({ title: "Historique Effacé", description: "Toutes les saisies d'heures ont été supprimées de Firestore.", variant: "destructive" });
    } catch (e) {
      console.error("Error deleting all time entries from Firestore:", e);
      toast({ title: "Erreur de suppression", description: "Impossible de supprimer tout l'historique.", variant: "destructive"});
    } finally {
      setIsLoadingTimeEntries(false);
    }
  }, [isClient, toast, fetchTimeEntries]);


  const refreshScheduleTemplates = useCallback(() => {
    fetchScheduleTemplates();
  }, [fetchScheduleTemplates]);


  const timeTrackingTabsConfig: TimeTrackingTab[] = [
    { value: "personnel", label: "Gestion Personnel", Icon: Users, component: <ManageBrigadeMembers members={brigadeMembers} onAddMember={addMember} onUpdateMember={updateMember} onDeleteMember={deleteMember} scheduleTemplates={scheduleTemplates} />, permissionKey: 'timeTracking_personnel' },
    { value: "recording", label: "Saisie & Historique", Icon: Clock, component: <RecordTimeLog members={brigadeMembers} timeEntries={timeEntries} onAddTimeEntry={addTimeEntry} onDeleteAllTimeEntries={handleDeleteAllTimeEntries} loggedInUsername={loggedInUsername} userPermissions={userPermissions} />, permissionKey: 'timeTracking_recording' },
    { value: "summary", label: "Relevés & PDF", Icon: FileText, component: <MemberSummaryPdf members={brigadeMembers} timeEntries={timeEntries} loggedInUsername={loggedInUsername} userPermissions={userPermissions} />, permissionKey: 'timeTracking_summary' },
    { value: "schedules", label: "Modèles d'Horaires", Icon: CalendarClock, component: <ManageWorkSchedules brigadeMembers={brigadeMembers} loggedInUsername={loggedInUsername} viewConfig={loggedInUserHourViewConfig} onTemplatesUpdated={refreshScheduleTemplates} />, permissionKey: 'timeTracking_schedules' },
  ];
  
  const visibleTabs = React.useMemo(() => {
    const isChefUser = loggedInUsername?.toLowerCase() === 'chef';
    if (isChefUser) {
      return timeTrackingTabsConfig;
    }
    return timeTrackingTabsConfig.filter(tab => userPermissions[tab.permissionKey as RubricId]);
  }, [userPermissions, loggedInUsername, timeTrackingTabsConfig]); 

  const [activeTab, setActiveTab] = React.useState(visibleTabs.length > 0 ? visibleTabs[0].value : "");
  
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.find(tab => tab.value === activeTab)) {
      setActiveTab(visibleTabs[0].value);
    } else if (visibleTabs.length === 0 && activeTab !== "") { 
      setActiveTab("");
    }
  }, [visibleTabs, activeTab]);


  if (!isClient || isLoadingMembers || isLoadingScheduleTemplates || isLoadingTimeEntries) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg text-muted-foreground ml-3">Chargement du suivi des heures...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 min-h-screen">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <div className="flex items-center space-x-3">
           <Clock className="w-10 h-10 text-accent" />
           <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-foreground title-glow text-center sm:text-left">
             Suivi des Heures Brigade
           </h1>
        </div>
      </div>
      <div className="mb-6 text-center sm:text-left">
        <CurrentDate />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {isMobile ? (
          <div className="mb-4">
            <Label htmlFor="mobile-timetracking-nav-select" className="text-sm font-medium">Naviguer vers :</Label>
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger id="mobile-timetracking-nav-select" className="w-full mt-1"><SelectValue placeholder="Choisir une section..." /></SelectTrigger>
              <SelectContent>{visibleTabs.map(tab => (<SelectItem key={tab.value} value={tab.value} className="text-sm"><span className="flex items-center"><tab.Icon className="mr-2 h-4 w-4" />{tab.label}</span></SelectItem>))}</SelectContent>
            </Select>
          </div>
        ) : (
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-4 mb-6 bg-card p-1 rounded-lg">
            {visibleTabs.map(tab => (<TabsTrigger key={tab.value} value={tab.value} className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-2 py-1"><tab.Icon className="mr-1 sm:mr-2 h-4 w-4" />{tab.label}</TabsTrigger>))}
          </TabsList>
        )}

        {visibleTabs.length > 0 ? (
          visibleTabs.map(tab => (
            <TabsContent key={tab.value} value={tab.value}>
              {tab.component}
            </TabsContent>
          ))
        ) : (
           <TabsContent value=""> 
            <Card>
              <CardHeader><CardTitle>Accès Restreint</CardTitle></CardHeader>
              <CardContent><p className="text-muted-foreground">Vous n'avez pas la permission d'accéder aux sous-rubriques du Suivi des Heures.</p></CardContent>
            </Card>
           </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

 
