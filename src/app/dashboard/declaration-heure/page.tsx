
"use client";

import Link from 'next/link';
import { FileClock, PlusCircle, History, Eye, Trash2, Edit2, CheckSquare, ListFilter, CalendarClock, FileText, CalendarOff } from 'lucide-react'; 
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CurrentDate } from '@/components/current-date';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { OvertimeRequest, PrestationType, AbsenceRequest, AbsenceType } from './types'; 
import { PRESTATION_TYPE_LABELS, ABSENCE_TYPE_LABELS } from './types';
import OvertimeRequestDialog from './components/OvertimeRequestDialog';
import AbsenceRequestDialog from './components/AbsenceRequestDialog'; // New import
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid, differenceInCalendarDays, addDays } from 'date-fns';
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

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const OVERTIME_REQUESTS_STORAGE_KEY = 'declaration_heure_overtime_requests_v5';
const ABSENCE_REQUESTS_STORAGE_KEY = 'declaration_heure_absence_requests_v1'; // New key
const BRIGADE_MEMBERS_STORAGE_KEY = 'time_tracking_members_v2';
const LOGGED_IN_USERNAME_KEY = 'loggedInUsername';

interface DeclarationHeureTab {
  value: string;
  label: string;
  Icon: React.ElementType;
  isChefOnly?: boolean;
}

