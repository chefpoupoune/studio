
"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Product, StockMovement, ProductFamily } from '../types';
import { PRODUCT_FAMILIES } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowRightLeft, PlusCircle, Trash2, FileText, Loader2, History, Check, ChevronsUpDown } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getPdfLayoutSettings, hexToRgb } from '@/lib/pdf-settings';
import  useMobile  from '@/hooks/use-mobile';
import { Checkbox } from "@/components/ui/checkbox";

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

const stockMovementSchema = z.object({
  productId: z.string().min(1, "Veuillez sélectionner un produit."),
  type: z.enum(['entry', 'exit'], { required_error: "Veuillez sélectionner un type de mouvement." }),
  quantity: z.coerce.number().min(1, "La quantité doit être d'au moins 1."),
  notes: z.string().optional(),
});

type StockMovementFormData = z.infer<typeof stockMovementSchema>;

interface ManageStockMovementsProps {
  products: Product[];
  stockMovements: StockMovement[];
  onAddStockMovement: (movement: Omit<StockMovement, 'id' | 'date' | 'productName'>) => void;
  onDeleteAllStockMovements: () => void;
  onDeleteMovement: (movementId: string) => Promise<void>;
  onDeleteSelectedMovements: (movements: StockMovement[]) => Promise<void>;
  onDeleteMonthlyHistory: (year: string, month: string) => Promise<void>;
}

const currentFullYear = new Date().getFullYear();
const yearsArray = Array.from({ length: 10 }, (_, i) => currentFullYear - 5 + i);
const monthsArray = Array.from({ length: 12 }, (_, i) => ({
  value: i.toString(), // 0-indexed
  label: format(new Date(currentFullYear, i), "MMMM", { locale: fr }),
}));


