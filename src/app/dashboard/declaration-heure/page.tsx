"use client";

import { FileClock, PlusCircle, History, Eye, Trash2, Edit2, CheckSquare, ListFilter, Clock, CalendarOff, FileText as PdfFileTextIcon, MailQuestion, Loader2, User, CalendarClock } from 'lucide-react'; 
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CurrentDate } from '@/components/current-date';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { OvertimeRequest, PrestationType, AbsenceRequest } from './types';
import { PRESTATION_TYPE_LABELS } from './types';
import OvertimeRequestDialog from '@/app/dashboard/declaration-heure/components/OvertimeRequestDialog'; // Correct import path
import AbsenceRequestDialog from '@/app/dashboard/declaration-heure/components/AbsenceRequestDialog'; // Correct import path
import ScheduleChangeRequestDialog from '@/app/dashboard/declaration-heure/components/ScheduleChangeRequestDialog'; // Correct import path
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
import type { ScheduleChangeRequest } from './types'; // Import the new type
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import useIsMobile from '@/hooks/use-mobile'
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import { firestore } from '@/lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  doc,
  setDoc,
  deleteDoc,
  where, // Import 'where' for filtering
  Timestamp,
  serverTimestamp, // For server-side timestamping if needed, though client-side is fine for updatedAt
} from 'firebase/firestore';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const BRIGADE_MEMBERS_STORAGE_KEY = 'time_tracking_members_v2'; 
const LOGGED_IN_USERNAME_KEY = 'loggedInUsername';

// --- AJOUT : Initialisation de Firebase Functions ---
const functions = getFunctions(undefined, 'us-central1');
const sendRequestStatusEmailCallable = httpsCallable(functions, 'sendRequestStatusEmail');
const deleteAllDeclarationsOfTypeCallable = httpsCallable(functions, 'deleteAllDeclarationsOfType');
// --------------------------------------------------


interface DeclarationHeureTab {
  value: string;
  label: string;
  Icon: React.ElementType;
}

/**
 * Complète les champs manquants d'un objet de mise en page PDF avec des valeurs
 * de secours numériques valides. Sert de filet de sécurité : si
 * getPdfLayoutSettings() renvoie un objet incomplet (champ undefined) pour un
 * type de formulaire donné, jsPDF finit par recevoir des coordonnées
 * "undefined" ou "NaN" dans doc.text(...), ce qui provoque l'erreur
 * "Invalid arguments passed to jsPDF.text".
 */
function withPdfSettingsDefaults(settings: any) {
  return {
    orientation: settings?.orientation ?? 'portrait',
    pageSize: settings?.pageSize ?? 'a4',
    fontFamily: settings?.fontFamily ?? 'helvetica', // jsPDF ne connaît nativement que helvetica/times/courier
    marginLeft: settings?.marginLeft ?? 40,
    marginRight: settings?.marginRight ?? 40,
    marginTop: settings?.marginTop ?? 40,
    marginBottom: settings?.marginBottom ?? 40,
    headerText: settings?.headerText ?? '',
    headerFontSize: settings?.headerFontSize ?? 10,
    footerText: settings?.footerText ?? '',
    footerFontSize: settings?.footerFontSize ?? 8,
    defaultFontSize: settings?.defaultFontSize ?? 10,
    documentTitleFontSize: settings?.documentTitleFontSize ?? 14,
    tableHeaderFontSize: settings?.tableHeaderFontSize ?? 10,
    tableBodyFontSize: settings?.tableBodyFontSize ?? 9,
    logoUrl: settings?.logoUrl ?? null,
    primaryColor: settings?.primaryColor ?? '#CCCCCC',
    showDocumentBaseTitle: settings?.showDocumentBaseTitle ?? false,
    documentBaseTitle: settings?.documentBaseTitle ?? '',
    ...settings, // on garde toute autre propriété déjà valide renvoyée par settings
  };
}

export default function DeclarationHeurePage() {
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>([]);
  const [isOvertimeFormOpen, setIsOvertimeFormOpen] = useState(false);
  const [editingOvertimeRequest, setEditingOvertimeRequest] = useState<OvertimeRequest | null>(null);
  const [isOvertimeApproverViewActive, setIsOvertimeApproverViewActive] = useState(false);

  const [absenceRequests, setAbsenceRequests] = useState<AbsenceRequest[]>([]);
  const [isAbsenceFormOpen, setIsAbsenceFormOpen] = useState(false);
  const [editingAbsenceRequest, setEditingAbsenceRequest] = useState<AbsenceRequest | null>(null);
  const [isAbsenceApproverViewActive, setIsAbsenceApproverViewActive] = useState(false);

  const [scheduleChangeRequests, setScheduleChangeRequests] = useState<ScheduleChangeRequest[]>([]);
  const [isScheduleChangeFormOpen, setIsScheduleChangeFormOpen] = useState(false);
  const [editingScheduleChangeRequest, setEditingScheduleChangeRequest] = useState<ScheduleChangeRequest | null>(null);
  
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

  // new
    
      // COLLEZ CE BLOC POUR REMPLACER L'ANCIENNE FONCTION

const deleteAllDeclarations = async (type: 'overtime' | 'absence' | 'scheduleChange') => {
    setIsSubmitting(true);
    try {
        const deleteAllDeclarationsOfType = httpsCallable(functions, 'deleteAllDeclarationsOfType');
        
        // On appelle la fonction en ne passant QUE le type
        const result = await deleteAllDeclarationsOfType({ type: type });
        
        toast({ title: 'Succès', description: `Toutes les déclarations de type '${type}' ont été supprimées.` });
    } catch (error: any) {
        console.error('Error deleting declarations:', error);
        // On affiche l'erreur exacte qui vient du serveur, c'est très important
        toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } finally {
        setIsSubmitting(false);
    }
};



    // fin du new


  const fetchOvertimeRequests = useCallback(async () => {
    if (!isClient) return;
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
    }
  }, [isClient, toast]);

  const fetchAbsenceRequests = useCallback(async () => {
    if (!isClient) return;
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
    }
  }, [isClient, toast]);

  const fetchScheduleChangeRequests = useCallback(async () => {
    if (!isClient) return;
    try {
      const scheduleChangeCollectionRef = collection(firestore, 'scheduleChangeRequests');
      const q = query(scheduleChangeCollectionRef, orderBy('requestDate', 'desc'));
      const querySnapshot = await getDocs(q, { source: 'server' }); // Force fetch from server
      const requestsList = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          requestDate: (data.requestDate as Timestamp)?.toDate ? (data.requestDate as Timestamp).toDate().toISOString() : new Date(data.requestDate).toISOString(),
          updatedAt: (data.updatedAt as Timestamp)?.toDate ? (data.updatedAt as Timestamp).toDate().toISOString() : new Date(data.updatedAt).toISOString(),
          date: data.date && (data.date as Timestamp)?.toDate ? (data.date as Timestamp).toDate().toISOString() : new Date(data.date).toISOString(),
          employeeSignatureDate: data.employeeSignatureDate && (data.employeeSignatureDate as Timestamp)?.toDate ? (data.employeeSignatureDate as Timestamp).toDate().toISOString() : null,
          directManagerSignatureDate: data.directManagerSignatureDate && (data.directManagerSignatureDate as Timestamp)?.toDate ? (data.directManagerSignatureDate as Timestamp).toDate().toISOString() : null,
          directorSignatureDate: data.directorSignatureDate && (data.directorSignatureDate as Timestamp)?.toDate ? (data.directorSignatureDate as Timestamp).toDate().toISOString() : null,
          decisionDate: data.decisionDate && (data.decisionDate as Timestamp)?.toDate ? (data.decisionDate as Timestamp).toDate().toISOString() : null,
        } as ScheduleChangeRequest;
      });
      setScheduleChangeRequests(requestsList);
      console.log(`[DeclarationHeurePage LOAD SCR] Loaded ${requestsList.length} schedule change requests from Firestore.`);
    } catch (e) {
      console.error("[DeclarationHeurePage LOAD SCR] Error loading schedule change requests from Firestore", e);
      setScheduleChangeRequests([]);
      toast({ title: "Erreur chargement demandes changement horaire", variant: "destructive" });
    }
  }, [isClient, toast]);

  useEffect(() => {
    if (isClient) {
      const loadAllData = async () => {
        setIsLoading(true);
        await Promise.allSettled([fetchOvertimeRequests(), fetchAbsenceRequests(), fetchScheduleChangeRequests()]);
        setIsLoading(false);
      };
      loadAllData(); // Initial load for all request types
    }
  }, [isClient, fetchOvertimeRequests, fetchAbsenceRequests, fetchScheduleChangeRequests]); // CORRECTION: Dépendance ajoutée


  const currentBrigadeMember = useMemo(() => {
    if (loggedInUsername && brigadeMembers.length > 0) {
      return brigadeMembers.find(bm => bm.name.toLowerCase() === loggedInUsername.toLowerCase());
    }
    return null;
  }, [loggedInUsername, brigadeMembers]);

  /// nouv //

    // --- AJOUT : Nouvelle fonction pour générer le PDF et envoyer l'e-mail ---
  const handleSendApprovalEmail = async (
    request: OvertimeRequest | AbsenceRequest | ScheduleChangeRequest, 
    requestType: 'overtime' | 'absence' | 'scheduleChange', 
    newStatus: 'accepted' | 'rejected',
    rejectionReasonFromForm?: string
  ) => {
    if (!request.brigadeMemberId) {
        console.error("Impossible d'envoyer l'e-mail, l'ID du membre de la brigade est manquant.");
        toast({ title: "Erreur critique", description: "ID de l'employé manquant pour l'envoi de l'e-mail.", variant: "destructive" });
        return;
    }

    let pdfBase64 = '';
    let requestDetails: any = '';

    try {
        if (requestType === 'overtime') {
            const r = request as OvertimeRequest;
            requestDetails = `Dépassement pour le motif : ${r.reasonStub}. Total: ${r.totalOvertimeHours}h.`;
        } else if (requestType === 'absence') {
            const r = request as AbsenceRequest;
            requestDetails = `Absence du ${format(parseISO(r.startDate), 'dd/MM/yy')} au ${format(parseISO(r.endDate), 'dd/MM/yy')}. Motif : ${r.reason}.`;
        } else if (requestType === 'scheduleChange') {
            const r = request as ScheduleChangeRequest;
            
            // CORRECTIF : S'assurer que chaque détail utilise sa propre date.
            if (r.scheduleChangeDetails && Array.isArray(r.scheduleChangeDetails) && r.scheduleChangeDetails.length > 0) {
                // On passe directement les détails, ils contiennent déjà les bonnes dates individuelles.
                requestDetails = r.scheduleChangeDetails;
            } else {
                // Ancien format (fallback)
                requestDetails = [{
                    date: r.date,
                    newStartTime: r.newStartTime,
                    newEndTime: r.newEndTime,
                    originalStartTime: r.originalStartTime,
                    originalEndTime: r.originalEndTime
                }];
            }
        }

        const dataToSend = {
            userId: request.brigadeMemberId,
            requestType: requestType,
            status: newStatus,
            reason: rejectionReasonFromForm || '',
            requestDetails: requestDetails,
            requestReason: request.reason || '',
            pdfBase64: pdfBase64,
        };
        
        toast({ title: "Envoi de l'e-mail...", description: `Notification en cours d'envoi à ${request.employeeName}.`});
        await sendRequestStatusEmailCallable(dataToSend);
        toast({ title: "E-mail envoyé !", description: `L'employé a été notifié de la décision.`, variant: "success"});

    } catch (error) {
        console.error("Erreur lors de l'envoi de l'e-mail d'approbation:", error);
        toast({ title: "Erreur d'envoi de l'e-mail", description: "La notification n'a pas pu être envoyée. Vérifiez la console pour plus de détails.", variant: "destructive" });
    }
  };

