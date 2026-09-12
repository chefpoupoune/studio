"use client";

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { firestore } from '@/lib/firebase';
import { BrigadeMember } from '../time-tracking/types';

const absenceSchema = z.object({
  userId: z.string().nonempty("L'employé est requis"),
  startDate: z.string().nonempty("La date de début est requise"),
  endDate: z.string().nonempty("La date de fin est requise"),
  reason: z.string().nonempty("Le motif est requis"),
});

interface AbsenceFormProps {
  onAbsenceAdded: () => void;
}

const AbsenceForm: React.FC<AbsenceFormProps> = ({ onAbsenceAdded }) => {
  const [brigadeMembers, setBrigadeMembers] = useState<BrigadeMember[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof absenceSchema>>({
    resolver: zodResolver(absenceSchema),
    defaultValues: {
      userId: '',
      startDate: '',
      endDate: '',
      reason: '',
    },
  });

  useEffect(() => {
    const fetchBrigadeMembers = async () => {
      const membersCollectionRef = collection(firestore, 'brigadeMembers');
      const q = query(membersCollectionRef, orderBy("name"));
      const querySnapshot = await getDocs(q);
      const membersList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BrigadeMember));
      setBrigadeMembers(membersList);
    };

    fetchBrigadeMembers();
  }, []);

  const onSubmit = async (values: z.infer<typeof absenceSchema>) => {
    setIsSubmitting(true);
    try {
      const selectedMember = brigadeMembers.find(m => m.id === values.userId);
      if (!selectedMember) {
        console.error("Selected member not found");
        return;
      }

      await addDoc(collection(firestore, 'requests'), {
        userId: values.userId,
        userName: selectedMember.name,
        userImage: selectedMember.image || '',
        startDate: new Date(values.startDate),
        endDate: new Date(values.endDate),
        reason: values.reason,
        type: 'absence',
        status: 'approved', // Absences added by the chef are auto-approved
        createdAt: new Date(),
      });
      onAbsenceAdded();
    } catch (error) {
      console.error("Error adding absence request: ", error);
    }
    setIsSubmitting(false);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="userId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Employé</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez un employé" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {brigadeMembers.map(member => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="startDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date de début</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="endDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date de fin</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Motif</FormLabel>
              <FormControl>
                <Input placeholder="ex: Congés payés" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Ajout en cours...' : 'Ajouter l\'absence'}
        </Button>
      </form>
    </Form>
  );
};

export default AbsenceForm;