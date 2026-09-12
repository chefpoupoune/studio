
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BellRing, Loader2, ChevronsRight } from 'lucide-react';
import type { OvertimeRequest, AbsenceRequest, ScheduleChangeRequest } from '@/app/dashboard/declaration-heure/types';
import { firestore } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';

interface PendingRequestsAlertProps {
  loggedInUsername: string | null;
}

export default function PendingRequestsAlert({ loggedInUsername }: PendingRequestsAlertProps) {
  const [pendingOvertimeCount, setPendingOvertimeCount] = useState(0);
  const [pendingAbsenceCount, setPendingAbsenceCount] = useState(0);
  const [pendingScheduleChangeCount, setPendingScheduleChangeCount] = useState(0); // Added state for schedule changes
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const loadPendingCounts = useCallback(async () => {
    if (!isClient) return;
    setIsLoading(true);
    try {
      // Fetch pending overtime requests
      const overtimeCollectionRef = collection(firestore, 'overtimeRequests');
      const overtimeQuery = query(overtimeCollectionRef, where('approvalStatus', '==', 'pending'));
      const overtimeSnapshot = await getDocs(overtimeQuery);
      setPendingOvertimeCount(overtimeSnapshot.size);

      // Fetch pending absence requests
      const absenceCollectionRef = collection(firestore, 'absenceRequests');
      const absenceQuery = query(absenceCollectionRef, where('approvalStatus', '==', 'pending'));
      const absenceSnapshot = await getDocs(absenceQuery);
      setPendingAbsenceCount(absenceSnapshot.size);

      // Fetch pending schedule change requests
      const scheduleChangeCollectionRef = collection(firestore, 'scheduleChangeRequests');
      const scheduleChangeQuery = query(scheduleChangeCollectionRef, where('approvalStatus', '==', 'pending'));
      const scheduleChangeSnapshot = await getDocs(scheduleChangeQuery);
      setPendingScheduleChangeCount(scheduleChangeSnapshot.size);

      console.log(`[PendingAlerts] Fetched counts - Overtime: ${overtimeSnapshot.size}, Absence: ${absenceSnapshot.size}, ScheduleChange: ${scheduleChangeSnapshot.size}`);

    } catch (e) {
      console.error("Error loading pending requests counts from Firestore:", e);
      setPendingOvertimeCount(0);
      setPendingAbsenceCount(0);
      setPendingScheduleChangeCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [isClient]);

  useEffect(() => {
    if (isClient && loggedInUsername?.toLowerCase() === 'chef') { // Only load for chef
      loadPendingCounts(); // Initial load

      const handleUpdate = () => {
        console.log("PendingRequestsAlert: an update event was received");
        loadPendingCounts();
      };
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            console.log("PendingRequestsAlert: Tab became visible, reloading counts.");
            loadPendingCounts();
        }
      };

      window.addEventListener('overtimeRequestsUpdated', handleUpdate);
      window.addEventListener('absenceRequestsUpdated', handleUpdate);
      window.addEventListener('scheduleChangeRequestsUpdated', handleUpdate); // Listen for schedule change updates
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        window.removeEventListener('overtimeRequestsUpdated', handleUpdate);
        window.removeEventListener('absenceRequestsUpdated', handleUpdate);
        window.removeEventListener('scheduleChangeRequestsUpdated', handleUpdate);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    } else {
      // If not chef, or not client-side yet, ensure counts are 0 and not loading
      setPendingOvertimeCount(0);
      setPendingAbsenceCount(0);
      setPendingScheduleChangeCount(0);
      setIsLoading(false);
    }
  }, [isClient, loggedInUsername, loadPendingCounts]);

  if (!isClient || loggedInUsername?.toLowerCase() !== 'chef') {
    return null;
  }

  if (isLoading) {
    return (
      <Alert className="mb-6 bg-muted/30 border-muted-foreground/20">
        <BellRing className="h-5 w-5 text-muted-foreground animate-pulse" />
        <AlertTitle className="font-semibold text-muted-foreground">Notifications</AlertTitle>
        <AlertDescription className="text-sm text-muted-foreground">
          <Loader2 className="inline-block mr-2 h-4 w-4 animate-spin" /> Chargement des demandes en attente...
        </AlertDescription>
      </Alert>
    );
  }

  const totalPending = pendingOvertimeCount + pendingAbsenceCount + pendingScheduleChangeCount;

  if (totalPending === 0) {
    return null; 
  }

  return (
    <Alert variant="destructive" className="mb-6">
      <BellRing className="h-5 w-5" />
      <AlertTitle className="font-semibold">Notifications de Demandes en Attente</AlertTitle>
      <AlertDescription>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="space-y-1">
            {pendingOvertimeCount > 0 && (
              <div>
                Vous avez <Badge variant="destructive" className="mx-1">{pendingOvertimeCount}</Badge> demande(s) de dépassement d'horaire en attente.
              </div>
            )}
            {pendingAbsenceCount > 0 && (
              <div>
                Vous avez <Badge variant="destructive" className="mx-1">{pendingAbsenceCount}</Badge> demande(s) d'absence en attente.
              </div>
            )}
            {pendingScheduleChangeCount > 0 && (
              <div>
                Vous avez <Badge variant="destructive" className="mx-1">{pendingScheduleChangeCount}</Badge> demande(s) de changement d'horaire en attente.
              </div>
            )}
          </div>
          <Button asChild variant="outline" size="sm" className="mt-2 sm:mt-0 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive">
            <Link href="/dashboard/declaration-heure">
              Voir les Demandes <ChevronsRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