////// fin du nouv//

  const handleAddOrUpdateOvertimeRequest = useCallback(async (
    data: Partial<Omit<OvertimeRequest, 'id' | 'employeeName' | 'requestDate' | 'updatedAt' >>
  ) => {
    if (isLoading) { toast({ title: "Données non prêtes", variant: "default" }); return; }
    
    const isChefCreatingOvertime = !editingOvertimeRequest && loggedInUsername?.toLowerCase() === 'chef';
const chefAsEmployeeForOvertime = isChefCreatingOvertime ? brigadeMembers.find(m => m.name.toLowerCase() === 'julien dernoncourt') : null;

const isChefCreating = !editingOvertimeRequest && isChef;
const employeeNameToUse = isChefCreating ? "Julien Dernoncourt" : (data.employeeName || editingOvertimeRequest?.employeeName || currentBrigadeMember?.name || "Employé Inconnu");
const positionToUse = isChefCreating ? "Chef de cuisine" : (data.position || editingOvertimeRequest?.position || currentBrigadeMember?.role || '');

let brigadeMemberIdToUse: string | undefined;
if (isChefCreating) {
  brigadeMemberIdToUse = 'chef_special_id';
} else {
  brigadeMemberIdToUse = data.brigadeMemberId || editingOvertimeRequest?.brigadeMemberId || currentBrigadeMember?.id;
}

if (!brigadeMemberIdToUse) {
  toast({ title: "Erreur de sauvegarde", description: "L'identifiant de l'employé est manquant.", variant: "destructive" });
  return;
}



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

            // new //

if (newStatus && newStatus !== 'pending' && originalStatus === 'pending' && brigadeMemberIdToUse) {
    await handleSendApprovalEmail(editingOvertimeRequest, 'overtime', newStatus, data.rejectionReason);

          
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
  }, [editingOvertimeRequest, loggedInUsername, currentBrigadeMember, toast, isLoading, fetchOvertimeRequests, isChef]);
  
  const handleDeleteOvertimeRequest = async (requestId: string) => {
    if (isLoading) return;
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
    if (isLoading) { toast({ title: "Données non prêtes", variant: "default"}); return; }
    
   
   const isChefCreatingAbsence = !editingAbsenceRequest && loggedInUsername?.toLowerCase() === 'chef';
const chefAsEmployeeForAbsence = isChefCreatingAbsence ? brigadeMembers.find(m => m.name.toLowerCase() === 'julien dernoncourt') : null;

const isChefCreating = !editingAbsenceRequest && isChef;
const employeeNameToUse = isChefCreating ? "Julien Dernoncourt" : (data.employeeName || editingAbsenceRequest?.employeeName || currentBrigadeMember?.name || "Employé Inconnu");
const positionToUse = isChefCreating ? "Chef de cuisine" : (data.position || editingAbsenceRequest?.position || currentBrigadeMember?.role || '');

let brigadeMemberIdToUse: string | undefined;
if (isChefCreating) {
  brigadeMemberIdToUse = 'chef_special_id';
} else {
  brigadeMemberIdToUse = data.brigadeMemberId || editingAbsenceRequest?.brigadeMemberId || currentBrigadeMember?.id;
}

if (!brigadeMemberIdToUse) {
  toast({ title: "Erreur de sauvegarde", description: "L'identifiant de l'employé est manquant.", variant: "destructive" });
  return;
}

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

          
             
            // new
if (newStatus && newStatus !== 'pending' && originalStatus === 'pending' && brigadeMemberIdToUse) {
    await handleSendApprovalEmail(editingAbsenceRequest, 'absence', newStatus, data.rejectionReason);

          // new

            
            
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
  }, [editingAbsenceRequest, loggedInUsername, currentBrigadeMember, toast, isLoading, fetchAbsenceRequests, isChef]);

  const handleDeleteAbsenceRequest = useCallback(async (requestId: string) => {
    if (isLoading) return;
     try {
      await deleteDoc(doc(firestore, 'absenceRequests', requestId)); // Correct Firestore delete
      fetchAbsenceRequests(); // Refresh the list
      window.dispatchEvent(new CustomEvent('absenceRequestsUpdated')); // Notify other components
      toast({ title: "Demande d'Absence Supprimée", variant: "destructive" }); // Success toast
    } catch (e) {
      console.error("Error deleting absence request from Firestore:", e);
      // Optionally toast error here too
      toast({ title: "Erreur suppression demande d'absence", variant: "destructive" }); // Error toast
    }
 }, [isLoading, fetchAbsenceRequests, toast]);

  const handleOpenAbsenceForm = (request?: AbsenceRequest, approverMode: boolean = false) => {
    setEditingAbsenceRequest(request || null);
    setIsAbsenceApproverViewActive(approverMode);
    setIsAbsenceFormOpen(true);
  };

  const handleAddOrUpdateScheduleChangeRequest = useCallback(async (
    data: Partial<Omit<ScheduleChangeRequest, 'id' | 'employeeName' | 'requestDate' | 'updatedAt'>>
  ) => {
    if (isLoading) { toast({ title: "Données non prêtes", variant: "default"}); return; }
    
   
    const isChefCreatingScheduleChange = !editingScheduleChangeRequest && loggedInUsername?.toLowerCase() === 'chef';
const chefAsEmployeeForScheduleChange = isChefCreatingScheduleChange ? brigadeMembers.find(m => m.name.toLowerCase() === 'julien dernoncourt') : null;

const isChefCreating = !editingScheduleChangeRequest && isChef;
const employeeNameToUse = isChefCreating ? "Julien Dernoncourt" : (data.employeeName || editingScheduleChangeRequest?.employeeName || currentBrigadeMember?.name || "Employé Inconnu");
const positionToUse = isChefCreating ? "Chef de cuisine" : (data.position || editingScheduleChangeRequest?.position || currentBrigadeMember?.role || '');

let brigadeMemberIdToUse: string | undefined;
if (isChefCreating) {
  brigadeMemberIdToUse = 'chef_special_id';
} else {
  brigadeMemberIdToUse = data.brigadeMemberId || editingScheduleChangeRequest?.brigadeMemberId || currentBrigadeMember?.id;
}

if (!brigadeMemberIdToUse) {
  toast({ title: "Erreur de sauvegarde", description: "L'identifiant de l'employé est manquant.", variant: "destructive" });
  return;
}

    const now = new Date();

    // Add check for missing brigadeMemberId
    if (!brigadeMemberIdToUse) {
      toast({ title: "Erreur sauvegarde demande", description: "Vos informations de membre de brigade sont manquantes. Veuillez vous reconnecter ou contacter un administrateur.", variant: "destructive" });
      return; // Stop the function execution if brigadeMemberId is missing
    }

    const requestDataToSave: Omit<ScheduleChangeRequest, 'id'> = { // Ensure type matches
      ...(data as any), // Use 'as any' here to bypass strict type check for data, or define a more specific type
      employeeName: employeeNameToUse,
      position: positionToUse,
      brigadeMemberId: brigadeMemberIdToUse,
      requestDate: editingScheduleChangeRequest ? Timestamp.fromDate(new Date(editingScheduleChangeRequest.requestDate)) : Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
      date: data.date ? Timestamp.fromDate(new Date(data.date)) : Timestamp.fromDate(new Date()),
      employeeSignatureDate: data.employeeSignatureDate ? Timestamp.fromDate(new Date(data.employeeSignatureDate)) : null,
      directManagerSignatureDate: data.directManagerSignatureDate ? Timestamp.fromDate(new Date(data.directManagerSignatureDate)) : null,
      directorSignatureDate: data.directorSignatureDate ? Timestamp.fromDate(new Date(data.directorSignatureDate)) : null,
      decisionDate: data.decisionDate ? Timestamp.fromDate(new Date(data.decisionDate)) : null,
    };
    
    try {
      console.log("[handleAddOrUpdateScheduleChangeRequest] Saving schedule change request. Editing:", !!editingScheduleChangeRequest);
      console.log("[ScheduleChangeRequest] Attempting to save schedule change request to Firestore...");
      if (editingScheduleChangeRequest) {
          const originalStatus = editingScheduleChangeRequest.approvalStatus || 'pending';
          const newStatus = data.approvalStatus;

          
            // new
if (newStatus && newStatus !== 'pending' && originalStatus === 'pending' && brigadeMemberIdToUse) {
  await handleSendApprovalEmail(editingScheduleChangeRequest, 'scheduleChange', newStatus, data.rejectionReason);

    // ...

            
            
            
            const notifTitle = "Demande de changement d'horaire traitée";
              const notifMessage = `Votre demande de changement d'horaire pour le ${format(parseISO(editingScheduleChangeRequest.date), 'dd/MM/yy')} a été ${newStatus === 'accepted' ? 'acceptée' : 'refusée'}.`;
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

          const docRef = doc(firestore, 'scheduleChangeRequests', editingScheduleChangeRequest.id);
          await setDoc(docRef, requestDataToSave);
          console.log(`[ScheduleChangeRequest] Successfully updated schedule change request with ID: ${editingScheduleChangeRequest.id}`);
          toast({ title: "Demande Changement Horaire Modifiée" });
      } else {
          const docRef = await addDoc(collection(firestore, 'scheduleChangeRequests'), requestDataToSave);
          console.log(`[ScheduleChangeRequest] Successfully added new schedule change request with ID: ${docRef.id}`);



// --- START: CHEF NOTIFICATION LOGGING ---
console.log("[ScheduleChangeRequest NOTIF] Attempting to find admin users for notification...");
const usersCollectionRef = collection(firestore, 'appUsers');
const adminQuery = query(usersCollectionRef, where('role', '==', 'admin'));
const adminQuerySnapshot = await getDocs(adminQuery);

if (!adminQuerySnapshot.empty) {
    console.log(`[ScheduleChangeRequest NOTIF] Found ${adminQuerySnapshot.size} admin user(s). Creating notifications.`);
    const notifTitle = "Nouvelle demande de changement d'horaire";
    const notifMessage = `Une nouvelle demande de changement d'horaire a été soumise par ${employeeNameToUse} pour le ${format(parseISO(data.date as string || now.toISOString()), 'dd/MM/yy')}.`;

    for (const adminDoc of adminQuerySnapshot.docs) {
        const adminUserId = adminDoc.id;
        const adminUserData = adminDoc.data();
        console.log(`[ScheduleChangeRequest NOTIF] Notifying admin user: ${adminUserData.username || 'Unknown'} (ID: ${adminUserId})`);

        const notificationData = {
            userId: adminUserId,
            title: notifTitle,
            message: notifMessage,
            link: '/dashboard/declaration-heure?tab=schedule-change-approval',
            createdAt: Timestamp.fromDate(new Date()),
            isRead: false,
        };

        try {
            await addDoc(collection(firestore, 'notifications'), notificationData);
            console.log(`[ScheduleChangeRequest NOTIF] Notification successfully added for admin user ID: ${adminUserId}`);
        } catch (error) {
            console.error(`[ScheduleChangeRequest NOTIF] Error adding notification for admin user ID: ${adminUserId}`, error);
        }
    }
    console.log(`[ScheduleChangeRequest NOTIF] Notified ${adminQuerySnapshot.size} admin users.`);
} else {
    console.warn("[ScheduleChangeRequest NOTIF] No user with role 'admin' found. Notification not sent.");

    const allUsersSnapshot = await getDocs(usersCollectionRef);
    console.log(`[ScheduleChangeRequest NOTIF] Total users in appUsers: ${allUsersSnapshot.size}`);
    allUsersSnapshot.forEach(doc => {
        console.log(`[ScheduleChangeRequest NOTIF] User: ${doc.id} - ${JSON.stringify(doc.data())}`);
    });
}
// --- END: CHEF NOTIFICATION LOGGING ---



          toast({ title: "Demande Changement Horaire Soumise" });
        fetchScheduleChangeRequests(); // Refresh the list
        window.dispatchEvent(new CustomEvent('scheduleChangeRequestsUpdated'));
      }
      console.log("[ScheduleChangeRequest] Schedule change request save process completed.");
    } catch (e) {
      const err = e as Error;
      console.error("Error saving schedule change request to Firestore:", e);
      toast({ title: "Erreur sauvegarde demande changement horaire", description: err.message, variant: "destructive"});
    } 
    setEditingScheduleChangeRequest(null);
  }, [editingScheduleChangeRequest, loggedInUsername, currentBrigadeMember, toast, isLoading, fetchScheduleChangeRequests, isChef]); // CORRECTION: Dépendance inutile 'activeTab' retirée

  const handleDeleteScheduleChangeRequest = useCallback(async (requestId: string) => {
    if (isLoading) return;
     try {
      await deleteDoc(doc(firestore, 'scheduleChangeRequests', requestId));
      fetchScheduleChangeRequests();
      window.dispatchEvent(new CustomEvent('scheduleChangeRequestsUpdated'));
      toast({ title: "Demande Changement Horaire Supprimée", variant: "destructive" });
     } catch (e) {
      console.error("Error deleting schedule change request from Firestore:", e);
      // Optionally toast error here too
      toast({ title: "Erreur suppression demande changement horaire", variant: "destructive" });
    }
 }, [isLoading, fetchScheduleChangeRequests, toast]);
 
   const handleDeleteAllDeclarations = async (declarationType: 'overtime' | 'absence' | 'scheduleChange') => {
    if (!isChef) {
      toast({ title: "Accès non autorisé", variant: "destructive" });
      return;
    }

    const declarationTypeNames = {
      overtime: "de dépassement d'horaire",
      absence: "d'absence",
      scheduleChange: "de changement d'horaire"
    };
    const declarationName = declarationTypeNames[declarationType];

    try {
      toast({ title: "Suppression en cours...", description: `Suppression de toutes les demandes ${declarationName}.` });
      
      await deleteAllDeclarationsOfTypeCallable({ type: declarationType });
      
      if (declarationType === 'overtime') {
        await fetchOvertimeRequests();
      } else if (declarationType === 'absence') {
        await fetchAbsenceRequests();
      } else if (declarationType === 'scheduleChange') {
        await fetchScheduleChangeRequests();
      }
      
      toast({ title: "Suppression réussie", description: `Toutes les demandes ${declarationName} ont été supprimées.`, variant: "success" });
    } catch (error) {
      const err = error as Error;
      console.error(`Erreur lors de la suppression de toutes les demandes de type '${declarationType}':`, err);
      toast({ title: "Erreur de suppression", description: err.message, variant: "destructive" });
    }
  };

  const handleOpenScheduleChangeForm = (request?: ScheduleChangeRequest) => {
    setEditingScheduleChangeRequest(request || null);
    setIsScheduleChangeFormOpen(true);
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

  const renderScheduleChangeRequestList = (requestsToList: ScheduleChangeRequest[], approverModeView: boolean) => (
    requestsToList.length === 0 ? (
      <p className="text-muted-foreground text-center py-6">
        {isChef ? "Aucune demande de changement d'horaire à approuver ou en cours." : "Vous n'avez aucune demande de changement d'horaire."}
      </p>
    ) : (
      <ScrollArea className="h-[calc(100vh-26rem)] sm:h-[calc(100vh-24rem)]">
        <div className="space-y-3 pr-3">
          {requestsToList.map(req => (
            <Card key={req.id} className="bg-card/60">
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex justify-between items-start">
                    <CardTitle className="text-md">Changement Horaire le {format(parseISO(req.date), "dd/MM/yy", {locale: fr})}</CardTitle>
                    <Badge variant={getStatusBadgeVariant(req.approvalStatus)}>{getStatusLabel(req.approvalStatus)}</Badge>
                </div>
                <CardDescription className="text-xs">
                  Demandé par: {req.employeeName} {req.position && `(${req.position})`}
                  {req.requestDate && ` | Le: ${format(parseISO(req.requestDate), "dd/MM/yy HH:mm", { locale: fr })}`}
                  {req.updatedAt && isValid(parseISO(req.updatedAt)) && ` | Modifié le: ${format(parseISO(req.updatedAt), "dd/MM/yy HH:mm", { locale: fr })}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1 text-xs">
                {req.newStartTime && req.newEndTime && (
                    <p className="text-muted-foreground"><span className="font-medium text-foreground/80">Nouvel horaire:</span> de {req.newStartTime} à {req.newEndTime}</p>
                )}
                 {req.prestationTypes && req.prestationTypes.length > 0 && (
                    <p className="text-muted-foreground"><span className="font-medium text-foreground/80">Prestations:</span>{' '}{req.prestationTypes.map(pt => PRESTATION_TYPE_LABELS[pt as PrestationType] || pt).join(', ')}{req.prestationTypes.includes('autres') && req.prestationTypeAutresDetail && ` (${req.prestationTypeAutresDetail})`}</p>
                )}
                {req.reason && <p className="text-muted-foreground"><span className="font-medium text-foreground/80">Motif:</span> {req.reason}</p>}
                
                {req.approvalStatus && req.approvalStatus !== 'pending' && (
                  <div className="border-t mt-2 pt-1">
                    <p className="font-medium text-foreground/80">Décision Direction:</p>
                    {req.approvalStatus === 'rejected' && req.rejectionReason && <p>Motif refus: {req.rejectionReason}</p>}
                    {req.decisionDate && isValid(parseISO(req.decisionDate)) && <p>Date Décision: {format(parseISO(req.decisionDate), "dd/MM/yyyy", {locale:fr})}</p>}
                  </div>
                )}
                 <div className="mt-2 flex justify-end space-x-2 pt-1">
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => handleOpenScheduleChangeForm(req)}>
                      <Edit2 className="mr-1 h-3.5 w-3.5"/> {approverModeView ? "Traiter / Voir" : ((req.approvalStatus === 'accepted' || req.approvalStatus === 'rejected') ? "Voir" : "Modifier")}
                    </Button>
                    
                    {/* CORRECTION: Ajout de la possibilité pour l'utilisateur d'annuler sa demande */}
                    {(!approverModeView && (req.approvalStatus === 'pending' || !req.approvalStatus)) && ( 
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" className="text-xs">
                            <Trash2 className="mr-1 h-3.5 w-3.5"/> Annuler/Suppr.
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Annuler la demande ?</AlertDialogTitle>
                            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Non</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteScheduleChangeRequest(req.id)}>
                              Oui, annuler
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    {(approverModeView && isChef) && ( 
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
                                    Êtes-vous sûr de vouloir supprimer la demande de changement d'horaire de {req.employeeName} pour le {isValid(parseISO(req.date)) ? format(parseISO(req.date), "dd/MM/yyyy") : 'date inconnue'}? Cette action est irréversible.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Non</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteScheduleChangeRequest(req.id)}>
                                    Oui, supprimer
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    
                    {req.approvalStatus === 'accepted' && (
                       <Button variant="default" size="sm" className="text-xs" onClick={() => handleGenerateScheduleChangeRequestPdf(req)}><PdfFileTextIcon className="mr-1 h-3.5 w-3.5"/> Générer PDF</Button>
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
    if (!isClient || !loggedInUsername || isLoading) return [];
    return overtimeRequests.filter(req => req.employeeName.toLowerCase() === loggedInUsername.toLowerCase());
  }, [isClient, loggedInUsername, overtimeRequests, isLoading]);

  const employeeAbsenceRequests = useMemo(() => {
    if (!isClient || !loggedInUsername || isLoading) return [];
    return absenceRequests.filter(req => req.employeeName.toLowerCase() === loggedInUsername.toLowerCase());
  }, [isClient, loggedInUsername, absenceRequests, isLoading]);
  
  const employeeScheduleChangeRequests = useMemo(() => {
    if (!isClient || !loggedInUsername || isLoading) return [];
    return scheduleChangeRequests.filter(req => req.employeeName.toLowerCase() === loggedInUsername.toLowerCase());
  }, [isClient, loggedInUsername, scheduleChangeRequests, isLoading]);

 const pendingScheduleChangeRequestsForChef = useMemo(() => {
    if (!isClient || isLoading) return [];
    return scheduleChangeRequests.filter(req => req.approvalStatus === 'pending');
  }, [isClient, scheduleChangeRequests, isLoading]);

  const allOvertimeRequestsForChef = useMemo(() => {
     if (!isClient || isLoading) return [];
    return overtimeRequests;
  }, [isClient, overtimeRequests, isLoading]);

  const allAbsenceRequestsForChef = useMemo(() => {
     if (!isClient || isLoading) return [];
    return absenceRequests;
  }, [isClient, absenceRequests, isLoading]);

  const allScheduleChangeRequestsForChef = useMemo(() => {
    if (!isClient || isLoading) return [];
   return scheduleChangeRequests;
 }, [isClient, scheduleChangeRequests, isLoading]);
  
  const declarationHeureTabsConfig: DeclarationHeureTab[] = [
    { value: "my-overtime-requests", label: "Dépassement Horaire", Icon: History },
    { value: "my-absence-requests", label: "Demandes Absence", Icon: CalendarOff },
    { value: "my-schedule-changes", label: "Changements Horaire", Icon: CalendarClock },
 ];

  if (isChef) {
    declarationHeureTabsConfig.push({ value: "overtime-approval", label: "Approb. Dépassement", Icon: CheckSquare });
    declarationHeureTabsConfig.push({ value: "schedule-change-approval", label: "Approb. Changement H.", Icon: CalendarClock });
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
              <div className="flex items-center gap-2">
                {isChef && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="mr-2 h-4 w-4" /> Tout Supprimer
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer toutes les demandes de dépassement ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette action est irréversible et supprimera TOUTES les demandes de dépassement d'horaire. Êtes-vous certain ?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteAllDeclarations('overtime')}>
                          Oui, tout supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <Button 
                  onClick={() => handleOpenOvertimeForm(undefined, false)} 
                  disabled={isLoading || (!currentBrigadeMember && !isChef)}
                >
                  <PlusCircle className="mr-2 h-4 w-4"/> Nouvelle Demande
                </Button>
              </div>
            </CardHeader>
            <CardContent>{renderOvertimeRequestList(isChef ? allOvertimeRequestsForChef : employeeOvertimeRequests, false)}</CardContent>
          </Card>
        );
      case "my-absence-requests":
        return (
          <Card className="shadow-xl">
             <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div><CardTitle>Mes Demandes d'Absence</CardTitle><CardDescription>Soumettez et suivez vos demandes.</CardDescription></div>
              <div className="flex items-center gap-2">
                {isChef && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="mr-2 h-4 w-4" /> Tout Supprimer
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer toutes les demandes d'absence ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette action est irréversible et supprimera TOUTES les demandes d'absence. Êtes-vous certain ?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteAllDeclarations('absence')}>
                          Oui, tout supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <Button 
                  onClick={() => handleOpenAbsenceForm(undefined, false)} 
                  disabled={isLoading || (!currentBrigadeMember && !isChef)}
                >
                  <PlusCircle className="mr-2 h-4 w-4"/> Nouvelle Demande
                </Button>
              </div>
            </CardHeader>
            <CardContent>{renderAbsenceRequestList(isChef ? allAbsenceRequestsForChef : employeeAbsenceRequests, false)}</CardContent>
          </Card>
        );
      case "my-schedule-changes":
        return (
          <Card className="shadow-xl">
             <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div><CardTitle>Mes Demandes de Changement d'Horaire</CardTitle><CardDescription>Soumettez et suivez vos demandes de modification de planning ponctuelle.</CardDescription></div>
              <div className="flex items-center gap-2">
                {isChef && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="mr-2 h-4 w-4" /> Tout Supprimer
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer toutes les demandes de changement d'horaire ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette action est irréversible et supprimera TOUTES les demandes de changement d'horaire. Êtes-vous certain ?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteAllDeclarations('scheduleChange')}>
                          Oui, tout supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <Button 
                  onClick={() => handleOpenScheduleChangeForm(undefined)} 
                  disabled={isLoading || (!currentBrigadeMember && !isChef)}
                >
                  <PlusCircle className="mr-2 h-4 w-4"/> Nouvelle Demande
                </Button>
              </div>
            </CardHeader>
            <CardContent>{renderScheduleChangeRequestList(isChef ? allScheduleChangeRequestsForChef : employeeScheduleChangeRequests, false)}</CardContent>
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
        case "schedule-change-approval": // New case for Schedule Change Approval
        return isChef ? (
          <Card className="shadow-xl">
            <CardHeader><CardTitle>Approbation des Changements d'Horaire</CardTitle><CardDescription>Traitez et gérez les demandes de changement d'horaire.</CardDescription></CardHeader>
            <CardContent>{renderScheduleChangeRequestList(allScheduleChangeRequestsForChef, true)}</CardContent>
          </Card>
        ) : null;
      default:
        return null;
    }
  };

                      // section PDF DEbut

     const handleGenerateOvertimeRequestPdf = async (request: OvertimeRequest) => { // Note: function is now async
    try {
        // Helper to fetch local image and convert to Base64
        const fetchImageAsBase64 = (url: string): Promise<string | null> => {
            return new Promise(async (resolve) => {
                try {
                    const response = await fetch(url);
                    if (!response.ok) { resolve(null); return; }
                    const blob = await response.blob();
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = () => resolve(null);
                    reader.readAsDataURL(blob);
                } catch { resolve(null); }
            });
        };

        const logoUrl = '/logo/logo1.png'; // Path from the public folder
        const logoBase64 = await fetchImageAsBase64(logoUrl);

        const doc = new jsPDF('p', 'pt', 'a4') as jsPDFWithAutoTable;
        const pageWidth = doc.internal.pageSize.width;
        const margin = 40;

          // couleur page (bleu)

          doc.setFillColor(230, 247, 255); // Définit la couleur de remplissage
          doc.rect(0, 0, pageWidth, doc.internal.pageSize.height, 'F'); // Dessine un rectangle rempli sur toute la page




        const calculateHours = (start?: string, end?: string): string => {
            if (!start || !end) return '';
            try {
                const [startH, startM] = start.split(':').map(Number);
                const [endH, endM] = end.split(':').map(Number);
                if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return '';
                const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
                if (totalMinutes < 0) return '';
                const hours = Math.floor(totalMinutes / 60);
                const minutes = totalMinutes % 60;
                return `${hours}h${minutes > 0 ? String(minutes).padStart(2, '0') : ''}`;
            } catch { return ''; }
        };

        // --- NEW & IMPROVED HEADER TABLE ---
        let currentY = margin;
        const headerTableHeight = 50; 

        doc.autoTable({
            startY: currentY,
            // Use empty strings to prevent "[object Object]" watermark
            body: [['', '', '']], 
            theme: 'grid',
            styles: {
                cellPadding: 0,
                lineWidth: 1,
                lineColor: 0,
                minCellHeight: headerTableHeight,
                valign: 'middle',
            },
            columnStyles: {
                0: { cellWidth: 160, styles: { cellPadding: 2 } },
                1: { cellWidth: 'auto', halign: 'center' },
                2: { cellWidth: 150, halign: 'center' }
            },
            didDrawCell: (data) => {
                if (data.row.index === 0) {
                    const cell = data.cell;
                    if (data.column.index === 0) { // Column 1: Logo
                        if (logoBase64) {
                            // Centered and properly resized logo
                            const logoWidth = 80;
                            const logoHeight = 34;
                            const x = cell.x + (cell.width - logoWidth) / 2;
                            const y = cell.y + (cell.height - logoHeight) / 2;
                            doc.addImage(logoBase64, 'PNG', x, y, logoWidth, logoHeight, undefined, 'FAST');
                        }
                    } else if (data.column.index === 1) { // Column 2: Title
                        doc.setFontSize(12);
                        doc.setFont(undefined, 'bold');
                        doc.text("DEMANDE DE DEPASSEMENT\nD'HORAIRE", cell.x + cell.width / 2, cell.y + cell.height / 2, {
                            align: 'center',
                            baseline: 'middle'
                        });
                    } else if (data.column.index === 2) { // Column 3: Ref
                        doc.setFontSize(9);
                        doc.setFont(undefined, 'normal');
                        const topBoxHeight = cell.height * 0.5;
                        doc.text("16-MES-F-05 Version 2", cell.x + cell.width / 2, cell.y + topBoxHeight / 2, {
                            align: 'center',
                            baseline: 'middle'
                        });
                        doc.line(cell.x, cell.y + topBoxHeight, cell.x + cell.width, cell.y + topBoxHeight);
                        doc.text("Pôle Enfance de la Gohelle", cell.x + cell.width / 2, cell.y + topBoxHeight + (cell.height - topBoxHeight) / 2, {
                            align: 'center',
                            baseline: 'middle'
                        });
                    }
                }
            },
            margin: { left: margin, right: margin }
        });
        currentY = (doc as any).autoTable.previous.finalY + 20; // Adjust spacing after header
        doc.setFont(undefined, 'normal');
        
        // --- MAIN INFO ---
        doc.setFontSize(9);
        doc.text("La demande doit être soumise à l'avis du pilote de prestation avec un préavis de 48h si possible", margin, currentY);
        currentY += 30;

        const drawUnderlinedText = (label: string, value: string, y: number) => {
            doc.setFontSize(10);
            const labelDims = doc.getTextDimensions(label);
            doc.text(label, margin, y);
            doc.setLineWidth(0.5);
            doc.line(margin, y + 2, margin + labelDims.w, y + 2);
            doc.text(value, margin + labelDims.w + 8, y);
        }

        drawUnderlinedText("Nom et Prénom:", request.employeeName || '.....................................', currentY);
        currentY += 25;
        drawUnderlinedText("Poste occupé à l'IME:", request.position || '.....................................', currentY);
        currentY += 30;

        // --- PRESTATIONS ---
        const prestLabel = "Prestation :";
        const prestLabelDims = doc.getTextDimensions(prestLabel);
        doc.text(prestLabel, margin, currentY);
        doc.setLineWidth(0.5);
        doc.line(margin, currentY + 2, margin + prestLabelDims.w, currentY + 2);
        doc.setFontSize(8);
        doc.text("Entourer la prestation correspondante", margin + 100, currentY);
        doc.setFontSize(10);
        currentY += 25;
        
        const allPrestations = {
            'Hébergement': { x: margin + 50, y: currentY }, 'Educatif': { x: margin + 180, y: currentY }, 'Médico-psycho-sociale': { x: margin + 310, y: currentY },
            'Administratif': { x: margin + 50, y: currentY + 20 }, 'Logistique': { x: margin + 180, y: currentY + 20 }
        };
        const requestPrestationLabels = (request.prestationTypes || []).map(p => PRESTATION_TYPE_LABELS[p as PrestationType] || p);
        Object.entries(allPrestations).forEach(([label, pos]) => {
            if (requestPrestationLabels.includes(label)) {
                const dims = doc.getTextDimensions(label);
                doc.setFillColor(255, 255, 0); // Yellow
                doc.rect(pos.x - 2, pos.y - dims.h + 2, dims.w + 4, dims.h, 'F');
            }
            doc.text(label, pos.x, pos.y);
        });
        currentY += 45;

        // --- MOTIF ---
        const motifLabel = "Motif de la demande :";
        const motifLabelDims = doc.getTextDimensions(motifLabel);
        doc.text(motifLabel, margin, currentY);
        doc.setLineWidth(0.5);
        doc.line(margin, currentY + 2, margin + motifLabelDims.w, currentY + 2);
        currentY += 10;
        doc.setLineWidth(0.5);
        doc.rect(margin, currentY, pageWidth - 2 * margin, 40);
        doc.text(request.reasonStub || '', margin + 5, currentY + 12, { maxWidth: pageWidth - 2 * margin - 10 });
        currentY += 65;

        // --- TABLE ---
        doc.setFont(undefined, 'bold');
        doc.text("Proposition de dépassement (jours et/ou heures travaillés exceptionnellement)", pageWidth / 2, currentY, { align: 'center' });
        doc.setFont(undefined, 'normal');
        currentY += 25;

        const tableBody = (request.overtimeDetails || []).map(detail => [
            `Le : ${isValid(parseISO(detail.date)) ? format(parseISO(detail.date), 'dd/MM/yyyy') : '..../..../....'}`,
            `de ${detail.startTime || '......h......'} à ${detail.endTime || '......h......'}`,
            calculateHours(detail.startTime, detail.endTime)
        ]);
        while (tableBody.length < 2) { tableBody.push([`Le : ..../..../....`, `de ......h...... à ......h......`, '']); }

        doc.autoTable({
            startY: currentY,
            head: [['', 'Horaires', "Nombre total\nd'heures"]],
            body: tableBody,
            theme: 'grid',
            styles: { lineWidth: 1, lineColor: [0, 0, 0], halign: 'center', valign: 'middle' },
            headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], halign: 'center' },
            margin: { left: margin, right: margin }
        });
        currentY = (doc as any).autoTable.previous.finalY + 30;

        // --- SUMMARY & LOCATION ---
        doc.text(`Au total, le dépassement représente ${request.totalOvertimeHours || '.....'} heures en plus de l'horaire prévu.`, margin, currentY);
        currentY += 35;
        doc.text(`Fait à : Brebières`, margin, currentY);
        doc.text(`Le : ${format(new Date(), 'dd/MM/yyyy')}`, pageWidth / 2 + 50, currentY);
        currentY += 70;
        
        // --- SIGNATURES ---
        const sigBoxWidth = 220; const sigBoxHeight = 80;
        doc.rect(margin, currentY, sigBoxWidth, sigBoxHeight);
        doc.text(request.employeeName, margin + sigBoxWidth / 2, currentY + 35, { align: 'center' });
        doc.text("Signature du demandeur", margin + sigBoxWidth / 2, currentY + sigBoxHeight + 15, { align: 'center' });
        doc.rect(pageWidth - margin - sigBoxWidth, currentY, sigBoxWidth, sigBoxHeight);
        doc.text("Mr Dernoncourt Julien", pageWidth - margin - sigBoxWidth / 2, currentY + 30, { align: 'center' });
        doc.text("Chef de cuisine IME Brebières", pageWidth - margin - sigBoxWidth / 2, currentY + 45, { align: 'center' });
        doc.text("Signature du responsable", pageWidth - margin - sigBoxWidth / 2, currentY + sigBoxHeight + 15, { align: 'center' });
        currentY += sigBoxHeight + 50;

        // --- FOOTER & DECISION ---
        const isAccepted = request.approvalStatus === 'accepted';
        doc.setFontSize(12);
        const acceptedText = "Demande Accordée";
        const rejectedText = "Demande refusée";
        if (isAccepted) {
            const dims = doc.getTextDimensions(acceptedText);
            doc.setFillColor(255, 255, 0); // Yellow
            doc.rect(margin - 2, currentY - dims.h + 2, dims.w + 4, dims.h + 2, 'F');
        } else {
             const dims = doc.getTextDimensions(rejectedText);
             doc.setFillColor(255, 255, 0); // Yellow
             doc.rect(margin + 130 - 2, currentY - dims.h + 2, dims.w + 4, dims.h + 2, 'F');
        }
        doc.setTextColor(0,0,0);
        doc.text(acceptedText, margin, currentY);
        doc.text("/", margin + 115, currentY);
        doc.text(rejectedText, margin + 130, currentY);
        doc.setFontSize(10);
        doc.text("version février 2022", pageWidth - margin, currentY, { align: 'right' });

        // --- SAVE ---
        doc.save(`Demande_Depassement_Horaire_${request.employeeName.replace(/\s+/g, '_')}.pdf`);
        toast({ title: "PDF Généré", description: `La demande de dépassement a été téléchargée.` });
    } catch (e) {
        console.error("Erreur génération PDF dépassement:", e);
        toast({ title: "Erreur génération PDF", description: (e as Error).message, variant: "destructive" });
    }
  };


     const handleGenerateAbsenceRequestPdf = async (request: AbsenceRequest) => {
    try {
        const fetchImageAsBase64 = (url: string): Promise<string | null> => {
             return new Promise(async (resolve) => {
                try {
                    const response = await fetch(url);
                    if (!response.ok) { resolve(null); return; }
                    const blob = await response.blob();
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = () => resolve(null);
                    reader.readAsDataURL(blob);
                } catch { resolve(null); }
            });
        };

        const logoUrl = '/logo/logo1.png';
        const logoBase64 = await fetchImageAsBase64(logoUrl);

        const doc = new jsPDF('p', 'pt', 'a4') as jsPDFWithAutoTable;
        const pageWidth = doc.internal.pageSize.width;
        const margin = 40;

        // Fond de page rose claire 

        doc.setFillColor(255, 182, 193); // Définit la couleur de remplissage 
        doc.rect(0, 0, pageWidth, doc.internal.pageSize.height, 'F'); // Dessine un rectangle rempli sur toute la page




        // --- HEADER TABLE (Same as Overtime) ---
        let currentY = margin;
        const headerTableHeight = 50; 
        doc.autoTable({
            startY: currentY,
            body: [['', '', '']], 
            theme: 'grid',
            styles: { cellPadding: 0, lineWidth: 1, lineColor: 0, minCellHeight: headerTableHeight, valign: 'middle' },
            columnStyles: {
                0: { cellWidth: 160, styles: { cellPadding: 2 } },
                1: { cellWidth: 'auto', halign: 'center' },
                2: { cellWidth: 150, halign: 'center' }
            },
            didDrawCell: (data) => {
                if (data.row.index === 0) {
                    const cell = data.cell;
                    if (data.column.index === 0) { // Logo
                        if (logoBase64) {
                            const logoWidth = 80; const logoHeight = 34;
                            const x = cell.x + (cell.width - logoWidth) / 2;
                            const y = cell.y + (cell.height - logoHeight) / 2;
                            doc.addImage(logoBase64, 'PNG', x, y, logoWidth, logoHeight, undefined, 'FAST');
                        }
                    } else if (data.column.index === 1) { // Title
                        doc.setFontSize(12);
                        doc.setFont(undefined, 'bold');
                        doc.text("DEMANDE D'AUTORISATION\nD'ABSENCE", cell.x + cell.width / 2, cell.y + cell.height / 2, { align: 'center', baseline: 'middle' });
                    } else if (data.column.index === 2) { // Ref
                        doc.setFontSize(9);
                        doc.setFont(undefined, 'normal');
                        const topBoxHeight = cell.height * 0.5;
                        doc.text("16-MES-F-04 Version 2.1", cell.x + cell.width / 2, cell.y + topBoxHeight / 2, { align: 'center', baseline: 'middle' });
                        doc.line(cell.x, cell.y + topBoxHeight, cell.x + cell.width, cell.y + topBoxHeight);
                        doc.text("Pôle Enfance de la Gohelle", cell.x + cell.width / 2, cell.y + topBoxHeight + (cell.height - topBoxHeight) / 2, { align: 'center', baseline: 'middle' });
                    }
                }
            },
            margin: { left: margin, right: margin }
        });
        currentY = (doc as any).autoTable.previous.finalY + 20;
        doc.setFont(undefined, 'normal');
        
        // --- MAIN INFO ---
        doc.setFontSize(9);
        doc.text("La demande doit être soumise à l'avis du pilote de prestation avec un préavis de 48h si possible", margin, currentY);
        currentY += 30;

        const drawUnderlinedText = (label: string, value: string, y: number) => {
            doc.setFontSize(10);
            const labelDims = doc.getTextDimensions(label);
            doc.text(label, margin, y);
            doc.setLineWidth(0.5);
            doc.line(margin, y + 2, margin + labelDims.w, y + 2);
            doc.text(value, margin + labelDims.w + 8, y);
        }

        drawUnderlinedText("Nom et Prénom:", request.employeeName || '.....................................', currentY);
        currentY += 25;
        drawUnderlinedText("Poste occupé à l'IME:", request.position || '.....................................', currentY);
        currentY += 30;

        // --- PRESTATIONS ---
        const prestLabel = "Prestation :";
        const prestLabelDims = doc.getTextDimensions(prestLabel);
        doc.text(prestLabel, margin, currentY);
        doc.setLineWidth(0.5);
        doc.line(margin, currentY + 2, margin + prestLabelDims.w, currentY + 2);
        doc.setFontSize(8);
        doc.text("Entourer la prestation correspondante", margin + 100, currentY);
        doc.setFontSize(10);
        currentY += 25;
        
        const allPrestations = {
            'Hébergement': { x: margin + 50, y: currentY }, 'Educatif': { x: margin + 180, y: currentY }, 'Médico-psycho-sociale': { x: margin + 310, y: currentY },
            'Administratif': { x: margin + 50, y: currentY + 20 }, 'Logistique': { x: margin + 180, y: currentY + 20 }
        };
        const requestPrestationLabels = (request.prestationTypes || []).map(p => PRESTATION_TYPE_LABELS[p as PrestationType] || p);
        Object.entries(allPrestations).forEach(([label, pos]) => {
            if (requestPrestationLabels.includes(label)) {
                const dims = doc.getTextDimensions(label);
                doc.setFillColor(255, 255, 0);
                doc.rect(pos.x - 2, pos.y - dims.h + 2, dims.w + 4, dims.h, 'F');
            }
            doc.text(label, pos.x, pos.y);
        });
        currentY += 45;

        // --- MOTIF ---
        const motifLabel = "Motif de la demande :";
        const motifLabelDims = doc.getTextDimensions(motifLabel);
        doc.text(motifLabel, margin, currentY);
        doc.setLineWidth(0.5);
        doc.line(margin, currentY + 2, margin + motifLabelDims.w, currentY + 2);
        // Use a simple line for the motif value
        doc.line(margin + motifLabelDims.w + 5, currentY + 2, pageWidth - margin, currentY + 2);
        doc.text(request.reason || '', margin + motifLabelDims.w + 8, currentY, {maxWidth: pageWidth - margin * 2 - motifLabelDims.w - 8});
        currentY += 40;

        // --- NEW ABSENCE TABLE ---
        doc.autoTable({
            startY: currentY,
            head: [[
                { content: "Date de l'absence prévue (jours et/ou heures initialement travaillés)", colSpan: 3 }
            ]],
            body: [
                [
                    `Le : ${isValid(parseISO(request.startDate)) ? format(parseISO(request.startDate), 'dd/MM/yyyy') : '..../..../....'}`,
                    'Horaires', 
                    'Nombre total d\'heures'
                ],
                ['', 'Matin ................... de .......... H .......... À .......... H ..........', '................... H ...................'],
                ['', 'Après-midi ............ de .......... H .......... À .......... H ..........', '................... H ...................'],
            ],
            theme: 'grid',
            styles: { lineWidth: 1, lineColor: 0, halign: 'center' },
            headStyles: { fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0] },

            columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 120 } },
            didParseCell: (data) => {
                if (data.row.index > 0) { // For Matin/Apres-midi rows
                    data.cell.styles.halign = 'left';
                }
                if (data.row.index === 1 && data.column.index === 2) {
                     data.cell.text = [`${request.totalAbsenceHours || '...'} H`];
                     data.cell.styles.halign = 'center';
                     data.cell.styles.valign = 'middle';
                }
            },
            willDrawCell: (data) => {
                 if (data.row.index === 1 && data.column.index === 2) {
                     // Merge the cell for total hours
                     data.cell.rowSpan = 2;
                 }
            },
            margin: { left: margin, right: margin }
        });
        currentY = (doc as any).autoTable.previous.finalY + 20;

        // --- SUMMARY & LOCATION ---
        doc.text(`Au total, l'absence représente ........ ${request.totalAbsenceHours || '...'} ........ heures ........ en moins de l'horaire prévu.`, margin, currentY);
        currentY += 35;
        doc.text(`Fait à : Brebières`, margin, currentY);
        doc.text(`Le : ${format(new Date(), 'dd/MM/yyyy')}`, pageWidth / 2 + 50, currentY);
        currentY += 70;
        
        // --- SIGNATURES ---
        const sigBoxWidth = 220; const sigBoxHeight = 80;
        doc.rect(margin, currentY, sigBoxWidth, sigBoxHeight);
        doc.text(request.employeeName, margin + sigBoxWidth / 2, currentY + 35, { align: 'center' });
        doc.text("Signature du demandeur", margin + sigBoxWidth / 2, currentY + sigBoxHeight + 15, { align: 'center' });
        doc.rect(pageWidth - margin - sigBoxWidth, currentY, sigBoxWidth, sigBoxHeight);
        doc.text("Mr Dernoncourt Julien", pageWidth - margin - sigBoxWidth / 2, currentY + 30, { align: 'center' });
        doc.text("Chef de cuisine IME Brebières", pageWidth - margin - sigBoxWidth / 2, currentY + 45, { align: 'center' });
        doc.text("Signature du responsable", pageWidth - margin - sigBoxWidth / 2, currentY + sigBoxHeight + 15, { align: 'center' });
        currentY += sigBoxHeight + 50;

        // --- FOOTER & DECISION ---
        const isAccepted = request.approvalStatus === 'accepted';
        doc.setFontSize(12);
        const acceptedText = "Demande Accordée";
        const rejectedText = "Demande refusée";
        if (isAccepted) {
            const dims = doc.getTextDimensions(acceptedText);
            doc.setFillColor(255, 255, 0); // Yellow
            doc.rect(margin - 2, currentY - dims.h + 2, dims.w + 4, dims.h + 2, 'F');
        } else {
             const dims = doc.getTextDimensions(rejectedText);
             doc.setFillColor(255, 255, 0); // Yellow
             doc.rect(margin + 130 - 2, currentY - dims.h + 2, dims.w + 4, dims.h + 2, 'F');
        }
        doc.setTextColor(0,0,0);
        doc.text(acceptedText, margin, currentY);
        doc.text("/", margin + 115, currentY);
        doc.text(rejectedText, margin + 130, currentY);
        doc.setFontSize(10);
        doc.text("version septembre 2025", pageWidth - margin, currentY, { align: 'right' });

        // --- SAVE ---
        doc.save(`Demande_Absence_${request.employeeName.replace(/\s+/g, '_')}.pdf`);
        toast({ title: "PDF Généré", description: `La demande d'absence a été téléchargée.` });
    } catch (e) {
        console.error("Erreur génération PDF absence:", e);
        toast({ title: "Erreur génération PDF", description: (e as Error).message, variant: "destructive" });
    }
  };

     const handleGenerateScheduleChangeRequestPdf = async (request: ScheduleChangeRequest) => {
    try {
        const fetchImageAsBase64 = (url: string): Promise<string | null> => {
             return new Promise(async (resolve) => {
                try {
                    const response = await fetch(url);
                    if (!response.ok) { resolve(null); return; }
                    const blob = await response.blob();
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = () => resolve(null);
                    reader.readAsDataURL(blob);
                } catch { resolve(null); }
            });
        };

        const logoUrl = '/logo/logo1.png';
        const logoBase64 = await fetchImageAsBase64(logoUrl);

        const doc = new jsPDF('p', 'pt', 'a4') as jsPDFWithAutoTable;
        const pageWidth = doc.internal.pageSize.width;
        const margin = 40;

        // fond de page couleur jaune clair

        doc.setFillColor(255, 255, 224); // Définit la couleur de remplissage (un jaune très clair)
        doc.rect(0, 0, pageWidth, doc.internal.pageSize.height, 'F'); // Dessine un rectangle rempli sur toute la page


        // --- HEADER ---
        let currentY = margin;
        const headerTableHeight = 50; 
        doc.autoTable({
            startY: currentY,
            body: [['', '', '']], 
            theme: 'grid', styles: { cellPadding: 0, lineWidth: 1, lineColor: 0, minCellHeight: headerTableHeight, valign: 'middle' },
            columnStyles: {
                0: { cellWidth: 160, styles: { cellPadding: 2 } },
                1: { cellWidth: 'auto', halign: 'center' },
                2: { cellWidth: 150, halign: 'center' }
            },
            didDrawCell: (data) => {
                if (data.row.index === 0) {
                    const cell = data.cell;
                    if (data.column.index === 0) {
                        if (logoBase64) {
                            const logoWidth = 80; const logoHeight = 34;
                            const x = cell.x + (cell.width - logoWidth) / 2;
                            const y = cell.y + (cell.height - logoHeight) / 2;
                            doc.addImage(logoBase64, 'PNG', x, y, logoWidth, logoHeight, undefined, 'FAST');
                        }
                    } else if (data.column.index === 1) {
                        doc.setFontSize(12); doc.setFont(undefined, 'bold');
                        doc.text("DEMANDE D'INVERSION\nHORAIRE", cell.x + cell.width / 2, cell.y + cell.height / 2, { align: 'center', baseline: 'middle' });
                    } else if (data.column.index === 2) {
                        doc.setFontSize(9); doc.setFont(undefined, 'normal');
                        const topBoxHeight = cell.height * 0.5;
                        doc.text("16-MES-F-02 Version 2.1", cell.x + cell.width / 2, cell.y + topBoxHeight / 2, { align: 'center', baseline: 'middle' });
                        doc.line(cell.x, cell.y + topBoxHeight, cell.x + cell.width, cell.y + topBoxHeight);
                        doc.text("Pôle Enfance de la Gohelle", cell.x + cell.width / 2, cell.y + topBoxHeight + (cell.height - topBoxHeight) / 2, { align: 'center', baseline: 'middle' });
                    }
                }
            },
            margin: { left: margin, right: margin }
        });
        currentY = (doc as any).autoTable.previous.finalY + 15;
        doc.setFont(undefined, 'normal');
        
        // --- MAIN INFO ---
        doc.setFontSize(9);
        doc.text("La demande doit être soumise à l'avis du pilote de prestation avec un préavis de 48h si possible", margin, currentY);
        currentY += 25;

        const drawUnderlinedText = (label: string, value: string, y: number) => {
            doc.setFontSize(10); const labelDims = doc.getTextDimensions(label);
            doc.text(label, margin, y); doc.setLineWidth(0.5);
            doc.line(margin, y + 2, margin + labelDims.w, y + 2);
            doc.text(value, margin + labelDims.w + 8, y);
        }

        drawUnderlinedText("Nom et Prénom:", request.employeeName || '.....................................', currentY);
        currentY += 25;
        drawUnderlinedText("Poste occupé au PEG:", request.position || '.....................................', currentY);
        currentY += 25;

        // --- PRESTATIONS ---
        const prestLabel = "Prestation :";
        const prestLabelDims = doc.getTextDimensions(prestLabel);
        doc.text(prestLabel, margin, currentY); doc.setLineWidth(0.5);
        doc.line(margin, currentY + 2, margin + prestLabelDims.w, currentY + 2);
        doc.setFontSize(8); doc.text("Entourer la prestation correspondante", margin + 100, currentY);
        doc.setFontSize(10); currentY += 25;
        
        const allPrestations = {
            'Hébergement': { x: margin + 50, y: currentY }, 'Educatif': { x: margin + 180, y: currentY }, 'Médico-psycho-sociale': { x: margin + 310, y: currentY },
            'Administratif': { x: margin + 50, y: currentY + 20 }, 'Logistique': { x: margin + 180, y: currentY + 20 }
        };
        const requestPrestationLabels = (request.prestationTypes || []).map(p => PRESTATION_TYPE_LABELS[p as PrestationType] || p);
        Object.entries(allPrestations).forEach(([label, pos]) => {
            if (requestPrestationLabels.includes(label)) {
                const dims = doc.getTextDimensions(label); doc.setFillColor(255, 255, 0);
                doc.rect(pos.x - 2, pos.y - dims.h + 2, dims.w + 4, dims.h, 'F');
            }
            doc.text(label, pos.x, pos.y);
        });
        currentY += 40;

        // --- MOTIF (THE REAL CORRECTION) ---
        const motifLabel = "Motif de la demande :";
        const motifLabelDims = doc.getTextDimensions(motifLabel);
        doc.text(motifLabel, margin, currentY);
        doc.setLineWidth(0.5);
        doc.line(margin, currentY + 2, margin + motifLabelDims.w, currentY + 2);
        doc.line(margin + motifLabelDims.w + 5, currentY + 2, pageWidth - margin, currentY + 2);
        doc.text(request.reasonStub || '', margin + motifLabelDims.w + 8, currentY, { maxWidth: pageWidth - margin * 2 - motifLabelDims.w - 8 });
        currentY += 25;

        // --- DYNAMIC TABLES & CALCULATION LOGIC ---
        const calculateDuration = (start?: string, end?: string): { totalMinutes: number, formatted: string } => {
            if (!start || !end || start.trim() === '' || end.trim() === '') return { totalMinutes: 0, formatted: '.........' };
            try {
                const [startH, startM] = start.split(':').map(Number);
                const [endH, endM] = end.split(':').map(Number);
                if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return { totalMinutes: 0, formatted: '.........' };
                let totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
                if (totalMinutes < 0) totalMinutes = 0;
                const h = Math.floor(totalMinutes / 60);
                const m = totalMinutes % 60;
                return { totalMinutes, formatted: `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}` };
            } catch { return { totalMinutes: 0, formatted: '.........' }; }
        };
        
        let totalDiffMinutes = 0;
        const allDetails = request.scheduleChangeDetails || [];
        allDetails.forEach(detail => {
            const originalDuration = calculateDuration(detail.originalStartTime, detail.originalEndTime);
            const newDuration = calculateDuration(detail.newStartTime, detail.newEndTime);
            totalDiffMinutes += newDuration.totalMinutes - originalDuration.totalMinutes;
        });

        const absences = allDetails.filter(d => calculateDuration(d.originalStartTime, d.originalEndTime).totalMinutes > 0);
        const recoveries = allDetails.filter(d => calculateDuration(d.newStartTime, d.newEndTime).totalMinutes > 0);

        for (let i = 0; i < 2; i++) {
            const absenceDetail = absences[i];
            const recoveryDetail = recoveries[i];

            const originalDuration = absenceDetail ? calculateDuration(absenceDetail.originalStartTime, absenceDetail.originalEndTime) : { formatted: '.........' };
            const newDuration = recoveryDetail ? calculateDuration(recoveryDetail.newStartTime, recoveryDetail.newEndTime) : { formatted: '.........' };
            
            const absenceDate = absenceDetail?.date;
            const recoveryDate = recoveryDetail?.date;

            if (i > 0) { 
                doc.setLineWidth(0.5);
                doc.line(margin, currentY + 5, pageWidth - margin, currentY + 5);
                currentY += 15;
            }

            const absenceBody = [
                [{ content: `Le : ${absenceDate && isValid(new Date(absenceDate)) ? format(new Date(absenceDate), 'dd/MM/yyyy') : '..../..../....'}`, styles: { halign: 'center' } }, `Matin .................. de ${absenceDetail?.originalStartTime || '...'} H à ${absenceDetail?.originalEndTime || '...'} H`, { content: `${originalDuration.formatted} H`, styles: { halign: 'center' }}],
                [{ content: '', styles: { minCellHeight: 20 } }, 'Après-midi ............ de .......... H .......... À .......... H ..........', { content: '......... H', styles: { halign: 'center' }}],
            ];
            const recoveryBody = [
                 [{ content: `Le : ${recoveryDate && isValid(new Date(recoveryDate)) ? format(new Date(recoveryDate), 'dd/MM/yyyy') : '..../..../....'}`, styles: { halign: 'center' } }, `Matin .................. de ${recoveryDetail?.newStartTime || '...'} H à ${recoveryDetail?.newEndTime || '...'} H`, { content: `${newDuration.formatted} H`, styles: { halign: 'center' }}],
                 [{ content: '', styles: { minCellHeight: 20 } }, 'Après-midi ............ de .......... H .......... À .......... H ..........', { content: '......... H', styles: { halign: 'center' }}],
            ];

            doc.autoTable({
                startY: currentY,
                head: [[{ content: "Date de l'absence prévue (jours et/ou heures initialement travaillés)", colSpan: 3 }]],
                body: absenceBody, theme: 'grid', styles: { lineWidth: 1, lineColor: 0, halign: 'left', valign: 'middle' },
                headStyles: { fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], halign: 'center' },
                columnStyles: { 0: { cellWidth: 120 }, 2: { cellWidth: 120 } }
            });
            currentY = (doc as any).autoTable.previous.finalY;
            doc.autoTable({
                startY: currentY,
                head: [[{ content: "Proposition de récupération (jours et/ou heures travaillés exceptionnellement)", colSpan: 3 }]],
                body: recoveryBody, theme: 'grid', styles: { lineWidth: 1, lineColor: 0, halign: 'left', valign: 'middle' },
                headStyles: { fontStyle: 'bold', fillColor: [255, 255, 255], textColor: [0, 0, 0], halign: 'center' },
                columnStyles: { 0: { cellWidth: 120 }, 2: { cellWidth: 120 } }
            });
            currentY = (doc as any).autoTable.previous.finalY;
        }
        currentY += 15;

        // --- SUMMARY ---
        let summaryPlus = '................ heures ................';
        let summaryMoins = '................ heures ................';

        if (totalDiffMinutes !== 0) {
            const absDiffMinutes = Math.abs(totalDiffMinutes);
            const h = Math.floor(absDiffMinutes / 60);
            const m = absDiffMinutes % 60;
            const diffFormatted = `${h > 0 ? `${h} heures` : ''}${m > 0 ? ` ${m}` : ''}`.trim();
            if (totalDiffMinutes > 0) {
                summaryPlus = `........ ${diffFormatted} ........`;
            } else {
                summaryMoins = `........ ${diffFormatted} ........`;
            }
        }
        
        doc.text(`Au total, l'inversion représente ${summaryPlus} en plus de l'horaire prévu.`, margin, currentY);
        currentY += 15;
        doc.text(`ou ${summaryMoins} en moins de l'horaire prévu.`, margin + 110, currentY);
        currentY += 30;

        // --- SIGNATURES ---
        const sigBoxWidth = 220; const sigBoxHeight = 60;
        doc.rect(margin, currentY, sigBoxWidth, sigBoxHeight);
        doc.text(request.employeeName, margin + sigBoxWidth / 2, currentY + 25, { align: 'center' });
        doc.text("Signature du demandeur", margin + sigBoxWidth / 2, currentY + sigBoxHeight + 12, { align: 'center' });
        doc.rect(pageWidth - margin - sigBoxWidth, currentY, sigBoxWidth, sigBoxHeight);
        doc.text("Mr Dernoncourt Julien", pageWidth - margin - sigBoxWidth / 2, currentY + 20, { align: 'center' });
        doc.text("Chef de cuisine IME Brebières", pageWidth - margin - sigBoxWidth / 2, currentY + 35, { align: 'center' });
        doc.text("Signature du responsable", pageWidth - margin - sigBoxWidth / 2, currentY + sigBoxHeight + 12, { align: 'center' });
        currentY += sigBoxHeight + 30;

        // --- FOOTER ---
        doc.text(`Fait à : Brebières`, margin, currentY);
        doc.text(`le : ${format(new Date(), 'dd/MM/yyyy')}`, pageWidth / 2 + 50, currentY);
        currentY += 30;

        const isAccepted = request.approvalStatus === 'accepted';
        doc.setFontSize(12);
        const acceptedText = "Demande Accordée";
        const rejectedText = "Demande refusée";
        if (isAccepted) {
            const dims = doc.getTextDimensions(acceptedText);
            doc.setFillColor(255, 255, 0); doc.rect(margin - 2, currentY - dims.h + 2, dims.w + 4, dims.h + 2, 'F');
        } else {
             const dims = doc.getTextDimensions(rejectedText);
             doc.setFillColor(255, 255, 0); doc.rect(margin + 130 - 2, currentY - dims.h + 2, dims.w + 4, dims.h + 2, 'F');
        }
        doc.setTextColor(0,0,0);
        doc.text(acceptedText, margin, currentY);
        doc.text("/", margin + 115, currentY);
        doc.text(rejectedText, margin + 130, currentY);
        doc.setFontSize(10);
        doc.text("version septembre 2025", pageWidth - margin, currentY, { align: 'right' });

        // --- SAVE ---
        doc.save(`Demande_Inversion_Horaire_${request.employeeName.replace(/\s+/g, '_')}.pdf`);
        toast({ title: "PDF Généré", description: `La demande d'inversion d'horaire a été téléchargée.` });
    } catch (e) {
        console.error("Erreur génération PDF changement horaire:", e);
        toast({ title: "Erreur génération PDF", description: (e as Error).message, variant: "destructive" });
    }
  };




                  // section PDF FIN



  if (!isClient || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg text-muted-foreground ml-3">Chargement des déclarations...</p>
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
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-1 mb-6 bg-card p-1 rounded-lg">
            {declarationHeureTabsConfig.map(tab => (<TabsTrigger key={tab.value} value={tab.value} className="text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-1 py-1 sm:px-2"><tab.Icon className="mr-1 sm:mr-2 h-4 w-4" />{tab.label}</TabsTrigger>))}
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

       <ScheduleChangeRequestDialog
        isOpen={isScheduleChangeFormOpen} onOpenChange={setIsScheduleChangeFormOpen} onSubmitRequest={handleAddOrUpdateScheduleChangeRequest}
        editingRequest={editingScheduleChangeRequest}
        isApproverView={isChef && activeTab === 'schedule-change-approval'} // Pass isApproverView based on tab and role
        currentUser={currentBrigadeMember ? { name: currentBrigadeMember.name, role: currentBrigadeMember.role } : loggedInUsername ? {name: loggedInUsername, role: ''} : null}
      />
    </div>
  );
}
