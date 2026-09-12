
"use client";

import React, { useState, useMemo } from 'react';
import type { Product, ProductFamily, Supplier, ProductSupplierReference } from '../types';
import { PRODUCT_FAMILIES, PURCHASE_ORDER_UNITS } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit2, Trash2, Upload, Search, Archive, ArchiveRestore } from 'lucide-react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import * as XLSX from 'xlsx';

const supplierReferenceSchema = z.object({
  supplierId: z.string().min(1, "Le fournisseur est requis."),
  reference: z.string().min(1, "La référence est requise."),
});

const productSchema = z.object({
  name: z.string().min(1, "Le nom est requis."),
  subNames: z.array(z.string()).optional(),
  supplierReferences: z.array(supplierReferenceSchema).min(1, "Au moins une référence fournisseur est requise."),
  quantity: z.coerce.number().min(0, "La quantité doit être positive."),
  alertThreshold: z.coerce.number().min(0, "Le seuil d'alerte doit être positif."),
  unit: z.enum(PURCHASE_ORDER_UNITS, { required_error: "L'unité est requise."}),
  quantityPerUnit: z.coerce.number().min(1, "La quantité par unité doit être d'au moins 1."),
  family: z.custom<ProductFamily>().optional(),
  archived: z.boolean().default(false),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ManageProductsProps {
  products: Product[];
  suppliers: Supplier[];
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onUpdateAllProductsThreshold: () => void;
}

export default function ManageProducts({ products, suppliers, onAddProduct, onUpdateProduct, onDeleteProduct, onUpdateAllProductsThreshold }: ManageProductsProps) {
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showArchived, setShowArchived] = useState(false);


  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      subNames: [],
      supplierReferences: [],
      quantity: 0,
      alertThreshold: 2,
      unit: 'Piece',
      quantityPerUnit: 1,
      family: undefined,
      archived: false,
    },
  });

  const { fields: subNamesFields, append: appendSubName, remove: removeSubName } = useFieldArray({ control: form.control, name: "subNames" });
  const { fields: supplierRefsFields, append: appendSupplierRef, remove: removeSupplierRef } = useFieldArray({ control: form.control, name: "supplierReferences" });

  React.useEffect(() => {
    if (isFormDialogOpen) {
      if (editingProduct) {
        form.reset({
          name: editingProduct.name,
          subNames: editingProduct.subNames || [],
          supplierReferences: editingProduct.supplierReferences || [],
          quantity: editingProduct.quantity,
          alertThreshold: editingProduct.alertThreshold || 2,
          unit: editingProduct.unit,
          quantityPerUnit: editingProduct.quantityPerUnit,
          family: editingProduct.family,
          archived: editingProduct.archived || false,
        });
      } else {
        form.reset({ name: '', subNames: [], supplierReferences: [], quantity: 0, alertThreshold: 2, unit: 'Piece', quantityPerUnit: 1, family: undefined, archived: false });
      }
    } else {
      setEditingProduct(null);
      form.reset({ name: '', subNames: [], supplierReferences: [], quantity: 0, alertThreshold: 2, unit: 'Piece', quantityPerUnit: 1, family: undefined, archived: false });
    }
  }, [editingProduct, form, isFormDialogOpen]);

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);

        json.forEach((row: any) => {
          const productData = {
            name: row.name,
            subNames: row.subNames ? row.subNames.split(',') : [],
            supplierReferences: row.supplierReferences ? JSON.parse(row.supplierReferences) : [], // Assuming JSON string format
            quantity: Number(row.quantity) || 0,
            alertThreshold: Number(row.alertThreshold) || 2,
            unit: row.unit,
            quantityPerUnit: Number(row.quantityPerUnit) || 1,
            family: row.family,
            archived: row.archived === 'TRUE' || row.archived === true,
          };
          onAddProduct(productData);
        });
        setIsImporting(false);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const onSubmit = (data: ProductFormData) => {
    const productData = { ...data, subNames: data.subNames || [] };
    if (editingProduct) {
      onUpdateProduct({ ...editingProduct, ...productData });
    } else {
      onAddProduct(productData);
    }
    setIsFormDialogOpen(false);
  };

  const handleOpenFormDialog = (product?: Product) => {
    setEditingProduct(product || null);
    setIsFormDialogOpen(true);
  };
  
 const toggleArchiveStatus = (product: Product) => {
    onUpdateProduct({ ...product, archived: !product.archived });
  };

  const getSupplierName = (supplierId: string) => {
    return suppliers.find(s => s.id === supplierId)?.name || 'Fournisseur inconnu';
  }


  const groupedProducts = useMemo(() => {
    const allProducts = products || [];
    const filteredByArchive = allProducts.filter(p => (showArchived ? p.archived : !p.archived));
    
    const grouped = filteredByArchive.reduce((acc, product) => {
      const family = product.family && PRODUCT_FAMILIES.includes(product.family) 
        ? product.family 
        : 'Non classé';
      if (!acc[family]) {
        acc[family] = [];
      }
      acc[family].push(product);
      return acc;
    }, {} as Record<ProductFamily | 'Non classé', Product[]>);

    const familyOrder: (ProductFamily | 'Non classé')[] = [...PRODUCT_FAMILIES, 'Non classé'];
    const sortedAndFilteredGroups: Record<string, Product[]> = {};
    const lowercasedFilter = searchTerm.toLowerCase();

    familyOrder.forEach(family => {
        if (grouped[family]) {
            const familyProducts = grouped[family];
            let filteredProducts = familyProducts;

            if (lowercasedFilter) {
                filteredProducts = familyProducts.filter(product => {
                    const nameMatch = product.name.toLowerCase().includes(lowercasedFilter);
                    const subNamesMatch = product.subNames?.some(subName => subName.toLowerCase().includes(lowercasedFilter));
                    const refMatch = product.supplierReferences?.some(ref => ref.reference.toLowerCase().includes(lowercasedFilter));
                    return nameMatch || subNamesMatch || refMatch;
                });
            }

            if (filteredProducts.length > 0) {
                 sortedAndFilteredGroups[family] = filteredProducts;
            }
        }
    });
    return sortedAndFilteredGroups;
  }, [products, searchTerm, showArchived]);

  return (
    <Card className="shadow-lg">
      <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle>Liste des Produits</CardTitle>
               <div className="flex items-center space-x-2">
                <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
                <Label htmlFor="show-archived">Afficher les produits archivés</Label>
              </div>
              <div className="w-full sm:w-72">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                      placeholder="Rechercher un produit..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                  />
                </div>
            </div>
          </div>
        </CardHeader>
      <CardContent>
        <div className="flex justify-end mb-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="mr-2">Appliquer Seuil Défaut (2)</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Appliquer le seuil par défaut ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action va définir le seuil d'alerte à 2 pour tous les produits existants.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={onUpdateAllProductsThreshold}>Confirmer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={() => setIsImporting(true)} className="mr-2">
            <Upload className="mr-2 h-4 w-4" /> Importer
          </Button>
          <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenFormDialog()}>
                <PlusCircle className="mr-2 h-4 w-4" /> Ajouter Produit
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[525px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProduct ? 'Modifier Produit' : 'Ajouter un Nouveau Produit'}</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                   <FormField control={form.control} name="family" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Famille</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Sélectionnez une famille" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>{PRODUCT_FAMILIES.map(family => (<SelectItem key={family} value={family}>{family}</SelectItem>))}</SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom du Produit</FormLabel>
                        <FormControl><Input placeholder="Ex: Savon Liquide" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                  <div>
                    <FormLabel>Sous-noms</FormLabel>
                    {subNamesFields.map((field, index) => (
                      <div key={field.id} className="flex items-center gap-2 mb-2">
                        <Input {...form.register(`subNames.${index}`)} />
                        <Button type="button" variant="destructive" size="icon" onClick={() => removeSubName(index)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => appendSubName('')}>Ajouter un sous-nom</Button>
                  </div>

                  <div>
                    <FormLabel>Références Fournisseurs</FormLabel>
                    {supplierRefsFields.map((field, index) => (
                      <div key={field.id} className="flex items-center gap-2 mb-2 p-2 border rounded-md">
                        <Controller
                          control={form.control}
                          name={`supplierReferences.${index}.supplierId`}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <SelectTrigger><SelectValue placeholder="Fournisseur" /></SelectTrigger>
                              <SelectContent>
                                {suppliers.map(supplier => (
                                  <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        <Input {...form.register(`supplierReferences.${index}.reference`)} placeholder="Référence" />
                        <Button type="button" variant="destructive" size="icon" onClick={() => removeSupplierRef(index)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => appendSupplierRef({ supplierId: '', reference: '' })}>Ajouter une référence fournisseur</Button>
                  </div>

                  <FormField control={form.control} name="quantity" render={({ field }) => (<FormItem><FormLabel>Quantité</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="alertThreshold" render={({ field }) => (<FormItem><FormLabel>Seuil d'Alerte</FormLabel><FormControl><Input type="number" placeholder="2" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="unit" render={({ field }) => (<FormItem><FormLabel>Unité</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Sélectionnez une unité" /></SelectTrigger></FormControl><SelectContent>{PURCHASE_ORDER_UNITS.map(unit => (<SelectItem key={unit} value={unit}>{unit}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="quantityPerUnit" render={({ field }) => (<FormItem><FormLabel>Quantité par Unité</FormLabel><FormControl><Input type="number" placeholder="1" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  
                  <DialogFooter className="sticky bottom-0 bg-background py-4">
                    <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
                    <Button type="submit">{editingProduct ? 'Enregistrer' : 'Ajouter'}</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
        {Object.keys(groupedProducts).length === 0 ? (
           <div className="text-center py-10 border-2 border-dashed border-muted-foreground/30 rounded-lg">
              <p className="mt-2 text-sm text-muted-foreground">Aucun produit ne correspond à votre recherche.</p>
            </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedProducts).map(([family, familyProducts]) => (
              <div key={family}>
                <h2 className="text-xl font-bold tracking-tight mb-2">{family} ({familyProducts.length})</h2>
                <div className="overflow-x-auto border rounded-md">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Sous-noms</TableHead>
                      <TableHead>Références Fournisseurs</TableHead>
                      <TableHead className="text-center">Quantité</TableHead>
                      <TableHead>Unité</TableHead>
                      <TableHead>Qté/Unité</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {familyProducts.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell>{product.name}</TableCell>
                          <TableCell>{product.subNames?.join(', ')}</TableCell>
                          <TableCell>
                            {product.supplierReferences?.map(ref => (
                                <div key={ref.supplierId}>{getSupplierName(ref.supplierId)}: {ref.reference}</div>
                            ))}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`font-bold ${product.quantity === 0 ? 'text-destructive' : product.quantity <= (product.alertThreshold || 2) ? 'text-orange-500' : 'text-green-600'}`}>
                              {product.quantity}
                            </span>
                          </TableCell>
                          <TableCell>{product.unit}</TableCell>
                          <TableCell>{product.quantityPerUnit}</TableCell>
                          <TableCell>
                           <Button variant="outline" size="icon" onClick={() => toggleArchiveStatus(product)}>
                              {showArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                            </Button>
                            <Button variant="outline" size="icon" onClick={() => handleOpenFormDialog(product)}><Edit2 className="h-4 w-4" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild><Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Supprimer ce produit ?</AlertDialogTitle><AlertDialogDescription>Action irréversible.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => onDeleteProduct(product.id)}>Supprimer</AlertDialogAction></AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <Dialog open={isImporting} onOpenChange={setIsImporting}>
        <DialogContent>
          <DialogHeader><DialogTitle>Importer des produits depuis un fichier Excel</DialogTitle></DialogHeader>
          <Input type="file" accept=".xlsx, .xls" onChange={handleFileImport} />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
