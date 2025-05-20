
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
import { FileCog, ImagePlus, Palette, Settings2, Save, Type, MessageSquare, ArrowRightLeft, TextCursorInput, Eye, FileTextIcon, AlignHorizontalSpaceAround, Maximize, Minus } from 'lucide-react';
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
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_FAMILY,
  DEFAULT_HEADER_FONT_SIZE,
  DEFAULT_FOOTER_FONT_SIZE,
  DEFAULT_TABLE_HEADER_FONT_SIZE,
  DEFAULT_TABLE_BODY_FONT_SIZE,
  DEFAULT_ORIENTATION,
  DEFAULT_PAGE_SIZE,
} from '@/lib/pdf-settings';
import { DEFAULT_APP_PRIMARY_COLOR } from '@/config/colors';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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
  { value: 'weekly_order_sheet', label: 'Fiche de Commande Hebdomadaire' },
  { value: 'pms_kitchen_cleaning_monthly', label: 'PMS - Nettoyage Cuisine (Mensuel)' },
  { value: 'pms_restaurant_cleaning_monthly', label: 'PMS - Nettoyage Restaurant (Mensuel)' },
  { value: 'pms_temperature_monitoring_monthly', label: 'PMS - Suivi Températures (Mensuel)' },
  { value: 'pms_reception_monitoring', label: 'PMS - Suivi Réception Marchandises' },
  { value: 'pms_temp_change_monitoring', label: 'PMS - Suivi Baisse/Remise Température' },
  { value: 'pms_defrosting_monitoring', label: 'PMS - Suivi Décongélation' },
  { value: 'pms_cooldown_monitoring', label: 'PMS - Liaison Froide (Baisse Temp.)' },
  { value: 'pms_delivery_monitoring', label: 'PMS - Liaison Froide (Livraison)' },
];

const GENERAL_CONFIG_DISPLAY_LABEL = "Configuration Générale / Par Défaut";

const fontFamilies: { value: NonNullable<PdfLayoutSettings['fontFamily']>, label: string }[] = [
    { value: 'helvetica', label: 'Helvetica (sans-serif)' },
    { value: 'times', label: 'Times New Roman (serif)' },
    { value: 'courier', label: 'Courier (monospace)' },
    { value: 'arial', label: 'Arial (sans-serif)'},
    { value: 'verdana', label: 'Verdana (sans-serif)'},
];

const pageOrientations: { value: NonNullable<PdfLayoutSettings['orientation']>, label: string }[] = [
    { value: 'portrait', label: 'Portrait' },
    { value: 'landscape', label: 'Paysage' },
];

