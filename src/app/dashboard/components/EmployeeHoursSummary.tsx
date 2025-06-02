
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, User, Clock, AlertCircle, TrendingUp, TrendingDown, Scale } from "lucide-react";
import type { BrigadeMember, TimeEntry } from '@/app/dashboard/time-tracking/types';
import type { ViewableHourSummaryConfig } from '@/app/dashboard/settings/components/user-management';
import { LOGGED_IN_USER_HOUR_VIEW_CONFIG_KEY } from '@/app/dashboard/settings/components/user-management'; // Import the key

const LOGGED_IN_USERNAME_KEY = 'loggedInUsername';
// LOGGED_IN_USER_HOUR_VIEW_CONFIG_KEY removed from local definition
const BRIGADE_MEMBERS_STORAGE_KEY = 'time_tracking_members_v2'; // Ensure this matches saving key
const TIME_ENTRIES_STORAGE_KEY = 'time_tracking_entries';

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

  useEffect(() => {
    setIsClient(true);
  }, []);

  const loadData = useCallback(() => {
    if (!isClient) return;
    console.log("EmployeeHoursSummary: loadData triggered");
    setIsLoading(true);
    try {
      const username = localStorage.getItem(LOGGED_IN_USERNAME_KEY);
      setLoggedInUsername(username);

      const configRaw = localStorage.getItem(LOGGED_IN_USER_HOUR_VIEW_CONFIG_KEY);
      setViewConfig(configRaw ? JSON.parse(configRaw) : { type: 'none' });

      const membersRaw = localStorage.getItem(BRIGADE_MEMBERS_STORAGE_KEY);
      setAllMembers(membersRaw ? JSON.parse(membersRaw) : []);

      const entriesRaw = localStorage.getItem(TIME_ENTRIES_STORAGE_KEY);
      const parsedEntries = entriesRaw ? JSON.parse(entriesRaw).map((e: any) => ({ ...e, date: new Date(e.date) })) : [];
      setAllTimeEntries(parsedEntries);
      console.log("EmployeeHoursSummary: Data re-loaded from localStorage.");
    } catch (e) {
      console.error("EmployeeHoursSummary: Error loading data for EmployeeHoursSummary:", e);
      setViewConfig({ type: 'none' }); // Reset to safe state
      setAllMembers([]);
      setAllTimeEntries([]);
    } finally {
      setIsLoading(false);
      console.log("EmployeeHoursSummary: loadData finished, isLoading set to false.");
    }
  }, [isClient, setIsLoading, setLoggedInUsername, setViewConfig, setAllMembers, setAllTimeEntries]);

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

      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('brigadeMembersUpdated', handleBrigadeMembersUpdated);
      window.addEventListener('timeEntriesUpdated', handleTimeEntriesUpdated);

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('brigadeMembersUpdated', handleBrigadeMembersUpdated);
        window.removeEventListener('timeEntriesUpdated', handleTimeEntriesUpdated);
      };
    }
  }, [isClient, loadData]);

  useEffect(() => {
    if (isLoading || !viewConfig || !isClient) { 
      setProcessedHours([]);
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

  if (!isClient || isLoading) {
    return (
      <Card className="shadow-lg h-full flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Récapitulatif Heures
          </CardTitle>
          <CardDescription className="text-xs">Chargement des données...</CardDescription>
        </CardHeader>
        <CardContent className="flex-grow pt-2 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Chargement...</p>
        </CardContent>
      </Card>
    );
  }
  
  const renderContent = () => {
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
      return <p className="text-sm text-muted-foreground text-center py-4 flex items-center justify-center gap-2"><AlertCircle className="w-4 h-4" /> Aucune donnée d'heure à afficher.</p>;
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

    