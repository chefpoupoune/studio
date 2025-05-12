
"use client";

import React, { useState, ChangeEvent, useEffect } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { UploadCloud, FileDown, FileText, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { fr } from 'date-fns/locale';
import { format } from 'date-fns';

// Extend jsPDF with autoTable, or TypeScript might complain
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

type ExcelRow = (string | number | boolean | Date | null)[];
type ExcelData = ExcelRow[];

const months = [
  { value: "0", label: "Janvier" }, { value: "1", label: "Février" }, { value: "2", label: "Mars" },
  { value: "3", label: "Avril" }, { value: "4", label: "Mai" }, { value: "5", label: "Juin" },
  { value: "6", label: "Juillet" }, { value: "7", label: "Août" }, { value: "8", label: "Septembre" },
  { value: "9", label: "Octobre" }, { value: "10", label: "Novembre" }, { value: "11", label: "Décembre" }
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i); // Last 5 years and next 4 years

export default function ExcelBenefitManager() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [excelData, setExcelData] = useState<ExcelData | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString());
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const { toast } = useToast();

  useEffect(() => {
    // Reset data if month/year changes after a file was processed
    setSelectedFile(null);
    setExcelData(null);
    setHeaders([]);
  }, [selectedMonth, selectedYear]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || file.type === "application/vnd.ms-excel") {
        setSelectedFile(file);
        setExcelData(null); // Clear previous data
        setHeaders([]);
        toast({ title: "Fichier Sélectionné", description: file.name });
      } else {
        toast({ title: "Type de fichier invalide", description: "Veuillez sélectionner un fichier Excel (.xlsx ou .xls).", variant: "destructive" });
        setSelectedFile(null);
        event.target.value = ''; // Reset file input
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
            setExcelData(jsonData.slice(1)); // Data without headers
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
      const doc = new jsPDF() as jsPDFWithAutoTable; // Cast to include autoTable
      const monthLabel = months.find(m => m.value === selectedMonth)?.label || '';
      const title = `Avantages en Nature - ${monthLabel} ${selectedYear}`;
      
      doc.setFontSize(18);
      doc.text(title, 14, 20);
      doc.setFontSize(10);
      doc.text(`Généré le: ${format(new Date(), "dd MMMM yyyy 'à' HH:mm", { locale: fr })}`, 14, 28);

      doc.autoTable({
        startY: 35,
        head: [headers],
        body: excelData.map(row => row.map(cell => cell === null || cell === undefined ? '' : String(cell))),
        theme: 'grid',
        headStyles: { fillColor: [22, 160, 133] }, // Example header color
        didDrawPage: (data) => {
          // Footer
          const pageCount = doc.getNumberOfPages();
          doc.setFontSize(10);
          doc.text(`Page ${data.pageNumber} sur ${pageCount}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
        }
      });
      doc.save(`Avantages_Nature_${monthLabel}_${selectedYear}.pdf`);
      toast({ title: "PDF Généré", description: "Le fichier PDF a été téléchargé." });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({ title: "Erreur PDF", description: "La génération du PDF a échoué.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
        <div>
          <Label htmlFor="month-select">Mois</Label>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger id="month-select">
              <SelectValue placeholder="Sélectionner un mois" />
            </SelectTrigger>
            <SelectContent>
              {months.map(month => (
                <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="year-select">Année</Label>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger id="year-select">
              <SelectValue placeholder="Sélectionner une année" />
            </SelectTrigger>
            <SelectContent>
              {years.map(year => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="w-full">
          <Label htmlFor="excel-upload" className="sr-only">Télécharger Excel</Label>
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
            Aperçu des Données ({months.find(m=>m.value === selectedMonth)?.label} {selectedYear})
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
            Générer PDF
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
                Sélectionnez un mois, une année, puis téléchargez un fichier Excel.
            </p>
        </div>
      )}
    </div>
  );
}
