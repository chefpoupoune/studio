
"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileCog, ImagePlus, Palette, Settings2, Save } from 'lucide-react';
import type { PdfLayoutSettings } from '../types';
import { useToast } from '@/hooks/use-toast';

const pdfTypes = [
  { value: 'benefits', label: 'Avantages en Nature' },
  { value: 'monthly_cost', label: 'Coût de Revient Mensuel' },
  { value: 'annual_cost', label: 'Récapitulatif Annuel Coût de Revient' },
  { value: 'picnic_cost', label: 'Coût Repas Pique-Nique/Salade' },
  { value: 'occasional_meal_cost', label: 'Coût Repas Occasionnel' },
  { value: 'inventory_report', label: 'Rapport d\'Inventaire' },
  { value: 'purchase_order', label: 'Bon de Commande Produit Cuisine' },
  { value: 'time_tracking_summary', label: 'Relevé d\'Heures Individuel' },
  { value: 'menu_planning_monthly', label: 'Planification des Menus Mensuelle' },
  { value: 'temperature_sheet_monthly', label: 'Fiche de Température Mensuelle' },
];

const GENERAL_CONFIG_VALUE = "_general_pdf_config_";
const GENERAL_CONFIG_DISPLAY_LABEL = "Configuration Générale / Par Défaut";
const PDF_LAYOUT_CONFIGS_KEY = "pdf_layout_configurations";

