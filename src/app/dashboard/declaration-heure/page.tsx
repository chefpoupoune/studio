
"use client";

import Link from 'next/link';
import { FileClock, PlusCircle, History, Eye, Trash2, Edit2, CheckSquare, ListFilter } from 'lucide-react'; 
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CurrentDate } from '@/components/current-date';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { OvertimeRequest, PrestationType } from './types';
import { PRESTATION_TYPE_LABELS } from './types';
import OvertimeRequestDialog from './components/OvertimeRequestDialog';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO, isValid } from 'date-fns';
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
} from "@/components/ui/alert-dialog"; // Removed AlertDialogTrigger as it's used via asChild
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { BrigadeMember } from '@/app/dashboard/time-tracking/types'; 
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/hooks/use-mobile';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


const OVERTIME_REQUESTS_STORAGE_KEY = 'declaration_heure_overtime_requests_v4'; 
const BRIGADE_MEMBERS_STORAGE_KEY = 'time_tracking_members_v2';
const LOGGED_IN_USERNAME_KEY = 'loggedInUsername';

interface DeclarationHeureTab {
  value: string;
  label: string;
  Icon: React.ElementType;
  component: React.ReactNode;
  isChefOnly?: boolean;
}

export default function DeclarationHeurePage() {
  const [isClient, setIsClient] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>([]);
  const [brigadeMembers, setBrigadeMembers] = useState<BrigadeMember[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [loggedInUsername, setLoggedInUsername] = useState<string | null>(null);
  const [editingRequest, setEditingRequest] = useState<OvertimeRequest | null>(null);
  const [isApproverViewActive, setIsApproverViewActive] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const isChef = useMemo(() => loggedInUsername?.toLowerCase() === 'chef', [loggedInUsername]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      console.log("[DeclarationHeurePage LOAD] Attempting to load data...");
      setDataLoaded(false);
      try {
        const storedRequests = localStorage.getItem(OVERTIME_REQUESTS_STORAGE_KEY);
        if (storedRequests) {
          console.log("[DeclarationHeurePage LOAD] Found stored requests.");
          setOvertimeRequests(JSON.parse(storedRequests).map((req: any) => ({
            ...req,
            id: req.id || `or_${Date.now()}_${Math.random().toString(36).substring(2,9)}`, // Ensure ID exists
            requestDate: req.requestDate || new Date().toISOString(), 
            overtimeDetails: Array.isArray(req.overtimeDetails) 
              ? req.overtimeDetails.map((d:any) => ({...d, date: d.date || new Date().toISOString() })) 
              : [],
            approvalStatus: req.approvalStatus || req.status || 'pending',
            prestationTypes: Array.isArray(req.prestationTypes) ? req.prestationTypes : [],
            compensationType: req.compensationType === undefined ? null : req.compensationType, // Ensure null if undefined
          })).sort((a: OvertimeRequest, b: OvertimeRequest) => parseISO(b.requestDate).getTime() - parseISO(a.requestDate).getTime()));
        } else {
          console.log("[DeclarationHeurePage LOAD] No stored requests found, defaulting to empty array.");
          setOvertimeRequests([]);
        }

        const storedBrigadeMembers = localStorage.getItem(BRIGADE_MEMBERS_STORAGE_KEY);
        if (storedBrigadeMembers) {
          console.log("[DeclarationHeurePage LOAD] Found stored brigade members.");
          setBrigadeMembers(JSON.parse(storedBrigadeMembers));
        } else {
          console.log("[DeclarationHeurePage LOAD] No stored brigade members found.");
          setBrigadeMembers([]);
        }

        const username = localStorage.getItem(LOGGED_IN_USERNAME_KEY);
        setLoggedInUsername(username);
        console.log("[DeclarationHeurePage LOAD] Logged in username:", username);

      } catch (e) {
        console.error("[DeclarationHeurePage LOAD] Error loading data from localStorage", e);
        localStorage.removeItem(OVERTIME_REQUESTS_STORAGE_KEY);
        setOvertimeRequests([]);
        setBrigadeMembers([]);
        toast({ title: "Erreur de chargement des données", variant: "destructive" });
      } finally {
        setDataLoaded(true);
        console.log("[DeclarationHeurePage LOAD] Data loading complete, dataLoaded set to true.");
      }
    }
  }, [isClient, toast]);

  useEffect(() => {
    if (isClient && dataLoaded) {
      console.log(`[DeclarationHeurePage SAVE] Attempting to save ${overtimeRequests.length} requests to localStorage.`);
      localStorage.setItem(OVERTIME_REQUESTS_STORAGE_KEY, JSON.stringify(overtimeRequests));
      console.log("[DeclarationHeurePage SAVE] Requests saved.");
    } else {
      console.log(`[DeclarationHeurePage SAVE] Save skipped. isClient: ${isClient}, dataLoaded: ${dataLoaded}`);
    }
  }, [overtimeRequests, isClient, dataLoaded]);

  const currentBrigadeMember = useMemo(() => {
    if (loggedInUsername && brigadeMembers.length > 0) {
      return brigadeMembers.find(bm => bm.name.toLowerCase() === loggedInUsername.toLowerCase());
    }
    return null;
  }, [loggedInUsername, brigadeMembers]);

  const handleAddOrUpdateOvertimeRequest = useCallback((
    data: Partial<OvertimeRequest>
  ) => {
    if (!dataLoaded) {
      toast({ title: "Données non prêtes", description: "Veuillez patienter le chargement des données.", variant: "default" });
      return;
    }

    const employeeNameToUse = editingRequest?.employeeName || currentBrigadeMember?.name || loggedInUsername || "Système";
    const positionToUse = data.position || (editingRequest ? editingRequest.position : (currentBrigadeMember?.role || ''));

    let updatedRequestsList;

    if (editingRequest) {
      updatedRequestsList = overtimeRequests.map(req => 
        req.id === editingRequest.id 
        ? { 
            ...req, 
            ...data,
            employeeName: employeeNameToUse,
            position: positionToUse,
            updatedAt: new Date().toISOString(),
            approvalStatus: data.approvalStatus || req.approvalStatus || 'pending',
          } as OvertimeRequest
        : req
      );
      toast({ title: "Demande Modifiée", description: "Votre demande de dépassement d'horaire a été mise à jour." });
    } else {
      const newRequest: OvertimeRequest = {
        id: `or_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`, // More unique ID
        employeeName: employeeNameToUse,
        requestDate: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        approvalStatus: data.approvalStatus || 'pending',
        reasonStub: data.reasonStub || "Non spécifié", // Ensure reasonStub has a default
        ...data,
        position: positionToUse,
        overtimeDetails: data.overtimeDetails || [],
        prestationTypes: data.prestationTypes || [],
      } as OvertimeRequest; 
      updatedRequestsList = [newRequest, ...overtimeRequests];
      toast({ title: "Demande Soumise", description: "Votre demande de dépassement d'horaire a été enregistrée." });
    }
    
    updatedRequestsList.sort((a,b) => parseISO(b.requestDate).getTime() - parseISO(a.requestDate).getTime());
    setOvertimeRequests(updatedRequestsList);
    setEditingRequest(null);
  }, [overtimeRequests, editingRequest, loggedInUsername, currentBrigadeMember, toast, dataLoaded]);
  
  const handleDeleteRequest = (requestId: string) => {
    if (!dataLoaded) return;
    setOvertimeRequests(prev => prev.filter(req => req.id !== requestId));
    toast({ title: "Demande Supprimée", variant: "destructive" });
  };

  const handleOpenForm = (request?: OvertimeRequest, approverMode: boolean = false) => {
    setEditingRequest(request || null);
    setIsApproverViewActive(approverMode);
    setIsFormOpen(true);
  };

  const getStatusBadgeVariant = (status?: OvertimeRequest['approvalStatus']) => {
    switch (status) {
      case 'accepted': return 'success';
      case 'rejected': return 'destructive';
      case 'pending': default: return 'secondary';
    }
  };
   const getStatusLabel = (status?: OvertimeRequest['approvalStatus']) => {
    switch (status) {
      case 'accepted': return 'Acceptée';
      case 'rejected': return 'Refusée';
      case 'pending': default: return 'En attente';
    }
  };

  const renderRequestList = (requestsToList: OvertimeRequest[], approverModeView: boolean) => (
    requestsToList.length === 0 ? (
      <p className="text-muted-foreground text-center py-6">Aucune demande à afficher.</p>
    ) : (
      <ScrollArea className="h-[calc(100vh-26rem)] sm:h-[calc(100vh-24rem)]"> 
        <div className="space-y-3 pr-3">
          {requestsToList.map(req => (
            <Card key={req.id} className="bg-card/60">
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-md">
                    Demande du {format(parseISO(req.requestDate), "dd/MM/yyyy HH:mm", {locale: fr})}
                  </CardTitle>
                  <Badge variant={getStatusBadgeVariant(req.approvalStatus)}>
                    {getStatusLabel(req.approvalStatus)}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Par: {req.employeeName} {req.position && `(${req.position})`}
                  {req.updatedAt && ` | Modifié le: ${format(parseISO(req.updatedAt), "dd/MM/yy HH:mm", { locale: fr })}`}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1 text-xs">
                <p className="text-muted-foreground"><span className="font-medium text-foreground/80">Motif:</span> {req.reasonStub}</p>
                  {req.prestationTypes && req.prestationTypes.length > 0 && (
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground/80">Prestations:</span>{' '}
                      {req.prestationTypes.map(pt => PRESTATION_TYPE_LABELS[pt as PrestationType] || pt).join(', ')}
                      {req.prestationTypes.includes('autres') && req.prestationTypeAutresDetail && ` (${req.prestationTypeAutresDetail})`}
                    </p>
                  )}
                
                {req.overtimeDetails && req.overtimeDetails.length > 0 && (
                  <div className="mt-1">
                    <span className="font-medium text-foreground/80 flex items-center gap-1 mb-0.5"><CalendarClock className="h-3 w-3"/>Détail H.Supp:</span>
                    <ul className="list-none pl-2 text-muted-foreground space-y-0.5">
                      {req.overtimeDetails.map((detail, index) => (
                        <li key={detail.id || index} className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-primary/70"/>
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
                    {req.compensationType && <p>Compensation: {req.compensationType === 'recovery' ? 'Récupération' : 'Paiement'}</p>}
                    {req.decisionDate && isValid(parseISO(req.decisionDate)) && <p>Date Décision: {format(parseISO(req.decisionDate), "dd/MM/yyyy", {locale:fr})}</p>}
                  </div>
                )}

                <div className="mt-2 flex justify-end space-x-2 pt-1">
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => handleOpenForm(req, approverModeView)}>
                      <Edit2 className="mr-1 h-3.5 w-3.5"/> {approverModeView ? "Traiter" : "Modifier"}
                    </Button>
                    {(req.approvalStatus === 'pending' || !req.approvalStatus) && !approverModeView && ( 
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" className="text-xs">
                            <Trash2 className="mr-1 h-3.5 w-3.5"/> Annuler/Suppr.
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Annuler la demande ?</AlertDialogTitle><AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Non</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteRequest(req.id)}>Oui, annuler</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    )
  );

  const employeeRequests = useMemo(() => {
    if (!isClient || !loggedInUsername || !dataLoaded) return [];
    return overtimeRequests.filter(req => req.employeeName.toLowerCase() === loggedInUsername.toLowerCase());
  }, [isClient, loggedInUsername, overtimeRequests, dataLoaded]);

  const allRequestsForChef = useMemo(() => {
     if (!isClient || !dataLoaded) return [];
    return overtimeRequests;
  }, [isClient, overtimeRequests, dataLoaded]);

  const declarationHeureTabsConfig: DeclarationHeureTab[] = [
    { value: "my-requests", label: "Mes Demandes", Icon: History, component: (
      <Card className="shadow-xl">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <CardTitle>Mes Demandes de Dépassement d'Horaire</CardTitle>
            <CardDescription>Soumettez et suivez vos demandes.</CardDescription>
          </div>
          <Button onClick={() => handleOpenForm(undefined, false)} disabled={!dataLoaded || (!isChef && !currentBrigadeMember)}>
            <PlusCircle className="mr-2 h-4 w-4"/> Nouvelle Demande
          </Button>
        </CardHeader>
        <CardContent>{renderRequestList(isChef ? allRequestsForChef : employeeRequests, false)}</CardContent>
      </Card>
    )},
    { value: "approval-requests", label: "Approbation Demandes", Icon: CheckSquare, component: (
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle>Approbation des Demandes de Dépassement</CardTitle>
          <CardDescription>Traitez les demandes soumises par les employés.</CardDescription>
        </CardHeader>
        <CardContent>{renderRequestList(allRequestsForChef, true)}</CardContent>
      </Card>
    ), isChefOnly: true},
    { value: "absence-requests", label: "Demandes d'Absence (À Venir)", Icon: ListFilter, component: (
      <Card className="shadow-xl opacity-50 cursor-not-allowed">
        <CardHeader><CardTitle>Demandes d'Absence</CardTitle><CardDescription>Soumettez et suivez vos demandes d'absence.</CardDescription></CardHeader>
        <CardContent><p className="text-muted-foreground text-center py-6">Le module de demande d'absence sera développé prochainement.</p></CardContent>
      </Card>
    )},
  ];

  const visibleTabs = useMemo(() => {
    return declarationHeureTabsConfig.filter(tab => !tab.isChefOnly || isChef);
  }, [isChef, declarationHeureTabsConfig]); // Added declarationHeureTabsConfig

  const [activeTab, setActiveTab] = useState(visibleTabs.length > 0 ? visibleTabs[0].value : "");
  
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.find(tab => tab.value === activeTab)) {
      setActiveTab(visibleTabs[0].value);
    } else if (visibleTabs.length === 0 && activeTab !== "") {
      setActiveTab("");
    }
  }, [visibleTabs, activeTab]);


  if (!isClient || !dataLoaded) { // Show loading until client is ready AND initial data load attempted
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
                {tab.component}
            </TabsContent>
            ))
        ) : (
            <TabsContent value=""><p className="text-muted-foreground text-center py-6">Aucune section accessible.</p></TabsContent>
        )}
      </Tabs>


      <OvertimeRequestDialog
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmitRequest={handleAddOrUpdateOvertimeRequest}
        editingRequest={editingRequest}
        currentUser={currentBrigadeMember ? { name: currentBrigadeMember.name, role: currentBrigadeMember.role } : 
                     loggedInUsername ? {name: loggedInUsername, role: ''} : null}
        isApproverView={isApproverViewActive}
      />
    </div>
  );
}
