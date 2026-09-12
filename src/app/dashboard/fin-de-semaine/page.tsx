'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { firestore } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Product, STORAGE_ZONES, StorageZone } from '@/app/dashboard/inventory/types';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

// Augment jsPDF with autoTable plugin
interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const FinDeSemainePage = () => {
    const [loading, setLoading] = useState<string | null>(null);
    const { toast } = useToast();

    const generateBlankSheetPDF = (zone: StorageZone) => {
        setLoading(zone);
        try {
            const doc = new jsPDF() as jsPDFWithAutoTable;
            const title = `Inventaire- ${zone}`;
            const date = new Date().toLocaleDateString('fr-FR');

            doc.setFontSize(18);
            doc.text(title, 14, 22);
            doc.setFontSize(11);
            doc.text(`Date: ${date}`, 14, 30);

            const tableColumn = ["Produit", "Quantité"];
            const tableRows = Array(40).fill(['', '']); 

            doc.autoTable({
                head: [tableColumn],
                body: tableRows,
                startY: 35,
                theme: 'grid',
                headStyles: { fillColor: [134, 31, 65] }, // Bordeaux color
            });

            doc.save(`inventaire_${zone.toLowerCase().replace(/[^a-z]/g, '')}_${date.replace(/\//g, '-')}.pdf`);
            toast({ title: "PDF généré", description: `La fiche d'inventaire pour ${zone} a été téléchargée.` });

        } catch (error) {
            console.error(`Erreur lors de la génération de la fiche ${zone}: `, error);
            toast({ title: "Erreur", description: `Une erreur est survenue lors de la génération du PDF.`, variant: "destructive" });
        } finally {
            setLoading(null);
        }
    };
    
    const generateNonFoodInventoryPDF = async () => {
        setLoading('Produit');
        try {
            const productsQuery = query(collection(firestore, 'inventoryProducts'), orderBy("name"));
            const productsSnapshot = await getDocs(productsQuery);
            const allProducts = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));

            const filteredProducts = allProducts.filter(p => {
                const family = (p.family || 'non classé').trim().toLowerCase();
                return ['salle / sanitaire', 'plonge', 'cuisine', 'non classé'].includes(family);
            });

            if (filteredProducts.length === 0) {
                toast({ 
                    title: "Aucun produit correspondant trouvé", 
                    description: "Vérifiez que des produits avec la famille 'Cuisine', 'Salle / Sanitaire', 'Plonge' ou 'Non classé' existent bien.", 
                    variant: "destructive",
                    duration: 9000
                });
                setLoading(null);
                return;
            }

            const doc = new jsPDF() as jsPDFWithAutoTable;
            const title = `Inventaire Produits d'entretien `;
            const date = new Date().toLocaleDateString('fr-FR');
            
            doc.setFontSize(18);
            doc.text(title, 14, 22);
            doc.setFontSize(11);
            doc.text(`Date: ${date}`, 14, 30);

            const groupedByFamily = filteredProducts.reduce((acc, product) => {
                const family = product.family || 'non classé';
                if (!acc[family]) {
                    acc[family] = [];
                }
                acc[family].push(product);
                return acc;
            }, {} as Record<string, Product[]>);

            let finalY = 35;
            const pageHeight = doc.internal.pageSize.height;
            const marginBottom = 20;
            const families = Object.keys(groupedByFamily).sort();

            for (const family of families) {
                const productsInFamily = groupedByFamily[family];
                const tableColumn = ["Nom du Produit", "Référence", "Quantité", "Quantité Réelle"];
                const tableRows = productsInFamily.map(product => [
                    product.name,
                    (product.references && product.references.length > 0) ? product.references.join(', ') : 'N/A',
                    product.quantity ?? 'N/A',
                    ''
                ]);

                const tempDoc = new jsPDF() as jsPDFWithAutoTable;
                tempDoc.autoTable({
                    head: [tableColumn],
                    body: tableRows,
                    startY: 0, 
                });
                const tableHeight = (tempDoc as any).lastAutoTable.finalY;
                const titleHeight = 12; 

                if (finalY + titleHeight + tableHeight > pageHeight - marginBottom) {
                    doc.addPage();
                    finalY = 22; 
                }

                if (finalY > 35) {
                    finalY += 5;
                }

                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.text(family.charAt(0).toUpperCase() + family.slice(1), 14, finalY);
                finalY += 7;

                doc.autoTable({
                    head: [tableColumn],
                    body: tableRows,
                    startY: finalY,
                    theme: 'grid',
                    headStyles: { fillColor: [134, 31, 65] },
                    didParseCell: (data) => {
                        if (data.row.section === 'body' && data.column.index === 2) {
                            const product = productsInFamily[data.row.index];
                            if (product && typeof product.quantity === 'number') {
                                let color: [number, number, number] | null = null;
                                if (product.quantity < 2) {
                                    color = [255, 204, 203]; // Light Red
                                } else if (product.quantity === 2) {
                                    color = [255, 238, 204]; // Light Orange
                                } else { // > 2
                                    color = [204, 255, 204]; // Light Green
                                }
                                if (color) {
                                    data.cell.styles.fillColor = color;
                                }
                            }
                        }
                    },
                });
                finalY = (doc as any).lastAutoTable.finalY;
            }

            doc.save(`inventaire_produits_${date.replace(/\//g, '-')}.pdf`);
            toast({ title: "PDF généré", description: "La fiche d'inventaire des produits non-alimentaires a été téléchargée." });

        } catch (error) {
            console.error("Erreur lors de la génération de l'inventaire produits: ", error);
            toast({ title: "Erreur", description: `Une erreur est survenue: ${(error as Error).message}`, variant: "destructive" });
        } finally {
            setLoading(null);
        }
    };
    
    const generateAdditionsSheetPDF = () => {
        setLoading('Additions');
        try {
            const doc = new jsPDF() as jsPDFWithAutoTable;
            const title = "Feuille de Rajout";
            const date = new Date().toLocaleDateString('fr-FR');

            doc.setFontSize(18);
            doc.text(title, 14, 22);
            doc.setFontSize(11);
            doc.text(`Date: ${date}`, 14, 30);

            const tableColumn = ["Produit", "Quantité"];
            const prefilledProducts = [
                "Eau", "Fruit", "Fond", "Bouillon", "Huile", "Vinaigre", 
                "Echalotte", "Ail", "Persil", "Oignon", "Beurre", "Margarine"
            ];
            const prefilledRows = prefilledProducts.map(product => [product, '']);
            const emptyRows = Array(13).fill(['', '']);
            const tableRows = [...prefilledRows, ...emptyRows];

            doc.autoTable({
                head: [tableColumn],
                body: tableRows,
                startY: 35,
                theme: 'grid',
                headStyles: { fillColor: [134, 31, 65] }, // Bordeaux color
            });

            doc.save(`feuille_rajout_${date.replace(/\//g, '-')}.pdf`);
            toast({ title: "PDF généré", description: "La feuille de rajout a été téléchargée." });

        } catch (error) {
            console.error("Erreur: ", error);
            toast({ title: "Erreur", description: "Une erreur est survenue lors de la génération du PDF.", variant: "destructive" });
        } finally {
            setLoading(null);
        }
    };

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <div className="space-y-6">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">Fin de Semaine</h1>
                    <p className="text-muted-foreground">
                        Générez vos fiches vierges pour les inventaires et les rajouts.
                    </p>
                </div>

                <div className="space-y-4">
                    <h2 className="text-2xl font-semibold tracking-tight">Inventaires Alimentaires</h2>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {STORAGE_ZONES.map(zone => (
                            <CardTemplate
                                key={zone}
                                title={`Inventaire - ${zone}`}
                                description={`Génère une fiche vierge avec un tableau à remplir pour la zone "${zone}".`}
                                buttonText={`Générer Fiche ${zone}`}
                                onClick={() => generateBlankSheetPDF(zone)}
                                isLoading={loading === zone}
                            />
                        ))}
                    </div>
                </div>
                
                <div className="space-y-4">
                    <h2 className="text-2xl font-semibold tracking-tight pt-4">Inventaire Produits</h2>
                     <div className="grid gap-4 md:grid-cols-2">
                        <CardTemplate
                            title="Inventaire Produits d'Entretien "
                            description="Génère une fiche avec la liste des produits de 'Cuisine', 'Salle / Sanitaire', 'Plonge' et 'Non classé'."
                            buttonText="Générer l'inventaire produits"
                            onClick={() => generateNonFoodInventoryPDF()}
                            isLoading={loading === 'Produit'}
                        />
                    </div>
                </div>


                <div className="space-y-4">
                    <h2 className="text-2xl font-semibold tracking-tight pt-4"> Rajout de commande</h2>
                     <div className="grid gap-4 md:grid-cols-2">
                        <CardTemplate
                            title="Feuille de Rajout"
                            description="Génère une liste de courses pré-remplie avec les produits de base."
                            buttonText="Générer la feuille de rajout"
                            onClick={generateAdditionsSheetPDF}
                            isLoading={loading === 'Additions'}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

const CardTemplate = ({ title, description, buttonText, onClick, isLoading }: {
    title: string;
    description: string;
    buttonText: string;
    onClick: () => void;
    isLoading: boolean;
}) => (
    <div className="border p-6 rounded-lg shadow-sm flex flex-col">
        <h2 className="text-xl font-semibold mb-2">{title}</h2>
        <p className="text-muted-foreground mb-4 flex-grow">{description}</p>
        <Button onClick={onClick} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
            {isLoading ? 'Génération...' : buttonText}
        </Button>
    </div>
);

export default FinDeSemainePage;
