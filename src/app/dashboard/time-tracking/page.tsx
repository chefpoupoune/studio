
"use client";

import Link from 'next/link';
import { Users, Clock, UserCheck, FileText, CalendarClock } from 'lucide-react';
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


const BRIGADE_MEMBERS_STORAGE_KEY = 'time_tracking_members_v2';
const TIME_ENTRIES_STORAGE_KEY = 'time_tracking_entries';
const WORK_SCHEDULE_CUSTOM_TEMPLATES_KEY = "time_tracking_custom_schedule_templates_v2";
const LOGGED_IN_USER_PERMISSIONS_KEY = 'loggedInUserPermissions';
const LOGGED_IN_USERNAME_KEY = 'loggedInUsername';
const LOGGED_IN_USER_HOUR_VIEW_CONFIG_KEY = 'loggedInUserHourViewConfig';


const initialBrigadeMembers: BrigadeMember[] = [
  { id: 'member_chef_01', name: 'Moi (Chef)', role: 'Chef de Cuisine', assignedScheduleTemplateIds: [] },
  { id: 'member_second_01', name: 'Alexandre Dubois', role: 'Second de Cuisine', assignedScheduleTemplateIds: [] },
];

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
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const timeTrackingTabsConfig: TimeTrackingTab[] = [
    { value: "personnel", label: "Gestion Personnel", Icon: Users, component: <ManageBrigadeMembers members={brigadeMembers} onAddMember={addMember} onUpdateMember={updateMember} onDeleteMember={deleteMember} scheduleTemplates={scheduleTemplates} />, permissionKey: 'timeTracking_personnel' },
    { value: "recording", label: "Saisie & Historique", Icon: Clock, component: <RecordTimeLog members={brigadeMembers} timeEntries={timeEntries} onAddTimeEntry={addTimeEntry} onDeleteAllTimeEntries={handleDeleteAllTimeEntries} loggedInUsername={loggedInUsername} userPermissions={userPermissions} />, permissionKey: 'timeTracking_recording' },
    { value: "summary", label: "Relevés & PDF", Icon: FileText, component: <MemberSummaryPdf members={brigadeMembers} timeEntries={timeEntries} loggedInUsername={loggedInUsername} userPermissions={userPermissions} />, permissionKey: 'timeTracking_summary' },
    { value: "schedules", label: "Modèles d'Horaires", Icon: CalendarClock, component: <ManageWorkSchedules initialScheduleTemplates={scheduleTemplates} brigadeMembers={brigadeMembers} onScheduleTemplatesChange={handleScheduleTemplatesChange} loggedInUsername={loggedInUsername} viewConfig={loggedInUserHourViewConfig} />, permissionKey: 'timeTracking_schedules' },
  ];
  
  const visibleTabs = React.useMemo(() => {
    if (loggedInUsername?.toLowerCase() === 'chef') {
      return timeTrackingTabsConfig;
    }
    return timeTrackingTabsConfig.filter(tab => userPermissions[tab.permissionKey as RubricId]);
  }, [userPermissions, loggedInUsername, timeTrackingTabsConfig]);

  const [activeTab, setActiveTab] = React.useState(visibleTabs.length > 0 ? visibleTabs[0].value : "");


  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    if (isClient) {
      try {
        const storedPermissionsRaw = localStorage.getItem(LOGGED_IN_USER_PERMISSIONS_KEY);
        if (storedPermissionsRaw) {
          setUserPermissions(JSON.parse(storedPermissionsRaw));
        }
        const username = localStorage.getItem(LOGGED_IN_USERNAME_KEY);
        setLoggedInUsername(username);

        const storedHourViewConfigRaw = localStorage.getItem(LOGGED_IN_USER_HOUR_VIEW_CONFIG_KEY);
        if (storedHourViewConfigRaw) {
            setLoggedInUserHourViewConfig(JSON.parse(storedHourViewConfigRaw));
        }


        const storedMembersRaw = localStorage.getItem(BRIGADE_MEMBERS_STORAGE_KEY);
        if (storedMembersRaw) {
          const parsedMembers = JSON.parse(storedMembersRaw);
          setBrigadeMembers(parsedMembers.map((m: any) => ({ ...m, assignedScheduleTemplateIds: Array.isArray(m.assignedScheduleTemplateIds) ? m.assignedScheduleTemplateIds : [] })));
        } else {
          setBrigadeMembers(initialBrigadeMembers);
        }

        const storedEntries = localStorage.getItem(TIME_ENTRIES_STORAGE_KEY);
        if (storedEntries) {
            const parsedEntries = JSON.parse(storedEntries).map((e: TimeEntry) => ({...e, date: new Date(e.date)}));
            setTimeEntries(parsedEntries.sort((a: TimeEntry,b: TimeEntry) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        }

        const storedTemplates = localStorage.getItem(WORK_SCHEDULE_CUSTOM_TEMPLATES_KEY);
        if (storedTemplates) {
          setScheduleTemplates(JSON.parse(storedTemplates));
        } else {
          setScheduleTemplates([]);
        }

      } catch (e) {
        console.error("Error loading data from localStorage (Time Tracking)", e);
        localStorage.removeItem(BRIGADE_MEMBERS_STORAGE_KEY);
        localStorage.removeItem(TIME_ENTRIES_STORAGE_KEY);
        localStorage.removeItem(WORK_SCHEDULE_CUSTOM_TEMPLATES_KEY);
        setBrigadeMembers(initialBrigadeMembers);
        setTimeEntries([]);
        setScheduleTemplates([]);
        toast({ title: "Erreur de chargement", description: "Données de suivi des heures corrompues, réinitialisation.", variant: "destructive" });
      }
    }
  }, [isClient, toast]);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem(BRIGADE_MEMBERS_STORAGE_KEY, JSON.stringify(brigadeMembers));
      window.dispatchEvent(new CustomEvent('brigadeMembersUpdated'));
    }
  }, [brigadeMembers, isClient]);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem(TIME_ENTRIES_STORAGE_KEY, JSON.stringify(timeEntries));
      window.dispatchEvent(new CustomEvent('timeEntriesUpdated'));
    }
  }, [timeEntries, isClient]);


  const addMember = useCallback((member: Omit<BrigadeMember, 'id'>) => {
    const newMember = { 
      ...member, 
      id: `member_${Date.now()}`, 
      assignedScheduleTemplateIds: Array.isArray(member.assignedScheduleTemplateIds) ? member.assignedScheduleTemplateIds : [] 
    };
    setBrigadeMembers(prev => [...prev, newMember].sort((a,b) => a.name.localeCompare(b.name)));
    toast({ title: "Membre Ajouté", description: `${member.name} a été ajouté à la brigade.` });
  }, [toast]);

  const updateMember = useCallback((updatedMember: BrigadeMember) => {
    const memberToUpdate = {
      ...updatedMember,
      assignedScheduleTemplateIds: Array.isArray(updatedMember.assignedScheduleTemplateIds) ? updatedMember.assignedScheduleTemplateIds : []
    };
    setBrigadeMembers(prev => prev.map(m => m.id === memberToUpdate.id ? memberToUpdate : m).sort((a,b) => a.name.localeCompare(b.name)));
    setTimeEntries(prevEntries => prevEntries.map(entry => 
        entry.memberId === memberToUpdate.id ? {...entry, memberName: memberToUpdate.name} : entry
    ));
    toast({ title: "Membre Modifié", description: `${memberToUpdate.name} a été mis à jour.` });
  }, [toast]);
  
  const deleteMember = useCallback((memberId: string) => {
    const memberName = brigadeMembers.find(m => m.id === memberId)?.name || "Le membre";
    setBrigadeMembers(prev => prev.filter(m => m.id !== memberId));
    toast({ title: "Membre Supprimé", description: `${memberName} a été retiré de la brigade.`, variant: "destructive" });
  }, [brigadeMembers, toast]);

  const addTimeEntry = useCallback((entry: Omit<TimeEntry, 'id' | 'memberName'>) => {
    const member = brigadeMembers.find(m => m.id === entry.memberId);
    if (!member) {
      toast({ title: "Erreur", description: "Membre non trouvé pour cette entrée d'heures.", variant: "destructive" });
      return;
    }
    
    const newEntry: TimeEntry = { 
        ...entry, 
        id: `te_${Date.now()}`, 
        memberName: member.name,
        date: new Date(entry.date) 
    };

    setTimeEntries(prev => [newEntry, ...prev].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    toast({ title: "Entrée d'heures enregistrée", description: `Entrée pour ${member.name} le ${format(newEntry.date, "dd/MM/yyyy", {locale: fr})} enregistrée.` });
  }, [brigadeMembers, toast]);

  const handleDeleteAllTimeEntries = useCallback(() => {
    setTimeEntries([]);
    toast({ title: "Historique Effacé", description: "Toutes les saisies d'heures ont été supprimées.", variant: "destructive" });
  }, [toast]);

  const handleScheduleTemplatesChange = useCallback((updatedTemplates: WeeklyWorkSchedule[]) => {
    setScheduleTemplates(updatedTemplates);
    if (isClient) {
      localStorage.setItem(WORK_SCHEDULE_CUSTOM_TEMPLATES_KEY, JSON.stringify(updatedTemplates));
    }
  }, [isClient]);
  
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.find(tab => tab.value === activeTab)) {
      setActiveTab(visibleTabs[0].value);
    } else if (visibleTabs.length === 0) {
      setActiveTab("");
    }
  }, [visibleTabs, activeTab]);


  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Chargement du suivi des heures...</p>
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
              <SelectTrigger id="mobile-timetracking-nav-select" className="w-full mt-1">
                <SelectValue placeholder="Choisir une section..." />
              </SelectTrigger>
              <SelectContent>
                {visibleTabs.map(tab => (
                  <SelectItem key={tab.value} value={tab.value} className="text-sm">
                    <span className="flex items-center">
                      <tab.Icon className="mr-2 h-4 w-4" />
                      {tab.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-4 mb-6 bg-card p-1 rounded-lg">
            {visibleTabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-2 py-1">
                <tab.Icon className="mr-1 sm:mr-2 h-4 w-4" /> {tab.label}
              </TabsTrigger>
            ))}
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
