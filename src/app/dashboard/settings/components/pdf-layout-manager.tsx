"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileCog, ImagePlus, Palette, Settings2, Save, Type, MessageSquare, ArrowRightLeft, TextCursorInput, Eye, FileTextIcon, Loader2, InfoIcon, Ruler } from 'lucide-react';
import type { PdfLayoutSettings } from '../types';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import {
  GENERAL_CONFIG_KEY,
  getPdfLayoutSettings as getEffectivePdfSettings,
  DEFAULT_LOGO_URL,
  DEFAULT_LOGO_WIDTH,
  DEFAULT_HEADER_TEXT,
  DEFAULT_FOOTER_TEXT,
  DEFAULT_MARGIN,
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_FAMILY,
  DEFAULT_DOCUMENT_BASE_TITLE,
  DEFAULT_SHOW_DOCUMENT_BASE_TITLE,
  DEFAULT_SHOW_MODULE_TITLE,
  DEFAULT_DOCUMENT_TITLE_FONT_SIZE,
  DEFAULT_HEADER_FONT_SIZE,
  DEFAULT_FOOTER_FONT_SIZE,
  DEFAULT_TABLE_HEADER_FONT_SIZE,
  DEFAULT_TABLE_BODY_FONT_SIZE,
  DEFAULT_ORIENTATION,
  DEFAULT_PAGE_SIZE,
  loadPdfLayoutSettingsFromFirestore,
  savePdfLayoutSettingsToFirestore,
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
  { value: 'picnic_recap_weekly', label: 'Récapitulatif Pique Nique (Hebdomadaire)' },
  { value: 'inventory_report', label: 'Rapport d\'Inventaire' },
  { value: 'purchase_order', label: 'Bon de Commande Produit Cuisine' },
  { value: 'time_tracking_summary', label: 'Relevé d\'Heures Individuel' },
  { value: 'menu_planning_monthly', label: 'Planification des Menus Mensuelle' },
  { value: 'temperature_sheet_monthly', label: 'Fiche de Température Mensuelle' },
  { value: 'weekly_order_sheet', label: 'Fiche de Commande Hebdomadaire' },
  { value: 'pms_kitchen_cleaning_monthly', label: 'PMS - Nettoyage Cuisine (Mensuel)' },
  { value: 'pms_restaurant_cleaning_monthly', label: 'PMS - Nettoyage Restaurant (Mensuel)' },
  { value: 'pms_fryer_oil_overall_monitoring', label: 'PMS - Suivi Huile Friture' },
  { value: 'pms_temperature_monitoring_monthly', label: 'PMS - Suivi Températures (Mensuel)' },
  { value: 'pms_reception_monitoring', label: 'PMS - Suivi Réception Marchandises' },
  { value: 'pms_temp_change_monitoring', label: 'PMS - Suivi Baisse/Remise Température' },
  { value: 'pms_defrosting_monitoring', label: 'PMS - Suivi Décongélation' },
  { value: 'pms_cooldown_monitoring', label: 'PMS - Liaison Froide (Baisse Temp.)' },
  { value: 'pms_delivery_monitoring', label: 'PMS - Liaison Froide (Livraison)' },
  { value: 'overtime_request_form', label: "Formulaire Demande Dépassement Horaire" },
  { value: 'absence_request_form', label: "Formulaire Demande d'Absence" },
  { value: 'pms_picnic_departure_form', label: "PMS - Fiche Départ Pique-Nique" },
].sort((a, b) => a.label.localeCompare(b.label));

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

const DEFAULT_SETTINGS: Required<PdfLayoutSettings> = {
  logoUrl: DEFAULT_LOGO_URL,
  logoWidth: DEFAULT_LOGO_WIDTH,
  primaryColor: DEFAULT_APP_PRIMARY_COLOR,
  headerText: DEFAULT_HEADER_TEXT,
  footerText: DEFAULT_FOOTER_TEXT,
  marginTop: DEFAULT_MARGIN,
  marginRight: DEFAULT_MARGIN,
  marginBottom: DEFAULT_MARGIN,
  marginLeft: DEFAULT_MARGIN,
  defaultFontSize: DEFAULT_FONT_SIZE,
  fontFamily: DEFAULT_FONT_FAMILY,
  documentBaseTitle: DEFAULT_DOCUMENT_BASE_TITLE,
  showDocumentBaseTitle: DEFAULT_SHOW_DOCUMENT_BASE_TITLE,
  showModuleTitle: DEFAULT_SHOW_MODULE_TITLE,
  documentTitleFontSize: DEFAULT_DOCUMENT_TITLE_FONT_SIZE,
  headerFontSize: DEFAULT_HEADER_FONT_SIZE,
  footerFontSize: DEFAULT_FOOTER_FONT_SIZE,
  tableHeaderFontSize: DEFAULT_TABLE_HEADER_FONT_SIZE,
  tableBodyFontSize: DEFAULT_TABLE_BODY_FONT_SIZE,
  orientation: DEFAULT_ORIENTATION,
  pageSize: DEFAULT_PAGE_SIZE,
};

