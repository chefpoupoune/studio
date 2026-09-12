'use client';

import { useState, useEffect } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { firestore } from "@/lib/firebase";
import type { PmsZone, PmsTaskDefinition, PmsConfigurations } from '../settings/types';
import { Loader2, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useAuth } from "@/contexts/AuthContext";

declare module 'jspdf' {
    interface jsPDF {
      autoTable: (options: any) => jsPDF;
    }
}

const PMS_CONFIG_COLLECTION = "pmsConfigurations";
const PMS_CONFIG_DOC_ID = "mainConfig";
const FREQUENCY_COLLECTION = "cleaningFrequencies";

const frequencyOptions = [
  { value: "", label: "Non défini" },
  { value: "daily", label: "Quotidien" },
  { value: "weekly", label: "1 fois par semaine" },
  { value: "every_friday", label: "Tout les vendredi" },
  { value: "monthly", label: "1 fois par mois" },
  { value: "quarterly", label: "Tous les 3 mois" },
  { value: "biannual", label: "Tous les 6 mois" },
  { value: "annual", label: "Tous les ans" },
];

const CleaningTab = ({ zones, frequencies, handleFrequencyChange, activeFilter, setActiveFilter, title, isReadOnly }: any) => {
  
  const filteredZones = zones.map(zone => ({
    ...zone,
    tasks: (zone.tasks || []).filter(task => activeFilter === 'all' || frequencies[task.id] === activeFilter)
  })).filter(zone => zone.tasks.length > 0);

  const renderZoneTable = (tasks: PmsTaskDefinition[]) => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-neutral-700">
        <thead>
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Tâche / Élément à nettoyer</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-1/3">Fréquence de nettoyage</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800">
          {tasks.map((task) => (
            <tr key={task.id}>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{task.name}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <select
                  value={frequencies[task.id] || ""}
                  onChange={(e) => handleFrequencyChange(task.id, e.target.value)}
                  disabled={isReadOnly}
                  className="block w-full bg-transparent border border-neutral-600 rounded-md py-2 px-3 focus:outline-none focus:ring-1 focus:ring-rose-500 disabled:bg-neutral-800 disabled:opacity-70"
                >
                  {frequencyOptions.map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-neutral-800 text-white">{opt.label}</option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="py-4">
       <div className="flex flex-wrap gap-2 mb-4">
          <Button 
            size="sm" 
            variant="outline"
            className={activeFilter === 'all' ? 'bg-rose-900 text-white hover:bg-rose-800 hover:text-white' : ''} 
            onClick={() => setActiveFilter('all')}
          >
            Tous
          </Button>
          {frequencyOptions.filter(opt => opt.value).map(opt => (
             <Button 
                key={opt.value} 
                size="sm" 
                variant="outline"
                className={activeFilter === opt.value ? 'bg-rose-900 text-white hover:bg-rose-800 hover:text-white' : ''} 
                onClick={() => setActiveFilter(opt.value)}
             >
                {opt.label}
             </Button>
          ))}
      </div>

      {filteredZones.length > 0 ? (
        <Accordion type="single" collapsible className="w-full" defaultValue={filteredZones[0]?.id}>
          {filteredZones.map((zone) => (
            <AccordionItem value={zone.id} key={zone.id}>
              <AccordionTrigger className="text-lg font-semibold hover:no-underline">{zone.name}</AccordionTrigger>
              <AccordionContent>
                {zone.tasks && zone.tasks.length > 0 ? renderZoneTable(zone.tasks) : <p className="p-4 text-sm">Aucune tâche définie pour cette zone.</p>}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : (
        <p className="text-center py-8 text-muted-foreground">
          {activeFilter === 'all' 
            ? `Les données de nettoyage sont introuvables. Assurez-vous que la zone "Suivi Nettoyage ${title}" est configurée.`
            : `Aucune tâche ne correspond au filtre "${frequencyOptions.find(o => o.value === activeFilter)?.label}".`
          }
        </p>
      )}
    </div>
  );
};


// --------- Main Page Component ---------
const CleaningPage = () => {
  const { toast } = useToast();
  const { isReadOnly, isLoading: isAuthLoading } = useAuth();
  const [kitchenZones, setKitchenZones] = useState<PmsZone[]>([]);
  const [restaurantZones, setRestaurantZones] = useState<PmsZone[]>([]);
  const [frequencies, setFrequencies] = useState<{ [taskId: string]: string }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("kitchen");
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'kitchen' || hash === 'restaurant') {
      setActiveTab(hash);
    }
  }, []);

  useEffect(() => {
    const fetchPageData = async () => {
      setIsLoading(true);
      try {
        const pmsConfigDoc = await getDoc(doc(firestore, PMS_CONFIG_COLLECTION, PMS_CONFIG_DOC_ID));
        const allTaskIds: string[] = [];
        if (pmsConfigDoc.exists()) {
          const pmsData = pmsConfigDoc.data() as PmsConfigurations;
          const kZones = pmsData['kitchenCleaning_v1'] || [];
          const rZones = pmsData['restaurantCleaning_v1'] || [];
          setKitchenZones(kZones);
          setRestaurantZones(rZones);
          
          [...kZones, ...rZones].forEach(zone => {
            (zone.tasks || []).forEach(task => allTaskIds.push(task.id));
          });
        } else {
          toast({ title: "Configuration Manquante", description: "Veuillez définir la configuration PMS dans les paramètres.", variant: "destructive" });
        }

        if (allTaskIds.length > 0) {
          const freqSnapshots = await getDocs(collection(firestore, FREQUENCY_COLLECTION));
          const freqData: { [taskId: string]: string } = {};
          freqSnapshots.forEach(doc => {
            if (allTaskIds.includes(doc.id)) {
              freqData[doc.id] = doc.data().frequency;
            }
          });
          setFrequencies(freqData);
        }
      } catch (error) {
        console.error("Error loading page data:", error);
        toast({ title: "Erreur de Chargement", description: "Une erreur est survenue lors du chargement des données.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    fetchPageData();
  }, [toast]);

  const handleFrequencyChange = async (taskId: string, frequency: string) => {
    if (isReadOnly) {
        toast({
          title: "Accès non autorisé",
          description: "Vous n\'avez pas les droits pour modifier cette information.",
          variant: "destructive"
        });
        return;
    }
    const oldFrequency = frequencies[taskId];
    setFrequencies((prev) => ({ ...prev, [taskId]: frequency }));
    try {
      await setDoc(doc(firestore, FREQUENCY_COLLECTION, taskId), { frequency });
      toast({ title: "Fréquence mise à jour", description: `La fréquence a bien été enregistrée.` });
    } catch (error) {
      setFrequencies((prev) => ({ ...prev, [taskId]: oldFrequency }));
      toast({ title: "Erreur de Sauvegarde", description: "Impossible de sauvegarder la fréquence.", variant: "destructive" });
    }
  };

  const handleExportPdf = () => {
    const activeTabData = activeTab === 'kitchen' ? kitchenZones : restaurantZones;
    const tabTitle = activeTab === 'kitchen' ? 'Cuisine' : 'Restaurant';
    const filterLabel = frequencyOptions.find(f => f.value === activeFilter)?.label || 'Tous';

    const filteredPdfZones = activeTabData.map(zone => ({
      ...zone,
      tasks: (zone.tasks || []).filter(task => activeFilter === 'all' || frequencies[task.id] === activeFilter)
    })).filter(zone => zone.tasks.length > 0);

    if (filteredPdfZones.length === 0) {
      toast({
        title: "Exportation impossible",
        description: "Aucune donnée à exporter pour la vue actuelle.",
        variant: "destructive",
      });
      return;
    }

    const doc = new jsPDF();
    doc.text(`Planning de Nettoyage - ${tabTitle}`, 14, 20);
    doc.setFontSize(12);
    doc.text(`Filtre appliqué : ${filterLabel}`, 14, 28);

    let finalY = 35;

    filteredPdfZones.forEach(zone => {
      if (finalY > 250) {
        doc.addPage();
        finalY = 20;
      }

      const tableRows = zone.tasks.map(task => [
        task.name,
        frequencyOptions.find(f => f.value === frequencies[task.id])?.label || 'Non défini'
      ]);

      doc.setFontSize(14);
      doc.text(zone.name, 14, finalY);
      finalY += 7;

      doc.autoTable({
        head: [["Tâche", "Fréquence"]],
        body: tableRows,
        startY: finalY,
        theme: 'grid',
        headStyles: { fillColor: [140, 20, 20] }, // Bordeaux color
      });

      finalY = (doc as any).lastAutoTable.finalY + 10;
    });

    doc.save(`planning-nettoyage-${tabTitle.toLowerCase()}-${filterLabel.toLowerCase().replace(/ /g, '_')}.pdf`);
  };

  if (isLoading || isAuthLoading) {
      return (
         <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2">Chargement des plannings...</p>
      </div>
      )
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-8">
          <div>
              <h1 className="text-3xl font-bold">Planning de Nettoyage</h1>
              <p className="text-muted-foreground">
                  Consultez ou modifiez le planning de nettoyage pour chaque catégorie.
              </p>
          </div>
          <Button onClick={handleExportPdf} variant="outline">
              <FileDown className="h-4 w-4 mr-2" />
              Exporter en PDF
          </Button>
      </div>

        <Tabs value={activeTab} onValueChange={(value) => { setActiveTab(value); setActiveFilter('all'); }} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="kitchen">Cuisine</TabsTrigger>
            <TabsTrigger value="restaurant">Restaurant</TabsTrigger>
          </TabsList>
          <TabsContent value="kitchen">
            <CleaningTab 
                zones={kitchenZones}
                frequencies={frequencies}
                handleFrequencyChange={handleFrequencyChange}
                activeFilter={activeFilter}
                setActiveFilter={setActiveFilter}
                title="Cuisine"
                isReadOnly={isReadOnly}
            />
          </TabsContent>
          <TabsContent value="restaurant">
            <CleaningTab 
                zones={restaurantZones}
                frequencies={frequencies}
                handleFrequencyChange={handleFrequencyChange}
                activeFilter={activeFilter}
                setActiveFilter={setActiveFilter}
                title="Restaurant"
                isReadOnly={isReadOnly}
            />
          </TabsContent>
        </Tabs>
    </div>
  );
};

export default CleaningPage;