export default function PdfLayoutManager() {
  const [selectedPdfType, setSelectedPdfType] = useState<string>(GENERAL_CONFIG_VALUE);
  const [pdfConfigs, setPdfConfigs] = useState<Record<string, Partial<PdfLayoutSettings>>>({});
  const [logoUrlInput, setLogoUrlInput] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedConfigs = localStorage.getItem(PDF_LAYOUT_CONFIGS_KEY);
      if (storedConfigs) {
        setPdfConfigs(JSON.parse(storedConfigs));
      }
    } catch (error) {
      console.error("Error loading PDF layout configs from localStorage:", error);
      toast({
        title: "Erreur de chargement",
        description: "Impossible de charger les configurations de mise en page PDF.",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    // Update logoUrlInput when selectedPdfType or pdfConfigs change
    const activeConfigKey = selectedPdfType || GENERAL_CONFIG_VALUE;
    const specificConfig = pdfConfigs[activeConfigKey];
    const generalConfig = pdfConfigs[GENERAL_CONFIG_VALUE];
    
    setLogoUrlInput(specificConfig?.logoUrl || generalConfig?.logoUrl || '');
  }, [selectedPdfType, pdfConfigs]);

  const handleSaveLogoUrl = () => {
    const activeConfigKey = selectedPdfType || GENERAL_CONFIG_VALUE;
    const newConfigs = {
      ...pdfConfigs,
      [activeConfigKey]: {
        ...(pdfConfigs[activeConfigKey] || {}),
        logoUrl: logoUrlInput,
      },
    };
    setPdfConfigs(newConfigs);
    localStorage.setItem(PDF_LAYOUT_CONFIGS_KEY, JSON.stringify(newConfigs));
    toast({
      title: "Logo Enregistré",
      description: `L'URL du logo pour "${selectedPdfLabel}" a été enregistrée.`,
    });
  };
  
  const selectedPdfLabel = useMemo(() => {
    if (selectedPdfType === GENERAL_CONFIG_VALUE) {
      return GENERAL_CONFIG_DISPLAY_LABEL;
    }
    const foundPdf = pdfTypes.find(pt => pt.value === selectedPdfType);
    return foundPdf ? foundPdf.label : GENERAL_CONFIG_DISPLAY_LABEL;
  }, [selectedPdfType]);

  const currentEffectiveLogoUrl = useMemo(() => {
    const specificConfig = pdfConfigs[selectedPdfType];
    const generalConfig = pdfConfigs[GENERAL_CONFIG_VALUE];
    return specificConfig?.logoUrl || generalConfig?.logoUrl || '';
  }, [selectedPdfType, pdfConfigs]);


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sélectionnez un type de PDF à configurer</CardTitle>
          <CardDescription>
            Choisissez le document dont vous souhaitez personnaliser la mise en page du logo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md">
            <Label htmlFor="pdf-type-select" className="mb-2 block">Type de Document PDF</Label>
            <Select value={selectedPdfType} onValueChange={setSelectedPdfType}>
              <SelectTrigger id="pdf-type-select">
                <SelectValue placeholder="Choisir un type de PDF..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GENERAL_CONFIG_VALUE}>{GENERAL_CONFIG_DISPLAY_LABEL}</SelectItem>
                {pdfTypes.map(pdf => (
                  <SelectItem key={pdf.value} value={pdf.value}>{pdf.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-accent"/>
            Options de Personnalisation pour: <span className="text-primary ml-1">{selectedPdfLabel}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
           <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 border rounded-lg shadow-sm bg-card/50 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <ImagePlus className="w-6 h-6 text-accent" />
                <h3 className="text-lg font-semibold text-foreground">Gestion du Logo</h3>
              </div>
              <div className="space-y-4">
                <div>
                    <Label htmlFor="logo-url-input">URL du Logo</Label>
                    <Input 
                        id="logo-url-input"
                        type="url"
                        placeholder="https://example.com/logo.png"
                        value={logoUrlInput}
                        onChange={(e) => setLogoUrlInput(e.target.value)}
                        className="mt-1"
                    />
                </div>
                <Button onClick={handleSaveLogoUrl}>
                    <Save className="mr-2 h-4 w-4"/> Enregistrer Logo
                </Button>
                {currentEffectiveLogoUrl && (
                  <div className="mt-4 p-2 border rounded-md inline-block bg-muted">
                    <p className="text-xs text-muted-foreground mb-1">Aperçu du logo actuel :</p>
                    <Image 
                        src={currentEffectiveLogoUrl} 
                        alt="Aperçu du logo" 
                        width={150} 
                        height={75} 
                        className="object-contain rounded"
                        data-ai-hint="logo company"
                        onError={(e) => {
                            // Small hack to hide broken image icon if URL is invalid / image fails to load
                            (e.target as HTMLImageElement).style.display = 'none';
                             toast({
                                title: "Erreur de chargement du logo",
                                description: "Impossible d'afficher l'aperçu. Vérifiez l'URL.",
                                variant: "destructive"
                            });
                        }}
                        onLoad={(e) => {
                             (e.target as HTMLImageElement).style.display = 'block';
                        }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border rounded-lg shadow-sm bg-card/50 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <Palette className="w-6 h-6 text-accent" />
                <h3 className="text-lg font-semibold text-foreground">Mise en Page et Styles</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Ajustez les marges, polices et couleurs spécifiques à ce document. (Bientôt disponible)
              </p>
               <Button variant="outline" disabled>Modifier Styles</Button>
            </div>
          </div>
           <div className="p-6 border rounded-lg shadow-sm bg-card/50 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <FileCog className="w-6 h-6 text-accent" />
                <h3 className="text-lg font-semibold text-foreground">En-têtes et Pieds de Page</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Personnalisez le contenu des en-têtes et pieds de page pour ce document. (Bientôt disponible)
              </p>
              <Button variant="outline" disabled>Configurer En-têtes/Pieds de Page</Button>
            </div>
        </CardContent>
      </Card>

      <Alert variant="default" className="border-primary/50 bg-primary/10">
        <FileCog className="h-5 w-5 text-primary" />
        <AlertTitle className="text-primary font-semibold">Autres fonctionnalités en développement</AlertTitle>
        <AlertDescription>
          La personnalisation des styles, en-têtes et pieds de page est prévue pour une future version. Seule la gestion de l'URL du logo est actuellement fonctionnelle.
        </AlertDescription>
      </Alert>
    </div>
  );
}