export default function PdfLayoutManager() {
  const [selectedPdfType, setSelectedPdfType] = useState<string>(GENERAL_CONFIG_KEY);
  const [pdfConfigs, setPdfConfigs] = useState<Record<string, Partial<PdfLayoutSettings>>>({});
  
  const [logoUrlInput, setLogoUrlInput] = useState<string>(DEFAULT_SETTINGS.logoUrl);
  const [logoWidthInput, setLogoWidthInput] = useState<string>(String(DEFAULT_SETTINGS.logoWidth));
  const [uploadedLogoPreview, setUploadedLogoPreview] = useState<string | null>(null);
  const [primaryColorInput, setPrimaryColorInput] = useState<string>(DEFAULT_SETTINGS.primaryColor);
  const [headerTextInput, setHeaderTextInput] = useState<string>(DEFAULT_SETTINGS.headerText);
  const [footerTextInput, setFooterTextInput] = useState<string>(DEFAULT_SETTINGS.footerText);
  const [marginTopInput, setMarginTopInput] = useState<string>(String(DEFAULT_SETTINGS.marginTop));
  const [marginRightInput, setMarginRightInput] = useState<string>(String(DEFAULT_SETTINGS.marginRight));
  const [marginBottomInput, setMarginBottomInput] = useState<string>(String(DEFAULT_SETTINGS.marginBottom));
  const [marginLeftInput, setMarginLeftInput] = useState<string>(String(DEFAULT_SETTINGS.marginLeft));
  const [defaultFontSizeInput, setDefaultFontSizeInput] = useState<string>(String(DEFAULT_SETTINGS.defaultFontSize));
  const [fontFamilyInput, setFontFamilyInput] = useState<NonNullable<PdfLayoutSettings['fontFamily']>>(DEFAULT_SETTINGS.fontFamily);
  const [documentBaseTitleInput, setDocumentBaseTitleInput] = useState<string>(DEFAULT_SETTINGS.documentBaseTitle);
  const [showDocumentBaseTitleInput, setShowDocumentBaseTitleInput] = useState<boolean>(DEFAULT_SETTINGS.showDocumentBaseTitle);
  const [showModuleTitleInput, setShowModuleTitleInput] = useState<boolean>(DEFAULT_SETTINGS.showModuleTitle);
  const [documentTitleFontSizeInput, setDocumentTitleFontSizeInput] = useState<string>(String(DEFAULT_SETTINGS.documentTitleFontSize));
  const [headerFontSizeInput, setHeaderFontSizeInput] = useState<string>(String(DEFAULT_SETTINGS.headerFontSize));
  const [footerFontSizeInput, setFooterFontSizeInput] = useState<string>(String(DEFAULT_SETTINGS.footerFontSize));
  const [tableHeaderFontSizeInput, setTableHeaderFontSizeInput] = useState<string>(String(DEFAULT_SETTINGS.tableHeaderFontSize));
  const [tableBodyFontSizeInput, setTableBodyFontSizeInput] = useState<string>(String(DEFAULT_SETTINGS.tableBodyFontSize));
  const [orientationInput, setOrientationInput] = useState<NonNullable<PdfLayoutSettings['orientation']>>(DEFAULT_SETTINGS.orientation);
  const [pageSizeInput, setPageSizeInput] = useState<NonNullable<PdfLayoutSettings['pageSize']>>(DEFAULT_SETTINGS.pageSize);

  const { toast } = useToast();
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const [isClient, setIsClient] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    
    const loadSettings = async () => {
      setIsLoadingSettings(true);
      try {
        const configs = await loadPdfLayoutSettingsFromFirestore();
        setPdfConfigs(configs);
      } catch (error) {
        console.error("Error loading PDF layout configs from Firestore:", error);
        toast({
          title: "Erreur de chargement",
          description: "Impossible de charger les configurations depuis la base de données.",
          variant: "destructive",
        });
        setPdfConfigs({ [GENERAL_CONFIG_KEY]: { ...DEFAULT_SETTINGS } });
      }
      setIsLoadingSettings(false);
    };

    loadSettings();
  }, [isClient, toast]);

  const [previewSettingsForDisplay, setPreviewSettingsForDisplay] = useState<Required<PdfLayoutSettings>>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (!isClient || isLoadingSettings) return;

    const loadAndSetCurrentSettings = async () => {
        const effectiveSettings = await getEffectivePdfSettings(selectedPdfType || GENERAL_CONFIG_KEY);

        setLogoUrlInput(effectiveSettings.logoUrl || DEFAULT_SETTINGS.logoUrl); 
        setLogoWidthInput(String(effectiveSettings.logoWidth ?? DEFAULT_SETTINGS.logoWidth));
        if (effectiveSettings.logoUrl && effectiveSettings.logoUrl.startsWith('data:image')) {
            setUploadedLogoPreview(effectiveSettings.logoUrl);
        } else {
            setUploadedLogoPreview(null); 
        }

        setPrimaryColorInput(effectiveSettings.primaryColor || DEFAULT_SETTINGS.primaryColor);
        setHeaderTextInput(effectiveSettings.headerText || DEFAULT_SETTINGS.headerText);
        setFooterTextInput(effectiveSettings.footerText || DEFAULT_SETTINGS.footerText);
        setMarginTopInput(String(effectiveSettings.marginTop ?? DEFAULT_SETTINGS.marginTop));
        setMarginRightInput(String(effectiveSettings.marginRight ?? DEFAULT_SETTINGS.marginRight));
        setMarginBottomInput(String(effectiveSettings.marginBottom ?? DEFAULT_SETTINGS.marginBottom));
        setMarginLeftInput(String(effectiveSettings.marginLeft ?? DEFAULT_SETTINGS.marginLeft));
        setDefaultFontSizeInput(String(effectiveSettings.defaultFontSize ?? DEFAULT_SETTINGS.defaultFontSize));
        setFontFamilyInput(effectiveSettings.fontFamily || DEFAULT_SETTINGS.fontFamily);
        setDocumentBaseTitleInput(effectiveSettings.documentBaseTitle || DEFAULT_SETTINGS.documentBaseTitle);
        setShowDocumentBaseTitleInput(effectiveSettings.showDocumentBaseTitle ?? DEFAULT_SETTINGS.showDocumentBaseTitle);
        setShowModuleTitleInput(effectiveSettings.showModuleTitle ?? DEFAULT_SETTINGS.showModuleTitle);
        setDocumentTitleFontSizeInput(String(effectiveSettings.documentTitleFontSize ?? DEFAULT_SETTINGS.documentTitleFontSize));
        setHeaderFontSizeInput(String(effectiveSettings.headerFontSize ?? DEFAULT_SETTINGS.headerFontSize));
        setFooterFontSizeInput(String(effectiveSettings.footerFontSize ?? DEFAULT_SETTINGS.footerFontSize));
        setTableHeaderFontSizeInput(String(effectiveSettings.tableHeaderFontSize ?? DEFAULT_SETTINGS.tableHeaderFontSize));
        setTableBodyFontSizeInput(String(effectiveSettings.tableBodyFontSize ?? DEFAULT_SETTINGS.tableBodyFontSize));
        setOrientationInput(effectiveSettings.orientation || DEFAULT_SETTINGS.orientation);
        setPageSizeInput(effectiveSettings.pageSize || DEFAULT_SETTINGS.pageSize);
    }
    
    loadAndSetCurrentSettings();
    
  }, [selectedPdfType, pdfConfigs, isClient, isLoadingSettings]);


  useEffect(() => {
    if (!isClient || isLoadingSettings) return;

    const liveSettings: Required<PdfLayoutSettings> = {
      logoUrl: logoUrlInput || DEFAULT_SETTINGS.logoUrl,
      logoWidth: parseFloat(logoWidthInput) || DEFAULT_SETTINGS.logoWidth,
      primaryColor: primaryColorInput || DEFAULT_SETTINGS.primaryColor,
      headerText: headerTextInput || DEFAULT_SETTINGS.headerText,
      footerText: footerTextInput || DEFAULT_SETTINGS.footerText,
      marginTop: parseFloat(marginTopInput) || DEFAULT_SETTINGS.marginTop,
      marginRight: parseFloat(marginRightInput) || DEFAULT_SETTINGS.marginRight,
      marginBottom: parseFloat(marginBottomInput) || DEFAULT_SETTINGS.marginBottom,
      marginLeft: parseFloat(marginLeftInput) || DEFAULT_SETTINGS.marginLeft,
      defaultFontSize: parseFloat(defaultFontSizeInput) || DEFAULT_SETTINGS.defaultFontSize,
      fontFamily: fontFamilyInput || DEFAULT_SETTINGS.fontFamily,
      documentBaseTitle: documentBaseTitleInput || DEFAULT_SETTINGS.documentBaseTitle,
      showDocumentBaseTitle: showDocumentBaseTitleInput,
      showModuleTitle: showModuleTitleInput,
      documentTitleFontSize: parseFloat(documentTitleFontSizeInput) || DEFAULT_SETTINGS.documentTitleFontSize,
      headerFontSize: parseFloat(headerFontSizeInput) || DEFAULT_SETTINGS.headerFontSize,
      footerFontSize: parseFloat(footerFontSizeInput) || DEFAULT_SETTINGS.footerFontSize,
      tableHeaderFontSize: parseFloat(tableHeaderFontSizeInput) || DEFAULT_SETTINGS.tableHeaderFontSize,
      tableBodyFontSize: parseFloat(tableBodyFontSizeInput) || DEFAULT_SETTINGS.tableBodyFontSize,
      orientation: orientationInput || DEFAULT_SETTINGS.orientation,
      pageSize: pageSizeInput || DEFAULT_SETTINGS.pageSize,
    };
    setPreviewSettingsForDisplay(liveSettings);
  }, [
    isClient, isLoadingSettings,
    logoUrlInput, logoWidthInput, primaryColorInput, headerTextInput, footerTextInput,
    marginTopInput, marginRightInput, marginBottomInput, marginLeftInput,
    defaultFontSizeInput, fontFamilyInput, documentBaseTitleInput, showDocumentBaseTitleInput,
    showModuleTitleInput,
    documentTitleFontSizeInput, headerFontSizeInput, footerFontSizeInput,
    tableHeaderFontSizeInput, tableBodyFontSizeInput, orientationInput, pageSizeInput
  ]);

  const selectedPdfLabel = useMemo(() => {
    if (selectedPdfType === GENERAL_CONFIG_KEY) {
      return GENERAL_CONFIG_DISPLAY_LABEL;
    }
    const foundPdf = pdfTypes.find(pt => pt.value === selectedPdfType);
    return foundPdf ? foundPdf.label : GENERAL_CONFIG_DISPLAY_LABEL;
  }, [selectedPdfType]);

  const saveConfig = useCallback(async (updates: Partial<PdfLayoutSettings>, successMessagePrefix: string) => {
    if (isSaving) return;
    setIsSaving(true);
    
    const activeConfigKey = selectedPdfType || GENERAL_CONFIG_KEY;
    const currentSpecificConfig = pdfConfigs[activeConfigKey] ? { ...pdfConfigs[activeConfigKey] } : {};
    let newSpecificConfig = { ...currentSpecificConfig, ...updates };

    (Object.keys(newSpecificConfig) as Array<keyof PdfLayoutSettings>).forEach(key => {
        const valueToSave = newSpecificConfig[key];
        const defaultValue = DEFAULT_SETTINGS[key];
        
        const isDefaultValue = valueToSave === defaultValue;
        if (valueToSave === undefined || (typeof valueToSave === 'string' && String(valueToSave).trim() === '') || (isDefaultValue && activeConfigKey !== GENERAL_CONFIG_KEY) ) {
          delete newSpecificConfig[key];
        }
    });
    
    const newPdfConfigs = { ...pdfConfigs };
    if (Object.keys(newSpecificConfig).length === 0 && activeConfigKey !== GENERAL_CONFIG_KEY) {
        delete newPdfConfigs[activeConfigKey];
    } else {
        newPdfConfigs[activeConfigKey] = newSpecificConfig;
    }
    
    try {
        await savePdfLayoutSettingsToFirestore(newPdfConfigs);
        setPdfConfigs(newPdfConfigs); 
        toast({
          title: "Configuration Enregistrée",
          description: `${successMessagePrefix} pour "${selectedPdfLabel}" a été enregistrée.`,
        });
    } catch (error) {
        console.error("Error saving PDF layout settings to Firestore:", error);
        toast({
          title: "Erreur de Sauvegarde",
          description: `Impossible d'enregistrer la configuration dans la base de données.`,
          variant: "destructive",
        });
    } finally {
        setIsSaving(false);
    }
  }, [selectedPdfType, pdfConfigs, toast, selectedPdfLabel, isSaving]);

  const handleLogoFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        if (file.size > 2 * 1024 * 1024) { 
            toast({
                title: "Fichier trop volumineux",
                description: "La taille du logo ne doit pas dépasser 2Mo.",
                variant: "destructive",
            });
            if (logoFileInputRef.current) logoFileInputRef.current.value = "";
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result as string;
            setLogoUrlInput(dataUrl); 
            setUploadedLogoPreview(dataUrl);
        };
        reader.readAsDataURL(file);
    }
  };

  const handleSaveLogoAndWidth = () => {
    saveConfig({ 
      logoUrl: logoUrlInput || undefined,
      logoWidth: parseFloat(logoWidthInput) || undefined
    }, "Le logo et sa largeur");
  };

  const handleSaveHeaderText = () => saveConfig({ headerText: headerTextInput || undefined }, "Le texte d'en-tête");
  const handleSaveFooterText = () => saveConfig({ footerText: footerTextInput || undefined }, "Le texte de pied de page");
  
  const handleSaveTitleOptions = () => {
    saveConfig({
      documentBaseTitle: documentBaseTitleInput || undefined,
      showDocumentBaseTitle: showDocumentBaseTitleInput,
      showModuleTitle: showModuleTitleInput,
    }, "Les options de titre");
  };

  const handleSaveLayoutAndFontStyles = () => {
    const updates: Partial<PdfLayoutSettings> = {
      primaryColor: primaryColorInput,
      marginTop: parseFloat(marginTopInput) || undefined,
      marginRight: parseFloat(marginRightInput) || undefined,
      marginBottom: parseFloat(marginBottomInput) || undefined,
      marginLeft: parseFloat(marginLeftInput) || undefined,
      defaultFontSize: parseFloat(defaultFontSizeInput) || undefined,
      fontFamily: fontFamilyInput || undefined,
      documentTitleFontSize: parseFloat(documentTitleFontSizeInput) || undefined,
      headerFontSize: parseFloat(headerFontSizeInput) || undefined,
      footerFontSize: parseFloat(footerFontSizeInput) || undefined,
      tableHeaderFontSize: parseFloat(tableHeaderFontSizeInput) || undefined,
      tableBodyFontSize: parseFloat(tableBodyFontSizeInput) || undefined,
      orientation: orientationInput || undefined,
      pageSize: pageSizeInput || undefined,
    };
    saveConfig(updates, "Les styles de mise en page et de police");
  };
  
  const renderPreviewHeaderText = () => {
    const headerToDisplay = previewSettingsForDisplay.headerText || '';
    const logoToDisplay = uploadedLogoPreview || (previewSettingsForDisplay.logoUrl?.startsWith('data:image') ? previewSettingsForDisplay.logoUrl : null);

    if (!headerToDisplay && !logoToDisplay) return <div className="h-4">&nbsp;</div>; 
  
    const lines = headerToDisplay.split('\n');
    return (
      <div style={{ fontSize: `${Math.max(5, (previewSettingsForDisplay.headerFontSize) / 2)}pt` }}>
        {lines.map((line, lineIndex) => {
          const cells = line.split('|');
          return (
            <div key={lineIndex} className="flex">
              {cells.map((cell, cellIndex) => {
                const cellContent = cell.trim();
                if (cellContent === '{logo}' && logoToDisplay) {
                  return (
                    <div key={cellIndex} className="p-0.5 border border-neutral-400 dark:border-neutral-500 flex-1 flex items-center justify-center">
                      <Image 
                        src={logoToDisplay} 
                        alt="Aperçu logo" 
                        width={32}
                        height={16}
                        style={{ width: `${previewSettingsForDisplay.logoWidth}%`, height: 'auto' }}
                        className="object-contain"
                        unoptimized
                      />
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
  
  if (!isClient || isLoadingSettings) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Personnalisation de la Mise en Page PDF</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary mr-2"/> Chargement des configurations...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const baseTitleTextPreview = (previewSettingsForDisplay.showDocumentBaseTitle && previewSettingsForDisplay.documentBaseTitle && previewSettingsForDisplay.documentBaseTitle.trim() !== "")
      ? previewSettingsForDisplay.documentBaseTitle.trim()
      : "";
  const moduleTitleTextPreview = previewSettingsForDisplay.showModuleTitle ? "Titre Module (Dynamique)" : "";
  let fullTitlePreview = "";
  if (baseTitleTextPreview && moduleTitleTextPreview) {
      fullTitlePreview = `${baseTitleTextPreview} - ${moduleTitleTextPreview}`;
  } else if (baseTitleTextPreview) {
      fullTitlePreview = baseTitleTextPreview;
  } else if (moduleTitleTextPreview) {
      fullTitlePreview = moduleTitleTextPreview;
  } else {
      fullTitlePreview = "(Aucun titre configuré pour l'affichage)";
  }

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
            <Select value={selectedPdfType} onValueChange={setSelectedPdfType} disabled={isSaving}>
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
            Modifiez les paramètres ci-dessous pour le type de PDF sélectionné. Les paramètres non définis utiliseront la configuration générale.
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
                    <Label htmlFor="logo-file-input">Télécharger un Logo (max 2Mo)</Label>
                    <Input 
                        id="logo-file-input"
                        type="file"
                        accept="image/png, image/jpeg, image/svg+xml, image/webp"
                        ref={logoFileInputRef}
                        onChange={handleLogoFileUpload}
                        className="mt-1 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                        disabled={isSaving}
                    />
                </div>
                 <div>
                    <Label htmlFor="logo-width-input" className="flex items-center gap-1"><Ruler className="w-4 h-4"/> Largeur du Logo (en % de la page)</Label>
                    <Input 
                        id="logo-width-input"
                        type="number"
                        value={logoWidthInput}
                        onChange={e => setLogoWidthInput(e.target.value)}
                        placeholder="Ex: 50"
                        className="mt-1 h-8"
                        disabled={isSaving}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                        La largeur est un pourcentage de la largeur totale de la page. 100% prendra toute la largeur.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Effectif : {previewSettingsForDisplay.logoWidth}%</p>
                </div>
                <Button onClick={handleSaveLogoAndWidth} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>} 
                    Enregistrer Logo & Largeur
                </Button>
                {(uploadedLogoPreview || (previewSettingsForDisplay.logoUrl && previewSettingsForDisplay.logoUrl.startsWith('data:image'))) && (
                  <div className="mt-4 p-2 border rounded-md inline-block bg-muted">
                    <p className="text-xs text-muted-foreground mb-1">Aperçu du logo actuel :</p>
                    <Image 
                        src={uploadedLogoPreview || previewSettingsForDisplay.logoUrl!} 
                        alt="Aperçu du logo" 
                        width={150} 
                        height={75} 
                        className="object-contain rounded"
                        unoptimized
                    />
                  </div>
                )}
                 {!(uploadedLogoPreview || (previewSettingsForDisplay.logoUrl && previewSettingsForDisplay.logoUrl.startsWith('data:image'))) && <p className="text-xs text-muted-foreground mt-2">Aucun logo configuré. Téléchargez une image.</p>}
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
                  <Select value={orientationInput} onValueChange={(val) => setOrientationInput(val as NonNullable<PdfLayoutSettings['orientation']>)} disabled={isSaving}>
                    <SelectTrigger id="orientation-select"><SelectValue /></SelectTrigger>
                    <SelectContent>{pageOrientations.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                   <p className="text-xs text-muted-foreground mt-1">Effective: {previewSettingsForDisplay.orientation === 'landscape' ? 'Paysage' : 'Portrait'}</p>
                </div>
                <div>
                  <Label htmlFor="page-size-select">Format de Page</Label>
                  <Select value={pageSizeInput} onValueChange={(val) => setPageSizeInput(val as NonNullable<PdfLayoutSettings['pageSize']>)} disabled={isSaving}>
                    <SelectTrigger id="page-size-select"><SelectValue /></SelectTrigger>
                    <SelectContent>{pageSizes.map(ps => <SelectItem key={ps.value} value={ps.value}>{ps.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">Effectif: {previewSettingsForDisplay.pageSize.toUpperCase()}</p>
                </div>
                <div>
                  <Label htmlFor="font-family-select">Police de Caractères</Label>
                  <Select value={fontFamilyInput} onValueChange={(val) => setFontFamilyInput(val as NonNullable<PdfLayoutSettings['fontFamily']>)} disabled={isSaving}>
                    <SelectTrigger id="font-family-select"><SelectValue /></SelectTrigger>
                    <SelectContent>{fontFamilies.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                  </Select>
                   <p className="text-xs text-muted-foreground mt-1">Effective: {fontFamilies.find(f => f.value === previewSettingsForDisplay.fontFamily)?.label || previewSettingsForDisplay.fontFamily}</p>
                </div>
                <Label className="flex items-center gap-1 pt-2"><TextCursorInput className="w-4 h-4"/> Tailles de Police (pt)</Label>
                <div className="grid grid-cols-2 gap-3">
                    <div><Label htmlFor="document-title-font-size-input" className="text-xs">Titre Document</Label><Input id="document-title-font-size-input" type="number" value={documentTitleFontSizeInput} onChange={e => setDocumentTitleFontSizeInput(e.target.value)} className="h-8" disabled={isSaving}/></div>
                    <div><Label htmlFor="default-font-size-input" className="text-xs">Défaut</Label><Input id="default-font-size-input" type="number" value={defaultFontSizeInput} onChange={e => setDefaultFontSizeInput(e.target.value)} className="h-8" disabled={isSaving}/></div>
                    <div><Label htmlFor="header-font-size-input" className="text-xs">En-tête (Perso)</Label><Input id="header-font-size-input" type="number" value={headerFontSizeInput} onChange={e => setHeaderFontSizeInput(e.target.value)} className="h-8" disabled={isSaving}/></div>
                    <div><Label htmlFor="footer-font-size-input" className="text-xs">Pied de Page</Label><Input id="footer-font-size-input" type="number" value={footerFontSizeInput} onChange={e => setFooterFontSizeInput(e.target.value)} className="h-8" disabled={isSaving}/></div>
                    <div><Label htmlFor="table-header-font-size-input" className="text-xs">En-tête Tableau</Label><Input id="table-header-font-size-input" type="number" value={tableHeaderFontSizeInput} onChange={e => setTableHeaderFontSizeInput(e.target.value)} className="h-8" disabled={isSaving}/></div>
                    <div><Label htmlFor="table-body-font-size-input" className="text-xs">Corps Tableau</Label><Input id="table-body-font-size-input" type="number" value={tableBodyFontSizeInput} onChange={e => setTableBodyFontSizeInput(e.target.value)} className="h-8" disabled={isSaving}/></div>
                </div>
                 <p className="text-xs text-muted-foreground mt-1">
                    Effectives: Titre Doc. {previewSettingsForDisplay.documentTitleFontSize}pt, Défaut {previewSettingsForDisplay.defaultFontSize}pt, En-tête Perso {previewSettingsForDisplay.headerFontSize}pt, Pied {previewSettingsForDisplay.footerFontSize}pt, En-tête Tab. {previewSettingsForDisplay.tableHeaderFontSize}pt, Corps Tab. {previewSettingsForDisplay.tableBodyFontSize}pt
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
                            disabled={isSaving}
                        />
                        <Input
                            type="text"
                            value={primaryColorInput}
                            onChange={(e) => setPrimaryColorInput(e.target.value)}
                            placeholder="#FFBF00"
                            className="w-32 h-8"
                            disabled={isSaving}
                        />
                    </div>
                     <p className="text-xs text-muted-foreground mt-1">Effective: <span style={{backgroundColor: previewSettingsForDisplay.primaryColor, padding: '2px 6px', borderRadius: '3px', color: '#fff', textShadow: '0 0 2px #000' }}>{previewSettingsForDisplay.primaryColor}</span></p>
                </div>
                <div>
                  <Label className="flex items-center gap-1"><ArrowRightLeft className="w-4 h-4"/> Marges (en points PDF, 1pt ≈ 0.35mm)</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label htmlFor="margin-top-input" className="text-xs">Haut</Label><Input id="margin-top-input" type="number" value={marginTopInput} onChange={e => setMarginTopInput(e.target.value)} placeholder={String(DEFAULT_MARGIN)} className="h-8" disabled={isSaving}/></div>
                    <div><Label htmlFor="margin-bottom-input" className="text-xs">Bas</Label><Input id="margin-bottom-input" type="number" value={marginBottomInput} onChange={e => setMarginBottomInput(e.target.value)} placeholder={String(DEFAULT_MARGIN)} className="h-8" disabled={isSaving}/></div>
                    <div><Label htmlFor="margin-left-input" className="text-xs">Gauche</Label><Input id="margin-left-input" type="number" value={marginLeftInput} onChange={e => setMarginLeftInput(e.target.value)} placeholder={String(DEFAULT_MARGIN)} className="h-8" disabled={isSaving}/></div>
                    <div><Label htmlFor="margin-right-input" className="text-xs">Droite</Label><Input id="margin-right-input" type="number" value={marginRightInput} onChange={e => setMarginRightInput(e.target.value)} placeholder={String(DEFAULT_MARGIN)} className="h-8" disabled={isSaving}/></div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Effectives: H:{previewSettingsForDisplay.marginTop}pt, B:{previewSettingsForDisplay.marginBottom}pt, G:{previewSettingsForDisplay.marginLeft}pt, D:{previewSettingsForDisplay.marginRight}pt</p>
                </div>
              </div>
            </div>
          
           <div className="p-6 border rounded-lg shadow-sm bg-card/50 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <FileCog className="w-6 h-6 text-accent" />
                <h3 className="text-lg font-semibold text-foreground">Contenu En-têtes, Pieds de Page & Options des Titres</h3>
              </div>
              <div className="space-y-4">
                <div>
                    <Label className="flex items-center gap-1" htmlFor="document-base-title-input"><TextCursorInput className="w-4 h-4"/> Titre de Base du Document</Label>
                    <Input 
                        id="document-base-title-input"
                        type="text"
                        placeholder="Ex: Rapport Mensuel"
                        value={documentBaseTitleInput}
                        onChange={(e) => setDocumentBaseTitleInput(e.target.value)}
                        className="mt-1 h-8"
                        disabled={isSaving}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Ce titre sera utilisé comme base. Des informations dynamiques pourront être ajoutées.</p>
                    {previewSettingsForDisplay.documentBaseTitle && <p className="text-xs text-muted-foreground mt-1">Effectif : {previewSettingsForDisplay.documentBaseTitle}</p>}
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <Label htmlFor="show-document-base-title-switch">Afficher le Titre de Base</Label>
                    <p className="text-xs text-muted-foreground">
                      Si activé, le "Titre de Base" ci-dessus sera inclus dans le titre principal du PDF.
                    </p>
                  </div>
                  <Switch
                    id="show-document-base-title-switch"
                    checked={showDocumentBaseTitleInput}
                    onCheckedChange={setShowDocumentBaseTitleInput}
                    disabled={isSaving}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <Label htmlFor="show-module-title-switch">Afficher le Titre Spécifique au Module</Label>
                    <p className="text-xs text-muted-foreground">
                      Si activé, le titre du module (ex: "Relevé d'Heures") sera inclus.
                    </p>
                  </div>
                  <Switch
                    id="show-module-title-switch"
                    checked={showModuleTitleInput}
                    onCheckedChange={setShowModuleTitleInput}
                    disabled={isSaving}
                  />
                </div>
                <Button onClick={handleSaveTitleOptions} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>} 
                    Enregistrer Options des Titres
                </Button>
                <div>
                    <Label htmlFor="header-text-input" className="flex items-center gap-1"><Type className="w-4 h-4"/> Texte d'En-tête Personnalisé</Label>
                    <Textarea 
                        id="header-text-input"
                        placeholder="Pour un en-tête tabulaire : utilisez '|' pour séparer les cellules, un saut de ligne pour une nouvelle rangée. Utilisez {logo} pour placer le logo. Ex: {logo} | Mon Titre Principal\n | Sous-titre"
                        value={headerTextInput}
                        onChange={(e) => setHeaderTextInput(e.target.value)}
                        className="mt-1"
                        rows={3}
                        disabled={isSaving}
                    />
                    {previewSettingsForDisplay.headerText && 
                      <div className="text-xs text-muted-foreground mt-1">Effectif : <pre className="whitespace-pre-wrap text-xs bg-muted/50 p-1 rounded inline-block">{previewSettingsForDisplay.headerText}</pre></div>
                    }
                    {!previewSettingsForDisplay.headerText && <p className="text-xs text-muted-foreground mt-1">Aucun texte d'en-tête personnalisé défini.</p>}
                </div>
                <Button onClick={handleSaveHeaderText} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>} 
                    Enregistrer En-tête Personnalisé
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
                        disabled={isSaving}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Utilisez &#123;date&#125;, &#123;pageNumber&#125;, &#123;totalPages&#125; comme placeholders.</p>
                    {previewSettingsForDisplay.footerText && <p className="text-xs text-muted-foreground mt-1">Effectif : {previewSettingsForDisplay.footerText}</p>}
                </div>
                 <Button onClick={handleSaveFooterText} disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>} 
                    Enregistrer Pied de Page
                </Button>
              </div>
            </div>
            <div className="flex justify-end mt-6 space-x-2">
                <Button onClick={handleSaveLayoutAndFontStyles} size="lg" disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Save className="mr-2 h-5 w-5"/>} 
                    Enregistrer Config. (Police, Couleur, Marges, Format)
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
            Visualisation basée sur les paramètres pour "{selectedPdfLabel}". L'aperçu se met à jour dynamiquement.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="text-sm mb-2">
              Orientation: <span className="font-semibold">{previewSettingsForDisplay.orientation === 'landscape' ? 'Paysage' : 'Portrait'}</span>, 
              Format: <span className="font-semibold">{previewSettingsForDisplay.pageSize.toUpperCase()}</span>,
              Police: <span className="font-semibold" style={{fontFamily: getFontFamilyCss(previewSettingsForDisplay.fontFamily)}}>{fontFamilies.find(f => f.value === previewSettingsForDisplay.fontFamily)?.label || previewSettingsForDisplay.fontFamily}</span>
            </div>
            <div className="text-xs mb-2">
                Afficher Titre de Base: <span className="font-semibold">{previewSettingsForDisplay.showDocumentBaseTitle ? 'Oui' : 'Non'}</span>, 
                Afficher Titre Module: <span className="font-semibold">{previewSettingsForDisplay.showModuleTitle ? 'Oui' : 'Non'}</span>
            </div>
          <div 
            key={JSON.stringify(previewSettingsForDisplay)} 
            className={cn(
                "bg-white dark:bg-neutral-800 p-1 rounded-sm shadow-inner w-full mx-auto overflow-hidden border border-muted",
                previewSettingsForDisplay.orientation === 'landscape' ? 'aspect-[297/210] max-w-md' : 'aspect-[210/297] max-w-sm'
            )}
            style={{ fontFamily: getFontFamilyCss(previewSettingsForDisplay.fontFamily) }}
          >
            <div
              className="h-full w-full bg-neutral-50 dark:bg-neutral-700 relative flex flex-col text-neutral-700 dark:text-neutral-200"
              style={{
                paddingTop: `${Math.max(1, (previewSettingsForDisplay.marginTop) / 7)}px`, 
                paddingBottom: `${Math.max(1, (previewSettingsForDisplay.marginBottom) / 7)}px`,
                paddingLeft: `${Math.max(1, (previewSettingsForDisplay.marginLeft) / 7)}px`,
                paddingRight: `${Math.max(1, (previewSettingsForDisplay.marginRight) / 7)}px`,
                fontSize: `${Math.max(3, (previewSettingsForDisplay.defaultFontSize) / 2.5)}pt`,
              }}
            >
              {/* Header Area */}
              <div className="mb-auto flex-shrink-0 leading-tight border-b border-neutral-300 dark:border-neutral-600 pb-0.5 mb-0.5 text-[0.9em]" style={{fontSize: `${Math.max(3, (previewSettingsForDisplay.headerFontSize) / 2.5)}pt`}}>
                {renderPreviewHeaderText()}
                 {!(previewSettingsForDisplay.headerText) && !(uploadedLogoPreview || (previewSettingsForDisplay.logoUrl && previewSettingsForDisplay.logoUrl.startsWith('data:image'))) && <div className="h-3">&nbsp;</div>}
              </div>

              {/* Document Title */}
              <div 
                className="text-center font-bold leading-tight my-1" 
                style={{fontSize: `${Math.max(4, (previewSettingsForDisplay.documentTitleFontSize) / 2.5)}pt`}}
              >
                {fullTitlePreview}
              </div>

              {/* Dummy Content Area */}
              <div className="flex-grow my-0.5 space-y-px overflow-hidden py-0.5">
                <div
                  className="h-1.5 w-full rounded-sm"
                  style={{ backgroundColor: previewSettingsForDisplay.primaryColor }}
                />
                <div className="text-neutral-600 dark:text-neutral-300" style={{fontSize: `${Math.max(3, (previewSettingsForDisplay.tableHeaderFontSize) / 2.5)}pt`}}>
                    En-tête Table 1 | En-tête Table 2 | En-tête Table 3
                </div>
                <div className="h-0.5 w-full bg-neutral-300 dark:bg-neutral-600 rounded-sm my-px" />
                <div className="text-neutral-500 dark:text-neutral-400" style={{fontSize: `${Math.max(3, (previewSettingsForDisplay.tableBodyFontSize) / 2.5)}pt`}}>
                    Ligne de contenu 1, col 1 | Col 2 | Col 3<br/>
                    Ligne de contenu 2, col 1 | Col 2 | Col 3<br/>
                    ... <br/>
                </div>
              </div>

              {/* Footer Area */}
              <div className="mt-auto flex-shrink-0">
                {previewSettingsForDisplay.footerText && (
                  <div className="text-neutral-500 dark:text-neutral-400 truncate leading-tight border-t border-neutral-300 dark:border-neutral-600 pt-0.5 mt-0.5" style={{fontSize: `${Math.max(2, (previewSettingsForDisplay.footerFontSize) / 2.5)}pt`}}>
                    {previewSettingsForDisplay.footerText
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
        <InfoIcon className="h-5 w-5 text-primary" />
        <AlertTitle className="text-primary font-semibold">Note sur l'Application des Paramètres</AlertTitle>
        <AlertDescription>
          Les configurations enregistrées ici seront utilisées lors de la génération des PDFs correspondants.
          Les polices standards disponibles sont : Helvetica, Times New Roman, Courier, Arial, Verdana.
        </AlertDescription>
      </Alert>
    </div>
  );
}
