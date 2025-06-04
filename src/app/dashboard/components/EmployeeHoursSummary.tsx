
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, User, Clock, AlertCircle, TrendingUp, TrendingDown, Scale, Loader2 } from "lucide-react";
import type { BrigadeMember, TimeEntry } from '@/app/dashboard/time-tracking/types';
import type { ViewableHourSummaryConfig } from '@/app/dashboard/settings/components/user-management';
import { LOGGED_IN_USER_HOUR_VIEW_CONFIG_KEY } from '@/app/dashboard/settings/components/user-management';
import { firestore } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

const LOGGED_IN_USERNAME_KEY = 'loggedInUsername';

interface MemberHours {
  memberId: string;
  name: string;
  role: string;
  added: number;
  deducted: number;
  net: number;
}

export default function EmployeeHoursSummary() {
  const [isClient, setIsClient] = useState(false);
  const [viewConfig, setViewConfig] = useState<ViewableHourSummaryConfig | null>(null);
  const [loggedInUsername, setLoggedInUsername] = useState<string | null>(null);
  const [allMembers, setAllMembers] = useState<BrigadeMember[]>([]);
  const [allTimeEntries, setAllTimeEntries] = useState<TimeEntry[]>([]);
  const [processedHours, setProcessedHours] = useState<MemberHours[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const loadData = useCallback(async () => {
    if (!isClient) return;
    console.log("EmployeeHoursSummary: loadData triggered");
    setIsLoading(true);
    try {
      const username = localStorage.getItem(LOGGED_IN_USERNAME_KEY);
      setLoggedInUsername(username);
      console.log(`EmployeeHoursSummary: Logged in username set to: ${username}`);

      const configRaw = localStorage.getItem(LOGGED_IN_USER_HOUR_VIEW_CONFIG_KEY);
      const parsedConfig = configRaw ? JSON.parse(configRaw) : { type: 'none' };
      setViewConfig(parsedConfig);
      console.log("EmployeeHoursSummary: View config set to:", parsedConfig);

      console.log("EmployeeHoursSummary: Fetching brigade members from Firestore...");
      const membersCollectionRef = collection(firestore, 'brigadeMembers');
      const qMembers = query(membersCollectionRef, orderBy("name"));
      const memberQuerySnapshot = await getDocs(qMembers, { source: 'server' }); // Force server read
      const membersList = memberQuerySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as BrigadeMember));
      setAllMembers([...membersList]); // Ensure new array reference
      console.log(`EmployeeHoursSummary: Fetched ${membersList.length} members. First few:`, membersList.slice(0,2).map(m => m.name));

      console.log("EmployeeHoursSummary: Fetching time entries from Firestore...");
      const entriesCollectionRef = collection(firestore, 'timeTrackingEntries');
      const qEntries = query(entriesCollectionRef, orderBy("date", "desc"));
      const entryQuerySnapshot = await getDocs(qEntries, { source: 'server' }); // Force server read
      const parsedEntries = entryQuerySnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          date: (data.date as Timestamp).toDate(), // Convert Firestore Timestamp to JS Date
        } as TimeEntry;
      });
      setAllTimeEntries([...parsedEntries]); // Ensure new array reference
      console.log(`EmployeeHoursSummary: Fetched ${parsedEntries.length} entries. First few:`, parsedEntries.slice(0,2).map(e => `${e.memberName} ${e.hours}h on ${e.date.toISOString().substring(0,10)}`));
      
      console.log("EmployeeHoursSummary: Data loaded from Firestore.");
    } catch (e: any) {
      console.error("EmployeeHoursSummary: Error loading data for EmployeeHoursSummary from Firestore:", e);
      toast({ title: "Erreur chargement récap. heures", description: "Les données n'ont pu être récupérées.", variant: "destructive" });
      setViewConfig({ type: 'none' }); 
      setAllMembers([]);
      setAllTimeEntries([]);
    } finally {
      setIsLoading(false);
      console.log("EmployeeHoursSummary: loadData finished, isLoading set to false.");
    }
  }, [isClient, setIsLoading, setViewConfig, setAllMembers, setAllTimeEntries, setLoggedInUsername, toast]);

  useEffect(() => {
    if (isClient) {
      loadData(); // Initial load

      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          console.log("EmployeeHoursSummary: Tab became visible, re-fetching data.");
          loadData();
        }
      };
      
      const handleBrigadeMembersUpdated = () => {
        console.log("EmployeeHoursSummary: brigadeMembersUpdated event received, re-fetching data.");
        loadData();
      };
      const handleTimeEntriesUpdated = () => {
        console.log("EmployeeHoursSummary: timeEntriesUpdated event received, re-fetching data.");
        loadData();
      };
      const handleHourViewConfigUpdated = () => {
        console.log("EmployeeHoursSummary: loggedInUserHourViewConfigUpdated event received, re-fetching data.");
        loadData();
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('brigadeMembersUpdated', handleBrigadeMembersUpdated);
      window.addEventListener('timeEntriesUpdated', handleTimeEntriesUpdated);
      window.addEventListener('loggedInUserHourViewConfigUpdated', handleHourViewConfigUpdated);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('brigadeMembersUpdated', handleBrigadeMembersUpdated);
        window.removeEventListener('timeEntriesUpdated', handleTimeEntriesUpdated);
        window.removeEventListener('loggedInUserHourViewConfigUpdated', handleHourViewConfigUpdated);
      };
    }
  }, [isClient, loadData]);

  useEffect(() => {
    console.log(`EmployeeHoursSummary: Processing effect. isLoading: ${isLoading}, isClient: ${isClient}, viewConfig: ${!!viewConfig}, allMembers len: ${allMembers.length}, allTimeEntries len: ${allTimeEntries.length}`);
    if (!isClient || !viewConfig) {
      setProcessedHours([]);
      console.log("EmployeeHoursSummary: Bailing from processing (not client or no viewConfig).");
      return;
    }

    if (isLoading) { 
      console.log("EmployeeHoursSummary: Bailing from processing (isLoading is true).");
      // Not clearing processedHours here to avoid flicker; old data shown while loading
      return;
    }
    
    console.log("EmployeeHoursSummary: Processing hours. Members:", allMembers.length, "Entries:", allTimeEntries.length, "ViewConfig:", viewConfig);

    const calculateHoursForMember = (memberId: string): Omit<MemberHours, 'name' | 'role' | 'memberId'> => {
      const memberEntries = allTimeEntries.filter(e => e.memberId === memberId);
      const added = memberEntries.filter(e => e.type === 'addition').reduce((sum, e) => sum + e.hours, 0);
      const deducted = memberEntries.filter(e => e.type === 'deduction').reduce((sum, e) => sum + e.hours, 0);
      return { added, deducted, net: added - deducted };
    };

    let hoursToDisplay: MemberHours[] = [];

    if (viewConfig.type === 'all') {
      hoursToDisplay = allMembers.map(member => {
        const { added, deducted, net } = calculateHoursForMember(member.id);
        return { memberId: member.id, name: member.name, role: member.role, added, deducted, net };
      }).sort((a,b) => b.net - a.net); 
    } else if (viewConfig.type === 'own' && loggedInUsername) {
      const ownMember = allMembers.find(m => m.name.toLowerCase() === loggedInUsername.toLowerCase());
      if (ownMember) {
        const { added, deducted, net } = calculateHoursForMember(ownMember.id);
        hoursToDisplay = [{ memberId: ownMember.id, name: ownMember.name, role: ownMember.role, added, deducted, net }];
      }
    } else if (viewConfig.type === 'specific' && viewConfig.specificMemberId) {
      const specificMember = allMembers.find(m => m.id === viewConfig.specificMemberId);
      if (specificMember) {
        const { added, deducted, net } = calculateHoursForMember(specificMember.id);
        hoursToDisplay = [{ memberId: specificMember.id, name: specificMember.name, role: specificMember.role, added, deducted, net }];
      }
    }
    setProcessedHours(hoursToDisplay);
    console.log("EmployeeHoursSummary: Processed hours:", hoursToDisplay.length > 0 ? hoursToDisplay : "None to display");
  }, [viewConfig, loggedInUsername, allMembers, allTimeEntries, isLoading, isClient]);


  if (!isClient) { // Initial render on server or before client-side hydration
    return (
      <Card className="shadow-lg h-full flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Récapitulatif Heures
          </CardTitle>
          <CardDescription className="text-xs">Chargement initial...</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow pt-2 flex items-center justify-center">
           <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }
  
  const renderContent = () => {
    if (isLoading && processedHours.length === 0) { // Show loading state only if there's no data to display yet
        return (
            <div className="flex flex-col items-center justify-center h-full py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
                <p className="text-sm text-muted-foreground">Chargement des heures...</p>
            </div>
        );
    }
    if (viewConfig?.type === 'none') {
      return <p className="text-sm text-muted-foreground text-center py-4 flex items-center justify-center gap-2"><AlertCircle className="w-4 h-4" /> Accès aux récapitulatifs d'heures non configuré.</p>;
    }

    if (processedHours.length === 0) {
        if (viewConfig?.type === 'own' && loggedInUsername) {
             return <p className="text-sm text-muted-foreground text-center py-4 flex items-center justify-center gap-2"><AlertCircle className="w-4 h-4" /> Soit votre compte ({loggedInUsername}) n'est pas lié à un membre de brigade, soit aucune heure n'a été enregistrée pour vous.</p>;
        }
         if (viewConfig?.type === 'specific' && viewConfig.specificMemberId) {
            const memberName = allMembers.find(m => m.id === viewConfig.specificMemberId)?.name || "l'employé spécifié";
            return <p className="text-sm text-muted-foreground text-center py-4 flex items-center justify-center gap-2"><AlertCircle className="w-4 h-4" /> Aucune heure enregistrée pour {memberName}.</p>;
        }
      return <p className="text-sm text-muted-foreground text-center py-4 flex items-center justify-center gap-2"><AlertCircle className="w-4 h-4" /> Aucune donnée d'heure à afficher pour la configuration actuelle.</p>;
    }

    if (viewConfig?.type === 'all') {
      return (
        <ScrollArea className="h-[200px] sm:h-[220px] pr-3">
          <ul className="space-y-2">
            {processedHours.map(data => (
              <li key={data.memberId} className="text-sm p-2 border rounded-md bg-card/60 hover:bg-muted/30">
                <div className="flex justify-between items-center">
                  <span className="font-medium truncate pr-2" title={data.name}>{data.name} <span className="text-xs text-muted-foreground">({data.role})</span></span>
                  <span className={`font-semibold ${data.net >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {data.net.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })} h
                  </span>
                </div>
                 <div className="text-xs text-muted-foreground mt-0.5 flex justify-between">
                    <span><TrendingUp className="inline h-3 w-3 mr-0.5 text-green-500"/>{data.added.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 2})}h</span>
                    <span><TrendingDown className="inline h-3 w-3 mr-0.5 text-red-500"/>{data.deducted.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 2})}h</span>
                </div>
              </li>
            ))}
          </ul>
        </ScrollArea>
      );
    }

    const singleMemberData = processedHours[0];
    return (
      <div className="space-y-2 text-sm">
        <p className="font-semibold text-lg text-center mb-3">{singleMemberData.name} <span className="text-base text-muted-foreground">({singleMemberData.role})</span></p>
        <div className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-900/30 rounded-md">
          <span className="flex items-center">
            <TrendingUp className="h-4 w-4 mr-1.5 text-green-600 dark:text-green-400"/>
            <span className="text-black dark:text-white">Heures Ajoutées:</span>
          </span>
          <span className="font-bold text-green-600 dark:text-green-400">{singleMemberData.added.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })} h</span>
        </div>
        <div className="flex justify-between items-center p-2 bg-red-50 dark:bg-red-900/30 rounded-md">
          <span className="flex items-center">
            <TrendingDown className="h-4 w-4 mr-1.5 text-red-600 dark:text-red-400"/>
            <span className="text-black dark:text-white">Heures Déduites:</span>
          </span>
          <span className="font-bold text-red-600 dark:text-red-400">{singleMemberData.deducted.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })} h</span>
        </div>
        <div className={`flex justify-between items-center p-2 rounded-md ${singleMemberData.net >= 0 ? 'bg-blue-50 dark:bg-blue-900/30' : 'bg-orange-50 dark:bg-orange-900/30'}`}>
          <span className="flex items-center">
            <Scale className={`h-4 w-4 mr-1.5 ${singleMemberData.net >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}/>
            <span className="text-black dark:text-white">Solde d'Heures:</span>
          </span>
          <span className={`font-bold text-lg ${singleMemberData.net >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
            {singleMemberData.net.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })} h
          </span>
        </div>
      </div>
    );
  };
  
  const getCardTitleIcon = () => {
    if (viewConfig?.type === 'all') return <Users className="w-5 h-5 text-primary" />;
    if (viewConfig?.type === 'own' || viewConfig?.type === 'specific') return <User className="w-5 h-5 text-primary" />;
    return <Clock className="w-5 h-5 text-primary" />;
  };
  
  const getCardDescription = () => {
    if (viewConfig?.type === 'all') return "Aperçu du solde horaire pour chaque membre.";
    if (viewConfig?.type === 'own' && loggedInUsername) return `Votre solde horaire personnel (${loggedInUsername}).`;
    if (viewConfig?.type === 'specific') {
        const memberName = allMembers.find(m => m.id === viewConfig.specificMemberId)?.name;
        return memberName ? `Solde horaire de ${memberName}.` : "Solde horaire pour un employé.";
    }
    return "Configuration de l'accès aux heures requise.";
  }

  return (
    <Card className="shadow-lg h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl flex items-center gap-2">
          {getCardTitleIcon()}
          Récapitulatif Heures
        </CardTitle>
        <CardDescription className="text-xs">
          {getCardDescription()}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow pt-2">
        {renderContent()}
      </CardContent>
    </Card>
  );
}

    