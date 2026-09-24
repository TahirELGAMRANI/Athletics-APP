import { useState } from 'react';
import { View } from 'react-native';

import { Badge, Button, Card, Chips, Empty, ErrorBox, Field, Icon, ListRow, Loading, Row, Screen, SectionTitle, Sheet, Stat, Txt } from '@/components/ui';
import { usePermissions } from '@/lib/auth';
import { money } from '@/lib/db';
import { attempt, confirmAsync, useLoad } from '@/lib/hooks';
import { must, supabase } from '@/lib/supabase';
import { campusNow, fmtDate } from '@/lib/time';
import { colors, space } from '@/lib/theme';

type Txn = { id: string; txn_date: string; txn_type: 'income' | 'expense'; category: string; amount: number; description: string | null; team_id: string | null; club_id: string | null; method: string | null; reference: string | null };

const CATEGORIES = ['Equipment', 'Travel', 'Referees', 'Tournament fees', 'Salaries', 'Medical', 'Maintenance', 'Sponsorship', 'Membership fees', 'Rental income', 'Other'];

export default function FinanceScreen() {
  const { isSuper } = usePermissions();
  const [period, setPeriod] = useState('month');
  const [type, setType] = useState('');
  const [editing, setEditing] = useState<Partial<Txn> | null>(null);

  const { data, error, loading, reload } = useLoad(async () => {
    const [t, teams, clubs] = await Promise.all([
      supabase.from('transactions').select('*').order('txn_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('teams').select('id,name').order('name'),
      supabase.from('clubs').select('id,name').order('name'),
    ]);
    return { txns: must(t) as Txn[], teams: (teams.data ?? []) as { id: string; name: string }[], clubs: (clubs.data ?? []) as { id: string; name: string }[] };
  }, []);

  if (!isSuper) return <Screen title="Transactions"><ErrorBox message="Only super admins can manage transactions." /></Screen>;

  const today = campusNow().date;
  const from = period === 'month' ? today.slice(0, 7) + '-01' : period === 'year' ? today.slice(0, 4) + '-01-01' : '0000-01-01';
  const list = (data?.txns ?? []).filter((t) => t.txn_date >= from && (!type || t.txn_type === type));
  const income = list.filter((t) => t.txn_type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const expense = list.filter((t) => t.txn_type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const byCat: Record<string, number> = {};
  list.filter((t) => t.txn_type === 'expense').forEach((t) => (byCat[t.category] = (byCat[t.category] ?? 0) + Number(t.amount)));
  const topCats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const label = (t: Txn) => data?.teams.find((x) => x.id === t.team_id)?.name ?? data?.clubs.find((x) => x.id === t.club_id)?.name;

  return (
    <Screen title="Transactions" subtitle="Every income and expense, with full history" onRefresh={reload} actions={<Button small icon="add" title="New entry" onPress={() => setEditing({ txn_type: 'expense', txn_date: today, category: 'Equipment' })} />}>
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      <Chips value={period} onChange={setPeriod} options={[{ value: 'month', label: 'This month' }, { value: 'year', label: 'This year' }, { value: 'all', label: 'All time' }]} />
      <Row wrap gap={space.md}>
        <Stat label="Income" value={money(income)} icon="arrow-down-circle" tone="success" />
        <Stat label="Expenses" value={money(expense)} icon="arrow-up-circle" tone="danger" />
        <Stat label="Net" value={money(income - expense)} icon="wallet" tone={income - expense >= 0 ? 'brand' : 'danger'} />
      </Row>
      {topCats.length ? (
        <Card style={{ gap: 10 }}>
          <Txt v="h3">Top expense categories</Txt>
          {topCats.map(([c, v]) => (
            <View key={c} style={{ gap: 4 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt v="small">{c}</Txt>
                <Txt v="small" style={{ fontWeight: '700' }}>{money(v)}</Txt>
              </Row>
              <View style={{ height: 8, backgroundColor: colors.brandSoft, borderRadius: 4 }}>
                <View style={{ width: `${(v / (topCats[0][1] || 1)) * 100}%`, height: 8, backgroundColor: colors.brand, borderRadius: 4 }} />
              </View>
            </View>
          ))}
        </Card>
      ) : null}
      <SectionTitle title="History" subtitle={`${list.length} entries`} />
      <Chips value={type} onChange={setType} options={[{ value: '', label: 'All' }, { value: 'income', label: 'Income' }, { value: 'expense', label: 'Expenses' }]} />
      {loading && !data ? <Loading /> : null}
      <Card padded={false}>
        {data && list.length === 0 ? <Empty icon="receipt-outline" title="No transactions in this period" /> : null}
        {list.map((t, i) => (
          <ListRow
            key={t.id}
            last={i === list.length - 1}
            left={<Icon name={t.txn_type === 'income' ? 'arrow-down-circle' : 'arrow-up-circle'} size={26} color={t.txn_type === 'income' ? colors.success : colors.danger} />}
            title={t.description || t.category}
            subtitle={[fmtDate(t.txn_date), t.category, label(t), t.method, t.reference].filter(Boolean).join(' · ')}
            right={<Txt v="h3" color={t.txn_type === 'income' ? colors.success : colors.danger}>{t.txn_type === 'income' ? '+' : '−'}{money(Number(t.amount))}</Txt>}
            onPress={() => setEditing(t)}
          />
        ))}
      </Card>
      {editing && data ? <TxnForm txn={editing} teams={data.teams} clubs={data.clubs} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} /> : null}
    </Screen>
  );
}

function TxnForm({ txn, teams, clubs, onClose, onSaved }: { txn: Partial<Txn>; teams: { id: string; name: string }[]; clubs: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({
    txn_type: txn.txn_type ?? 'expense',
    txn_date: txn.txn_date ?? campusNow().date,
    category: txn.category ?? 'Equipment',
    amount: txn.amount != null ? String(txn.amount) : '',
    description: txn.description ?? '',
    link: txn.team_id ? `t:${txn.team_id}` : txn.club_id ? `c:${txn.club_id}` : '',
    method: txn.method ?? 'Bank transfer',
    reference: txn.reference ?? '',
  });
  const set = (k: keyof typeof v) => (x: string) => setV({ ...v, [k]: x });
  const save = () =>
    attempt(async () => {
      const amount = Number(v.amount.replace(',', '.'));
      if (!amount || amount < 0) throw new Error('Enter a positive amount');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v.txn_date)) throw new Error('Date must be YYYY-MM-DD');
      const { data: u } = await supabase.auth.getUser();
      const row = {
        txn_type: v.txn_type,
        txn_date: v.txn_date,
        category: v.category,
        amount,
        description: v.description || null,
        team_id: v.link.startsWith('t:') ? v.link.slice(2) : null,
        club_id: v.link.startsWith('c:') ? v.link.slice(2) : null,
        method: v.method || null,
        reference: v.reference || null,
      };
      if (txn.id) must(await supabase.from('transactions').update(row).eq('id', txn.id));
      else must(await supabase.from('transactions').insert({ ...row, created_by: u.user?.id }));
      onSaved();
    });
  const remove = async () => {
    if (!txn.id || !(await confirmAsync('Delete this transaction?'))) return;
    await attempt(async () => {
      must(await supabase.from('transactions').delete().eq('id', txn.id!));
      onSaved();
    });
  };
  return (
    <Sheet visible title={txn.id ? 'Edit transaction' : 'New transaction'} onClose={onClose} footer={<Row>{txn.id ? <Button variant="danger" icon="trash-outline" title="Delete" onPress={remove} /> : null}<Button title="Save" icon="checkmark" onPress={save} style={{ flex: 1 }} /></Row>}>
      <Chips value={v.txn_type} onChange={set('txn_type')} options={[{ value: 'expense', label: 'Expense', icon: 'arrow-up-circle-outline' }, { value: 'income', label: 'Income', icon: 'arrow-down-circle-outline' }]} />
      <Row>
        <Field label="Amount (MAD)" value={v.amount} onChangeText={set('amount')} keyboardType="decimal-pad" style={{ flex: 1 }} />
        <Field label="Date" value={v.txn_date} onChangeText={set('txn_date')} placeholder="YYYY-MM-DD" style={{ flex: 1 }} />
      </Row>
      <Chips label="Category" value={v.category} onChange={set('category')} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
      <Field label="Description" value={v.description} onChangeText={set('description')} placeholder="e.g. 12 volleyballs for women's team" />
      <Chips label="Linked to" value={v.link} onChange={set('link')} options={[{ value: '', label: 'General' }, ...teams.map((t) => ({ value: `t:${t.id}`, label: t.name })), ...clubs.map((c) => ({ value: `c:${c.id}`, label: c.name }))]} />
      <Row>
        <Field label="Method" value={v.method} onChangeText={set('method')} style={{ flex: 1 }} />
        <Field label="Reference / invoice #" value={v.reference} onChangeText={set('reference')} style={{ flex: 1 }} />
      </Row>
      <Badge text="Entries are kept in the history for reporting" tone="info" icon="information-circle" />
    </Sheet>
  );
}