export default function DeclarationHeurePage() {
  const [isClient, setIsClient] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  // Overtime states
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>([]);
  const [isOvertimeFormOpen, setIsOvertimeFormOpen] = useState(false);
  const [editingOvertimeRequest, setEditingOvertimeRequest] = useState<OvertimeRequest | null>(null);
  const [isApproverViewActive, setIsApproverViewActive] = useState(false);

  // Absence states
  const [absenceRequests, setAbsenceRequests] = useState<AbsenceRequest[]>([]);
  const [isAbsenceFormOpen, setIsAbsenceFormOpen] = useState(false);
  const [editingAbsenceRequest, setEditingAbsenceRequest] = useState<AbsenceRequest | null>(null);
  // const [isAbsenceApproverViewActive, setIsAbsenceApproverViewActive] = useState(false); // For future approval

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
    console.log("[DeclarationHeurePage LOAD] Attempting to load initial data from localStorage.");
    setDataLoaded(false);
    let loadedOvertime: OvertimeRequest[] = [];
    let loadedAbsence: AbsenceRequest[] = [];
    let loadedBrigade: BrigadeMember[] = [];
    let usernameFromStorage: string | null = null;

    try {
      // Load Overtime Requests
      const storedOvertimeRaw = localStorage.getItem(OVERTIME_REQUESTS_STORAGE_KEY);
      if (storedOvertimeRaw) {
        loadedOvertime = JSON.parse(storedOvertimeRaw).map((req: any) => ({
          ...req,
          id: req.id || `or_${Date.now()}_${Math.random().toString(36).substring(2,9)}`, 
          requestDate: req.requestDate || new Date().toISOString(),
          updatedAt: req.updatedAt || new Date().toISOString(),
          overtimeDetails: Array.isArray(req.overtimeDetails) 
            ? req.overtimeDetails.map((d:any) => ({...d, date: d.date || new Date().toISOString(), id: d.id || `detail_${Date.now()}_${Math.random().toString(36).substring(2,9)}` })) 
            : [],
          approvalStatus: req.approvalStatus || 'pending',
          prestationTypes: Array.isArray(req.prestationTypes) ? req.prestationTypes : [],
          prestationTypeAutresDetail: req.prestationTypeAutresDetail || '',
          rejectionReason: req.rejectionReason || '',
          decisionDate: req.decisionDate || null,
          employeeSignatureDate: req.employeeSignatureDate || null,
          directManagerSignatureDate: req.directManagerSignatureDate || null,
          directorSignatureDate: req.directorSignatureDate || null,
        }));
      }
      setOvertimeRequests(loadedOvertime.sort((a,b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime()));

      // Load Absence Requests
      const storedAbsenceRaw = localStorage.getItem(ABSENCE_REQUESTS_STORAGE_KEY);
      if (storedAbsenceRaw) {
        loadedAbsence = JSON.parse(storedAbsenceRaw).map((req: any) => ({
          ...req,
          id: req.id || `abs_${Date.now()}_${Math.random().toString(36).substring(2,9)}`,
          requestDate: req.requestDate || new Date().toISOString(),
          updatedAt: req.updatedAt || new Date().toISOString(),
          status: req.status || 'pending',
        }));
      }
      setAbsenceRequests(loadedAbsence.sort((a,b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime()));


      const storedBrigadeMembersRaw = localStorage.getItem(BRIGADE_MEMBERS_STORAGE_KEY);
      if (storedBrigadeMembersRaw) loadedBrigade = JSON.parse(storedBrigadeMembersRaw);
      setBrigadeMembers(loadedBrigade);
      
      usernameFromStorage = localStorage.getItem(LOGGED_IN_USERNAME_KEY);
      setLoggedInUsername(usernameFromStorage);

    } catch (e) {
      console.error("[DeclarationHeurePage LOAD] Error loading data from localStorage", e);
      localStorage.removeItem(OVERTIME_REQUESTS_STORAGE_KEY); 
      localStorage.removeItem(ABSENCE_REQUESTS_STORAGE_KEY);
      setOvertimeRequests([]);
      setAbsenceRequests([]);
      setBrigadeMembers([]);
      setLoggedInUsername(null);
      toast({ title: "Erreur de chargement des données", description: "Les données de déclaration ont été réinitialisées.", variant: "destructive" });
    } finally {
      setDataLoaded(true);
      console.log("[DeclarationHeurePage LOAD] Data loading complete.");
    }
  }, [isClient, toast]);

  useEffect(() => {
    if (isClient && dataLoaded) { 
      localStorage.setItem(OVERTIME_REQUESTS_STORAGE_KEY, JSON.stringify(overtimeRequests));
    }
  }, [overtimeRequests, isClient, dataLoaded]);

  useEffect(() => {
    if (isClient && dataLoaded) {
      localStorage.setItem(ABSENCE_REQUESTS_STORAGE_KEY, JSON.stringify(absenceRequests));
    }
  }, [absenceRequests, isClient, dataLoaded]);

  const currentBrigadeMember = useMemo(() => {
    if (loggedInUsername && brigadeMembers.length > 0) {
      return brigadeMembers.find(bm => bm.name.toLowerCase() === loggedInUsername.toLowerCase());
    }
    return null;
  }, [loggedInUsername, brigadeMembers]);

  // Overtime Handlers
  const handleAddOrUpdateOvertimeRequest = useCallback((
    data: Partial<Omit<OvertimeRequest, 'id' | 'employeeName' | 'requestDate' | 'updatedAt'>> & {id?: string}
  ) => {
    if (!dataLoaded) {
      toast({ title: "Données non prêtes", description: "Veuillez patienter le chargement des données.", variant: "default" });
      return;
    }

    const employeeNameToUse = editingOvertimeRequest?.employeeName || currentBrigadeMember?.name || loggedInUsername || "Système";
    const positionToUse = data.position || (editingOvertimeRequest ? editingOvertimeRequest.position : (currentBrigadeMember?.role || ''));
    const nowISO = new Date().toISOString();
    let updatedRequestsList;

    if (editingOvertimeRequest || data.id) {
      const idToUpdate = data.id || editingOvertimeRequest!.id;
      updatedRequestsList = overtimeRequests.map(req => 
        req.id === idToUpdate
        ? { 
            ...req, 
            ...data,
            id: req.id,
            employeeName: employeeNameToUse,
            position: positionToUse,
            updatedAt: nowISO,
            reasonStub: data.reasonStub || req.reasonStub || "Non spécifié",
            approvalStatus: data.approvalStatus || req.approvalStatus || 'pending',
            prestationTypes: data.prestationTypes || req.prestationTypes || ['logistique'],
          } as OvertimeRequest
        : req
      );
      toast({ title: "Demande Dépassement Modifiée", description: "La demande a été mise à jour." });
    } else {
      const newRequest: OvertimeRequest = {
        id: `or_${Date.now()}_${Math.random().toString(36).substring(2,9)}`, 
        employeeName: employeeNameToUse,
        requestDate: nowISO,
        updatedAt: nowISO,
        approvalStatus: data.approvalStatus || 'pending',
        reasonStub: data.reasonStub || "Non spécifié",
        ...data,
        position: positionToUse,
        overtimeDetails: data.overtimeDetails || [],
        prestationTypes: data.prestationTypes || ['logistique'],
      } as OvertimeRequest; 
      updatedRequestsList = [newRequest, ...overtimeRequests];
      toast({ title: "Demande Dépassement Soumise", description: "La demande a été enregistrée." });
    }
    
    updatedRequestsList.sort((a,b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
    setOvertimeRequests(updatedRequestsList);
    setEditingOvertimeRequest(null); 
  }, [overtimeRequests, editingOvertimeRequest, loggedInUsername, currentBrigadeMember, toast, dataLoaded]);
  
  const handleDeleteOvertimeRequest = (requestId: string) => {
    if (!dataLoaded) return;
    setOvertimeRequests(prev => prev.filter(req => req.id !== requestId));
    toast({ title: "Demande Dépassement Supprimée", variant: "destructive" });
  };

  const handleOpenOvertimeForm = (request?: OvertimeRequest, approverMode: boolean = false) => {
    setEditingOvertimeRequest(request || null);
    setIsApproverViewActive(approverMode);
    setIsOvertimeFormOpen(true);
  };

  // Absence Handlers
  const handleAddOrUpdateAbsenceRequest = useCallback((
    data: Partial<Omit<AbsenceRequest, 'id' | 'employeeName' | 'requestDate' | 'updatedAt' | 'position'>> & {id?: string}
  ) => {
    if (!dataLoaded) {
        toast({ title: "Données non prêtes", variant: "default"});
        return;
    }
    const employeeNameToUse = editingAbsenceRequest?.employeeName || currentBrigadeMember?.name || loggedInUsername || "Système";
    const positionToUse = editingAbsenceRequest?.position || currentBrigadeMember?.role || '';
    const nowISO = new Date().toISOString();
    let updatedList;

    if (editingAbsenceRequest || data.id) {
        const idToUpdate = data.id || editingAbsenceRequest!.id;
        updatedList = absenceRequests.map(req => 
            req.id === idToUpdate 
            ? { ...req, ...data, employeeName: employeeNameToUse, position: positionToUse, updatedAt: nowISO, status: req.status || 'pending' } as AbsenceRequest
            : req
        );
        toast({ title: "Demande d'Absence Modifiée" });
    } else {
        const newRequest: AbsenceRequest = {
            id: `abs_${Date.now()}_${Math.random().toString(36).substring(2,9)}`,
            employeeName: employeeNameToUse,
            position: positionToUse,
            requestDate: nowISO,
            updatedAt: nowISO,
            status: 'pending',
            absenceType: data.absenceType!, // Should be set by form
            startDate: data.startDate!, // Should be set by form
            endDate: data.endDate!, // Should be set by form
            reason: data.reason || '',
            absenceTypeAutresDetail: data.absenceTypeAutresDetail,
        };
        updatedList = [newRequest, ...absenceRequests];
        toast({ title: "Demande d'Absence Soumise" });
    }
    updatedList.sort((a,b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
    setAbsenceRequests(updatedList);
    setEditingAbsenceRequest(null);
  }, [absenceRequests, editingAbsenceRequest, loggedInUsername, currentBrigadeMember, toast, dataLoaded]);

  const handleDeleteAbsenceRequest = (requestId: string) => {
    if (!dataLoaded) return;
    setAbsenceRequests(prev => prev.filter(req => req.id !== requestId));
    toast({ title: "Demande d'Absence Supprimée", variant: "destructive" });
  };

  const handleOpenAbsenceForm = (request?: AbsenceRequest) => {
    setEditingAbsenceRequest(request || null);
    // setIsAbsenceApproverViewActive(false); // For future approval logic
    setIsAbsenceFormOpen(true);
  };


  const getStatusBadgeVariant = (status?: OvertimeRequest['approvalStatus'] | AbsenceRequest['status']) => {
    switch (status) {
      case 'accepted': return 'success';
      case 'rejected': return 'destructive';
      case 'pending': default: return 'secondary';
    }
  };
   const getStatusLabel = (status?: OvertimeRequest['approvalStatus'] | AbsenceRequest['status']) => {
    switch (status) {
      case 'accepted': return 'Acceptée';
      case 'rejected': return 'Refusée';
      case 'pending': default: return 'En attente';
    }
  };

  const handleGenerateOvertimeRequestPdf = (request: OvertimeRequest) => {
    const pdfSettings = getPdfLayoutSettings('overtime_request_form');
    const doc = new jsPDF({
      orientation: pdfSettings.orientation,
      unit: 'pt',
      format: pdfSettings.pageSize,
    }) as jsPDFWithAutoTable;
    doc.setFont(pdfSettings.fontFamily);

    const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });
    let currentY = pdfSettings.marginTop;

    if (pdfSettings.logoUrl && pdfSettings.logoUrl.startsWith('data:image')) {
        try {
            const imgProps = doc.getImageProperties(pdfSettings.logoUrl);
            const formatType = imgProps.fileType.toUpperCase();
            const desiredHeight = 30; 
            const imgWidth = (imgProps.width * desiredHeight) / imgProps.height;
            doc.addImage(pdfSettings.logoUrl, formatType, pdfSettings.marginLeft, currentY, imgWidth, desiredHeight);
            currentY += desiredHeight + 5;
        } catch(e:any) { console.error("Error drawing logo in PDF:", e); }
    }
    if (pdfSettings.headerText) {
      const headerLines = pdfSettings.headerText.split('\n');
      doc.setFontSize(pdfSettings.headerFontSize);
      headerLines.forEach(line => {
          doc.text(line, pdfSettings.marginLeft, currentY);
          currentY += pdfSettings.headerFontSize * 0.7 + 2; 
      });
      currentY += 5;
    }

    doc.setFontSize(18);
    doc.text("DEMANDE DE DEPASSEMENT D'HORAIRE", doc.internal.pageSize.getWidth() / 2, currentY, { align: 'center' });
    currentY += 25;

    doc.setFontSize(pdfSettings.defaultFontSize);
    doc.text(`Nom et prénom du salarié : ${request.employeeName || 'N/A'}`, pdfSettings.marginLeft, currentY); currentY += 15;
    doc.text(`Poste occupé à l'IME : ${request.position || 'N/A'}`, pdfSettings.marginLeft, currentY); currentY += 20;

    doc.text("Prestation correspondante :", pdfSettings.marginLeft, currentY); currentY += 15;
    let prestationText = (request.prestationTypes || [])
      .map(pt => PRESTATION_TYPE_LABELS[pt] || pt)
      .join(', ');
    if (request.prestationTypes?.includes('autres') && request.prestationTypeAutresDetail) {
      prestationText += ` (Précision : ${request.prestationTypeAutresDetail})`;
    }
    doc.text(prestationText || "Logistique", pdfSettings.marginLeft + 10, currentY, { maxWidth: doc.internal.pageSize.getWidth() - pdfSettings.marginLeft - pdfSettings.marginRight - 20 });
    currentY += (doc.splitTextToSize(prestationText || "Logistique", doc.internal.pageSize.getWidth() - pdfSettings.marginLeft - pdfSettings.marginRight - 20).length * (pdfSettings.defaultFontSize * 0.7)) + 5;

    doc.text("Motif de la demande :", pdfSettings.marginLeft, currentY); currentY += 15;
    doc.text(request.reasonStub || 'N/A', pdfSettings.marginLeft + 10, currentY, { maxWidth: doc.internal.pageSize.getWidth() - pdfSettings.marginLeft - pdfSettings.marginRight - 20 });
    currentY += (doc.splitTextToSize(request.reasonStub || 'N/A', doc.internal.pageSize.getWidth() - pdfSettings.marginLeft - pdfSettings.marginRight - 20).length * (pdfSettings.defaultFontSize * 0.7)) + 10;

    if (request.overtimeDetails && request.overtimeDetails.length > 0) {
      doc.text("Détail des heures supplémentaires :", pdfSettings.marginLeft, currentY); currentY += 5;
      doc.autoTable({
        startY: currentY,
        head: [['Date', 'Heure début', 'Heure fin']],
        body: request.overtimeDetails.map(d => [
          d.date && isValid(parseISO(d.date)) ? format(parseISO(d.date), 'dd/MM/yyyy', { locale: fr }) : 'N/A',
          d.startTime || '-',
          d.endTime || '-',
        ]),
        theme: 'grid',
        styles: { fontSize: pdfSettings.tableBodyFontSize, font: pdfSettings.fontFamily },
        headStyles: { fillColor: hexToRgb(pdfSettings.primaryColor || '#CCCCCC') || [220,220,220], textColor: [0,0,0], fontSize: pdfSettings.tableHeaderFontSize },
        margin: { left: pdfSettings.marginLeft, right: pdfSettings.marginRight },
      });
      currentY = (doc as any).lastAutoTable.finalY + 10;
    }

    doc.text(`Total des heures en plus de l'horaire prévu : ${request.totalOvertimeHours || 'N/A'}`, pdfSettings.marginLeft, currentY); currentY += 20;
    
    const sigDate = (dateStr: string | null | undefined) => dateStr && isValid(parseISO(dateStr)) ? format(parseISO(dateStr), "dd/MM/yyyy", { locale: fr }) : 'Non signé';
    doc.text(`Saluarié(e) le : ${sigDate(request.employeeSignatureDate)}`, pdfSettings.marginLeft, currentY); currentY += 15;
    doc.text(`Le Responsable Direct le : ${sigDate(request.directManagerSignatureDate)}`, pdfSettings.marginLeft, currentY); currentY += 15;
    doc.text(`Le Directeur le : ${sigDate(request.directorSignatureDate)}`, pdfSettings.marginLeft, currentY); currentY += 25;

    doc.setFont(undefined, 'bold');
    doc.text("CADRE RESERVE A LA DIRECTION", pdfSettings.marginLeft, currentY);
    doc.setFont(undefined, 'normal');
    currentY += 15;
    doc.text(`Acceptée / Refusée : ${getStatusLabel(request.approvalStatus)}`, pdfSettings.marginLeft, currentY); currentY += 15;
    if (request.approvalStatus === 'rejected' && request.rejectionReason) {
      doc.text(`Si refusée, motif : ${request.rejectionReason}`, pdfSettings.marginLeft, currentY); currentY += 15;
    }
    doc.text(`Date : ${sigDate(request.decisionDate)}`, pdfSettings.marginLeft, currentY); currentY += 15;
    doc.text(`Signature de la Direction : `, pdfSettings.marginLeft, currentY); 

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        if (pdfSettings.footerText) {
          let footerStr = pdfSettings.footerText.replace('{date}', generationDateFormatted).replace('{pageNumber}', i.toString()).replace('{totalPages}', pageCount.toString());
          doc.setFontSize(pdfSettings.footerFontSize);
          doc.text(footerStr, pdfSettings.marginLeft, doc.internal.pageSize.height - (pdfSettings.marginBottom / 2));
        }
    }

    doc.save(`Demande_Depassement_${request.employeeName.replace(/\s+/g, '_')}_${format(parseISO(request.requestDate), "yyyy-MM-dd")}.pdf`);
    toast({ title: "PDF Généré", description: `Le PDF pour la demande de ${request.employeeName} a été téléchargé.` });
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
                  {req.updatedAt && ` | Modifié le: ${format(parseISO(req.updatedAt), "dd/MM/yy HH:mm", { locale: fr })}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1 text-xs">
                <p className="text-muted-foreground"><span className="font-medium text-foreground/80">Motif:</span> {req.reasonStub}</p>
                {req.prestationTypes && req.prestationTypes.length > 0 && (
                    <p className="text-muted-foreground"><span className="font-medium text-foreground/80">Prestations:</span>{' '}{req.prestationTypes.map(pt => PRESTATION_TYPE_LABELS[pt as PrestationType] || pt).join(', ')}{req.prestationTypes.includes('autres') && req.prestationTypeAutresDetail && ` (${req.prestationTypeAutresDetail})`}</p>
                )}
                
                {req.overtimeDetails && req.overtimeDetails.length > 0 && (
                  <div className="mt-1">
                    <span className="font-medium text-foreground/80 flex items-center gap-1 mb-0.5"><CalendarClock className="h-3 w-3"/>Détail H.Supp:</span>
                    <ul className="list-none pl-2 text-muted-foreground space-y-0.5">
                      {req.overtimeDetails.map((detail, index) => (
                        <li key={detail.id || index} className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-primary/70"/>
                          {detail.date && isValid(parseISO(detail.date)) ? format(parseISO(detail.date), "dd/MM/yy", {locale: fr}) : 'Date invalide'}
                          {detail.startTime && detail.endTime ? `: de ${detail.startTime} à ${detail.endTime}` : detail.startTime ? `: à partir de ${detail.startTime}` : detail.endTime ? `: jusqu'à ${detail.endTime}` : ' (horaires non spécifiés)'}
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
                    {(req.approvalStatus === 'pending' || !req.approvalStatus) && !approverModeView && ( 
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" className="text-xs"><Trash2 className="mr-1 h-3.5 w-3.5"/> Annuler/Suppr.</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Annuler la demande ?</AlertDialogTitle><AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Non</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteOvertimeRequest(req.id)}>Oui, annuler</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                      </AlertDialog>
                    )}
                    {req.approvalStatus === 'accepted' && (
                      <Button variant="default" size="sm" className="text-xs" onClick={() => handleGenerateOvertimeRequestPdf(req)}><FileText className="mr-1 h-3.5 w-3.5"/> Générer PDF</Button>
                    )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    )
  );

  const renderAbsenceRequestList = (requestsToList: AbsenceRequest[]) => (
    requestsToList.length === 0 ? (
      <p className="text-muted-foreground text-center py-6">Vous n'avez aucune demande d'absence.</p>
    ) : (
      <ScrollArea className="h-[calc(100vh-26rem)] sm:h-[calc(100vh-24rem)]">
        <div className="space-y-3 pr-3">
          {requestsToList.map(req => (
            <Card key={req.id} className="bg-card/60">
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex justify-between items-start">
                    <CardTitle className="text-md">Absence du {format(parseISO(req.startDate), "dd/MM/yy", {locale: fr})} au {format(parseISO(req.endDate), "dd/MM/yy", {locale: fr})}</CardTitle>
                    <Badge variant={getStatusBadgeVariant(req.status)}>{getStatusLabel(req.status)}</Badge>
                </div>
                <CardDescription className="text-xs">
                  Demandé par: {req.employeeName} {req.position && `(${req.position})`}
                  {` | Type: ${ABSENCE_TYPE_LABELS[req.absenceType] || req.absenceType}`}
                  {req.absenceType === 'Autre' && req.absenceTypeAutresDetail && ` (${req.absenceTypeAutresDetail})`}
                  {` | Le: ${format(parseISO(req.requestDate), "dd/MM/yy HH:mm", { locale: fr })}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1 text-xs">
                {req.reason && <p className="text-muted-foreground"><span className="font-medium text-foreground/80">Motif:</span> {req.reason}</p>}
                {/* Future: Display number of days */}
                 <div className="mt-2 flex justify-end space-x-2 pt-1">
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => handleOpenAbsenceForm(req)}>
                      <Edit2 className="mr-1 h-3.5 w-3.5"/> {(req.status === 'accepted' || req.status === 'rejected') ? "Voir" : "Modifier"}
                    </Button>
                    {(req.status === 'pending' || !req.status) && ( 
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" className="text-xs"><Trash2 className="mr-1 h-3.5 w-3.5"/> Annuler/Suppr.</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Annuler la demande d'absence ?</AlertDialogTitle><AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Non</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteAbsenceRequest(req.id)}>Oui, annuler</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                      </AlertDialog>
                    )}
                    {/* Future: PDF for absence request */}
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
  
  // const allAbsenceRequestsForChef = useMemo(() => { // For future approval tab
  //    if (!isClient || !dataLoaded) return [];
  //   return absenceRequests;
  // }, [isClient, absenceRequests, dataLoaded]);


  const declarationHeureTabsConfig: DeclarationHeureTab[] = [
    { value: "my-overtime-requests", label: "Demandes Dépassement", Icon: History },
    { value: "my-absence-requests", label: "Demandes Absence", Icon: CalendarOff },
    { value: "overtime-approval", label: "Approbation Dépassement", Icon: CheckSquare, isChefOnly: true },
    // { value: "absence-approval", label: "Approbation Absence", Icon: FileCheck2, isChefOnly: true }, // Placeholder
  ];

  const visibleTabs = useMemo(() => {
    return declarationHeureTabsConfig.filter(tab => !tab.isChefOnly || isChef);
  }, [isChef]); 

  const [activeTab, setActiveTab] = useState(visibleTabs.length > 0 ? visibleTabs[0].value : "");
  
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.find(tab => tab.value === activeTab)) {
      setActiveTab(visibleTabs[0].value);
    } else if (visibleTabs.length === 0 && activeTab !== "") {
      setActiveTab("");
    }
  }, [visibleTabs, activeTab]);


  if (!isClient || !dataLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-lg text-muted-foreground">Chargement de la déclaration d'heures...</p>
      </div>
    );
  }
  
  const getTabContent = (tabValue: string) => {
    switch (tabValue) {
      case "my-overtime-requests":
        return (
          <Card className="shadow-xl">
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <CardTitle>Mes Demandes de Dépassement d'Horaire</CardTitle>
                <CardDescription>Soumettez et suivez vos demandes.</CardDescription>
              </div>
              <Button onClick={() => handleOpenOvertimeForm(undefined, false)} disabled={!dataLoaded || (!currentBrigadeMember && !isChef)}>
                <PlusCircle className="mr-2 h-4 w-4"/> Nouvelle Demande Dépassement
              </Button>
            </CardHeader>
            <CardContent>{renderOvertimeRequestList(employeeOvertimeRequests, false)}</CardContent>
          </Card>
        );
      case "my-absence-requests":
        return (
          <Card className="shadow-xl">
             <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <div>
                <CardTitle>Mes Demandes d'Absence</CardTitle>
                <CardDescription>Soumettez et suivez vos demandes d'absence.</CardDescription>
              </div>
              <Button onClick={() => handleOpenAbsenceForm(undefined)} disabled={!dataLoaded || (!currentBrigadeMember && !isChef)}>
                <PlusCircle className="mr-2 h-4 w-4"/> Nouvelle Demande d'Absence
              </Button>
            </CardHeader>
            <CardContent>{renderAbsenceRequestList(employeeAbsenceRequests)}</CardContent>
          </Card>
        );
      case "overtime-approval":
        return isChef ? (
          <Card className="shadow-xl">
            <CardHeader>
              <CardTitle>Approbation des Demandes de Dépassement</CardTitle>
              <CardDescription>Traitez les demandes soumises par les employés.</CardDescription>
            </CardHeader>
            <CardContent>{renderOvertimeRequestList(allOvertimeRequestsForChef, true)}</CardContent>
          </Card>
        ) : null;
      default:
        return null;
    }
  };

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
              <SelectTrigger id="mobile-declaration-nav-select" className="w-full mt-1">
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
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 gap-1 mb-6 bg-card p-1 rounded-lg">
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
                {getTabContent(tab.value)}
            </TabsContent>
            ))
        ) : (
            <TabsContent value=""><p className="text-muted-foreground text-center py-6">Aucune section accessible.</p></TabsContent>
        )}
      </Tabs>

      <OvertimeRequestDialog
        isOpen={isOvertimeFormOpen}
        onOpenChange={setIsOvertimeFormOpen}
        onSubmitRequest={handleAddOrUpdateOvertimeRequest}
        editingRequest={editingOvertimeRequest}
        currentUser={currentBrigadeMember ? { name: currentBrigadeMember.name, role: currentBrigadeMember.role } : 
                     loggedInUsername ? {name: loggedInUsername, role: ''} : null}
        isApproverView={isApproverViewActive}
      />
      
      <AbsenceRequestDialog
        isOpen={isAbsenceFormOpen}
        onOpenChange={setIsAbsenceFormOpen}
        onSubmitRequest={handleAddOrUpdateAbsenceRequest}
        editingRequest={editingAbsenceRequest}
        currentUser={currentBrigadeMember ? { name: currentBrigadeMember.name, role: currentBrigadeMember.role } : 
                     loggedInUsername ? {name: loggedInUsername, role: ''} : null}
        // isApproverView={isAbsenceApproverViewActive} // For future
      />
    </div>
  );
}
