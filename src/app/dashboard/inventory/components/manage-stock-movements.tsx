
"use client";

import React, { useState } from 'react';
import type { Product, StockMovement } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowRightLeft, PlusCircle } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';


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
}

export default function ManageStockMovements({ products, stockMovements, onAddStockMovement }: ManageStockMovementsProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
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

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Enregistrer un Mouvement de Stock</CardTitle>
           <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Nouveau Mouvement
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Nouveau Mouvement de Stock</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                  <FormField
                    control={form.control}
                    name="productId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Produit</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={products.length === 0}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un produit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {products.length > 0 ? products.map(product => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name} (Réf: {product.reference}) - Stock: {product.quantity}
                              </SelectItem>
                            )) : <SelectItem value="disabled" disabled>Aucun produit disponible</SelectItem>}
                          </SelectContent>
                        </Select>
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
                              <FormControl>
                                <RadioGroupItem value="entry" />
                              </FormControl>
                              <FormLabel className="font-normal">Entrée</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2">
                              <FormControl>
                                <RadioGroupItem value="exit" />
                              </FormControl>
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
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} />
                        </FormControl>
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
                        <FormControl>
                          <Textarea placeholder="Ex: Réception fournisseur, Utilisation interne..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                     <DialogClose asChild>
                        <Button type="button" variant="outline">Annuler</Button>
                     </DialogClose>
                    <Button type="submit" disabled={products.length === 0}>Enregistrer Mouvement</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
           <p className="text-sm text-muted-foreground">Enregistrez ici les entrées (achats, retours) et sorties (utilisations, pertes) de produits pour maintenir votre inventaire à jour.</p>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Historique des Mouvements</CardTitle>
          <CardDescription>Liste des 20 derniers mouvements de stock enregistrés.</CardDescription>
        </CardHeader>
        <CardContent>
          {stockMovements.length === 0 ? (
             <p className="text-muted-foreground text-center py-8">Aucun mouvement de stock enregistré.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockMovements.slice(0, 20).map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell>{format(new Date(movement.date), "dd/MM/yyyy HH:mm", { locale: fr })}</TableCell>
                      <TableCell className="font-medium">{movement.productName}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${movement.type === 'entry' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {movement.type === 'entry' ? 'Entrée' : 'Sortie'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{movement.quantity}</TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate max-w-xs">{movement.notes || 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
