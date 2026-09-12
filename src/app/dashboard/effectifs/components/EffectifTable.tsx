import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Effectif } from '../types';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useToast } from '@/hooks/use-toast';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { saveEffectif } from '../services';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

export default function EffectifTable({ effectifs, onUpdate, onDelete }: { effectifs: Effectif[], onUpdate: (effectif: Effectif) => void, onDelete: (id: string) => void }) {
  const { toast } = useToast();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const sortedEffectifs = [...effectifs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const totals = sortedEffectifs.reduce((acc, effectif) => {
    acc.imp += Number(effectif.imp) || 0;
    acc.impPn += Number(effectif.impPn) || 0;
    acc.saj += Number(effectif.saj) || 0;
    acc.sajPn += Number(effectif.sajPn) || 0;
    acc.ime += Number(effectif.ime) || 0;
    acc.imePn += Number(effectif.imePn) || 0;
    acc.esat += Number(effectif.esat) || 0;
    acc.esatPn += Number(effectif.esatPn) || 0;
    acc.repasExceptionnel += Number(effectif.repasExceptionnel) || 0;
    acc.nous += Number(effectif.nous) || 0;
    
    const totalEffectif = (Number(effectif.imp) || 0) + (Number(effectif.saj) || 0) + (Number(effectif.ime) || 0) + (Number(effectif.esat) || 0) + (Number(effectif.repasExceptionnel) || 0) + (Number(effectif.nous) || 0);
    const totalPn = (Number(effectif.impPn) || 0) + (Number(effectif.sajPn) || 0) + (Number(effectif.imePn) || 0) + (Number(effectif.esatPn) || 0);
    
    acc.totalEffectif += totalEffectif;
    acc.totalPn += totalPn;
    acc.totalComplet += totalEffectif + totalPn;

    return acc;
  }, {
    imp: 0,
    impPn: 0,
    saj: 0,
    sajPn: 0,
    ime: 0,
    imePn: 0,
    esat: 0,
    esatPn: 0,
    repasExceptionnel: 0,
    nous: 0,
    totalEffectif: 0,
    totalPn: 0,
    totalComplet: 0
  });

  const generatePdf = async () => {
    if (effectifs.length === 0) {
      toast({ title: "Aucune donnée", description: "Il n'y a pas de données d'effectif à exporter.", variant: "destructive" });
      return;
    }
    setIsGeneratingPdf(true);

    try {
      const pdfSettings = await getPdfLayoutSettings('staffing_summary');
      const doc = new jsPDF({
        orientation: pdfSettings.orientation as any,
        unit: 'pt',
        format: pdfSettings.pageSize as any,
      }) as jsPDFWithAutoTable;

      const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });
      const monthLabel = effectifs.length > 0 ? format(new Date(effectifs[0].date), "MMMM yyyy", { locale: fr }) : "";

      let tableStartY = pdfSettings.marginTop;
      const pageContentWidth = doc.internal.pageSize.width - pdfSettings.marginLeft - pdfSettings.marginRight;

      // --- En-tête ---
      // ... (code de l'en-tête inchangé)

      // --- Titre ---
      const moduleDefaultTitle = `Recap effectif (${monthLabel})`;
      let finalTitle = "";
      if (pdfSettings.showDocumentBaseTitle && pdfSettings.documentBaseTitle) {
          finalTitle = pdfSettings.documentBaseTitle.trim();
      }
      if (pdfSettings.showModuleTitle) {
          finalTitle = finalTitle ? `${finalTitle} - ${moduleDefaultTitle}` : moduleDefaultTitle;
      }
      if(finalTitle) {
        doc.setFontSize(pdfSettings.documentTitleFontSize);
        doc.text(finalTitle, doc.internal.pageSize.width / 2, tableStartY, { align: 'center' });
        tableStartY += pdfSettings.documentTitleFontSize + 5;
      }

      // --- Tableau ---
      const headStyles: any = { fontStyle: 'bold', fontSize: pdfSettings.tableHeaderFontSize, valign: 'middle', halign: 'center' };
      if (pdfSettings.primaryColor) {
        const rgb = hexToRgb(pdfSettings.primaryColor);
        if(rgb){
            headStyles.fillColor = [rgb.r, rgb.g, rgb.b];
            const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
            headStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
        }
      }

      const body = sortedEffectifs.map(effectif => {
        const imp = Number(effectif.imp) || 0;
        const impPn = Number(effectif.impPn) || 0;
        const saj = Number(effectif.saj) || 0;
        const sajPn = Number(effectif.sajPn) || 0;
        const ime = Number(effectif.ime) || 0;
        const imePn = Number(effectif.imePn) || 0;
        const esat = Number(effectif.esat) || 0;
        const esatPn = Number(effectif.esatPn) || 0;
        const repasExceptionnel = Number(effectif.repasExceptionnel) || 0;
        const nous = Number(effectif.nous) || 0;
        
        const totalEffectif = imp + saj + ime + esat + repasExceptionnel + nous;
        const totalPn = impPn + sajPn + imePn + esatPn;
        const totalComplet = totalEffectif + totalPn;

        return [
          new Date(effectif.date).toLocaleDateString(),
          imp,
          impPn,
          saj,
          sajPn,
          ime,
          imePn,
          esat,
          esatPn,
          repasExceptionnel,
          nous,
          totalEffectif,
          totalPn,
          totalComplet
        ];
      });

      const foot = [[
        'Total',
        totals.imp,
        totals.impPn,
        totals.saj,
        totals.sajPn,
        totals.ime,
        totals.imePn,
        totals.esat,
        totals.esatPn,
        totals.repasExceptionnel,
        totals.nous,
        totals.totalEffectif,
        totals.totalPn,
        totals.totalComplet
      ]];

      const footStyles: any = { fontStyle: 'bold', fontSize: pdfSettings.tableHeaderFontSize, valign: 'middle', halign: 'center' };
      if (pdfSettings.primaryColor) {
        const rgb = hexToRgb(pdfSettings.primaryColor);
        if(rgb){
            footStyles.fillColor = [rgb.r, rgb.g, rgb.b];
            const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
            footStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
        }
      }

      doc.autoTable({
        startY: tableStartY,
        head: [['Date', 'IMP', 'PN', 'SAJ', 'PN', 'IME', 'PN', 'ESAT', 'PN', 'Repas Except.', 'Nous', 'Total Effectif', 'Total PN', 'Total Complet']],
        body: body,
        foot: foot,
        theme: 'grid',
        headStyles: headStyles,
        footStyles: footStyles,
        styles: { fontSize: pdfSettings.tableBodyFontSize, cellPadding: 2, font: pdfSettings.fontFamily, lineWidth: 0.1, lineColor: [0, 0, 0] },
        didDrawPage: (data) => {
          // ... (code du pied de page inchangé)
        },
        margin: { left: pdfSettings.marginLeft, right: pdfSettings.marginRight, bottom: pdfSettings.marginBottom },
      });

      doc.save(`Recapitulatif_Effectifs_${monthLabel.replace(/\s/g, '_')}.pdf`);
      toast({ title: "PDF Généré", description: "Le récapitulatif des effectifs a été téléchargé." });

    } catch (error) {
      console.error("Error generating PDF for staffing:", error);
      toast({ title: "Erreur PDF", description: `La génération du PDF a échoué: ${(error as Error).message}`, variant: "destructive" });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
   <div className="rounded-lg bg-card text-card-foreground p-4 shadow-md">
     <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Récapitulatif du mois</h2>
        <Button onClick={generatePdf} disabled={isGeneratingPdf || effectifs.length === 0}>
            {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            Générer PDF
        </Button>
     </div>
     <Table>
       <TableHeader>
         <TableRow>
           <TableHead>Date</TableHead>
           <TableHead>IMP</TableHead>
           <TableHead>PN</TableHead>
           <TableHead>SAJ</TableHead>
           <TableHead>PN</TableHead>
           <TableHead>IME</TableHead>
           <TableHead>PN</TableHead>
           <TableHead>ESAT</TableHead>
           <TableHead>PN</TableHead>
           <TableHead>Repas Except.</TableHead>
           <TableHead>Nous</TableHead>
           <TableHead className="font-bold">Total Effectif</TableHead>
           <TableHead className="font-bold">Total PN</TableHead>
           <TableHead className="font-bold">Total Complet</TableHead>
           <TableHead>Actions</TableHead>
         </TableRow>
       </TableHeader>
       <TableBody>
         {sortedEffectifs.map((effectif) => {
            const handleValueChange = (field: keyof Omit<Effectif, 'id' | 'date'>, value: string) => {
                const numericValue = Number(value) || 0;

                if (numericValue === (effectif[field] || 0)) {
                    return; 
                }

                const updatedEffectifData: Omit<Effectif, 'id'> = {
                    date: effectif.date,
                    imp: effectif.imp || 0,
                    impPn: effectif.impPn || 0,
                    saj: effectif.saj || 0,
                    sajPn: effectif.sajPn || 0,
                    ime: effectif.ime || 0,
                    imePn: effectif.imePn || 0,
                    esat: effectif.esat || 0,
                    esatPn: effectif.esatPn || 0,
                    repasExceptionnel: effectif.repasExceptionnel || 0,
                    nous: effectif.nous || 0,
                    [field]: numericValue,
                };

                saveEffectif(updatedEffectifData).then((savedEffectif) => {
                    onUpdate(savedEffectif);
                    toast({ title: "Succès", description: "L'effectif a été mis à jour." });
                }).catch(error => {
                    console.error("Error saving effectif:", error);
                    toast({
                        title: "Erreur de sauvegarde",
                        description: "Impossible d'enregistrer les modifications. Vérifiez la console pour plus de détails.",
                        variant: "destructive"
                    });
                });
            };

            const imp = Number(effectif.imp) || 0;
            const impPn = Number(effectif.impPn) || 0;
            const saj = Number(effectif.saj) || 0;
            const sajPn = Number(effectif.sajPn) || 0;
            const ime = Number(effectif.ime) || 0;
            const imePn = Number(effectif.imePn) || 0;
            const esat = Number(effectif.esat) || 0;
            const esatPn = Number(effectif.esatPn) || 0;
            const repasExceptionnel = Number(effectif.repasExceptionnel) || 0;
            const nous = Number(effectif.nous) || 0;

            const totalEffectif = imp + saj + ime + esat + repasExceptionnel + nous;
            const totalPn = impPn + sajPn + imePn + esatPn;
            const totalComplet = totalEffectif + totalPn;

            return (
              <TableRow key={effectif.id}>
                <TableCell>{new Date(effectif.date).toLocaleDateString()}</TableCell>
                <TableCell><Input type="number" defaultValue={imp} onBlur={(e) => handleValueChange('imp', e.target.value)} className="w-16" /></TableCell>
                <TableCell><Input type="number" defaultValue={impPn} onBlur={(e) => handleValueChange('impPn', e.target.value)} className="w-16" /></TableCell>
                <TableCell><Input type="number" defaultValue={saj} onBlur={(e) => handleValueChange('saj', e.target.value)} className="w-16" /></TableCell>
                <TableCell><Input type="number" defaultValue={sajPn} onBlur={(e) => handleValueChange('sajPn', e.target.value)} className="w-16" /></TableCell>
                <TableCell><Input type="number" defaultValue={ime} onBlur={(e) => handleValueChange('ime', e.target.value)} className="w-16" /></TableCell>
                <TableCell><Input type="number" defaultValue={imePn} onBlur={(e) => handleValueChange('imePn', e.target.value)} className="w-16" /></TableCell>
                <TableCell><Input type="number" defaultValue={esat} onBlur={(e) => handleValueChange('esat', e.target.value)} className="w-16" /></TableCell>
                <TableCell><Input type="number" defaultValue={esatPn} onBlur={(e) => handleValueChange('esatPn', e.target.value)} className="w-16" /></TableCell>
                <TableCell><Input type="number" defaultValue={repasExceptionnel} onBlur={(e) => handleValueChange('repasExceptionnel', e.target.value)} className="w-20" /></TableCell>
                <TableCell><Input type="number" defaultValue={nous} onBlur={(e) => handleValueChange('nous', e.target.value)} className="w-16" /></TableCell>
                <TableCell className="font-bold">{totalEffectif}</TableCell>
                <TableCell className="font-bold">{totalPn}</TableCell>
                <TableCell className="font-bold">{totalComplet}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(effectif.id)}>
                      <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
         })}
       </TableBody>
       <TableFooter>
        <TableRow>
          <TableCell className="font-bold">Total</TableCell>
          <TableCell className="font-bold">{totals.imp}</TableCell>
          <TableCell className="font-bold">{totals.impPn}</TableCell>
          <TableCell className="font-bold">{totals.saj}</TableCell>
          <TableCell className="font-bold">{totals.sajPn}</TableCell>
          <TableCell className="font-bold">{totals.ime}</TableCell>
          <TableCell className="font-bold">{totals.imePn}</TableCell>
          <TableCell className="font-bold">{totals.esat}</TableCell>
          <TableCell className="font-bold">{totals.esatPn}</TableCell>
          <TableCell className="font-bold">{totals.repasExceptionnel}</TableCell>
          <TableCell className="font-bold">{totals.nous}</TableCell>
          <TableCell className="font-bold">{totals.totalEffectif}</TableCell>
          <TableCell className="font-bold">{totals.totalPn}</TableCell>
          <TableCell className="font-bold">{totals.totalComplet}</TableCell>
          <TableCell></TableCell>
        </TableRow>
      </TableFooter>
     </Table>
   </div>
  );
}
