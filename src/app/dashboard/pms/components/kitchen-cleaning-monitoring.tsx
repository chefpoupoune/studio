
"use client";

import React, { useState, ChangeEvent, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { UploadCloud, FileText, Loader2, CalendarIcon, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

type ExcelRow = (string | number | boolean | Date | null)[];
type ExcelData = ExcelRow[];

export default function KitchenCleaningMonitoring() {
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [excelData, setExcelData] = useState<ExcelData | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Effacer les données Excel et le fichier sélectionné quand la date change
  useEffect(() => {
    setSelectedFile(null);
    setExcelData(null);
    setHeaders([]);
  }, [selectedDate]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || file.type === "application/vnd.ms-excel") {
        setSelectedFile(file);
        setExcelData(null); 
        setHeaders([]);
        toast({ title: "Fichier Sélectionné", description: file.name });
      } else {
        toast({ title: "Type de fichier invalide", description: "Veuillez sélectionner un fichier Excel (.xlsx ou .xls).", variant: "destructive" });
        setSelectedFile(null);
        event.target.value = ''; // Réinitialiser l'input file
      }
    }
  };

  const processExcelFile = () => {
    if (!selectedFile) {
      toast({ title: "Aucun fichier", description: "Veuillez d'abord sélectionner un fichier Excel.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (data) {
          const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as ExcelData;
          
          if (jsonData.length > 0) {
            const extractedHeaders = jsonData[0].map(header => String(header ?? ''));
            setHeaders(extractedHeaders);
            setExcelData(jsonData.slice(1));
            toast({ title: "Fichier Traité", description: "Les données du fichier Excel ont été chargées." });
          } else {
            setHeaders([]);
            setExcelData([]);
            toast({ title: "Fichier Vide", description: "Le fichier Excel semble vide ou ne contient pas d'en-têtes.", variant: "destructive" });
          }
        }
      } catch (error) {
        console.error("Error processing Excel file:", error);
        toast({ title: "Erreur de Traitement", description: "Impossible de lire le fichier Excel.", variant: "destructive" });
        setExcelData(null);
        setHeaders([]);
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      setIsLoading(false);
      toast({ title: "Erreur de Lecture", description: "Impossible de lire le fichier.", variant: "destructive" });
    };
    reader.readAsBinaryString(selectedFile);
  };

  const generatePdf = () => {
    if (!excelData || excelData.length === 0 || headers.length === 0) {
      toast({ title: "Aucune Donnée", description: "Veuillez traiter un fichier Excel avec des données pour générer un PDF.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const pdfSettings = getPdfLayoutSettings('pms_kitchen_cleaning'); // Use a specific key for PDF settings
      const doc = new jsPDF() as jsPDFWithAutoTable;
      const dateFormattedForTitle = format(selectedDate, "dd MMMM yyyy", { locale: fr });
      const generationDateFormatted = format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr });

      let currentY = 15;
      if (pdfSettings.headerText) {
        doc.setFontSize(10);
        doc.text(pdfSettings.headerText, 14, currentY);
        currentY += 10;
      }

      if (pdfSettings.logoUrl) {
        doc.setFontSize(8); 
        doc.text(`Logo: ${pdfSettings.logoUrl}`, 14, currentY);
        currentY += 5; 
      }
      
      const title = `Suivi Nettoyage Cuisine - ${dateFormattedForTitle}`;
      doc.setFontSize(18);
      doc.text(title, 14, currentY);
      currentY += 8;
      
      doc.setFontSize(10);
      doc.text(`Généré le: ${generationDateFormatted}`, 14, currentY);
      currentY += 7;

      const headStyles: { fillColor?: [number, number, number], textColor?: [number, number, number] } = {};
      if (pdfSettings.primaryColor) {
        const primaryColorRgb = hexToRgb(pdfSettings.primaryColor);
        if (primaryColorRgb) {
          headStyles.fillColor = primaryColorRgb;
          const brightness = (primaryColorRgb[0] * 299 + primaryColorRgb[1] * 587 + primaryColorRgb[2] * 114) / 1000;
          headStyles.textColor = brightness > 125 ? [0,0,0] : [255,255,255];
        }
      }

      doc.autoTable({
        startY: currentY,
        head: [headers],
        body: excelData.map(row => row.map(cell => cell === null || cell === undefined ? '' : String(cell))),
        theme: 'grid',
        headStyles: headStyles,
        didDrawPage: (data) => {
          const pageCount = doc.internal.getNumberOfPages();
          if (pdfSettings.footerText) {
            let footerStr = pdfSettings.footerText
              .replace('{date}', generationDateFormatted)
              .replace('{pageNumber}', data.pageNumber.toString())
              .replace('{totalPages}', pageCount.toString());
            
            doc.setFontSize(9);
            doc.text(footerStr, data.settings.margin.left, doc.internal.pageSize.height - 10);
          }
        }
      });
      doc.save(`Suivi_Nettoyage_Cuisine_${format(selectedDate, "yyyy-MM-dd")}.pdf`);
      toast({ title: "PDF Généré", description: "Le fichier PDF du suivi de nettoyage a été téléchargé." });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Erreur PDF", description: "La génération du PDF a échoué.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Suivi Quotidien du Nettoyage Cuisine (via Excel)
        </CardTitle>
        <CardDescription>
          Sélectionnez une date, téléchargez votre fichier Excel (.xlsx ou .xls) pour visualiser les tâches de nettoyage et générer un PDF.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="cleaning-date">Date du suivi</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full sm:w-[280px] justify-start text-left font-normal mt-1",
                  !selectedDate && "text-muted-foreground"
                )}
                id="cleaning-date"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP", { locale: fr }) : <span>Choisir une date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(startOfDay(date))}
                initialFocus
                locale={fr}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="w-full">
            <Label htmlFor="excel-upload" className="sr-only">Télécharger Fichier Excel de Suivi</Label>
            <Input
              id="excel-upload"
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              className="cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
            />
          </div>
          <Button onClick={processExcelFile} disabled={!selectedFile || isLoading} className="w-full sm:w-auto">
            {isLoading && selectedFile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
            Traiter le Fichier
          </Button>
        </div>
        
        {selectedFile && !excelData && !isLoading && (
          <p className="text-sm text-muted-foreground">Fichier "{selectedFile.name}" prêt à être traité. Cliquez sur "Traiter le Fichier".</p>
        )}

        {excelData && headers.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-foreground">
              Aperçu du Suivi pour le {format(selectedDate, "dd MMMM yyyy", { locale: fr })}
            </h3>
            <div className="overflow-x-auto border rounded-md max-h-[400px]">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    {headers.map((header, index) => (
                      <TableHead key={index}>{header}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {excelData.map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <TableCell key={cellIndex}>
                          {cell instanceof Date ? format(cell, 'P', { locale: fr }) : (cell === null || cell === undefined ? '' : String(cell))}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button onClick={generatePdf} disabled={isLoading} className="w-full sm:w-auto">
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Générer PDF du Suivi
            </Button>
          </div>
        )}
        
        {excelData && excelData.length === 0 && headers.length === 0 && !isLoading && (
           <p className="text-muted-foreground text-center py-8">Aucune donnée à afficher. Le fichier est peut-être vide ou mal formaté.</p>
        )}

        {!selectedFile && !isLoading && (
          <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
              <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                  Sélectionnez une date, puis téléchargez un fichier Excel pour le suivi du nettoyage cuisine.
              </p>
          </div>
        )}
         {isLoading && !selectedFile && (
             <div className="text-center py-10">
                <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin" />
                <p className="mt-2 text-sm text-muted-foreground">Chargement...</p>
            </div>
         )}
      </CardContent>
    </Card>
  );
}


    