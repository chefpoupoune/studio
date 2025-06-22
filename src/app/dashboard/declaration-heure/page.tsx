
"use client";

import Link from 'next/link';
import { FileClock, PlusCircle, History, Eye, Trash2, Edit2, CheckSquare, ListFilter, Clock, CalendarOff, FileText as PdfFileTextIcon, MailQuestion, Loader2, User, CalendarClock } from 'lucide-react'; 
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CurrentDate } from '@/components/current-date';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { OvertimeRequest, PrestationType, AbsenceRequest } from './types';
import { PRESTATION_TYPE_LABELS } from './types';
import OvertimeRequestDialog from './components/OvertimeRequestDialog';
import AbsenceRequestDialog from './components/AbsenceRequestDialog';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid, differenceInCalendarDays } from 'date-fns';
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
import type { BrigadeMember } from '@/app/dashboard/time-tracking/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile'; 
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import { firestore } from '@/lib/firebase';
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  doc,
  setDoc,
  deleteDoc,
  Timestamp,
  serverTimestamp, // For server-side timestamping if needed, though client-side is fine for updatedAt
} from 'firebase/firestore';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const BRIGADE_MEMBERS_STORAGE_KEY = 'time_tracking_members_v2'; 
const LOGGED_IN_USERNAME_KEY = 'loggedInUsername';


interface DeclarationHeureTab {
  value: string;
  label: string;
  Icon: React.ElementType;
}

