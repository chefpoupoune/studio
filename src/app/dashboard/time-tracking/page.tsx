
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

const BRIGADE_MEMBERS_STORAGE_KEY = 'time_tracking_members_v2';
const TIME_ENTRIES_STORAGE_KEY = 'time_tracking_entries';
const WORK_SCHEDULE_CUSTOM_TEMPLATES_KEY = "time_tracking_custom_schedule_templates_v2";

const initialBrigadeMembers: BrigadeMember[] = [
  { id: 'member_chef_01', name: 'Moi (Chef)', role: 'Chef de Cuisine', assignedScheduleTemplateIds: [] },
  { id: 'member_second_01', name: 'Alexandre Dubois', role: 'Second de Cuisine', assignedScheduleTemplateIds: [] },
];

export default function TimeTrackingPage() {
  const [brigadeMembers, setBrigadeMembers] = useState<BrigadeMember[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [scheduleTemplates, setScheduleTemplates] = useState<WeeklyWorkSchedule[]>([]);
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    if (isClient) {
      try {
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
    }
  }, [brigadeMembers, isClient]);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem(TIME_ENTRIES_STORAGE_KEY, JSON.stringify(timeEntries));
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
           <Users className="w-10 h-10 text-accent" />
           <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-foreground title-glow text-center sm:text-left">
             Suivi des Heures Brigade
           </h1>
        </div>
      </div>
      <div className="mb-6 text-center sm:text-left">
        <CurrentDate />
      </div>

      <Tabs defaultValue="recording" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-6 bg-card p-1 rounded-lg">
          <TabsTrigger value="personnel" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Users className="mr-1 sm:mr-2 h-4 w-4" /> Gestion Personnel
          </TabsTrigger>
          <TabsTrigger value="recording" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Clock className="mr-1 sm:mr-2 h-4 w-4" /> Saisie & Historique
          </TabsTrigger>
          <TabsTrigger value="summary" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <FileText className="mr-1 sm:mr-2 h-4 w-4" /> Relevés & PDF
          </TabsTrigger>
          <TabsTrigger value="schedules" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <CalendarClock className="mr-1 sm:mr-2 h-4 w-4" /> Modèles d'Horaires
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personnel">
          <ManageBrigadeMembers
            members={brigadeMembers}
            onAddMember={addMember}
            onUpdateMember={updateMember}
            onDeleteMember={deleteMember}
            scheduleTemplates={scheduleTemplates}
          />
        </TabsContent>
        <TabsContent value="recording">
          <RecordTimeLog
            members={brigadeMembers}
            timeEntries={timeEntries}
            onAddTimeEntry={addTimeEntry}
            onDeleteAllTimeEntries={handleDeleteAllTimeEntries}
          />
        </TabsContent>
        <TabsContent value="summary">
          <MemberSummaryPdf 
            members={brigadeMembers}
            timeEntries={timeEntries}
          />
        </TabsContent>
        <TabsContent value="schedules">
          <ManageWorkSchedules 
            initialScheduleTemplates={scheduleTemplates}
            brigadeMembers={brigadeMembers}
            onScheduleTemplatesChange={handleScheduleTemplatesChange}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

