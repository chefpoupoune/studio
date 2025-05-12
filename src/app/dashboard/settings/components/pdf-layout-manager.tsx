
"use client";

import React, { useState, useMemo } from 'react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileCog, ImagePlus, Palette, Settings2 } from 'lucide-react';

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
  // Note: Fiche de Commande (WeeklyOrderSheets) is a specific static template, might not fit this customization model as easily.
];

const GENERAL_CONFIG_VALUE = "_general_pdf_config_";
const GENERAL_CONFIG_DISPLAY_LABEL = "Configuration Générale / Par Défaut";

export default function PdfLayoutManager() {
  const [selectedPdfType, setSelectedPdfType] = useState<string>('');

  const selectedPdfLabel = useMemo(() => {
    if (selectedPdfType === GENERAL_CONFIG_VALUE) {
      return GENERAL_CONFIG_DISPLAY_LABEL;
    }
    const foundPdf = pdfTypes.find(pt => pt.value === selectedPdfType);
    if (foundPdf) {
      return foundPdf.label;
    }
    // Default label when placeholder is active or if value is somehow not found (e.g. initial empty string)
    return GENERAL_CONFIG_DISPLAY_LABEL; 
  }, [selectedPdfType]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sélectionnez un type de PDF à configurer</CardTitle>
          <CardDescription>
            Choisissez le document dont vous souhaitez (à terme) personnaliser la mise en page.
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
      
      <Alert variant="default" className="border-primary/50 bg-primary/10">
        <FileCog className="h-5 w-5 text-primary" />
        <AlertTitle className="text-primary font-semibold">Fonctionnalité en cours de développement</AlertTitle>
        <AlertDescription>
          La gestion avancée de la mise en page des PDF est prévue pour une future version. Les options ci-dessous sont des démonstrations de ce qui sera possible.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-accent"/>
            Options de Personnalisation pour: <span className="text-primary ml-1">{selectedPdfLabel}</span>
          </CardTitle>
           <CardDescription>
            Les options suivantes sont des exemples et ne sont pas encore fonctionnelles.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
           <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 border rounded-lg shadow-sm bg-card/50 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <ImagePlus className="w-6 h-6 text-accent" />
                <h3 className="text-lg font-semibold text-foreground">Gestion du Logo</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Téléchargez et positionnez votre logo pour ce type de document.
              </p>
              <Button variant="outline" disabled>Télécharger Logo</Button>
            </div>

            <div className="p-6 border rounded-lg shadow-sm bg-card/50 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-3">
                <Palette className="w-6 h-6 text-accent" />
                <h3 className="text-lg font-semibold text-foreground">Mise en Page et Styles</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Ajustez les marges, polices et couleurs spécifiques à ce document.
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
                Personnalisez le contenu des en-têtes et pieds de page pour ce document.
              </p>
              <Button variant="outline" disabled>Configurer En-têtes/Pieds de Page</Button>
            </div>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground text-center pt-4">
        Actuellement, tous les PDF sont générés avec une mise en page standard. Nous travaillons activement pour vous offrir une personnalisation complète.
      </p>
    </div>
  );
}

