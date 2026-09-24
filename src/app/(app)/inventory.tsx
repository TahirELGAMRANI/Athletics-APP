import { useState } from 'react';
import { View } from 'react-native';

import { Badge, Button, Card, Chips, Empty, ErrorBox, Field, IconButton, ListRow, Loading, Row, Screen, Sheet, Stat, Txt } from '@/components/ui';
import { usePermissions } from '@/lib/auth';
import { attempt, confirmAsync, useLoad } from '@/lib/hooks';
import { must, supabase } from '@/lib/supabase';
import { fmtDate } from '@/lib/time';
import { colors, space } from '@/lib/theme';

type Item = { id: string; name: string; category: string; quantity: number; min_quantity: number; location: string | null; notes: string | null; updated_at: string };

function stockTone(i: Item) {
  if (i.quantity === 0) return { text: 'Out of stock', tone: 'danger' as const };
  if (i.quantity <= i.min_quantity) return { text: 'Low stock', tone: 'warning' as const };
  return { text: 'In stock', tone: 'success' as const };
}

export default function InventoryScreen() {
  const { isSuper, isAdmin } = usePermissions();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [editing, setEditing] = useState<Partial<Item> | null>(null);
  const [adjust, setAdjust] = useState<Item | null>(null);
  const [history, setHistory] = useState<Item | null>(null);

  const { data, error, loading, reload } = useLoad(async () => must(await supabase.from('inventory_items').select('*').order('category').order('name')) as Item[], []);

  if (!isSuper && !isAdmin) return <Screen title="Inventory"><ErrorBox message="Inventory is available to the athletics staff only." /></Screen>;

  const cats = Array.from(new Set((data ?? []).map((i) => i.category)));
  const list = (data ?? []).filter((i) => (!cat || i.category === cat) && (!q || i.name.toLowerCase().includes(q.toLowerCase())));
  const out = (data ?? []).filter((i) => i.quantity === 0).length;
  const low = (data ?? []).filter((i) => i.quantity > 0 && i.quantity <= i.min_quantity).length;

  return (
    <Screen
      title="Inventory"
      subtitle={isSuper ? 'Add, update and track equipment stock' : 'Stock availability'}
      onRefresh={reload}
      actions={isSuper ? <Button small icon="add" title="Add item" onPress={() => setEditing({ category: cat || 'General', quantity: 0, min_quantity: 0 })} /> : null}>
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      <Row wrap gap={space.md}>
        <Stat label="Items" value={data?.length ?? 0} icon="cube" />
        <Stat label="Units in stock" value={(data ?? []).reduce((s, i) => s + i.quantity, 0)} icon="layers" tone="info" />
        <Stat label="Low stock" value={low} icon="alert-circle" tone="warning" />
        <Stat label="Out of stock" value={out} icon="close-circle" tone="danger" />
      </Row>
      <Field value={q} onChangeText={setQ} placeholder="Search equipment…" />
      {cats.length > 1 ? <Chips value={cat} onChange={setCat} options={[{ value: '', label: 'All' }, ...cats.map((c) => ({ value: c, label: c }))]} /> : null}
      {loading && !data ? <Loading /> : null}
      <Card padded={false}>
        {data && list.length === 0 ? <Empty icon="cube-outline" title={data.length ? 'No matching items' : 'Inventory is empty'} subtitle={isSuper && !data.length ? 'Add balls, nets, bibs, bikes, first-aid kits…' : undefined} /> : null}
        {list.map((i, idx) => {
          const st = stockTone(i);
          return (
            <ListRow
              key={i.id}
              last={idx === list.length - 1}
              title={i.name}
              subtitle={[i.category, i.location, `min ${i.min_quantity}`].filter(Boolean).join(' · ')}
              onPress={() => setHistory(i)}
              right={
                <Row gap={8}>
                  <Badge text={st.text} tone={st.tone} />
                  <View style={{ minWidth: 44, alignItems: 'flex-end' }}>
                    <Txt v="h2" color={i.quantity === 0 ? colors.danger : colors.text}>{i.quantity}</Txt>
                  </View>
                  {isSuper ? (
                    <>
                      <IconButton icon="swap-vertical" size={16} onPress={() => setAdjust(i)} />
                      <IconButton icon="create-outline" size={16} onPress={() => setEditing(i)} />
                    </>
                  ) : null}
                </Row>
              }
            />
          );
        })}
      </Card>
      {editing ? <ItemForm item={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} /> : null}
      {adjust ? <AdjustSheet item={adjust} onClose={() => setAdjust(null)} onSaved={() => { setAdjust(null); reload(); }} /> : null}
      {history ? <History item={history} onClose={() => setHistory(null)} /> : null}
    </Screen>
  );
}

