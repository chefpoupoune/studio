'use client';

import { useState, useEffect } from 'react';
import EffectifForm from '../components/EffectifForm';
import { getEffectifsForMonth } from '../services';
import { Effectif } from '../types';

export default function AddEffectifPage() {
  const [effectifs, setEffectifs] = useState<Effectif[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const fetchEffectifs = async () => {
    const data = await getEffectifsForMonth(selectedDate);
    setEffectifs(data);
  };

  useEffect(() => {
    fetchEffectifs();
  }, [selectedDate]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Saisie des Effectifs</h1>
      <EffectifForm onSave={fetchEffectifs} effectifs={effectifs} selectedDate={selectedDate} />
    </div>
  );
}
