
"use client";

import Link from 'next/link';
import { FileClock, PlusCircle, History, Eye, Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CurrentDate } from '@/components/current-date';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { OvertimeRequestStub, OvertimeRequestStatus } from './types';
import OvertimeRequestDialog from './components/OvertimeRequestDialog';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { BrigadeMember } from '@/app/dashboard/time-tracking/types'; // Import BrigadeMember

const OVERTIME_REQUESTS_STORAGE_KEY = 'declaration_heure_overtime_requests_v2';
const BRIGADE_MEMBERS_STORAGE_KEY = 'time_tracking_members_v2';
const LOGGED_IN_USERNAME_KEY = 'loggedInUsername';

export default function DeclarationHeurePage() {
  const [isClient, setIsClient] = useState(false);
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequestStub[]>([]);
  const [brigadeMembers, setBrigadeMembers] = useState<BrigadeMember[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loggedInUsername, setLoggedInUsername] = useState<string | null>(null);
  const [editingRequest, setEditingRequest] = useState<OvertimeRequestStub | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
    const username = localStorage.getItem(LOGGED_IN_USERNAME_KEY);
    setLoggedInUsername(username);
  }, []);

  useEffect(() => {
    if (isClient) {
      try {
        const storedRequests = localStorage.getItem(OVERTIME_REQUESTS_STORAGE_KEY);
        if (storedRequests) {
          setOvertimeRequests(JSON.parse(storedRequests).map((req: any) => ({
            ...req,
            requestDate: req.requestDate || new Date().toISOString(), // Ensure requestDate exists
          })));
        }
        const storedBrigadeMembers = localStorage.getItem(BRIGADE_MEMBERS_STORAGE_KEY);
        if (storedBrigadeMembers) {
          setBrigadeMembers(JSON.parse(storedBrigadeMembers));
        }
      } catch (e) {
        console.error("Error loading data from localStorage", e);
        toast({ title: "Erreur de chargement des données", variant: "destructive" });
      }
    }
  }, [isClient, toast]);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem(OVERTIME_REQUESTS_STORAGE_KEY, JSON.stringify(overtimeRequests));
    }
  }, [overtimeRequests, isClient]);

  const currentBrigadeMember = useMemo(() => {
    if (loggedInUsername && brigadeMembers.length > 0) {
      return brigadeMembers.find(bm => bm.name.toLowerCase() === loggedInUsername.toLowerCase());
    }
    return null;
  }, [loggedInUsername, brigadeMembers]);

  const handleAddOrUpdateOvertimeRequest = useCallback((
    data: Omit<OvertimeRequestStub, 'id' | 'employeeName' | 'requestDate' | 'status'>
  ) => {
    if (!loggedInUsername) {
      toast({ title: "Utilisateur non identifié", description: "Impossible de soumettre la demande.", variant: "destructive" });
      return;
    }
    
    const employeeNameToUse = currentBrigadeMember?.name || loggedInUsername;
    // If form provides a position and it's different from currentBrigadeMember.role, use form's. Otherwise, use currentBrigadeMember.role.
    const positionToUse = data.position || currentBrigadeMember?.role;


    if (editingRequest) {
      setOvertimeRequests(prev => prev.map(req => 
        req.id === editingRequest.id 
        ? { 
            ...editingRequest, 
            ...data,
            position: positionToUse, // Ensure position is updated if changed, or keeps prefill
            employeeName: employeeNameToUse, // Keep original employeeName if editing, though it should match
          }
        : req
      ).sort((a,b) => parseISO(b.requestDate).getTime() - parseISO(a.requestDate).getTime()));
      toast({ title: "Demande Modifiée", description: "Votre demande de dépassement d'horaire a été mise à jour." });
      setEditingRequest(null);
    } else {
      const newRequest: OvertimeRequestStub = {
        id: `or_${Date.now()}`,
        employeeName: employeeNameToUse,
        requestDate: new Date().toISOString(),
        status: 'en_attente',
        reasonStub: data.reasonStub,
        position: positionToUse,
        prestationTypeNotes: data.prestationTypeNotes,
        overtimeDetailsNotes: data.overtimeDetailsNotes,
        totalOvertimeHours: data.totalOvertimeHours,
      };
      setOvertimeRequests(prev => [newRequest, ...prev].sort((a,b) => parseISO(b.requestDate).getTime() - parseISO(a.requestDate).getTime()));
      toast({ title: "Demande Soumise", description: "Votre demande de dépassement d'horaire a été enregistrée." });
    }
  }, [loggedInUsername, currentBrigadeMember, toast, editingRequest]);
  
  const handleDeleteRequest = (requestId: string) => {
    setOvertimeRequests(prev => prev.filter(req => req.id !== requestId));
    toast({ title: "Demande Supprimée", variant: "destructive" });
  };

  const handleOpenForm = (request?: OvertimeRequestStub) => {
    setEditingRequest(request || null);
    setIsFormOpen(true);
  };

  const getStatusBadgeVariant = (status: OvertimeRequestStatus) => {
    switch (status) {
      case 'approuvee': return 'success';
      case 'refusee': return 'destructive';
      case 'en_attente':
      default: return 'secondary';
    }
  };
   const getStatusLabel = (status: OvertimeRequestStatus) => {
    switch (status) {
      case 'approuvee': return 'Approuvée';
      case 'refusee': return 'Refusée';
      case 'en_attente':
      default: return 'En attente';
    }
  };

  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Chargement de la déclaration d'heures...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 min-h-screen">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <div className="flex items-center space-x-3">
           <FileClock className="w-10 h-10 text-accent" />
           <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-foreground title-glow text-center sm:text-left">
             Déclaration d'Heures
           </h1>
        </div>
      </div>
      <div className="mb-6 text-center sm:text-left">
        <CurrentDate />
      </div>
      
      <Card className="shadow-xl mb-6">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <CardTitle>Demandes de Dépassement d'Horaire</CardTitle>
            <CardDescription>
              Soumettez et suivez vos demandes de dépassement d'horaire.
            </CardDescription>
          </div>
          <Button onClick={() => handleOpenForm()}>
            <PlusCircle className="mr-2 h-4 w-4"/> Nouvelle Demande
          </Button>
        </CardHeader>
        <CardContent>
          {overtimeRequests.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">Aucune demande de dépassement soumise.</p>
          ) : (
            <ScrollArea className="h-[calc(100vh-26rem)] sm:h-[calc(100vh-24rem)]"> 
              <div className="space-y-3 pr-3">
                {overtimeRequests.map(req => (
                  <Card key={req.id} className="bg-card/60">
                    <CardHeader className="pb-2 pt-3 px-4">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-md">
                          Demande du {format(parseISO(req.requestDate), "dd/MM/yyyy HH:mm", {locale: fr})}
                        </CardTitle>
                        <Badge variant={getStatusBadgeVariant(req.status)}>
                          {getStatusLabel(req.status)}
                        </Badge>
                      </div>
                      <CardDescription className="text-xs">
                        Par: {req.employeeName} {req.position && `(${req.position})`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 space-y-1">
                      <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground/80">Motif:</span> {req.reasonStub}</p>
                      {req.prestationTypeNotes && <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Prestation:</span> {req.prestationTypeNotes}</p>}
                      {req.overtimeDetailsNotes && <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Détail H.Supp:</span> {req.overtimeDetailsNotes}</p>}
                      {req.totalOvertimeHours && <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Total H.Supp:</span> {req.totalOvertimeHours}</p>}
                      <div className="mt-2 flex justify-end space-x-2 pt-1">
                          <Button variant="outline" size="sm" className="text-xs" onClick={() => handleOpenForm(req)}>
                            <Edit2 className="mr-1 h-3.5 w-3.5"/> Modifier
                          </Button>
                          {req.status === 'en_attente' && ( // Allow deletion only if pending
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" className="text-xs">
                                  <Trash2 className="mr-1 h-3.5 w-3.5"/> Annuler/Suppr.
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Annuler la demande ?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Cette action est irréversible.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Non</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteRequest(req.id)}>
                                    Oui, annuler
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <OvertimeRequestDialog
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmitRequest={handleAddOrUpdateOvertimeRequest}
        editingRequest={editingRequest}
        currentUser={currentBrigadeMember ? { name: currentBrigadeMember.name, role: currentBrigadeMember.role } : 
                     loggedInUsername ? {name: loggedInUsername, role: ''} : null}
      />

      <Card className="shadow-xl opacity-50 cursor-not-allowed">
        <CardHeader>
          <CardTitle>Demandes d'Absence</CardTitle>
          <CardDescription>
            Soumettez et suivez vos demandes d'absence (fonctionnalité à venir).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-6">
            Le module de demande d'absence sera développé prochainement.
          </p>
        </CardContent>
      </Card>

    </div>
  );
}