function ItemForm({ item, onClose, onSaved }: { item: Partial<Item>; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({
    name: item.name ?? '',
    category: item.category ?? 'General',
    quantity: String(item.quantity ?? 0),
    min_quantity: String(item.min_quantity ?? 0),
    location: item.location ?? '',
    notes: item.notes ?? '',
  });
  const save = () =>
    attempt(async () => {
      if (!v.name.trim()) throw new Error('Name is required');
      const row = { name: v.name.trim(), category: v.category.trim() || 'General', quantity: Math.max(0, parseInt(v.quantity || '0', 10)), min_quantity: Math.max(0, parseInt(v.min_quantity || '0', 10)), location: v.location || null, notes: v.notes || null };
      if (item.id) must(await supabase.from('inventory_items').update(row).eq('id', item.id));
      else {
        const created = must(await supabase.from('inventory_items').insert(row).select('id').single()) as { id: string };
        const { data: u } = await supabase.auth.getUser();
        await supabase.from('inventory_movements').insert({ item_id: created.id, change: row.quantity, reason: 'Initial stock', user_id: u.user?.id });
      }
      onSaved();
    });
  const remove = async () => {
    if (!item.id || !(await confirmAsync('Delete item?', item.name))) return;
    await attempt(async () => {
      must(await supabase.from('inventory_items').delete().eq('id', item.id!));
      onSaved();
    });
  };
  return (
    <Sheet
      visible
      title={item.id ? 'Edit item' : 'New item'}
      onClose={onClose}
      footer={
        <Row>
          {item.id ? <Button variant="danger" icon="trash-outline" title="Delete" onPress={remove} /> : null}
          <Button title="Save" icon="checkmark" onPress={save} style={{ flex: 1 }} />
        </Row>
      }>
      <Field label="Item name" value={v.name} onChangeText={(t) => setV({ ...v, name: t })} placeholder="e.g. Volleyball (Mikasa V200W)" />
      <Field label="Category" value={v.category} onChangeText={(t) => setV({ ...v, category: t })} placeholder="Balls, Nets, Apparel, Medical…" />
      <Row>
        <Field label="Quantity" value={v.quantity} onChangeText={(t) => setV({ ...v, quantity: t })} keyboardType="numeric" style={{ flex: 1 }} />
        <Field label="Low-stock alert at" value={v.min_quantity} onChangeText={(t) => setV({ ...v, min_quantity: t })} keyboardType="numeric" style={{ flex: 1 }} />
      </Row>
      <Field label="Location" value={v.location} onChangeText={(t) => setV({ ...v, location: t })} placeholder="e.g. Gym storage room" />
      <Field label="Notes" value={v.notes} onChangeText={(t) => setV({ ...v, notes: t })} multiline />
    </Sheet>
  );
}

function AdjustSheet({ item, onClose, onSaved }: { item: Item; onClose: () => void; onSaved: () => void }) {
  const [n, setN] = useState('1');
  const [reason, setReason] = useState('');
  const apply = (sign: 1 | -1) =>
    attempt(async () => {
      const qty = parseInt(n || '0', 10);
      if (!qty || qty < 0) throw new Error('Enter a positive number');
      const next = item.quantity + sign * qty;
      if (next < 0) throw new Error(`Only ${item.quantity} in stock`);
      // Update quantity; the database trigger logs the movement automatically.
      must(await supabase.from('inventory_items').update({ quantity: next }).eq('id', item.id));
      if (reason) {
        const { data: last } = await supabase.from('inventory_movements').select('id').eq('item_id', item.id).order('created_at', { ascending: false }).limit(1);
        if (last?.[0]) await supabase.from('inventory_movements').update({ reason }).eq('id', last[0].id);
      }
      onSaved();
    });
  return (
    <Sheet visible title={`Adjust — ${item.name}`} onClose={onClose}>
      <Txt color={colors.muted}>Currently {item.quantity} in stock.</Txt>
      <Field label="Number of units" value={n} onChangeText={setN} keyboardType="numeric" />
      <Field label="Reason" value={reason} onChangeText={setReason} placeholder="e.g. Issued to Women's Volleyball, broken, new delivery" />
      <Row>
        <Button variant="danger" icon="remove-circle-outline" title="Take out" onPress={() => apply(-1)} style={{ flex: 1 }} />
        <Button icon="add-circle-outline" title="Add to stock" onPress={() => apply(1)} style={{ flex: 1 }} />
      </Row>
    </Sheet>
  );
}

function History({ item, onClose }: { item: Item; onClose: () => void }) {
  const { data } = useLoad(async () => must(await supabase.from('inventory_movements').select('*, profiles(full_name)').eq('item_id', item.id).order('created_at', { ascending: false }).limit(50)) as { id: string; change: number; reason: string | null; created_at: string; profiles: { full_name: string } | null }[], [item.id]);
  return (
    <Sheet visible title={item.name} onClose={onClose}>
      <Txt color={colors.muted}>{[item.category, item.location].filter(Boolean).join(' · ')}{item.notes ? `\n${item.notes}` : ''}</Txt>
      <Txt v="h3">Stock history</Txt>
      {!data ? <Loading /> : data.length === 0 ? <Txt color={colors.muted}>No movements yet.</Txt> : null}
      {(data ?? []).map((m) => (
        <Row key={m.id} style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Txt v="small">{m.reason ?? 'Update'}</Txt>
            <Txt v="caption" color={colors.muted}>{fmtDate(m.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}{m.profiles ? ` · ${m.profiles.full_name}` : ''}</Txt>
          </View>
          <Badge text={`${m.change > 0 ? '+' : ''}${m.change}`} tone={m.change >= 0 ? 'success' : 'danger'} />
        </Row>
      ))}
    </Sheet>
  );
}
