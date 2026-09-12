'use client';

import { useState, useEffect } from 'react';
import { firestore } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export default function ChefChecklist() {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [newItemText, setNewItemText] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(firestore, 'chefChecklist'), (snapshot) => {
      const checklistItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as ChecklistItem[];
      setItems(checklistItems);
    });
    return unsubscribe;
  }, []);

  const handleAddItem = async () => {
    if (newItemText.trim() === '') return;
    await addDoc(collection(firestore, 'chefChecklist'), {
      text: newItemText,
      completed: false,
    });
    setNewItemText('');
  };

  const handleToggleItem = async (id: string, completed: boolean) => {
    const itemRef = doc(firestore, 'chefChecklist', id);
    await updateDoc(itemRef, { completed: !completed });
  };

  const handleDeleteItem = async (id: string) => {
    await deleteDoc(doc(firestore, 'chefChecklist', id));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Checklist du Chef</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex space-x-2 mb-4">
          <Input
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            placeholder="Nouvel élément..."
          />
          <Button onClick={handleAddItem}>Ajouter</Button>
        </div>
        <ScrollArea className="h-40">
          <ul>
            {items.map((item) => (
              <li key={item.id} className="flex items-center space-x-2 mb-2">
                <Checkbox
                  checked={item.completed}
                  onCheckedChange={() => handleToggleItem(item.id, item.completed)}
                />
                <span className={`flex-grow ${item.completed ? 'line-through' : ''}`}>
                  {item.text}
                </span>
                <Button variant="ghost" size="sm" onClick={() => handleDeleteItem(item.id)}>
                  X
                </Button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
