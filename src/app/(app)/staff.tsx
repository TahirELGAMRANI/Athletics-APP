import { useState } from 'react';

import { Avatar, Badge, Button, Card, Chips, Empty, ErrorBox, Field, ListRow, Loading, Row, Screen, Sheet, Stat } from '@/components/ui';
import { usePermissions } from '@/lib/auth';
import { fetchTeams, money } from '@/lib/db';
import { attempt, confirmAsync, useLoad } from '@/lib/hooks';
import { must, supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';
import type { Team } from '@/lib/types';

type Staff = {
  id: string;
  profile_id: string | null;
  full_name: string;
  role_title: string;
  employment_type: 'employee' | 'volunteer' | 'contractor' | 'intern';
  status: 'active' | 'on_leave' | 'inactive';
  salary: number | null;
  salary_period: string | null;
  email: string | null;
  phone: string | null;
  national_id: string | null;
  address: string | null;
  date_of_birth: string | null;
  start_date: string | null;
  team_id: string | null;
  notes: string | null;
};

export default function StaffScreen() {
  const { isSuper } = usePermissions();
  const [type, setType] = useState('');
  const [editing, setEditing] = useState<Partial<Staff> | null>(null);
  const { data, error, loading, reload } = useLoad(async () => {
    const [s, teams] = await Promise.all([supabase.from('staff').select('*').order('full_name'), fetchTeams()]);
    return { staff: must(s) as Staff[], teams };
  }, []);

  if (!isSuper) return <Screen title="Staff"><ErrorBox message="Only super admins can view staff records." /></Screen>;

  const list = (data?.staff ?? []).filter((s) => !type || s.employment_type === type);
  const active = (data?.staff ?? []).filter((s) => s.status === 'active');
  const payroll = active.filter((s) => s.salary_period !== 'yearly').reduce((sum, s) => sum + Number(s.salary ?? 0), 0);

  return (
    <Screen title="Staff" subtitle="Coaches & staff — HR records" onRefresh={reload} actions={<Button small icon="add" title="Add staff" onPress={() => setEditing({ employment_type: 'employee', status: 'active', salary_period: 'monthly' })} />}>
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      <Row wrap gap={space.md}>
        <Stat label="Active staff" value={active.length} icon="people" />
        <Stat label="Employees" value={active.filter((s) => s.employment_type === 'employee').length} icon="briefcase" tone="info" />
        <Stat label="Volunteers" value={active.filter((s) => s.employment_type === 'volunteer').length} icon="heart" tone="warning" />
        <Stat label="Monthly payroll" value={money(payroll)} icon="cash" tone="brand" />
      </Row>
      <Chips value={type} onChange={setType} options={[{ value: '', label: 'All' }, { value: 'employee', label: 'Employees' }, { value: 'volunteer', label: 'Volunteers' }, { value: 'contractor', label: 'Contractors' }, { value: 'intern', label: 'Interns' }]} />
      {loading && !data ? <Loading /> : null}
      <Card padded={false}>
        {data && list.length === 0 ? <Empty icon="id-card-outline" title="No staff records" /> : null}
        {list.map((s, i) => (
          <ListRow
            key={s.id}
            last={i === list.length - 1}
            left={<Avatar name={s.full_name} />}
            title={s.full_name}
            subtitle={[s.role_title, data?.teams.find((t) => t.id === s.team_id)?.name, s.salary != null ? `${money(Number(s.salary))} / ${s.salary_period ?? 'month'}` : null].filter(Boolean).join(' · ')}
            right={
              <Row gap={6}>
                <Badge text={s.employment_type} tone={s.employment_type === 'volunteer' ? 'warning' : 'brand'} />
                <Badge text={s.status.replace('_', ' ')} tone={s.status === 'active' ? 'success' : s.status === 'on_leave' ? 'warning' : 'neutral'} />
              </Row>
            }
            onPress={() => setEditing(s)}
          />
        ))}
      </Card>
      {editing && data ? <StaffForm staff={editing} teams={data.teams} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} /> : null}
    </Screen>
  );
}

