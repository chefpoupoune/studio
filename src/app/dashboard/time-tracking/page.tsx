"use client";

import Link from 'next/link';
import { Users, Clock, UserCheck, FileText } from 'lucide-react'; // Removed ArrowLeft
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ManageBrigadeMembers from './components/manage-brigade-members';
import RecordTimeLog from './components/record-time-log';
import MemberSummaryPdf from './components/member-summary-pdf';
import type { BrigadeMember, TimeEntry } from './types';
import React, { useState, useEffect, useCallback } from 'react';
import { CurrentDate } from '@/components/current-date';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const initialBrigadeMembers: BrigadeMember[] = [
  { id: 'member_chef_01', name: 'Moi (Chef)', role: 'Chef de Cuisine' },
  { id: 'member_second_01', name: 'Alexandre Dubois', role: 'Second de Cuisine' },
];

export default function TimeTrackingPage() {
  const [brigadeMembers, setBrigadeMembers] = useState<BrigadeMember[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    if (isClient) {
      try {
        const storedMembers = localStorage.getItem('time_tracking_members');
        if (storedMembers) {
          setBrigadeMembers(JSON.parse(storedMembers));
        } else {
          setBrigadeMembers(initialBrigadeMembers);
        }

        const storedEntries = localStorage.getItem('time_tracking_entries');
        if (storedEntries) {
            const parsedEntries = JSON.parse(storedEntries).map((e: TimeEntry) => ({...e, date: new Date(e.date)}));
            setTimeEntries(parsedEntries.sort((a: TimeEntry,b: TimeEntry) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        }
      } catch (e) {
        console.error("Error loading data from localStorage (Time Tracking)", e);
        localStorage.removeItem('time_tracking_members');
        localStorage.removeItem('time_tracking_entries');
        setBrigadeMembers(initialBrigadeMembers);
        setTimeEntries([]);
      }
    }
  }, [isClient]);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem('time_tracking_members', JSON.stringify(brigadeMembers));
    }
  }, [brigadeMembers, isClient]);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem('time_tracking_entries', JSON.stringify(timeEntries));
    }
  }, [timeEntries, isClient]);

  const addMember = useCallback((member: Omit<BrigadeMember, 'id'>) => {
    setBrigadeMembers(prev => [...prev, { ...member, id: `member_${Date.now()}` }]);
    toast({ title: "Membre Ajouté", description: `${member.name} a été ajouté à la brigade.` });
  }, [toast]);

  const updateMember = useCallback((updatedMember: BrigadeMember) => {
    setBrigadeMembers(prev => prev.map(m => m.id === updatedMember.id ? updatedMember : m));
    setTimeEntries(prevEntries => prevEntries.map(entry => 
        entry.memberId === updatedMember.id ? {...entry, memberName: updatedMember.name} : entry
    ));
    toast({ title: "Membre Modifié", description: `${updatedMember.name} a été mis à jour.` });
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
        {/* Back to Dashboard button removed */}
      </div>
      <div className="mb-6 text-center sm:text-left">
        <CurrentDate />
      </div>

      <Tabs defaultValue="recording" className="w-full">
        <TabsList className="grid w-full grid-cols-1 md:grid-cols-3 mb-6 bg-card p-1 rounded-lg">
          <TabsTrigger value="personnel" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Users className="mr-1 sm:mr-2 h-4 w-4" /> Gestion Personnel
          </TabsTrigger>
          <TabsTrigger value="recording" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Clock className="mr-1 sm:mr-2 h-4 w-4" /> Saisie & Historique
          </TabsTrigger>
          <TabsTrigger value="summary" className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <FileText className="mr-1 sm:mr-2 h-4 w-4" /> Relevés & PDF
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personnel">
          <ManageBrigadeMembers
            members={brigadeMembers}
            onAddMember={addMember}
            onUpdateMember={updateMember}
            onDeleteMember={deleteMember}
          />
        </TabsContent>
        <TabsContent value="recording">
          <RecordTimeLog
            members={brigadeMembers}
            timeEntries={timeEntries}
            onAddTimeEntry={addTimeEntry}
          />
        </TabsContent>
        <TabsContent value="summary">
          <MemberSummaryPdf 
            members={brigadeMembers}
            timeEntries={timeEntries}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
