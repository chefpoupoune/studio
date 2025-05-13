
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
import { FileCog, ImagePlus, Palette, Settings2, Save, Type, MessageSquare, ArrowRightLeft, TextCursorInput, Eye } from 'lucide-react';
import type { PdfLayoutSettings } from '../types';
import { useToast } from '@/hooks/use-toast';
import { 
  PDF_LAYOUT_CONFIGS_KEY, 
  GENERAL_CONFIG_KEY, 
  getPdfLayoutSettings as fetchPdfSettings,
  DEFAULT_LOGO_URL,
  DEFAULT_HEADER_TEXT,
  DEFAULT_FOOTER_TEXT,
  DEFAULT_MARGIN,
  DEFAULT_FONT_SIZE
} from '@/lib/pdf-settings';
import { DEFAULT_APP_PRIMARY_COLOR } from '@/config/colors';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

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
  const [primaryColorInput, setPrimaryColorInput] = useState<string>(DEFAULT_APP_PRIMARY_COLOR);
  const [headerTextInput, setHeaderTextInput] = useState<string>('');
  const [footerTextInput, setFooterTextInput] = useState<string>('');
  const [marginTopInput, setMarginTopInput] = useState<string>(String(DEFAULT_MARGIN));
  const [marginRightInput, setMarginRightInput] = useState<string>(String(DEFAULT_MARGIN));
  const [marginBottomInput, setMarginBottomInput] = useState<string>(String(DEFAULT_MARGIN));
  const [marginLeftInput, setMarginLeftInput] = useState<string>(String(DEFAULT_MARGIN));
  const [defaultFontSizeInput, setDefaultFontSizeInput] = useState<string>(String(DEFAULT_FONT_SIZE));


  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedConfigs = localStorage.getItem(PDF_LAYOUT_CONFIGS_KEY);
      if (storedConfigs) {
        setPdfConfigs(JSON.parse(storedConfigs));
      } else {
        setPdfConfigs({ [GENERAL_CONFIG_KEY]: { 
            primaryColor: DEFAULT_APP_PRIMARY_COLOR, 
            footerText: DEFAULT_FOOTER_TEXT,
            marginTop: DEFAULT_MARGIN,
            marginRight: DEFAULT_MARGIN,
            marginBottom: DEFAULT_MARGIN,
            marginLeft: DEFAULT_MARGIN,
            defaultFontSize: DEFAULT_FONT_SIZE,
            logoUrl: DEFAULT_LOGO_URL,
            headerText: DEFAULT_HEADER_TEXT,
        } }); 
      }
    } catch (error) {
      console.error("Error loading PDF layout configs from localStorage:", error);
      toast({
        title: "Erreur de chargement",
        description: "Impossible de charger les configurations de mise en page PDF.",
        variant: "destructive",
      });
      setPdfConfigs({ [GENERAL_CONFIG_KEY]: { 
            primaryColor: DEFAULT_APP_PRIMARY_COLOR, 
            footerText: DEFAULT_FOOTER_TEXT,
            marginTop: DEFAULT_MARGIN,
            marginRight: DEFAULT_MARGIN,
            marginBottom: DEFAULT_MARGIN,
            marginLeft: DEFAULT_MARGIN,
            defaultFontSize: DEFAULT_FONT_SIZE,
            logoUrl: DEFAULT_LOGO_URL,
            headerText: DEFAULT_HEADER_TEXT,
      } });
    }
  }, [toast]);

  useEffect(() => {
    const activeConfigKey = selectedPdfType || GENERAL_CONFIG_KEY;
    const specificSettings = pdfConfigs[activeConfigKey] || {};
    const effectiveSettings = fetchPdfSettings(activeConfigKey); 
    
    setLogoUrlInput(specificSettings.logoUrl ?? effectiveSettings.logoUrl);
    setPrimaryColorInput(specificSettings.primaryColor ?? effectiveSettings.primaryColor);
    setHeaderTextInput(specificSettings.headerText ?? effectiveSettings.headerText);
    setFooterTextInput(specificSettings.footerText ?? effectiveSettings.footerText);
    setMarginTopInput(String(specificSettings.marginTop ?? effectiveSettings.marginTop));
    setMarginRightInput(String(specificSettings.marginRight ?? effectiveSettings.marginRight));
    setMarginBottomInput(String(specificSettings.marginBottom ?? effectiveSettings.marginBottom));
    setMarginLeftInput(String(specificSettings.marginLeft ?? effectiveSettings.marginLeft));
    setDefaultFontSizeInput(String(specificSettings.defaultFontSize ?? effectiveSettings.defaultFontSize));

  }, [selectedPdfType, pdfConfigs]);

  const selectedPdfLabel = useMemo(() => {
    if (selectedPdfType === GENERAL_CONFIG_KEY) {
      return GENERAL_CONFIG_DISPLAY_LABEL;
    }
    const foundPdf = pdfTypes.find(pt => pt.value === selectedPdfType);
    return foundPdf ? foundPdf.label : GENERAL_CONFIG_DISPLAY_LABEL;
  }, [selectedPdfType]);

  const saveConfig = (updates: Partial<PdfLayoutSettings>, successMessage: string) => {
    const activeConfigKey = selectedPdfType || GENERAL_CONFIG_KEY;
    
    const newSpecificConfig: Partial<PdfLayoutSettings> = { ...(pdfConfigs[activeConfigKey] || {}) };

    (Object.keys(updates) as Array<keyof PdfLayoutSettings>).forEach(key => {
        const valueToSave = updates[key];
        let defaultValue: string | number | undefined;

        switch(key) {
            case 'logoUrl': defaultValue = DEFAULT_LOGO_URL; break;
            case 'primaryColor': defaultValue = DEFAULT_APP_PRIMARY_COLOR; break;
            case 'headerText': defaultValue = DEFAULT_HEADER_TEXT; break;
            case 'footerText': defaultValue = DEFAULT_FOOTER_TEXT; break;
            case 'marginTop': case 'marginRight': case 'marginBottom': case 'marginLeft': defaultValue = DEFAULT_MARGIN; break;
            case 'defaultFontSize': defaultValue = DEFAULT_FONT_SIZE; break;
        }
        
        if (valueToSave === undefined || (valueToSave === defaultValue && activeConfigKey !== GENERAL_CONFIG_KEY) ) {
          delete newSpecificConfig[key];
        } else {
          (newSpecificConfig as any)[key] = valueToSave;
        }
    });
    
    const updatedConfigs = { ...pdfConfigs };
    if (Object.keys(newSpecificConfig).length === 0 && activeConfigKey !== GENERAL_CONFIG_KEY) {
        delete updatedConfigs[activeConfigKey]; 
    } else {
        updatedConfigs[activeConfigKey] = newSpecificConfig;
    }
    
    setPdfConfigs(updatedConfigs);
    localStorage.setItem(PDF_LAYOUT_CONFIGS_KEY, JSON.stringify(updatedConfigs));
    toast({
      title: "Configuration Enregistrée",
      description: `${successMessage} pour "${selectedPdfLabel}" a été enregistrée.`,
    });
  };

  const handleSaveLogoUrl = () => saveConfig({ logoUrl: logoUrlInput || undefined }, "L'URL du logo");
  const handleSaveHeaderText = () => saveConfig({ headerText: headerTextInput || undefined }, "Le texte d'en-tête");
  const handleSaveFooterText = () => saveConfig({ footerText: footerTextInput || undefined }, "Le texte de pied de page");

  const handleSaveLayoutStyles = () => {
    const updates: Partial<PdfLayoutSettings> = {
      primaryColor: primaryColorInput,
      marginTop: parseFloat(marginTopInput) || undefined,
      marginRight: parseFloat(marginRightInput) || undefined,
      marginBottom: parseFloat(marginBottomInput) || undefined,
      marginLeft: parseFloat(marginLeftInput) || undefined,
      defaultFontSize: parseFloat(defaultFontSizeInput) || undefined,
    };
    saveConfig(updates, "Les styles de mise en page");
  };

  const currentEffectiveSettings = useMemo(() => fetchPdfSettings(selectedPdfType), [selectedPdfType, pdfConfigs]);


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
            Modifiez les paramètres ci-dessous pour le type de PDF sélectionné. Les paramètres non définis spécifiquement pour ce type de PDF utiliseront la configuration générale (ou les valeurs par défaut de l'application).
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
                {currentEffectiveSettings.logoUrl && (
                  <div className="mt-4 p-2 border rounded-md inline-block bg-muted">
                    <p className="text-xs text-muted-foreground mb-1">Aperçu du logo actuel (si URL valide):</p>
                    <Image 
                        src={currentEffectiveSettings.logoUrl} 
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
                 {!currentEffectiveSettings.logoUrl && <p className="text-xs text-muted-foreground mt-2">Aucun logo configuré. Saisissez une URL pour en ajouter un.</p>}
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
                     <div className="flex items-center gap-2 mt-1">
                        <input 
                            id="primary-color-input"
                            type="color"
                            value={primaryColorInput}
                            onChange={(e) => setPrimaryColorInput(e.target.value)}
                            className="h-8 w-10 rounded border-input bg-background p-0.5 cursor-pointer"
                        />
                        <Input
                            type="text"
                            value={primaryColorInput}
                            onChange={(e) => setPrimaryColorInput(e.target.value)}
                            placeholder="#FFBF00"
                            className="w-32 h-8"
                        />
                    </div>
                     <p className="text-xs text-muted-foreground mt-1">Effective: <span style={{backgroundColor: currentEffectiveSettings.primaryColor, padding: '2px 6px', borderRadius: '3px', color: '#fff', textShadow: '0 0 2px #000' }}>{currentEffectiveSettings.primaryColor}</span></p>
                </div>
                <Label className="flex items-center gap-1"><ArrowRightLeft className="w-4 h-4"/> Marges (en points PDF, 1pt ≈ 0.35mm)</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label htmlFor="margin-top-input" className="text-xs">Haut</Label><Input id="margin-top-input" type="number" value={marginTopInput} onChange={e => setMarginTopInput(e.target.value)} placeholder={String(DEFAULT_MARGIN)} className="h-8"/></div>
                  <div><Label htmlFor="margin-bottom-input" className="text-xs">Bas</Label><Input id="margin-bottom-input" type="number" value={marginBottomInput} onChange={e => setMarginBottomInput(e.target.value)} placeholder={String(DEFAULT_MARGIN)} className="h-8"/></div>
                  <div><Label htmlFor="margin-left-input" className="text-xs">Gauche</Label><Input id="margin-left-input" type="number" value={marginLeftInput} onChange={e => setMarginLeftInput(e.target.value)} placeholder={String(DEFAULT_MARGIN)} className="h-8"/></div>
                  <div><Label htmlFor="margin-right-input" className="text-xs">Droite</Label><Input id="margin-right-input" type="number" value={marginRightInput} onChange={e => setMarginRightInput(e.target.value)} placeholder={String(DEFAULT_MARGIN)} className="h-8"/></div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Effectives: H:{currentEffectiveSettings.marginTop}pt, B:{currentEffectiveSettings.marginBottom}pt, G:{currentEffectiveSettings.marginLeft}pt, D:{currentEffectiveSettings.marginRight}pt</p>
                
                <div>
                    <Label htmlFor="default-font-size-input" className="flex items-center gap-1"><TextCursorInput className="w-4 h-4"/> Taille de Police par Défaut (pt)</Label>
                    <Input id="default-font-size-input" type="number" value={defaultFontSizeInput} onChange={e => setDefaultFontSizeInput(e.target.value)} placeholder={String(DEFAULT_FONT_SIZE)} className="h-8 mt-1"/>
                    <p className="text-xs text-muted-foreground mt-1">Effective: {currentEffectiveSettings.defaultFontSize}pt</p>
                </div>

                 <Button onClick={handleSaveLayoutStyles}>
                    <Save className="mr-2 h-4 w-4"/> Enregistrer Styles de Mise en Page
                </Button>
              </div>
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
                        placeholder="Ex: Confidentiel - Mon Entreprise"
                        value={headerTextInput}
                        onChange={(e) => setHeaderTextInput(e.target.value)}
                        className="mt-1"
                        rows={2}
                    />
                    {currentEffectiveSettings.headerText && <p className="text-xs text-muted-foreground mt-1">Effectif : {currentEffectiveSettings.headerText}</p>}
                     {!currentEffectiveSettings.headerText && <p className="text-xs text-muted-foreground mt-1">Aucun texte d'en-tête défini.</p>}
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
                    {currentEffectiveSettings.footerText && <p className="text-xs text-muted-foreground mt-1">Effectif : {currentEffectiveSettings.footerText}</p>}
                </div>
                 <Button onClick={handleSaveFooterText}>
                    <Save className="mr-2 h-4 w-4"/> Enregistrer Pied de Page
                </Button>
              </div>
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-accent"/>
            Aperçu de la Mise en Page PDF (Simulation)
          </CardTitle>
          <CardDescription>
            Visualisation approximative basée sur les paramètres actuels pour "{selectedPdfLabel}".
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-white dark:bg-neutral-800 p-4 rounded-md shadow-inner aspect-[210/297] w-full max-w-sm mx-auto overflow-hidden border border-muted">
            <div
              className="h-full w-full bg-neutral-50 dark:bg-neutral-700 relative flex flex-col"
              style={{
                paddingTop: `${Math.max(2, currentEffectiveSettings.marginTop / 4)}px`, // Scaled margins
                paddingBottom: `${Math.max(2, currentEffectiveSettings.marginBottom / 4)}px`,
                paddingLeft: `${Math.max(2, currentEffectiveSettings.marginLeft / 4)}px`,
                paddingRight: `${Math.max(2, currentEffectiveSettings.marginRight / 4)}px`,
                fontSize: `${Math.max(6, currentEffectiveSettings.defaultFontSize / 1.8)}px`, // Scaled font
              }}
            >
              {/* Header Area */}
              <div className="mb-auto flex-shrink-0">
                {currentEffectiveSettings.logoUrl && (
                  <div className="mb-1 h-6 w-auto flex items-center">
                    <Image
                      src={currentEffectiveSettings.logoUrl}
                      alt="Aperçu Logo"
                      width={40} height={20}
                      className="object-contain max-h-full max-w-full"
                      data-ai-hint="logo company"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                      unoptimized // Useful for arbitrary URLs if not whitelisted
                    />
                  </div>
                )}
                {currentEffectiveSettings.headerText && (
                  <div className="text-[0.8em] text-neutral-600 dark:text-neutral-300 truncate leading-tight">
                    {currentEffectiveSettings.headerText.split('\n')[0]}
                  </div>
                )}
              </div>

              {/* Dummy Content Area */}
              <div className="flex-grow my-1 space-y-0.5 overflow-hidden py-1">
                <div
                  className="h-2 w-full rounded-sm"
                  style={{ backgroundColor: currentEffectiveSettings.primaryColor }}
                />
                <div className="h-1 w-11/12 bg-neutral-300 dark:bg-neutral-600 rounded-sm" />
                <div className="h-1 w-full bg-neutral-300 dark:bg-neutral-600 rounded-sm" />
                <div className="h-1 w-10/12 bg-neutral-300 dark:bg-neutral-600 rounded-sm" />
                <div className="h-1 w-full bg-neutral-300 dark:bg-neutral-600 rounded-sm" />
                <div className="h-1 w-9/12 bg-neutral-300 dark:bg-neutral-600 rounded-sm" />
              </div>

              {/* Footer Area */}
              <div className="mt-auto flex-shrink-0">
                {currentEffectiveSettings.footerText && (
                  <div className="text-[0.8em] text-neutral-500 dark:text-neutral-400 truncate leading-tight">
                    {currentEffectiveSettings.footerText
                      .replace('{date}', format(new Date(), "dd/MM/yy HH:mm", { locale: fr }))
                      .replace('{pageNumber}', '1')
                      .replace('{totalPages}', 'N')
                      .split('\n')[0]}
                  </div>
                )}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Cet aperçu est une simulation et peut ne pas refléter exactement le PDF final. Les tailles sont réduites.
          </p>
        </CardContent>
      </Card>

      <Alert variant="default" className="border-primary/50 bg-primary/10">
        <FileCog className="h-5 w-5 text-primary" />
        <AlertTitle className="text-primary font-semibold">Note sur l'Application des Paramètres</AlertTitle>
        <AlertDescription>
          Les configurations enregistrées ici (logo, couleur, marges, police, en-têtes, pieds de page) seront utilisées lors de la génération des PDFs correspondants.
        </AlertDescription>
      </Alert>
    </div>
  );
}