function StaffForm({ staff, teams, onClose, onSaved }: { staff: Partial<Staff>; teams: Team[]; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({
    full_name: staff.full_name ?? '',
    role_title: staff.role_title ?? '',
    employment_type: staff.employment_type ?? 'employee',
    status: staff.status ?? 'active',
    salary: staff.salary != null ? String(staff.salary) : '',
    salary_period: staff.salary_period ?? 'monthly',
    email: staff.email ?? '',
    phone: staff.phone ?? '',
    national_id: staff.national_id ?? '',
    address: staff.address ?? '',
    date_of_birth: staff.date_of_birth ?? '',
    start_date: staff.start_date ?? '',
    team_id: staff.team_id ?? '',
    notes: staff.notes ?? '',
  });
  const set = (k: keyof typeof v) => (t: string) => setV({ ...v, [k]: t });
  const save = () =>
    attempt(async () => {
      if (!v.full_name.trim() || !v.role_title.trim()) throw new Error('Name and role are required');
      for (const d of [v.date_of_birth, v.start_date]) if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error('Dates must be YYYY-MM-DD');
      const row = {
        ...v,
        full_name: v.full_name.trim(),
        salary: v.salary === '' ? null : Number(v.salary),
        date_of_birth: v.date_of_birth || null,
        start_date: v.start_date || null,
        team_id: v.team_id || null,
        email: v.email || null,
        phone: v.phone || null,
        national_id: v.national_id || null,
        address: v.address || null,
        notes: v.notes || null,
      };
      if (staff.id) must(await supabase.from('staff').update(row).eq('id', staff.id));
      else must(await supabase.from('staff').insert(row));
      onSaved();
    });
  const remove = async () => {
    if (!staff.id || !(await confirmAsync('Delete staff record?', staff.full_name))) return;
    await attempt(async () => {
      must(await supabase.from('staff').delete().eq('id', staff.id!));
      onSaved();
    });
  };
  return (
    <Sheet visible title={staff.id ? 'Staff record' : 'New staff member'} onClose={onClose} footer={<Row>{staff.id ? <Button variant="danger" icon="trash-outline" title="Delete" onPress={remove} /> : null}<Button title="Save" icon="checkmark" onPress={save} style={{ flex: 1 }} /></Row>}>
      <Field label="Full name" value={v.full_name} onChangeText={set('full_name')} autoCapitalize="words" />
      <Field label="Role / title" value={v.role_title} onChangeText={set('role_title')} placeholder="e.g. Head Coach, Physiotherapist, Lifeguard" />
      <Chips label="Employment" value={v.employment_type} onChange={set('employment_type')} options={[{ value: 'employee', label: 'Employee' }, { value: 'volunteer', label: 'Volunteer' }, { value: 'contractor', label: 'Contractor' }, { value: 'intern', label: 'Intern' }]} />
      <Chips label="Status" value={v.status} onChange={set('status')} options={[{ value: 'active', label: 'Active' }, { value: 'on_leave', label: 'On leave' }, { value: 'inactive', label: 'Inactive' }]} />
      <Row>
        <Field label="Salary (MAD)" value={v.salary} onChangeText={set('salary')} keyboardType="decimal-pad" style={{ flex: 1 }} />
        <Chips label="Per" value={v.salary_period} onChange={set('salary_period')} scroll={false} options={[{ value: 'monthly', label: 'Month' }, { value: 'yearly', label: 'Year' }, { value: 'session', label: 'Session' }]} />
      </Row>
      <Chips label="Team (optional)" value={v.team_id} onChange={set('team_id')} options={[{ value: '', label: 'None' }, ...teams.map((t) => ({ value: t.id, label: t.name }))]} />
      <Row>
        <Field label="Email" value={v.email} onChangeText={set('email')} keyboardType="email-address" style={{ flex: 1 }} />
        <Field label="Phone" value={v.phone} onChangeText={set('phone')} keyboardType="phone-pad" style={{ flex: 1 }} />
      </Row>
      <Row>
        <Field label="National ID (CIN)" value={v.national_id} onChangeText={set('national_id')} style={{ flex: 1 }} />
        <Field label="Date of birth" value={v.date_of_birth} onChangeText={set('date_of_birth')} placeholder="YYYY-MM-DD" style={{ flex: 1 }} />
      </Row>
      <Row>
        <Field label="Start date" value={v.start_date} onChangeText={set('start_date')} placeholder="YYYY-MM-DD" style={{ flex: 1 }} />
        <Field label="Address" value={v.address} onChangeText={set('address')} style={{ flex: 1 }} />
      </Row>
      <Field label="Notes" value={v.notes} onChangeText={set('notes')} multiline />
    </Sheet>
  );
}
