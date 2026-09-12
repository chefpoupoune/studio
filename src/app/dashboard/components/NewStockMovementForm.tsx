'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Product, StockMovement, ProductFamily } from '@/app/dashboard/inventory/types';
import { PRODUCT_FAMILIES } from '@/app/dashboard/inventory/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from '@/hooks/use-toast';

const stockMovementSchema = z.object({
  productId: z.string().min(1, "Veuillez sélectionner un produit."),
  type: z.enum(['entry', 'exit'], { required_error: "Veuillez sélectionner un type de mouvement." }),
  quantity: z.coerce.number().min(1, "La quantité doit être d'au moins 1."),
  notes: z.string().optional(),
});

type StockMovementFormData = z.infer<typeof stockMovementSchema>;

interface NewStockMovementFormProps {
  products: Product[];
  onAddStockMovement: (movement: Omit<StockMovement, 'id' | 'date' | 'productName'>) => void;
  onFormSubmit: () => void;
}

export default function NewStockMovementForm({ products, onAddStockMovement, onFormSubmit }: NewStockMovementFormProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const dialogContentRef = useRef<HTMLDivElement>(null);

  const form = useForm<StockMovementFormData>({
    resolver: zodResolver(stockMovementSchema),
    defaultValues: {
      productId: '',
      type: 'exit',
      quantity: 1,
      notes: '',
    },
  });

  const onSubmit = (data: StockMovementFormData) => {
    onAddStockMovement(data);
    form.reset();
    onFormSubmit();
    toast({ title: "Mouvement de Stock Enregistré", description: "Le stock a été mis à jour." });
    window.dispatchEvent(new CustomEvent('stockUpdated'));
  };

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

  const renderProductCombobox = (field: any) => (
    <Popover open={isPopoverOpen} onOpenChange={(isOpen) => {
        setIsPopoverOpen(isOpen);
        if (!isOpen) setSearchQuery("");
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
                        if (filteredProducts.length === 0) return null;
                        return (
                        <CommandGroup key={family} heading={family}>
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
                                    <Check className={`mr-2 h-4 w-4 ${field.value === product.id ? "opacity-100" : "opacity-0"}`} />
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


  return (
    <div ref={dialogContentRef}>
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
                              <FormControl><RadioGroupItem value="exit" /></FormControl>
                              <FormLabel className="font-normal">Sortie</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2">
                              <FormControl><RadioGroupItem value="entry" /></FormControl>
                              <FormLabel className="font-normal">Entrée</FormLabel>
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
                        <FormControl><Textarea placeholder="Ex: Utilisation interne, Perte, etc." {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline">Annuler</Button></DialogClose>
                    <Button type="submit" disabled={products.length === 0}>
                        Valider le Mouvement
                    </Button>
                </DialogFooter>
            </form>
        </Form>
    </div>
  );
}
