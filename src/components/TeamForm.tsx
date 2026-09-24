import { useState } from 'react';

import { attempt } from '@/lib/hooks';
import { must, supabase } from '@/lib/supabase';
import type { Team } from '@/lib/types';
import { Button, Chips, Field, Sheet } from './ui';

export function TeamForm({ team, onClose, onSaved }: { team?: Team; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ name: team?.name ?? '', sport: team?.sport ?? '', gender: team?.gender ?? 'mixed', description: team?.description ?? '' });
  const save = () =>
    attempt(async () => {
      if (!v.name.trim() || !v.sport.trim()) throw new Error('Name and sport are required');
      const row = { ...v, name: v.name.trim(), sport: v.sport.trim(), description: v.description || null };
      if (team) must(await supabase.from('teams').update(row).eq('id', team.id));
      else must(await supabase.from('teams').insert(row));
      onSaved();
    });
  return (
    <Sheet visible title={team ? 'Edit team' : 'New team'} onClose={onClose} footer={<Button title="Save" icon="checkmark" onPress={save} />}>
      <Field label="Team name" value={v.name} onChangeText={(t) => setV({ ...v, name: t })} placeholder="e.g. Women's Handball" />
      <Field label="Sport" value={v.sport} onChangeText={(t) => setV({ ...v, sport: t })} placeholder="e.g. Handball" />
      <Chips label="Category" value={v.gender} onChange={(g) => setV({ ...v, gender: g })} options={[{ value: 'women', label: 'Women' }, { value: 'men', label: 'Men' }, { value: 'mixed', label: 'Mixed' }]} />
      <Field label="Description" value={v.description} onChangeText={(t) => setV({ ...v, description: t })} multiline />
    </Sheet>
  );
}
