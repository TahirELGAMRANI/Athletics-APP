import { useState } from 'react';

import { attempt } from '@/lib/hooks';
import { must, supabase } from '@/lib/supabase';
import { Button, Field, Row, Sheet } from './ui';

export type Club = { id: string; name: string; category: string | null; description: string | null; president: string | null; contact_email: string | null };

export function ClubForm({ club, onClose, onSaved }: { club?: Club; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ name: club?.name ?? '', category: club?.category ?? '', description: club?.description ?? '', president: club?.president ?? '', contact_email: club?.contact_email ?? '' });
  const save = () =>
    attempt(async () => {
      if (!v.name.trim()) throw new Error('Club name is required');
      const row = { name: v.name.trim(), category: v.category || null, description: v.description || null, president: v.president || null, contact_email: v.contact_email || null };
      if (club) must(await supabase.from('clubs').update(row).eq('id', club.id));
      else must(await supabase.from('clubs').insert(row));
      onSaved();
    });
  return (
    <Sheet visible title={club ? 'Edit club' : 'New club'} onClose={onClose} footer={<Button title="Save" icon="checkmark" onPress={save} />}>
      <Field label="Name" value={v.name} onChangeText={(t) => setV({ ...v, name: t })} />
      <Field label="Category" value={v.category} onChangeText={(t) => setV({ ...v, category: t })} placeholder="e.g. Outdoor, E-sports, Fitness" />
      <Field label="Description" value={v.description} onChangeText={(t) => setV({ ...v, description: t })} multiline />
      <Row>
        <Field label="President" value={v.president} onChangeText={(t) => setV({ ...v, president: t })} style={{ flex: 1 }} />
        <Field label="Contact email" value={v.contact_email} onChangeText={(t) => setV({ ...v, contact_email: t })} keyboardType="email-address" style={{ flex: 1 }} />
      </Row>
    </Sheet>
  );
}