export default function DeclarationHeurePage() {
  const [isClient, setIsClient] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>([]);
  const [isOvertimeFormOpen, setIsOvertimeFormOpen] = useState(false);
  const [editingOvertimeRequest, setEditingOvertimeRequest] = useState<OvertimeRequest | null>(null);
  const [isOvertimeApproverViewActive, setIsOvertimeApproverViewActive] = useState(false);

  const [absenceRequests, setAbsenceRequests] = useState<AbsenceRequest[]>([]);
  const [isAbsenceFormOpen, setIsAbsenceFormOpen] = useState(false);
  const [editingAbsenceRequest, setEditingAbsenceRequest] = useState<AbsenceRequest | null>(null);
  const [isAbsenceApproverViewActive, setIsAbsenceApproverViewActive] = useState(false);
  
  const [brigadeMembers, setBrigadeMembers] = useState<BrigadeMember[]>([]);
  const [loggedInUsername, setLoggedInUsername] = useState<string | null>(null);
  
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const isChef = useMemo(() => loggedInUsername?.toLowerCase() === 'chef', [loggedInUsername]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    
    const fetchInitialLocalData = async () => {
        try {
            const storedBrigadeMembersRaw = localStorage.getItem(BRIGADE_MEMBERS_STORAGE_KEY);
            if (storedBrigadeMembersRaw) {
                setBrigadeMembers(JSON.parse(storedBrigadeMembersRaw));
            } else {
                const membersCollectionRef = collection(firestore, 'brigadeMembers');
                const q = query(membersCollectionRef, orderBy("name"));
                const querySnapshot = await getDocs(q);
                const membersList = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as BrigadeMember));
                setBrigadeMembers(membersList);
            }
            
            const usernameFromStorage = localStorage.getItem(LOGGED_IN_USERNAME_KEY);
            setLoggedInUsername(usernameFromStorage);
        } catch (e) {
            console.error("[DeclarationHeurePage LOAD Local] Error loading brigade members or username from localStorage", e);
            setBrigadeMembers([]); 
            setLoggedInUsername(null);
            toast({ title: "Erreur de chargement initial (local)", variant: "destructive" });
        }
    };
    fetchInitialLocalData();
  }, [isClient, toast]);

  const fetchOvertimeRequests = useCallback(async () => {
    if (!isClient) return;
    setDataLoaded(false);
    try {
      const overtimeCollectionRef = collection(firestore, 'overtimeRequests');
      const q = query(overtimeCollectionRef, orderBy('requestDate', 'desc'));
      const querySnapshot = await getDocs(q);
      const requestsList = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          requestDate: (data.requestDate as Timestamp)?.toDate ? (data.requestDate as Timestamp).toDate().toISOString() : new Date(data.requestDate).toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate ? (data.updatedAt as Timestamp).toDate().toISOString() : new Date(data.updatedAt).toISOString(),
          employeeSignatureDate: data.employeeSignatureDate && (data.employeeSignatureDate as Timestamp)?.toDate ? (data.employeeSignatureDate as Timestamp).toDate().toISOString() : null,
          directManagerSignatureDate: data.directManagerSignatureDate && (data.directManagerSignatureDate as Timestamp)?.toDate ? (data.directManagerSignatureDate as Timestamp).toDate().toISOString() : null,
          directorSignatureDate: data.directorSignatureDate && (data.directorSignatureDate as Timestamp)?.toDate ? (data.directorSignatureDate as Timestamp).toDate().toISOString() : null,
          decisionDate: data.decisionDate && (data.decisionDate as Timestamp)?.toDate ? (data.decisionDate as Timestamp).toDate().toISOString() : null,
          overtimeDetails: (data.overtimeDetails || []).map((detail: any) => ({
            ...detail,
            date: detail.date && (detail.date as Timestamp)?.toDate ? (detail.date as Timestamp).toDate().toISOString() : new Date(detail.date).toISOString(),
          })),
        } as OvertimeRequest;
      });
      setOvertimeRequests(requestsList);
      console.log(`[DeclarationHeurePage LOAD OT] Loaded ${requestsList.length} overtime requests from Firestore.`);
    } catch (e) {
      console.error("[DeclarationHeurePage LOAD OT] Error loading overtime requests from Firestore", e);
      setOvertimeRequests([]);
      toast({ title: "Erreur chargement demandes dépassement", variant: "destructive" });
    } finally {
      setDataLoaded(true);
    }
  }, [isClient, toast]);

  const fetchAbsenceRequests = useCallback(async () => {
    if (!isClient) return;
    setDataLoaded(false);
    try {
      const absenceCollectionRef = collection(firestore, 'absenceRequests');
      const q = query(absenceCollectionRef, orderBy('requestDate', 'desc'));
      const querySnapshot = await getDocs(q);
      const requestsList = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          requestDate: (data.requestDate as Timestamp)?.toDate ? (data.requestDate as Timestamp).toDate().toISOString() : new Date(data.requestDate).toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate ? (data.updatedAt as Timestamp).toDate().toISOString() : new Date(data.updatedAt).toISOString(),
          startDate: data.startDate && (data.startDate as Timestamp)?.toDate ? (data.startDate as Timestamp).toDate().toISOString() : new Date(data.startDate).toISOString(),
          endDate: data.endDate && (data.endDate as Timestamp)?.toDate ? (data.endDate as Timestamp).toDate().toISOString() : new Date(data.endDate).toISOString(),
          employeeSignatureDate: data.employeeSignatureDate && (data.employeeSignatureDate as Timestamp)?.toDate ? (data.employeeSignatureDate as Timestamp).toDate().toISOString() : null,
          directManagerSignatureDate: data.directManagerSignatureDate && (data.directManagerSignatureDate as Timestamp)?.toDate ? (data.directManagerSignatureDate as Timestamp).toDate().toISOString() : null,
          directorSignatureDate: data.directorSignatureDate && (data.directorSignatureDate as Timestamp)?.toDate ? (data.directorSignatureDate as Timestamp).toDate().toISOString() : null,
          decisionDate: data.decisionDate && (data.decisionDate as Timestamp)?.toDate ? (data.decisionDate as Timestamp).toDate().toISOString() : null,
        } as AbsenceRequest;
      });
      setAbsenceRequests(requestsList);
      console.log(`[DeclarationHeurePage LOAD ABS] Loaded ${requestsList.length} absence requests from Firestore.`);
    } catch (e) {
      console.error("[DeclarationHeurePage LOAD ABS] Error loading absence requests from Firestore", e);
      setAbsenceRequests([]);
      toast({ title: "Erreur chargement demandes d'absence", variant: "destructive" });
    } finally {
      setDataLoaded(true);
    }
  }, [isClient, toast]);

  useEffect(() => {
    if (isClient) {
      fetchOvertimeRequests();
      fetchAbsenceRequests();
    }
  }, [isClient, fetchOvertimeRequests, fetchAbsenceRequests]);


  const currentBrigadeMember = useMemo(() => {
    if (loggedInUsername && brigadeMembers.length > 0) {
      return brigadeMembers.find(bm => bm.name.toLowerCase() === loggedInUsername.toLowerCase());
    }
    return null;
  }, [loggedInUsername, brigadeMembers]);

  const handleAddOrUpdateOvertimeRequest = useCallback(async (
    data: Partial<Omit<OvertimeRequest, 'id' | 'employeeName' | 'requestDate' | 'updatedAt' >>
  ) => {
    if (!dataLoaded) { toast({ title: "Données non prêtes", variant: "default" }); return; }
    
    const employeeNameToUse = editingOvertimeRequest?.employeeName || currentBrigadeMember?.name || loggedInUsername || "Système";
    const positionToUse = data.position || (editingOvertimeRequest ? editingOvertimeRequest.position : (currentBrigadeMember?.role || ''));
    const brigadeMemberIdToUse = editingOvertimeRequest?.brigadeMemberId || currentBrigadeMember?.id;
    const now = new Date();

    const requestDataToSave = {
      ...data,
      employeeName: employeeNameToUse,
      position: positionToUse,
      brigadeMemberId: brigadeMemberIdToUse,
      requestDate: editingOvertimeRequest ? Timestamp.fromDate(new Date(editingOvertimeRequest.requestDate)) : Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
      employeeSignatureDate: data.employeeSignatureDate ? Timestamp.fromDate(new Date(data.employeeSignatureDate)) : null,
      directManagerSignatureDate: data.directManagerSignatureDate ? Timestamp.fromDate(new Date(data.directManagerSignatureDate)) : null,
      directorSignatureDate: data.directorSignatureDate ? Timestamp.fromDate(new Date(data.directorSignatureDate)) : null,
      decisionDate: data.decisionDate ? Timestamp.fromDate(new Date(data.decisionDate)) : null,
      overtimeDetails: (data.overtimeDetails || []).map(detail => ({
        ...detail,
        date: detail.date ? Timestamp.fromDate(new Date(detail.date)) : Timestamp.fromDate(new Date()),
      })),
      compensationType: null,
    };

    try {
      if (editingOvertimeRequest) {
        const originalStatus = editingOvertimeRequest.approvalStatus || 'pending';
        const newStatus = data.approvalStatus;

        if (newStatus && newStatus !== 'pending' && originalStatus === 'pending' && brigadeMemberIdToUse) {
            const notifTitle = "Demande de dépassement traitée";
            const notifMessage = `Votre demande de dépassement du ${format(parseISO(editingOvertimeRequest.requestDate), 'dd/MM/yyyy')} a été ${newStatus === 'accepted' ? 'acceptée' : 'refusée'}.`;
            const notificationData = {
                userId: brigadeMemberIdToUse,
                title: notifTitle,
                message: notifMessage,
                link: '/dashboard/declaration-heure',
                createdAt: Timestamp.fromDate(new Date()),
                isRead: false,
            };
            await addDoc(collection(firestore, 'notifications'), notificationData);
        }

        const docRef = doc(firestore, 'overtimeRequests', editingOvertimeRequest.id);
        await setDoc(docRef, requestDataToSave);
        toast({ title: "Demande Dépassement Modifiée" });
      } else {
        await addDoc(collection(firestore, 'overtimeRequests'), requestDataToSave);
        toast({ title: "Demande Dépassement Soumise" });
      }
      fetchOvertimeRequests();
      window.dispatchEvent(new CustomEvent('overtimeRequestsUpdated'));
    } catch (e) {
      console.error("Error saving overtime request to Firestore:", e);
      toast({ title: "Erreur sauvegarde demande dépassement", variant: "destructive"});
    }
    setEditingOvertimeRequest(null); 
  }, [editingOvertimeRequest, loggedInUsername, currentBrigadeMember, toast, dataLoaded, fetchOvertimeRequests]);
  
  const handleDeleteOvertimeRequest = async (requestId: string) => {
    if (!dataLoaded) return;
    try {
      await deleteDoc(doc(firestore, 'overtimeRequests', requestId));
      fetchOvertimeRequests();
      window.dispatchEvent(new CustomEvent('overtimeRequestsUpdated'));
      toast({ title: "Demande Dépassement Supprimée", variant: "destructive" });
    } catch (e) {
      console.error("Error deleting overtime request from Firestore:", e);
      toast({ title: "Erreur suppression demande dépassement", variant: "destructive" });
    }
  };

  const handleOpenOvertimeForm = (request?: OvertimeRequest, approverMode: boolean = false) => {
    setEditingOvertimeRequest(request || null);
    setIsOvertimeApproverViewActive(approverMode);
    setIsOvertimeFormOpen(true);
  };

  const handleAddOrUpdateAbsenceRequest = useCallback(async (
    data: Partial<Omit<AbsenceRequest, 'id' | 'employeeName' | 'requestDate' | 'updatedAt'>>
  ) => {
    if (!dataLoaded) { toast({ title: "Données non prêtes", variant: "default"}); return; }
    
    const employeeNameToUse = editingAbsenceRequest?.employeeName || currentBrigadeMember?.name || loggedInUsername || "Système";
    const positionToUse = data.position || (editingAbsenceRequest ? editingAbsenceRequest.position : (currentBrigadeMember?.role || ''));
    const brigadeMemberIdToUse = editingAbsenceRequest?.brigadeMemberId || currentBrigadeMember?.id;
    const now = new Date();

    const requestDataToSave = {
      ...data,
      employeeName: employeeNameToUse,
      position: positionToUse,
      brigadeMemberId: brigadeMemberIdToUse,
      requestDate: editingAbsenceRequest ? Timestamp.fromDate(new Date(editingAbsenceRequest.requestDate)) : Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
      startDate: data.startDate ? Timestamp.fromDate(new Date(data.startDate)) : Timestamp.fromDate(new Date()),
      endDate: data.endDate ? Timestamp.fromDate(new Date(data.endDate)) : Timestamp.fromDate(new Date()),
      employeeSignatureDate: data.employeeSignatureDate ? Timestamp.fromDate(new Date(data.employeeSignatureDate)) : null,
      directManagerSignatureDate: data.directManagerSignatureDate ? Timestamp.fromDate(new Date(data.directManagerSignatureDate)) : null,
      directorSignatureDate: data.directorSignatureDate ? Timestamp.fromDate(new Date(data.directorSignatureDate)) : null,
      decisionDate: data.decisionDate ? Timestamp.fromDate(new Date(data.decisionDate)) : null,
    };
    
    try {
      if (editingAbsenceRequest) {
          const originalStatus = editingAbsenceRequest.approvalStatus || 'pending';
          const newStatus = data.approvalStatus;

          if (newStatus && newStatus !== 'pending' && originalStatus === 'pending' && brigadeMemberIdToUse) {
              const notifTitle = "Demande d'absence traitée";
              const notifMessage = `Votre demande d'absence du ${format(parseISO(editingAbsenceRequest.startDate), 'dd/MM/yy')} au ${format(parseISO(editingAbsenceRequest.endDate), 'dd/MM/yy')} a été ${newStatus === 'accepted' ? 'acceptée' : 'refusée'}.`;
              const notificationData = {
                  userId: brigadeMemberIdToUse,
                  title: notifTitle,
                  message: notifMessage,
                  link: '/dashboard/declaration-heure',
                  createdAt: Timestamp.fromDate(new Date()),
                  isRead: false,
              };
              await addDoc(collection(firestore, 'notifications'), notificationData);
          }

          const docRef = doc(firestore, 'absenceRequests', editingAbsenceRequest.id);
          await setDoc(docRef, requestDataToSave);
          toast({ title: "Demande d'Absence Modifiée" });
      } else {
          await addDoc(collection(firestore, 'absenceRequests'), requestDataToSave);
          toast({ title: "Demande d'Absence Soumise" });
      }
      fetchAbsenceRequests();
      window.dispatchEvent(new CustomEvent('absenceRequestsUpdated'));
    } catch (e) {
      console.error("Error saving absence request to Firestore:", e);
      toast({ title: "Erreur sauvegarde demande d'absence", variant: "destructive"});
    }
    setEditingAbsenceRequest(null);
  }, [editingAbsenceRequest, loggedInUsername, currentBrigadeMember, toast, dataLoaded, fetchAbsenceRequests]);

  const handleDeleteAbsenceRequest = async (requestId: string) => {
    if (!dataLoaded) return;
     try {
      await deleteDoc(doc(firestore, 'absenceRequests', requestId));
      fetchAbsenceRequests();
      window.dispatchEvent(new CustomEvent('absenceRequestsUpdated'));
      toast({ title: "Demande d'Absence Supprimée", variant: "destructive" });
    } catch (e) {
      console.error("Error deleting absence request from Firestore:", e);
      toast({ title: "Erreur suppression demande d'absence", variant: "destructive" });
    }
  };

  const handleOpenAbsenceForm = (request?: AbsenceRequest, approverMode: boolean = false) => {
    setEditingAbsenceRequest(request || null);
    setIsAbsenceApproverViewActive(approverMode);
    setIsAbsenceFormOpen(true);
  };

  const getStatusBadgeVariant = (status?: OvertimeRequest['approvalStatus'] | AbsenceRequest['approvalStatus']) => {
    switch (status) { case 'accepted': return 'success'; case 'rejected': return 'destructive'; case 'pending': default: return 'secondary'; }
  };
  const getStatusLabel = (status?: OvertimeRequest['approvalStatus'] | AbsenceRequest['approvalStatus']) => {
    switch (status) { case 'accepted': return 'Acceptée'; case 'rejected': return 'Refusée'; case 'pending': default: return 'En attente'; }
  };

  const renderOvertimeRequestList = (requestsToList: OvertimeRequest[], approverModeView: boolean) => (
    requestsToList.length === 0 ? (
      <p className="text-muted-foreground text-center py-6">
        {approverModeView ? "Aucune demande à approuver pour le moment." : "Vous n'avez aucune demande de dépassement d'horaire."}
      </p>
    ) : (
      <ScrollArea className="h-[calc(100vh-26rem)] sm:h-[calc(100vh-24rem)]"> 
        <div className="space-y-3 pr-3">
          {requestsToList.map(req => (
            <Card key={req.id} className="bg-card/60">
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-md">Demande du {format(parseISO(req.requestDate), "dd/MM/yyyy HH:mm", {locale: fr})}</CardTitle>
                  <Badge variant={getStatusBadgeVariant(req.approvalStatus)}>{getStatusLabel(req.approvalStatus)}</Badge>
                </div>
                <CardDescription className="text-xs">
                  Par: {req.employeeName} {req.position && `(${req.position})`}
                  {req.updatedAt && isValid(parseISO(req.updatedAt)) && ` | Modifié le: ${format(parseISO(req.updatedAt), "dd/MM/yy HH:mm", { locale: fr })}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1 text-xs">
                <p className="text-muted-foreground"><span className="font-medium text-foreground/80">Motif:</span> {req.reasonStub}</p>
                {req.prestationTypes && req.prestationTypes.length > 0 && (
                    <p className="text-muted-foreground"><span className="font-medium text-foreground/80">Prestations:</span>{' '}{req.prestationTypes.map(pt => PRESTATION_TYPE_LABELS[pt as PrestationType] || pt).join(', ')}{req.prestationTypes.includes('autres') && req.prestationTypeAutresDetail && ` (${req.prestationTypeAutresDetail})`}</p>
                )}
                {req.overtimeDetails && req.overtimeDetails.length > 0 && (
                  <div className="mt-1">
                    <span className="font-medium text-foreground/80 flex items-center gap-1 mb-0.5"><Clock className="h-3 w-3 text-primary/70"/>Détail H.Supp:</span>
                    <ul className="list-none pl-2 text-muted-foreground space-y-0.5">
                      {req.overtimeDetails.map((detail, index) => (
                        <li key={detail.id || index} className="flex items-center gap-1.5">
                          <CalendarClock className="h-3 w-3 text-primary/70"/>
                          {detail.date && isValid(parseISO(detail.date)) ? format(parseISO(detail.date), "dd/MM/yy", {locale: fr}) : 'Date invalide'}
                          {detail.startTime && detail.endTime ? `: de ${detail.startTime} à ${detail.endTime}` : 
                            detail.startTime ? `: à partir de ${detail.startTime}` : 
                            detail.endTime ? `: jusqu'à ${detail.endTime}` : ' (horaires non spécifiés)'}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {req.totalOvertimeHours && <p className="text-muted-foreground mt-1"><span className="font-medium text-foreground/80">Total H.Supp:</span> {req.totalOvertimeHours}</p>}
                {req.approvalStatus && req.approvalStatus !== 'pending' && (
                  <div className="border-t mt-2 pt-1">
                    <p className="font-medium text-foreground/80">Décision Direction:</p>
                    {req.approvalStatus === 'rejected' && req.rejectionReason && <p>Motif refus: {req.rejectionReason}</p>}
                    {req.decisionDate && isValid(parseISO(req.decisionDate)) && <p>Date Décision: {format(parseISO(req.decisionDate), "dd/MM/yyyy", {locale:fr})}</p>}
                  </div>
                )}
                <div className="mt-2 flex justify-end space-x-2 pt-1">
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => handleOpenOvertimeForm(req, approverModeView)}>
                      <Edit2 className="mr-1 h-3.5 w-3.5"/> {approverModeView ? "Traiter / Voir" : ((req.approvalStatus === 'accepted' || req.approvalStatus === 'rejected') ? "Voir" : "Modifier")}
                    </Button>
                    {approverModeView && isChef && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" className="text-xs">
                                    <Trash2 className="mr-1 h-3.5 w-3.5"/> Supprimer
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Supprimer la demande ?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Êtes-vous sûr de vouloir supprimer la demande de {req.employeeName} du {isValid(parseISO(req.requestDate)) ? format(parseISO(req.requestDate), "dd/MM/yyyy") : 'date inconnue'}? Cette action est irréversible.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Non</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteOvertimeRequest(req.id)}>
                                        Oui, supprimer
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                    {(!approverModeView && (req.approvalStatus === 'pending' || !req.approvalStatus)) && ( 
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" className="text-xs">
                            <Trash2 className="mr-1 h-3.5 w-3.5"/> Annuler/Suppr.
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Annuler la demande ?</AlertDialogTitle><AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Non</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteOvertimeRequest(req.id)}>Oui, annuler</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                      </AlertDialog>
                    )}
                    {req.approvalStatus === 'accepted' && (
                      <Button variant="default" size="sm" className="text-xs" onClick={() => handleGenerateOvertimeRequestPdf(req)}><PdfFileTextIcon className="mr-1 h-3.5 w-3.5"/> Générer PDF</Button>
                    )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    )
  );

  const renderAbsenceRequestList = (requestsToList: AbsenceRequest[], approverModeView: boolean) => (
    requestsToList.length === 0 ? (
      <p className="text-muted-foreground text-center py-6">
        {approverModeView ? "Aucune demande d'absence à approuver." : "Vous n'avez aucune demande d'absence."}
      </p>
    ) : (
      <ScrollArea className="h-[calc(100vh-26rem)] sm:h-[calc(100vh-24rem)]">
        <div className="space-y-3 pr-3">
          {requestsToList.map(req => (
            <Card key={req.id} className="bg-card/60">
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex justify-between items-start">
                    <CardTitle className="text-md">Absence du {format(parseISO(req.startDate), "dd/MM/yy", {locale: fr})} au {format(parseISO(req.endDate), "dd/MM/yy", {locale: fr})}</CardTitle>
                    <Badge variant={getStatusBadgeVariant(req.approvalStatus)}>{getStatusLabel(req.approvalStatus)}</Badge>
                </div>
                <CardDescription className="text-xs">
                  Demandé par: {req.employeeName} {req.position && `(${req.position})`}
                  {req.hoursPerDay && ` | ${req.hoursPerDay}h/j`}
                  {req.totalAbsenceHours && req.totalAbsenceHours > 0 && ` (Total: ${req.totalAbsenceHours.toFixed(1)}h)`}
                  {` | Le: ${format(parseISO(req.requestDate), "dd/MM/yy HH:mm", { locale: fr })}`}
                  {req.updatedAt && isValid(parseISO(req.updatedAt)) && ` | Modifié le: ${format(parseISO(req.updatedAt), "dd/MM/yy HH:mm", { locale: fr })}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1 text-xs">
                {req.prestationTypes && req.prestationTypes.length > 0 && (
                    <p className="text-muted-foreground"><span className="font-medium text-foreground/80">Prestations:</span>{' '}{req.prestationTypes.map(pt => PRESTATION_TYPE_LABELS[pt as PrestationType] || pt).join(', ')}{req.prestationTypes.includes('autres') && req.prestationTypeAutresDetail && ` (${req.prestationTypeAutresDetail})`}</p>
                )}
                {req.reason && <p className="text-muted-foreground"><span className="font-medium text-foreground/80">Motif:</span> {req.reason}</p>}
                {req.numberOfDays && <p className="text-muted-foreground"><span className="font-medium text-foreground/80">Durée:</span> {req.numberOfDays} jour(s)</p>}
                {req.approvalStatus && req.approvalStatus !== 'pending' && (
                  <div className="border-t mt-2 pt-1">
                    <p className="font-medium text-foreground/80">Décision Direction:</p>
                    {req.approvalStatus === 'rejected' && req.rejectionReason && <p>Motif refus: {req.rejectionReason}</p>}
                    {req.decisionDate && isValid(parseISO(req.decisionDate)) && <p>Date Décision: {format(parseISO(req.decisionDate), "dd/MM/yyyy", {locale:fr})}</p>}
                  </div>
                )}
                 <div className="mt-2 flex justify-end space-x-2 pt-1">
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => handleOpenAbsenceForm(req, approverModeView)}>
                      <Edit2 className="mr-1 h-3.5 w-3.5"/> {(approverModeView || req.approvalStatus === 'accepted' || req.approvalStatus === 'rejected') ? "Voir / Traiter" : "Modifier"}
                    </Button>
                    {approverModeView && isChef && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm" className="text-xs">
                                    <Trash2 className="mr-1 h-3.5 w-3.5"/> Supprimer
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Supprimer la demande d'absence ?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Êtes-vous sûr de vouloir supprimer la demande d'absence de {req.employeeName} du {isValid(parseISO(req.startDate)) ? format(parseISO(req.startDate), "dd/MM/yyyy") : 'date inconnue'}? Cette action est irréversible.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Non</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteAbsenceRequest(req.id)}>
                                        Oui, supprimer
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                    {(!approverModeView && (req.approvalStatus === 'pending' || !req.approvalStatus)) && ( 
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" className="text-xs"><Trash2 className="mr-1 h-3.5 w-3.5"/> Annuler/Suppr.</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Annuler la demande d'absence ?</AlertDialogTitle><AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Non</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteAbsenceRequest(req.id)}>Oui, annuler</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                      </AlertDialog>
                    )}
                    {req.approvalStatus === 'accepted' && (
                       <Button variant="default" size="sm" className="text-xs" onClick={() => handleGenerateAbsenceRequestPdf(req)}><PdfFileTextIcon className="mr-1 h-3.5 w-3.5"/> Générer PDF</Button>
                    )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    )
  );

  const employeeOvertimeRequests = useMemo(() => {
    if (!isClient || !loggedInUsername || !dataLoaded) return [];
    return overtimeRequests.filter(req => req.employeeName.toLowerCase() === loggedInUsername.toLowerCase());
  }, [isClient, loggedInUsername, overtimeRequests, dataLoaded]);

  const employeeAbsenceRequests = useMemo(() => {
    if (!isClient || !loggedInUsername || !dataLoaded) return [];
    return absenceRequests.filter(req => req.employeeName.toLowerCase() === loggedInUsername.toLowerCase());
  }, [isClient, loggedInUsername, absenceRequests, dataLoaded]);
  
  const allOvertimeRequestsForChef = useMemo(() => {
     if (!isClient || !dataLoaded) return [];
    return overtimeRequests;
  }, [isClient, overtimeRequests, dataLoaded]);

  const allAbsenceRequestsForChef = useMemo(() => {
     if (!isClient || !dataLoaded) return [];
    return absenceRequests;
  }, [isClient, absenceRequests, dataLoaded]);
  
  const declarationHeureTabsConfig: DeclarationHeureTab[] = [
    { value: "my-overtime-requests", label: "Dépassement Horaire", Icon: History },
    { value: "my-absence-requests", label: "Demandes Absence", Icon: CalendarOff },
  ];
  if (isChef) {
    declarationHeureTabsConfig.push({ value: "overtime-approval", label: "Approb. Dépassement", Icon: CheckSquare });
    declarationHeureTabsConfig.push({ value: "absence-approval", label: "Approb. Absence", Icon: MailQuestion });
  }

  const [activeTab, setActiveTab] = useState(declarationHeureTabsConfig[0].value);
  
  const getTabContent = (tabValue: string) => {
    switch (tabValue) {
      case "my-overtime-requests":
        return (
          <Card className="shadow-xl">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div><CardTitle>Mes Demandes de Dépassement d'Horaire</CardTitle><CardDescription>Soumettez et suivez vos demandes.</CardDescription></div>
              <Button 
                onClick={() => handleOpenOvertimeForm(undefined, false)} 
                disabled={!dataLoaded || (!currentBrigadeMember && !isChef)}
              >
                <PlusCircle className="mr-2 h-4 w-4"/> Nouvelle Demande Dépassement
              </Button>
            </CardHeader>
            <CardContent>{renderOvertimeRequestList(isChef ? allOvertimeRequestsForChef : employeeOvertimeRequests, false)}</CardContent>
          </Card>
        );
      case "my-absence-requests":
        return (
          <Card className="shadow-xl">
             <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div><CardTitle>Mes Demandes d'Absence</CardTitle><CardDescription>Soumettez et suivez vos demandes.</CardDescription></div>
              <Button 
                onClick={() => handleOpenAbsenceForm(undefined, false)} 
                disabled={!dataLoaded || (!currentBrigadeMember && !isChef)}
              >
                <PlusCircle className="mr-2 h-4 w-4"/> Nouvelle Demande Absence
              </Button>
            </CardHeader>
            <CardContent>{renderAbsenceRequestList(isChef ? allAbsenceRequestsForChef : employeeAbsenceRequests, false)}</CardContent>
          </Card>
        );
      case "overtime-approval":
        return isChef ? (
          <Card className="shadow-xl">
            <CardHeader><CardTitle>Approbation des Demandes de Dépassement</CardTitle><CardDescription>Traitez les demandes soumises.</CardDescription></CardHeader>
            <CardContent>{renderOvertimeRequestList(allOvertimeRequestsForChef, true)}</CardContent>
          </Card>
        ) : null;
      case "absence-approval": 
        return isChef ? (
          <Card className="shadow-xl">
            <CardHeader><CardTitle>Approbation des Demandes d'Absence</CardTitle><CardDescription>Traitez les demandes d'absence soumises.</CardDescription></CardHeader>
            <CardContent>{renderAbsenceRequestList(allAbsenceRequestsForChef, true)}</CardContent>
          </Card>
        ) : null;
      default:
        return null;
    }
  };

  const handleGenerateOvertimeRequestPdf = (request: OvertimeRequest) => {
    const pdfSettings = getPdfLayoutSettings('overtime_request_form');
    const doc = new jsPDF({ orientation: pdfSettings.orientation, unit: 'pt', format: pdfSettings.pageSize }) as jsPDFWithAutoTable;
    doc.setFont(pdfSettings.fontFamily);
    const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });
    let currentY = pdfSettings.marginTop;
    if (pdfSettings.logoUrl && pdfSettings.logoUrl.startsWith('data:image')) { try { const imgProps = doc.getImageProperties(pdfSettings.logoUrl); const formatType = imgProps.fileType.toUpperCase(); const desiredHeight = 30; const imgWidth = (imgProps.width * desiredHeight) / imgProps.height; doc.addImage(pdfSettings.logoUrl, formatType, pdfSettings.marginLeft, currentY, imgWidth, desiredHeight); currentY += desiredHeight + 5; } catch(e){ console.error("Error drawing logo in PDF:", e); }}
    if (pdfSettings.headerText) { const headerLines = pdfSettings.headerText.split('\n'); doc.setFontSize(pdfSettings.headerFontSize); headerLines.forEach(line => { doc.text(line, pdfSettings.marginLeft, currentY); currentY += pdfSettings.headerFontSize * 0.7 + 2; }); currentY += 5; }
    
    const moduleDefaultTitle = "Demande de Dépassement d'Horaire";
    let pdfTitle;
    if (pdfSettings.showDocumentBaseTitle && pdfSettings.documentBaseTitle && pdfSettings.documentBaseTitle.trim() !== "") {
      pdfTitle = `${pdfSettings.documentBaseTitle} - ${moduleDefaultTitle}`;
    } else {
      pdfTitle = moduleDefaultTitle;
    }
    doc.setFontSize(pdfSettings.documentTitleFontSize); 
    doc.text(pdfTitle, doc.internal.pageSize.getWidth() / 2, currentY, { align: 'center' }); 
    currentY += pdfSettings.documentTitleFontSize * 0.7 + 5;

    doc.setFontSize(pdfSettings.defaultFontSize); doc.text(`Nom et prénom du salarié : ${request.employeeName || 'N/A'}`, pdfSettings.marginLeft, currentY); currentY += 15;
    doc.text(`Poste occupé à l'IME : ${request.position || 'N/A'}`, pdfSettings.marginLeft, currentY); currentY += 20;
    const prestationText = (request.prestationTypes || []).map(pt => PRESTATION_TYPE_LABELS[pt] || pt).join(', ') + 
      ((request.prestationTypes || []).includes('autres') && request.prestationTypeAutresDetail ? ` (${request.prestationTypeAutresDetail})` : '');
    doc.text(`Prestation correspondante : ${prestationText || 'Logistique'}`, pdfSettings.marginLeft, currentY); currentY += 15;
    doc.text("Motif de la demande :", pdfSettings.marginLeft, currentY); currentY += 15; doc.text(request.reasonStub || 'N/A', pdfSettings.marginLeft + 10, currentY, { maxWidth: doc.internal.pageSize.getWidth() - pdfSettings.marginLeft - pdfSettings.marginRight - 20 }); currentY += (doc.splitTextToSize(request.reasonStub || 'N/A', doc.internal.pageSize.getWidth() - pdfSettings.marginLeft - pdfSettings.marginRight - 20).length * (pdfSettings.defaultFontSize * 0.7)) + 10;
    if (request.overtimeDetails && request.overtimeDetails.length > 0) { doc.text("Détail des heures supplémentaires :", pdfSettings.marginLeft, currentY); currentY += 5; doc.autoTable({ startY: currentY, head: [['Date', 'Heure début', 'Heure fin']], body: request.overtimeDetails.map(d => [ d.date && isValid(parseISO(d.date)) ? format(parseISO(d.date), 'dd/MM/yyyy', { locale: fr }) : 'N/A', d.startTime || '-', d.endTime || '-', ]), theme: 'grid', styles: { fontSize: pdfSettings.tableBodyFontSize, font: pdfSettings.fontFamily }, headStyles: { fillColor: hexToRgb(pdfSettings.primaryColor || '#CCCCCC') || [220,220,220], textColor: [0,0,0], fontSize: pdfSettings.tableHeaderFontSize }, margin: { left: pdfSettings.marginLeft, right: pdfSettings.marginRight }, }); currentY = (doc as any).lastAutoTable.finalY + 10; }
    doc.text(`Total des heures en plus de l'horaire prévu : ${request.totalOvertimeHours || 'N/A'}`, pdfSettings.marginLeft, currentY); currentY += 20;
    const sigDate = (dateStr: string | null | undefined) => dateStr && isValid(parseISO(dateStr)) ? format(parseISO(dateStr), "dd/MM/yyyy", { locale: fr }) : 'Non signé';
    doc.text(`Salarié(e) le : ${sigDate(request.employeeSignatureDate)}`, pdfSettings.marginLeft, currentY); currentY += 15; doc.text(`Le Responsable Direct le : ${sigDate(request.directManagerSignatureDate)}`, pdfSettings.marginLeft, currentY); currentY += 15; doc.text(`Le Directeur le : ${sigDate(request.directorSignatureDate)}`, pdfSettings.marginLeft, currentY); currentY += 25;
    doc.setFont(undefined, 'bold'); doc.text("CADRE RESERVE A LA DIRECTION", pdfSettings.marginLeft, currentY); doc.setFont(undefined, 'normal'); currentY += 15; doc.text(`Acceptée / Refusée : ${getStatusLabel(request.approvalStatus)}`, pdfSettings.marginLeft, currentY); currentY += 15;
    if (request.approvalStatus === 'rejected' && request.rejectionReason) { doc.text(`Si refusée, motif : ${request.rejectionReason}`, pdfSettings.marginLeft, currentY); currentY += 15; }
    doc.text(`Date : ${sigDate(request.decisionDate)}`, pdfSettings.marginLeft, currentY); currentY += 15; 
    doc.text(`Signature de la Direction : Dernoncourt Julien / Chef de cuisine`, pdfSettings.marginLeft, currentY);
    const pageCount = doc.internal.getNumberOfPages(); for (let i = 1; i <= pageCount; i++) { doc.setPage(i); if (pdfSettings.footerText) { let footerStr = pdfSettings.footerText.replace('{date}', generationDateFormatted).replace('{pageNumber}', i.toString()).replace('{totalPages}', pageCount.toString()); doc.setFontSize(pdfSettings.footerFontSize); doc.text(footerStr, pdfSettings.marginLeft, doc.internal.pageSize.height - (pdfSettings.marginBottom / 2)); }}
    doc.save(`Demande_Depassement_${request.employeeName.replace(/\s+/g, '_')}_${format(parseISO(request.requestDate), "yyyy-MM-dd")}.pdf`);
    toast({ title: "PDF Généré", description: `Le PDF pour la demande de ${request.employeeName} a été téléchargé.` });
  };
  
  const handleGenerateAbsenceRequestPdf = (request: AbsenceRequest) => {
    const pdfSettings = getPdfLayoutSettings('absence_request_form');
    const doc = new jsPDF({ orientation: pdfSettings.orientation, unit: 'pt', format: pdfSettings.pageSize }) as jsPDFWithAutoTable;
    doc.setFont(pdfSettings.fontFamily);
    const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });
    let currentY = pdfSettings.marginTop;

    if (pdfSettings.logoUrl && pdfSettings.logoUrl.startsWith('data:image')) { try { const imgProps = doc.getImageProperties(pdfSettings.logoUrl); const formatType = imgProps.fileType.toUpperCase(); const desiredHeight = 30; const imgWidth = (imgProps.width * desiredHeight) / imgProps.height; doc.addImage(pdfSettings.logoUrl, formatType, pdfSettings.marginLeft, currentY, imgWidth, desiredHeight); currentY += desiredHeight + 5; } catch(e){ console.error("Error drawing logo in PDF:", e); }}
    if (pdfSettings.headerText) { const headerLines = pdfSettings.headerText.split('\n'); doc.setFontSize(pdfSettings.headerFontSize); headerLines.forEach(line => { doc.text(line, pdfSettings.marginLeft, currentY); currentY += pdfSettings.headerFontSize * 0.7 + 2; }); currentY += 5; }

    const moduleDefaultTitle = "Demande d'Absence";
    let pdfTitle;
    if (pdfSettings.showDocumentBaseTitle && pdfSettings.documentBaseTitle && pdfSettings.documentBaseTitle.trim() !== "") {
      pdfTitle = `${pdfSettings.documentBaseTitle} - ${moduleDefaultTitle}`;
    } else {
      pdfTitle = moduleDefaultTitle;
    }
    doc.setFontSize(pdfSettings.documentTitleFontSize); 
    doc.text(pdfTitle, doc.internal.pageSize.getWidth() / 2, currentY, { align: 'center' }); 
    currentY += pdfSettings.documentTitleFontSize * 0.7 + 5;
    
    doc.setFontSize(pdfSettings.defaultFontSize);
    doc.text(`Nom et prénom du salarié : ${request.employeeName || 'N/A'}`, pdfSettings.marginLeft, currentY); currentY += 15;
    doc.text(`Poste occupé à l'IME : ${request.position || 'N/A'}`, pdfSettings.marginLeft, currentY); currentY += 15;
    
    const prestationAbsenceText = (request.prestationTypes || []).map(pt => PRESTATION_TYPE_LABELS[pt] || pt).join(', ') +
      ((request.prestationTypes || []).includes('autres') && request.prestationTypeAutresDetail ? ` (${request.prestationTypeAutresDetail})` : '');
    doc.text(`Prestation correspondante : ${prestationAbsenceText || 'Logistique'}`, pdfSettings.marginLeft, currentY); currentY += 15;

    doc.text(`Date de début : ${format(parseISO(request.startDate), "dd/MM/yyyy", { locale: fr })}`, pdfSettings.marginLeft, currentY); currentY += 15;
    doc.text(`Date de fin : ${format(parseISO(request.endDate), "dd/MM/yyyy", { locale: fr })}`, pdfSettings.marginLeft, currentY); currentY += 15;
    doc.text(`Nombre de jours d'absence : ${request.numberOfDays || 'N/A'}`, pdfSettings.marginLeft, currentY); currentY += 15;
    if(request.hoursPerDay) { doc.text(`Nombre d'heures par jour d'absence : ${request.hoursPerDay}h`, pdfSettings.marginLeft, currentY); currentY += 15;}
    if(request.totalAbsenceHours && request.totalAbsenceHours > 0) { doc.text(`Total heures d'absence : ${request.totalAbsenceHours.toFixed(1)}h`, pdfSettings.marginLeft, currentY); currentY += 15;}
    if (request.reason) { doc.text("Motif :", pdfSettings.marginLeft, currentY); currentY += 15; doc.text(request.reason, pdfSettings.marginLeft + 10, currentY, { maxWidth: doc.internal.pageSize.getWidth() - pdfSettings.marginLeft - pdfSettings.marginRight - 20 }); currentY += (doc.splitTextToSize(request.reason, doc.internal.pageSize.getWidth() - pdfSettings.marginLeft - pdfSettings.marginRight - 20).length * (pdfSettings.defaultFontSize * 0.7)) + 10;}
    
    const sigDate = (dateStr: string | null | undefined) => dateStr && isValid(parseISO(dateStr)) ? format(parseISO(dateStr), "dd/MM/yyyy", { locale: fr }) : 'Non signé';
    doc.text(`Salarié(e) le : ${sigDate(request.employeeSignatureDate)}`, pdfSettings.marginLeft, currentY); currentY += 15;
    doc.text(`Le Responsable Direct le : ${sigDate(request.directManagerSignatureDate)}`, pdfSettings.marginLeft, currentY); currentY += 15;
    doc.text(`Le Directeur le : ${sigDate(request.directorSignatureDate)}`, pdfSettings.marginLeft, currentY); currentY += 25;
    
    doc.setFont(undefined, 'bold'); doc.text("CADRE RESERVE A LA DIRECTION", pdfSettings.marginLeft, currentY); doc.setFont(undefined, 'normal'); currentY += 15;
    doc.text(`Acceptée / Refusée : ${getStatusLabel(request.approvalStatus)}`, pdfSettings.marginLeft, currentY); currentY += 15;
    if (request.approvalStatus === 'rejected' && request.rejectionReason) { doc.text(`Si refusée, motif : ${request.rejectionReason}`, pdfSettings.marginLeft, currentY); currentY += 15; }
    doc.text(`Date : ${sigDate(request.decisionDate)}`, pdfSettings.marginLeft, currentY); currentY += 15;
    doc.text(`Signature de la Direction : `, pdfSettings.marginLeft, currentY); 

    const pageCount = doc.internal.getNumberOfPages(); for (let i = 1; i <= pageCount; i++) { doc.setPage(i); if (pdfSettings.footerText) { let footerStr = pdfSettings.footerText.replace('{date}', generationDateFormatted).replace('{pageNumber}', i.toString()).replace('{totalPages}', pageCount.toString()); doc.setFontSize(pdfSettings.footerFontSize); doc.text(footerStr, pdfSettings.marginLeft, doc.internal.pageSize.height - (pdfSettings.marginBottom / 2)); }}
    doc.save(`Demande_Absence_${request.employeeName.replace(/\s+/g, '_')}_${format(parseISO(request.startDate), "yyyy-MM-dd")}.pdf`);
    toast({ title: "PDF Généré", description: `Le PDF pour la demande d'absence de ${request.employeeName} a été téléchargé.` });
  };


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
           <FileClock className="w-10 h-10 text-accent" />
           <h1 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-foreground title-glow text-center sm:text-left">
             Déclaration d'Heures et Absences
           </h1>
        </div>
      </div>
      <div className="mb-6 text-center sm:text-left">
        <CurrentDate />
      </div>
      
       <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {isMobile ? (
          <div className="mb-4">
            <Label htmlFor="mobile-declaration-nav-select" className="text-sm font-medium">Naviguer vers :</Label>
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger id="mobile-declaration-nav-select" className="w-full mt-1"><SelectValue placeholder="Choisir une section..." /></SelectTrigger>
              <SelectContent>{declarationHeureTabsConfig.map(tab => (<SelectItem key={tab.value} value={tab.value} className="text-sm"><span className="flex items-center"><tab.Icon className="mr-2 h-4 w-4" />{tab.label}</span></SelectItem>))}</SelectContent>
            </Select>
          </div>
        ) : (
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-1 mb-6 bg-card p-1 rounded-lg">
            {declarationHeureTabsConfig.map(tab => (<TabsTrigger key={tab.value} value={tab.value} className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-2 py-1"><tab.Icon className="mr-1 sm:mr-2 h-4 w-4" />{tab.label}</TabsTrigger>))}
          </TabsList>
        )}
        {declarationHeureTabsConfig.map(tab => (<TabsContent key={tab.value} value={tab.value}>{getTabContent(tab.value)}</TabsContent>))}
      </Tabs>

      <OvertimeRequestDialog
        isOpen={isOvertimeFormOpen} onOpenChange={setIsOvertimeFormOpen} onSubmitRequest={handleAddOrUpdateOvertimeRequest}
        editingRequest={editingOvertimeRequest}
        currentUser={currentBrigadeMember ? { name: currentBrigadeMember.name, role: currentBrigadeMember.role } : loggedInUsername ? {name: loggedInUsername, role: ''} : null}
        isApproverView={isOvertimeApproverViewActive}
      />
      
      <AbsenceRequestDialog
        isOpen={isAbsenceFormOpen} onOpenChange={setIsAbsenceFormOpen} onSubmitRequest={handleAddOrUpdateAbsenceRequest}
        editingRequest={editingAbsenceRequest}
        currentUser={currentBrigadeMember ? { name: currentBrigadeMember.name, role: currentBrigadeMember.role } : loggedInUsername ? {name: loggedInUsername, role: ''} : null}
        isApproverView={isAbsenceApproverViewActive}
      />
    </div>
  );
}


    