export default function ManageStockMovements({ products, stockMovements, onAddStockMovement, onDeleteAllStockMovements, onDeleteMovement, onDeleteSelectedMovements, onDeleteMonthlyHistory }: ManageStockMovementsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();
  const isMobile = useMobile();
  const [selectedMovements, setSelectedMovements] = useState<string[]>([]);
  const dialogContentRef = useRef<HTMLDivElement>(null);
  
  const [selectedYearForPdf, setSelectedYearForPdf] = useState<string>(currentFullYear.toString());
  const [selectedMonthForPdf, setSelectedMonthForPdf] = useState<string>(new Date().getMonth().toString()); // 0-indexed
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const groupedProducts = useMemo(() => {
    const grouped = products.reduce((acc, product) => {
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
    const sortedGroups: Record<string, Product[]> = {};
    familyOrder.forEach(family => {
      if (grouped[family]) {
        sortedGroups[family] = grouped[family].sort((a,b) => a.name.localeCompare(b.name));
      }
    });
    return sortedGroups;
  }, [products]);

  const handleSelectMovement = (id: string) => {
    setSelectedMovements(prev =>
      prev.includes(id) ? prev.filter(mId => mId !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    if (selectedMovements.length === filteredStockMovements.length) {
      setSelectedMovements([]);
    } else {
      setSelectedMovements(filteredStockMovements.map(m => m.id));
    }
  };

  const handleDeleteSelected = async () => {
    const movementsToDelete = stockMovements.filter(m => selectedMovements.includes(m.id));
    if (movementsToDelete.length > 0) {
        await onDeleteSelectedMovements(movementsToDelete);
        setSelectedMovements([]);
    }
  };

  const form = useForm<StockMovementFormData>({
    resolver: zodResolver(stockMovementSchema),
    defaultValues: {
      productId: '',
      type: 'entry',
      quantity: 1,
      notes: '',
    },
  });

  const onSubmit = (data: StockMovementFormData) => {
    onAddStockMovement(data);
    form.reset();
    setIsDialogOpen(false);
  };

  const filteredStockMovements = useMemo(() => {
    if (!stockMovements || !isClient) return []; 
    
    return stockMovements.filter(movement => {
      const movementDate = new Date(movement.date);
      const isDateMatch = movementDate.getFullYear().toString() === selectedYearForPdf &&
                        movementDate.getMonth().toString() === selectedMonthForPdf;
                        
      return isDateMatch;

    }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}, [stockMovements, selectedYearForPdf, selectedMonthForPdf, isClient]);

  const generateMonthlyPdf = async () => {
    // PDF Generation logic
  };

  const renderProductCombobox = (field: any) => (
    <Popover open={isPopoverOpen} onOpenChange={(isOpen) => {
        setIsPopoverOpen(isOpen);
        if (!isOpen) {
            setSearchQuery("");
        }
    }} modal={true} > 
        <PopoverTrigger asChild>
            <FormControl>
                <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between disabled:opacity-100 disabled:cursor-not-allowed"
                    disabled={products.length === 0}
                >
                    {field.value
                        ? products.find((product) => product.id === field.value)?.name
                        : "Sélectionner un produit"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </FormControl>
        </PopoverTrigger>
        <PopoverContent 
            container={dialogContentRef.current}
            className="w-[--radix-popover-trigger-width] p-0"
        >
            <Command>
                <CommandInput 
                    placeholder="Rechercher un produit ou réf..."
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                />
                <CommandList>
                    <CommandEmpty>Aucun produit trouvé.</CommandEmpty>
                    {Object.entries(groupedProducts).map(([family, familyProducts]) => {
                        const filteredProducts = familyProducts.filter(product =>
                            `${product.name} ${product.references.join(' ')}`
                            .toLowerCase()
                            .includes(searchQuery.toLowerCase())
                        );

                        if (filteredProducts.length === 0) {
                            return null;
                        }

                        return (
                        <CommandGroup 
                            key={family} 
                            heading={family}
                            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-center [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:bg-muted"
                        >
                            {filteredProducts.map((product) => (
                                <CommandItem
                                    key={product.id}
                                    value={`${product.name} ${product.references.join(' ')}`}
                                    onSelect={() => {
                                        form.setValue("productId", product.id);
                                        setIsPopoverOpen(false);
                                        setSearchQuery("");
                                    }}
                                >
                                    <Check
                                        className={`mr-2 h-4 w-4 ${field.value === product.id ? "opacity-100" : "opacity-0"}`}
                                    />
                                    <div>
                                        <div>{product.name} <span className="text-xs text-muted-foreground">(Stock: {product.quantity})</span></div>
                                        <div className="text-xs text-muted-foreground">{product.references.join(', ')}</div>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        );
                    })}
                </CommandList>
            </Command>
        </PopoverContent>
    </Popover>
);


  if (isMobile) {
    return (
      <Card className="shadow-lg">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-primary"/>
                Enregistrer un Mouvement de Stock
            </CardTitle>
            <CardDescription>Enregistrez ici les entrées et sorties de produits.</CardDescription>
          </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" /> Nouveau Mouvement
              </Button>
            </DialogTrigger>
            <DialogContent ref={dialogContentRef} className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Nouveau Mouvement de Stock</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                  <FormField
                    control={form.control}
                    name="productId"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Produit</FormLabel>
                        {renderProductCombobox(field)}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Type de Mouvement</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex space-x-4"
                          >
                            <FormItem className="flex items-center space-x-2">
                              <FormControl><RadioGroupItem value="entry" /></FormControl>
                              <FormLabel className="font-normal">Entrée</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2">
                              <FormControl><RadioGroupItem value="exit" /></FormControl>
                              <FormLabel className="font-normal">Sortie</FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantité</FormLabel>
                        <FormControl><Input type="number" placeholder="0" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes (Optionnel)</FormLabel>
                        <FormControl><Textarea placeholder="Ex: Réception fournisseur, Utilisation interne..." {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                      <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
                    <Button type="submit" disabled={products.length === 0}>Enregistrer Mouvement</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
            <p className="text-sm text-muted-foreground">
              {products.length === 0 ? "Veuillez d'abord ajouter des produits dans l'onglet 'Gestion Produits'." :
              "Enregistrez ici les entrées et sorties de produits pour maintenir votre inventaire à jour."
              }
            </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
        <Card className="shadow-lg">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-primary"/>
                Enregistrer un Mouvement de Stock
            </CardTitle>
            <CardDescription>Enregistrez ici les entrées et sorties de produits.</CardDescription>
          </div>
           <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" /> Nouveau Mouvement
              </Button>
            </DialogTrigger>
            <DialogContent ref={dialogContentRef} className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Nouveau Mouvement de Stock</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                  <FormField
                    control={form.control}
                    name="productId"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Produit</FormLabel>
                        {renderProductCombobox(field)}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>Type de Mouvement</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex space-x-4"
                          >
                            <FormItem className="flex items-center space-x-2">
                              <FormControl><RadioGroupItem value="entry" /></FormControl>
                              <FormLabel className="font-normal">Entrée</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2">
                              <FormControl><RadioGroupItem value="exit" /></FormControl>
                              <FormLabel className="font-normal">Sortie</FormLabel>
                            </FormItem>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantité</FormLabel>
                        <FormControl><Input type="number" placeholder="0" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes (Optionnel)</FormLabel>
                        <FormControl><Textarea placeholder="Ex: Réception fournisseur, Utilisation interne..." {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                     <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
                    <Button type="submit" disabled={products.length === 0}>Enregistrer Mouvement</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
           <p className="text-sm text-muted-foreground">
             {products.length === 0 ? "Veuillez d'abord ajouter des produits dans l'onglet 'Gestion Produits'." :
              "Enregistrez ici les entrées et sorties de produits pour maintenir votre inventaire à jour."
             }
           </p>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Historique des Mouvements</CardTitle>
          <CardDescription>Liste des mouvements de stock enregistrés pour la période sélectionnée.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 items-end mb-4">
            <div>
              <Label htmlFor="year-select-history">Année</Label>
              <Select value={selectedYearForPdf} onValueChange={setSelectedYearForPdf}>
                <SelectTrigger id="year-select-history"><SelectValue placeholder="Année" /></SelectTrigger>
                <SelectContent>{yearsArray.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="month-select-history">Mois</Label>
              <Select value={selectedMonthForPdf} onValueChange={setSelectedMonthForPdf}>
                <SelectTrigger id="month-select-history"><SelectValue placeholder="Mois" /></SelectTrigger>
                <SelectContent>{monthsArray.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={generateMonthlyPdf} disabled={isGeneratingPdf || filteredStockMovements.length === 0} className="w-full sm:w-auto">
                {isGeneratingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Générer PDF
            </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={filteredStockMovements.length === 0}>
                    <Trash2 className="mr-2 h-4 w-4" /> Supprimer l'historique du mois
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer l'historique de {monthsArray.find(m => m.value === selectedMonthForPdf)?.label} {selectedYearForPdf} ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action est irréversible et ne supprimera que les entrées de l'historique pour la période sélectionnée. Les quantités en stock des produits ne seront PAS affectées.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDeleteMonthlyHistory(selectedYearForPdf, selectedMonthForPdf)}>Confirmer</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          </div>

          {selectedMovements.length > 0 && (
              <div className="flex items-center gap-4 mb-4 p-2 bg-muted rounded-md">
                  <p className="text-sm font-medium">{selectedMovements.length} mouvement(s) sélectionné(s)</p>
                  <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Supprimer la sélection
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer les mouvements sélectionnés ?</AlertDialogTitle>
                              <AlertDialogDescription>Cette action est irréversible. Le stock sera recalculé.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDeleteSelected}>Confirmer la suppression</AlertDialogAction>
                          </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
              </div>
          )}

          {filteredStockMovements.length === 0 ? (
             <p className="text-muted-foreground text-center py-8">Aucun mouvement de stock pour {monthsArray.find(m => m.value === selectedMonthForPdf)?.label} {selectedYearForPdf}.</p>
          ) : (
            <div className="overflow-x-auto border rounded-md max-h-[400px]">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                     <TableHead className="w-[50px] text-center">
                          <Checkbox
                              checked={selectedMovements.length === filteredStockMovements.length && filteredStockMovements.length > 0}
                              onCheckedChange={handleSelectAllFiltered}
                              aria-label="Sélectionner tous les mouvements filtrés"
                          />
                      </TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStockMovements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell className="text-center">
                          <Checkbox
                              checked={selectedMovements.includes(movement.id)}
                              onCheckedChange={() => handleSelectMovement(movement.id)}
                              aria-label={`Sélectionner le mouvement pour ${movement.productName}`}
                          />
                      </TableCell>
                      <TableCell>{format(new Date(movement.date), "dd/MM/yyyy HH:mm", { locale: fr })}</TableCell>
                      <TableCell className="font-medium">{movement.productName}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${movement.type === 'entry' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {movement.type === 'entry' ? 'Entrée' : 'Sortie'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{movement.quantity}</TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate max-w-xs">{movement.notes || 'N/A'}</TableCell>
                      <TableCell className="text-center">
                          <AlertDialog>
                              <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                  <AlertDialogHeader>
                                      <AlertDialogTitle>Supprimer ce mouvement ?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                          Produit: {movement.productName} <br/>
                                          Quantité: {movement.quantity} ({movement.type}) <br/>
                                          Date: {format(new Date(movement.date), "dd/MM/yyyy HH:mm")}
                                          <br/><br/>
                                          Cette action est irréversible. Le stock sera recalculé.
                                      </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => onDeleteMovement(movement.id)}>Confirmer</AlertDialogAction>
                                  </AlertDialogFooter>
                              </AlertDialogContent>
                          </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {stockMovements.length > 0 && (
          <CardFooter className="flex justify-end pt-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Supprimer Tout l'Historique (Global)
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Êtes-vous sûr de vouloir supprimer TOUT l'historique des mouvements ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est irréversible et supprimera tous les mouvements de stock enregistrés, toutes périodes confondues.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={onDeleteAllStockMovements}>
                    Supprimer Tout
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
