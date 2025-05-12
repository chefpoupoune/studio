
"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileCog, ImagePlus, Palette, Settings2, Save, Type, MessageSquare } from 'lucide-react';
import type { PdfLayoutSettings } from '../types';
import { useToast } from '@/hooks/use-toast';
import { PDF_LAYOUT_CONFIGS_KEY, GENERAL_CONFIG_KEY } from '@/lib/pdf-settings'; // Import constants

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
  { value: 'weekly_order_sheet', label: 'Fiche de Commande Hebdomadaire' }
];

const GENERAL_CONFIG_DISPLAY_LABEL = "Configuration Générale / Par Défaut";


export default function PdfLayoutManager() {
  const [selectedPdfType, setSelectedPdfType] = useState<string>(GENERAL_CONFIG_KEY);
  const [pdfConfigs, setPdfConfigs] = useState<Record<string, Partial<PdfLayoutSettings>>>({});
  
  const [logoUrlInput, setLogoUrlInput] = useState<string>('');
  const [primaryColorInput, setPrimaryColorInput] = useState<string>('');
  const [headerTextInput, setHeaderTextInput] = useState<string>('');
  const [footerTextInput, setFooterTextInput] = useState<string>('');

  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedConfigs = localStorage.getItem(PDF_LAYOUT_CONFIGS_KEY);
      if (storedConfigs) {
        setPdfConfigs(JSON.parse(storedConfigs));
      } else {
        // Initialize with a default general config if nothing is stored
        setPdfConfigs({ [GENERAL_CONFIG_KEY]: { primaryColor: '#16A085', footerText: 'Généré le {date} - Page {pageNumber}/{totalPages}' } }); 
      }
    } catch (error) {
      console.error("Error loading PDF layout configs from localStorage:", error);
      toast({
        title: "Erreur de chargement",
        description: "Impossible de charger les configurations de mise en page PDF.",
        variant: "destructive",
      });
      setPdfConfigs({ [GENERAL_CONFIG_KEY]: { primaryColor: '#16A085', footerText: 'Généré le {date} - Page {pageNumber}/{totalPages}' } });
    }
  }, [toast]);

  useEffect(() => {
    const activeConfigKey = selectedPdfType || GENERAL_CONFIG_KEY;
    const specificConfig = pdfConfigs[activeConfigKey];
    const generalConfig = pdfConfigs[GENERAL_CONFIG_KEY] || {};
    
    setLogoUrlInput(specificConfig?.logoUrl || generalConfig?.logoUrl || '');
    setPrimaryColorInput(specificConfig?.primaryColor || generalConfig?.primaryColor || '#16A085');
    setHeaderTextInput(specificConfig?.headerText || generalConfig?.headerText || '');
    setFooterTextInput(specificConfig?.footerText || generalConfig?.footerText || `Généré le {date} - Page {pageNumber}/{totalPages}`);
  }, [selectedPdfType, pdfConfigs]);

  const selectedPdfLabel = useMemo(() => {
    if (selectedPdfType === GENERAL_CONFIG_KEY) {
      return GENERAL_CONFIG_DISPLAY_LABEL;
    }
    const foundPdf = pdfTypes.find(pt => pt.value === selectedPdfType);
    return foundPdf ? foundPdf.label : GENERAL_CONFIG_DISPLAY_LABEL;
  }, [selectedPdfType]);

  const saveConfigValue = (key: keyof PdfLayoutSettings, value: string | undefined, successMessage: string) => {
    const activeConfigKey = selectedPdfType || GENERAL_CONFIG_KEY;
    const newConfigs = {
      ...pdfConfigs,
      [activeConfigKey]: {
        ...(pdfConfigs[activeConfigKey] || {}),
        [key]: value,
      },
    };
    setPdfConfigs(newConfigs);
    localStorage.setItem(PDF_LAYOUT_CONFIGS_KEY, JSON.stringify(newConfigs));
    toast({
      title: "Configuration Enregistrée",
      description: `${successMessage} pour "${selectedPdfLabel}" a été enregistrée.`,
    });
  };

  const handleSaveLogoUrl = () => saveConfigValue('logoUrl', logoUrlInput, "L'URL du logo");
  const handleSavePrimaryColor = () => saveConfigValue('primaryColor', primaryColorInput, "La couleur primaire");
  const handleSaveHeaderText = () => saveConfigValue('headerText', headerTextInput, "Le texte d'en-tête");
  const handleSaveFooterText = () => saveConfigValue('footerText', footerTextInput, "Le texte de pied de page");

  const currentEffectiveLogoUrl = useMemo(() => pdfConfigs[selectedPdfType]?.logoUrl || pdfConfigs[GENERAL_CONFIG_KEY]?.logoUrl || '', [selectedPdfType, pdfConfigs]);
  const currentEffectivePrimaryColor = useMemo(() => pdfConfigs[selectedPdfType]?.primaryColor || pdfConfigs[GENERAL_CONFIG_KEY]?.primaryColor || '#16A085', [selectedPdfType, pdfConfigs]);
  const currentEffectiveHeaderText = useMemo(() => pdfConfigs[selectedPdfType]?.headerText || pdfConfigs[GENERAL_CONFIG_KEY]?.headerText || '', [selectedPdfType, pdfConfigs]);
  const currentEffectiveFooterText = useMemo(() => pdfConfigs[selectedPdfType]?.footerText || pdfConfigs[GENERAL_CONFIG_KEY]?.footerText || `Généré le {date} - Page {pageNumber}/{totalPages}`, [selectedPdfType, pdfConfigs]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sélectionnez un type de PDF à configurer</CardTitle>
          <CardDescription>
            Choisissez le document dont vous souhaitez personnaliser la mise en page. Les configurations spécifiques priment sur la configuration générale.
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
                <SelectItem value={GENERAL_CONFIG_KEY}>{GENERAL_CONFIG_DISPLAY_LABEL}</SelectItem>
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
          <CardDescription>
            Modifiez les paramètres ci-dessous pour le type de PDF sélectionné. Les paramètres non définis spécifiquement pour ce type de PDF utiliseront la configuration générale.
          </CardDescription>
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
              <div className="space-y-4">
                <div>
                    <Label htmlFor="primary-color-input">Couleur Primaire (Hex)</Label>
                    <Input 
                        id="primary-color-input"
                        type="text" // Can also be type="color", but text allows pasting hex codes
                        placeholder="#16A085"
                        value={primaryColorInput}
                        onChange={(e) => setPrimaryColorInput(e.target.value)}
                        className="mt-1"
                    />
                    {currentEffectivePrimaryColor && (
                         <div className="mt-2 flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Couleur actuelle:</span>
                            <div style={{ backgroundColor: currentEffectivePrimaryColor }} className="w-5 h-5 rounded border border-border"></div>
                            <span className="text-xs font-mono">{currentEffectivePrimaryColor}</span>
                        </div>
                    )}
                </div>
                 <Button onClick={handleSavePrimaryColor}>
                    <Save className="mr-2 h-4 w-4"/> Enregistrer Couleur Primaire
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                D'autres options (marges, polices) bientôt disponibles.
              </p>
            </div>
          </div>
           <div className="p-6 border rounded-lg shadow-sm bg-card/50 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <FileCog className="w-6 h-6 text-accent" />
                <h3 className="text-lg font-semibold text-foreground">En-têtes et Pieds de Page</h3>
              </div>
              <div className="space-y-4">
                <div>
                    <Label htmlFor="header-text-input" className="flex items-center gap-1"><Type className="w-4 h-4"/> Texte d'En-tête</Label>
                    <Textarea 
                        id="header-text-input"
                        placeholder="Ex: Confidentiel - [Nom de l'Entreprise]"
                        value={headerTextInput}
                        onChange={(e) => setHeaderTextInput(e.target.value)}
                        className="mt-1"
                        rows={2}
                    />
                    {currentEffectiveHeaderText && <p className="text-xs text-muted-foreground mt-1">Actuel : {currentEffectiveHeaderText}</p>}
                </div>
                <Button onClick={handleSaveHeaderText}>
                    <Save className="mr-2 h-4 w-4"/> Enregistrer En-tête
                </Button>
                 <div>
                    <Label htmlFor="footer-text-input" className="flex items-center gap-1"><MessageSquare className="w-4 h-4"/> Texte de Pied de Page</Label>
                    <Textarea 
                        id="footer-text-input"
                        placeholder="Ex: Généré le {date} - Page {pageNumber}/{totalPages}"
                        value={footerTextInput}
                        onChange={(e) => setFooterTextInput(e.target.value)}
                        className="mt-1"
                        rows={2}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Utilisez &#123;date&#125;, &#123;pageNumber&#125;, &#123;totalPages&#125; comme placeholders.</p>
                    {currentEffectiveFooterText && <p className="text-xs text-muted-foreground mt-1">Actuel : {currentEffectiveFooterText}</p>}
                </div>
                 <Button onClick={handleSaveFooterText}>
                    <Save className="mr-2 h-4 w-4"/> Enregistrer Pied de Page
                </Button>
              </div>
            </div>
        </CardContent>
      </Card>

      <Alert variant="default" className="border-primary/50 bg-primary/10">
        <FileCog className="h-5 w-5 text-primary" />
        <AlertTitle className="text-primary font-semibold">Note sur l'Application des Paramètres</AlertTitle>
        <AlertDescription>
          Les configurations enregistrées ici (logo, couleur, en-têtes, pieds de page) seront utilisées lors de la génération des PDFs correspondants. L'intégration de ces paramètres dans chaque module de génération PDF est une étape future.
        </AlertDescription>
      </Alert>
    </div>
  );
}

