
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BellRing, Loader2, ChevronsRight } from 'lucide-react';
import type { OvertimeRequest, AbsenceRequest } from '@/app/dashboard/declaration-heure/types';

const OVERTIME_REQUESTS_STORAGE_KEY = 'declaration_heure_overtime_requests_v5';
const ABSENCE_REQUESTS_STORAGE_KEY = 'declaration_heure_absence_requests_v5';

interface PendingRequestsAlertProps {
  loggedInUsername: string | null;
}

export default function PendingRequestsAlert({ loggedInUsername }: PendingRequestsAlertProps) {
  const [pendingOvertimeCount, setPendingOvertimeCount] = useState(0);
  const [pendingAbsenceCount, setPendingAbsenceCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const loadPendingCounts = useCallback(() => {
    if (!isClient) return;
    setIsLoading(true);
    try {
      const storedOvertimeRaw = localStorage.getItem(OVERTIME_REQUESTS_STORAGE_KEY);
      let overtimeCount = 0;
      if (storedOvertimeRaw) {
        const parsedOvertime: OvertimeRequest[] = JSON.parse(storedOvertimeRaw);
        overtimeCount = parsedOvertime.filter(req => req.approvalStatus === 'pending').length;
      }
      setPendingOvertimeCount(overtimeCount);

      const storedAbsenceRaw = localStorage.getItem(ABSENCE_REQUESTS_STORAGE_KEY);
      let absenceCount = 0;
      if (storedAbsenceRaw) {
        const parsedAbsence: AbsenceRequest[] = JSON.parse(storedAbsenceRaw);
        absenceCount = parsedAbsence.filter(req => req.approvalStatus === 'pending').length;
      }
      setPendingAbsenceCount(absenceCount);

    } catch (e) {
      console.error("Error loading pending requests counts:", e);
      setPendingOvertimeCount(0);
      setPendingAbsenceCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [isClient]);

  useEffect(() => {
    if (isClient) {
      loadPendingCounts(); // Initial load

      const handleOvertimeUpdate = () => {
        console.log("PendingRequestsAlert: overtimeRequestsUpdated event received");
        loadPendingCounts();
      };
      const handleAbsenceUpdate = () => {
        console.log("PendingRequestsAlert: absenceRequestsUpdated event received");
        loadPendingCounts();
      };
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            console.log("PendingRequestsAlert: Tab became visible, reloading counts.");
            loadPendingCounts();
        }
      };


      window.addEventListener('overtimeRequestsUpdated', handleOvertimeUpdate);
      window.addEventListener('absenceRequestsUpdated', handleAbsenceUpdate);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        window.removeEventListener('overtimeRequestsUpdated', handleOvertimeUpdate);
        window.removeEventListener('absenceRequestsUpdated', handleAbsenceUpdate);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [isClient, loadPendingCounts]);

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

  const totalPending = pendingOvertimeCount + pendingAbsenceCount;

  if (totalPending === 0) {
    return (
       <Alert variant="default" className="mb-6 bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700">
        <BellRing className="h-5 w-5 text-green-600 dark:text-green-400" />
        <AlertTitle className="font-semibold text-green-700 dark:text-green-300">Notifications de Demandes</AlertTitle>
        <AlertDescription className="text-sm text-green-600 dark:text-green-400">
          Aucune demande de dépassement d'horaire ou d'absence en attente d'approbation.
        </AlertDescription>
      </Alert>
    );
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