const pageSizes: { value: NonNullable<PdfLayoutSettings['pageSize']>, label: string }[] = [
    { value: 'a3', label: 'A3' },
    { value: 'a4', label: 'A4' },
    { value: 'a5', label: 'A5' },
    { value: 'letter', label: 'Lettre US' },
    { value: 'legal', label: 'Légal US' },
];


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

  const [fontFamilyInput, setFontFamilyInput] = useState<NonNullable<PdfLayoutSettings['fontFamily']>>(DEFAULT_FONT_FAMILY);
  const [headerFontSizeInput, setHeaderFontSizeInput] = useState<string>(String(DEFAULT_HEADER_FONT_SIZE));
  const [footerFontSizeInput, setFooterFontSizeInput] = useState<string>(String(DEFAULT_FOOTER_FONT_SIZE));
  const [tableHeaderFontSizeInput, setTableHeaderFontSizeInput] = useState<string>(String(DEFAULT_TABLE_HEADER_FONT_SIZE));
  const [tableBodyFontSizeInput, setTableBodyFontSizeInput] = useState<string>(String(DEFAULT_TABLE_BODY_FONT_SIZE));
  const [orientationInput, setOrientationInput] = useState<NonNullable<PdfLayoutSettings['orientation']>>(DEFAULT_ORIENTATION);
  const [pageSizeInput, setPageSizeInput] = useState<NonNullable<PdfLayoutSettings['pageSize']>>(DEFAULT_PAGE_SIZE);

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
            fontFamily: DEFAULT_FONT_FAMILY,
            headerFontSize: DEFAULT_HEADER_FONT_SIZE,
            footerFontSize: DEFAULT_FOOTER_FONT_SIZE,
            tableHeaderFontSize: DEFAULT_TABLE_HEADER_FONT_SIZE,
            tableBodyFontSize: DEFAULT_TABLE_BODY_FONT_SIZE,
            orientation: DEFAULT_ORIENTATION,
            pageSize: DEFAULT_PAGE_SIZE,
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
    
    setFontFamilyInput(specificSettings.fontFamily ?? effectiveSettings.fontFamily);
    setHeaderFontSizeInput(String(specificSettings.headerFontSize ?? effectiveSettings.headerFontSize));
    setFooterFontSizeInput(String(specificSettings.footerFontSize ?? effectiveSettings.footerFontSize));
    setTableHeaderFontSizeInput(String(specificSettings.tableHeaderFontSize ?? effectiveSettings.tableHeaderFontSize));
    setTableBodyFontSizeInput(String(specificSettings.tableBodyFontSize ?? effectiveSettings.tableBodyFontSize));
    setOrientationInput(specificSettings.orientation ?? effectiveSettings.orientation);
    setPageSizeInput(specificSettings.pageSize ?? effectiveSettings.pageSize);

  }, [selectedPdfType, pdfConfigs]);

  const selectedPdfLabel = useMemo(() => {
    if (selectedPdfType === GENERAL_CONFIG_KEY) {
      return GENERAL_CONFIG_DISPLAY_LABEL;
    }
    const foundPdf = pdfTypes.find(pt => pt.value === selectedPdfType);
    return foundPdf ? foundPdf.label : GENERAL_CONFIG_DISPLAY_LABEL;
  }, [selectedPdfType]);

  const saveConfig = useCallback((updates: Partial<PdfLayoutSettings>, successMessagePrefix: string) => {
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
            case 'fontFamily': defaultValue = DEFAULT_FONT_FAMILY; break;
            case 'headerFontSize': defaultValue = DEFAULT_HEADER_FONT_SIZE; break;
            case 'footerFontSize': defaultValue = DEFAULT_FOOTER_FONT_SIZE; break;
            case 'tableHeaderFontSize': defaultValue = DEFAULT_TABLE_HEADER_FONT_SIZE; break;
            case 'tableBodyFontSize': defaultValue = DEFAULT_TABLE_BODY_FONT_SIZE; break;
            case 'orientation': defaultValue = DEFAULT_ORIENTATION; break;
            case 'pageSize': defaultValue = DEFAULT_PAGE_SIZE; break;
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
      description: `${successMessagePrefix} pour "${selectedPdfLabel}" a été enregistrée.`,
    });
  }, [selectedPdfType, pdfConfigs, toast, selectedPdfLabel]);

  const handleSaveLogoUrl = () => saveConfig({ logoUrl: logoUrlInput || undefined }, "L'URL du logo");
  const handleSaveHeaderText = () => saveConfig({ headerText: headerTextInput || undefined }, "Le texte d'en-tête");
  const handleSaveFooterText = () => saveConfig({ footerText: footerTextInput || undefined }, "Le texte de pied de page");

  const handleSaveLayoutAndFontStyles = () => {
    const updates: Partial<PdfLayoutSettings> = {
      primaryColor: primaryColorInput,
      marginTop: parseFloat(marginTopInput) || undefined,
      marginRight: parseFloat(marginRightInput) || undefined,
      marginBottom: parseFloat(marginBottomInput) || undefined,
      marginLeft: parseFloat(marginLeftInput) || undefined,
      defaultFontSize: parseFloat(defaultFontSizeInput) || undefined,
      fontFamily: fontFamilyInput || undefined,
      headerFontSize: parseFloat(headerFontSizeInput) || undefined,
      footerFontSize: parseFloat(footerFontSizeInput) || undefined,
      tableHeaderFontSize: parseFloat(tableHeaderFontSizeInput) || undefined,
      tableBodyFontSize: parseFloat(tableBodyFontSizeInput) || undefined,
      orientation: orientationInput || undefined,
      pageSize: pageSizeInput || undefined,
    };
    saveConfig(updates, "Les styles de mise en page et de police");
  };

  const currentEffectiveSettings = useMemo(() => fetchPdfSettings(selectedPdfType), [selectedPdfType, pdfConfigs]);

  const renderPreviewHeaderText = () => {
    if (!currentEffectiveSettings.headerText) return <div className="h-4">&nbsp;</div>; // Placeholder for height
  
    const lines = currentEffectiveSettings.headerText.split('\n');
    return (
      <div style={{ fontSize: `${Math.max(5, (currentEffectiveSettings.headerFontSize || DEFAULT_HEADER_FONT_SIZE) / 2)}pt` }}>
        {lines.map((line, lineIndex) => {
          const cells = line.split('|');
          return (
            <div key={lineIndex} className="flex">
              {cells.map((cell, cellIndex) => {
                const cellContent = cell.trim();
                if (cellContent === '{logo}' && currentEffectiveSettings.logoUrl) {
                  return (
                    <div key={cellIndex} className="p-0.5 border border-neutral-400 dark:border-neutral-500 flex-1 flex items-center justify-center">
                      <div className="w-8 h-5 bg-neutral-300 dark:bg-neutral-600 rounded-sm text-[0.4rem] flex items-center justify-center text-neutral-500 dark:text-neutral-400">LOGO</div>
                    </div>
                  );
                }
                return (
                  <div key={cellIndex} className="p-0.5 border border-neutral-400 dark:border-neutral-500 flex-1 whitespace-pre-wrap text-xs">
                    {cellContent || <>&nbsp;</>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };
  
  const getFontFamilyCss = (fontFamilyValue?: string) => {
    switch(fontFamilyValue) {
      case 'times': return 'Times New Roman, Times, serif';
      case 'courier': return 'Courier New, Courier, monospace';
      case 'arial': return 'Arial, sans-serif';
      case 'verdana': return 'Verdana, sans-serif';
      case 'helvetica':
      default:
        return 'Helvetica, Arial, sans-serif';
    }
  };

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
                        unoptimized
                    />
                  </div>
                )}
                 {!currentEffectiveSettings.logoUrl && <p className="text-xs text-muted-foreground mt-2">Aucun logo configuré. Saisissez une URL pour en ajouter un.</p>}
              </div>
            </div>

            <div className="p-6 border rounded-lg shadow-sm bg-card/50 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <FileTextIcon className="w-6 h-6 text-accent" />
                <h3 className="text-lg font-semibold text-foreground">Format et Police</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="orientation-select">Orientation de Page</Label>
                  <Select value={orientationInput} onValueChange={(val) => setOrientationInput(val as NonNullable<PdfLayoutSettings['orientation']>)}>
                    <SelectTrigger id="orientation-select"><SelectValue /></SelectTrigger>
                    <SelectContent>{pageOrientations.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                   <p className="text-xs text-muted-foreground mt-1">Effective: {currentEffectiveSettings.orientation === 'landscape' ? 'Paysage' : 'Portrait'}</p>
                </div>
                <div>
                  <Label htmlFor="page-size-select">Format de Page</Label>
                  <Select value={pageSizeInput} onValueChange={(val) => setPageSizeInput(val as NonNullable<PdfLayoutSettings['pageSize']>)}>
                    <SelectTrigger id="page-size-select"><SelectValue /></SelectTrigger>
                    <SelectContent>{pageSizes.map(ps => <SelectItem key={ps.value} value={ps.value}>{ps.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Effectif: {currentEffectiveSettings.pageSize.toUpperCase()}</p>
                </div>
                <div>
                  <Label htmlFor="font-family-select">Police de Caractères</Label>
                  <Select value={fontFamilyInput} onValueChange={(val) => setFontFamilyInput(val as NonNullable<PdfLayoutSettings['fontFamily']>)}>
                    <SelectTrigger id="font-family-select"><SelectValue /></SelectTrigger>
                    <SelectContent>{fontFamilies.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                  </Select>
                   <p className="text-xs text-muted-foreground mt-1">Effective: {fontFamilies.find(f => f.value === currentEffectiveSettings.fontFamily)?.label || currentEffectiveSettings.fontFamily}</p>
                </div>
                <Label className="flex items-center gap-1"><TextCursorInput className="w-4 h-4"/> Tailles de Police (pt)</Label>
                <div className="grid grid-cols-2 gap-3">
                    <div><Label htmlFor="default-font-size-input" className="text-xs">Défaut</Label><Input id="default-font-size-input" type="number" value={defaultFontSizeInput} onChange={e => setDefaultFontSizeInput(e.target.value)} className="h-8"/></div>
                    <div><Label htmlFor="header-font-size-input" className="text-xs">En-tête Doc.</Label><Input id="header-font-size-input" type="number" value={headerFontSizeInput} onChange={e => setHeaderFontSizeInput(e.target.value)} className="h-8"/></div>
                    <div><Label htmlFor="footer-font-size-input" className="text-xs">Pied de Page</Label><Input id="footer-font-size-input" type="number" value={footerFontSizeInput} onChange={e => setFooterFontSizeInput(e.target.value)} className="h-8"/></div>
                    <div><Label htmlFor="table-header-font-size-input" className="text-xs">En-tête Tableau</Label><Input id="table-header-font-size-input" type="number" value={tableHeaderFontSizeInput} onChange={e => setTableHeaderFontSizeInput(e.target.value)} className="h-8"/></div>
                    <div><Label htmlFor="table-body-font-size-input" className="text-xs">Corps Tableau</Label><Input id="table-body-font-size-input" type="number" value={tableBodyFontSizeInput} onChange={e => setTableBodyFontSizeInput(e.target.value)} className="h-8"/></div>
                </div>
                 <p className="text-xs text-muted-foreground mt-1">
                    Effectives: Défaut {currentEffectiveSettings.defaultFontSize}pt, En-tête Doc {currentEffectiveSettings.headerFontSize}pt, Pied {currentEffectiveSettings.footerFontSize}pt, En-tête Tab. {currentEffectiveSettings.tableHeaderFontSize}pt, Corps Tab. {currentEffectiveSettings.tableBodyFontSize}pt
                </p>
              </div>
            </div>
          </div>
          
           <div className="p-6 border rounded-lg shadow-sm bg-card/50 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <Palette className="w-6 h-6 text-accent" />
                <h3 className="text-lg font-semibold text-foreground">Couleurs & Marges</h3>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
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
                <div>
                  <Label className="flex items-center gap-1"><ArrowRightLeft className="w-4 h-4"/> Marges (en points PDF, 1pt ≈ 0.35mm)</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label htmlFor="margin-top-input" className="text-xs">Haut</Label><Input id="margin-top-input" type="number" value={marginTopInput} onChange={e => setMarginTopInput(e.target.value)} placeholder={String(DEFAULT_MARGIN)} className="h-8"/></div>
                    <div><Label htmlFor="margin-bottom-input" className="text-xs">Bas</Label><Input id="margin-bottom-input" type="number" value={marginBottomInput} onChange={e => setMarginBottomInput(e.target.value)} placeholder={String(DEFAULT_MARGIN)} className="h-8"/></div>
                    <div><Label htmlFor="margin-left-input" className="text-xs">Gauche</Label><Input id="margin-left-input" type="number" value={marginLeftInput} onChange={e => setMarginLeftInput(e.target.value)} placeholder={String(DEFAULT_MARGIN)} className="h-8"/></div>
                    <div><Label htmlFor="margin-right-input" className="text-xs">Droite</Label><Input id="margin-right-input" type="number" value={marginRightInput} onChange={e => setMarginRightInput(e.target.value)} placeholder={String(DEFAULT_MARGIN)} className="h-8"/></div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Effectives: H:{currentEffectiveSettings.marginTop}pt, B:{currentEffectiveSettings.marginBottom}pt, G:{currentEffectiveSettings.marginLeft}pt, D:{currentEffectiveSettings.marginRight}pt</p>
                </div>
              </div>
            </div>
          
           <div className="p-6 border rounded-lg shadow-sm bg-card/50 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <FileCog className="w-6 h-6 text-accent" />
                <h3 className="text-lg font-semibold text-foreground">Contenu En-têtes et Pieds de Page</h3>
              </div>
              <div className="space-y-4">
                <div>
                    <Label htmlFor="header-text-input" className="flex items-center gap-1"><Type className="w-4 h-4"/> Texte d'En-tête</Label>
                    <Textarea 
                        id="header-text-input"
                        placeholder="Pour un en-tête tabulaire : utilisez '|' pour séparer les cellules, un saut de ligne pour une nouvelle rangée. Utilisez {logo} pour placer le logo. Ex: {logo} | Mon Titre Principal\n | Sous-titre"
                        value={headerTextInput}
                        onChange={(e) => setHeaderTextInput(e.target.value)}
                        className="mt-1"
                        rows={3}
                    />
                    {currentEffectiveSettings.headerText && <div className="text-xs text-muted-foreground mt-1">Effectif : <pre className="whitespace-pre-wrap text-xs bg-muted/50 p-1 rounded">{currentEffectiveSettings.headerText}</pre></div>}
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
            <div className="flex justify-end mt-6">
                <Button onClick={handleSaveLayoutAndFontStyles} size="lg">
                    <Save className="mr-2 h-5 w-5"/> Enregistrer Toutes les Configurations de Mise en Page & Police
                </Button>
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-accent"/>
            Aperçu de la Mise en Page PDF
          </CardTitle>
          <CardDescription>
            Visualisation basée sur les paramètres pour "{selectedPdfLabel}".
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="text-sm mb-2">
              Orientation: <span className="font-semibold">{currentEffectiveSettings.orientation === 'landscape' ? 'Paysage' : 'Portrait'}</span>, 
              Format: <span className="font-semibold">{currentEffectiveSettings.pageSize.toUpperCase()}</span>,
              Police: <span className="font-semibold" style={{fontFamily: getFontFamilyCss(currentEffectiveSettings.fontFamily)}}>{fontFamilies.find(f => f.value === currentEffectiveSettings.fontFamily)?.label || currentEffectiveSettings.fontFamily}</span>
            </div>
          <div 
            className={cn(
                "bg-white dark:bg-neutral-800 p-1 rounded-sm shadow-inner w-full mx-auto overflow-hidden border border-muted",
                currentEffectiveSettings.orientation === 'landscape' ? 'aspect-[297/210] max-w-md' : 'aspect-[210/297] max-w-sm'
            )}
            style={{ fontFamily: getFontFamilyCss(currentEffectiveSettings.fontFamily) }}
          >
            <div
              className="h-full w-full bg-neutral-50 dark:bg-neutral-700 relative flex flex-col text-neutral-700 dark:text-neutral-200"
              style={{
                paddingTop: `${Math.max(1, currentEffectiveSettings.marginTop / 7)}px`, 
                paddingBottom: `${Math.max(1, currentEffectiveSettings.marginBottom / 7)}px`,
                paddingLeft: `${Math.max(1, currentEffectiveSettings.marginLeft / 7)}px`,
                paddingRight: `${Math.max(1, currentEffectiveSettings.marginRight / 7)}px`,
                fontSize: `${Math.max(3, (currentEffectiveSettings.defaultFontSize || DEFAULT_FONT_SIZE) / 2.5)}pt`,
              }}
            >
              {/* Header Area */}
              <div className="mb-auto flex-shrink-0 leading-tight border-b border-neutral-300 dark:border-neutral-600 pb-0.5 mb-0.5 text-[0.9em]" style={{fontSize: `${Math.max(3, (currentEffectiveSettings.headerFontSize || DEFAULT_HEADER_FONT_SIZE) / 2.5)}pt`}}>
                {renderPreviewHeaderText()}
                 {!currentEffectiveSettings.headerText && !currentEffectiveSettings.logoUrl && <div className="h-3">&nbsp;</div>}
              </div>

              {/* Dummy Content Area */}
              <div className="flex-grow my-0.5 space-y-px overflow-hidden py-0.5">
                <div
                  className="h-1.5 w-full rounded-sm"
                  style={{ backgroundColor: currentEffectiveSettings.primaryColor }}
                />
                <div className="text-neutral-600 dark:text-neutral-300" style={{fontSize: `${Math.max(3, (currentEffectiveSettings.tableHeaderFontSize || DEFAULT_TABLE_HEADER_FONT_SIZE) / 2.5)}pt`}}>
                    En-tête Table 1 | En-tête Table 2 | En-tête Table 3
                </div>
                <div className="h-0.5 w-full bg-neutral-300 dark:bg-neutral-600 rounded-sm my-px" />
                <div className="text-neutral-500 dark:text-neutral-400" style={{fontSize: `${Math.max(3, (currentEffectiveSettings.tableBodyFontSize || DEFAULT_TABLE_BODY_FONT_SIZE) / 2.5)}pt`}}>
                    Ligne de contenu 1, col 1 | Col 2 | Col 3<br/>
                    Ligne de contenu 2, col 1 | Col 2 | Col 3<br/>
                    ... <br/>
                </div>
              </div>

              {/* Footer Area */}
              <div className="mt-auto flex-shrink-0">
                {currentEffectiveSettings.footerText && (
                  <div className="text-neutral-500 dark:text-neutral-400 truncate leading-tight border-t border-neutral-300 dark:border-neutral-600 pt-0.5 mt-0.5" style={{fontSize: `${Math.max(2, (currentEffectiveSettings.footerFontSize || DEFAULT_FOOTER_FONT_SIZE) / 2.5)}pt`}}>
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
            Cet aperçu est une simulation et peut ne pas refléter exactement le PDF final.
          </p>
        </CardContent>
      </Card>

      <Alert variant="default" className="border-primary/50 bg-primary/10">
        <FileCog className="h-5 w-5 text-primary" />
        <AlertTitle className="text-primary font-semibold">Note sur l'Application des Paramètres</AlertTitle>
        <AlertDescription>
          Les configurations enregistrées ici seront utilisées lors de la génération des PDFs correspondants.
          Les polices standards disponibles sont : Helvetica, Times New Roman, Courier, Arial, Verdana.
        </AlertDescription>
      </Alert>
    </div>
  );
}
    
