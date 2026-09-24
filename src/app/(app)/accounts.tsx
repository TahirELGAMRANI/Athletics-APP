import { useState } from 'react';

import { Avatar, Badge, Button, Card, Chips, Empty, ErrorBox, Field, ListRow, Loading, Row, Screen, Sheet, Txt } from '@/components/ui';
import { usePermissions } from '@/lib/auth';
import { fetchTeams } from '@/lib/db';
import { attempt, useLoad } from '@/lib/hooks';
import { must, supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { ROLE_LABEL, type Player, type Profile, type Role } from '@/lib/types';

const ROLES: Role[] = ['super_admin', 'admin', 'coach', 'player', 'student'];

function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `${s}!`;
}

export default function AccountsScreen() {
  const { isSuper } = usePermissions();
  const [role, setRole] = useState<Role | ''>('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const { data, error, loading, reload } = useLoad(async () => {
    const [p, teams, players] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      fetchTeams(),
      supabase.from('players').select('*').order('full_name'),
    ]);
    return { profiles: must(p) as Profile[], teams, players: (players.data ?? []) as Player[] };
  }, []);

  if (!isSuper) return <Screen title="Accounts"><ErrorBox message="Only super admins can manage accounts." /></Screen>;

  const list = (data?.profiles ?? []).filter((p) => !role || p.role === role);
  return (
    <Screen title="Accounts" subtitle="Create accounts for players, coaches and staff" onRefresh={reload} actions={<Button small icon="person-add" title="Create account" onPress={() => setCreating(true)} />}>
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      <Chips value={role} onChange={setRole} options={[{ value: '', label: 'Everyone' }, ...ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))]} />
      {loading && !data ? <Loading /> : null}
      <Card padded={false}>
        {data && list.length === 0 ? <Empty icon="people-outline" title="No accounts" /> : null}
        {list.map((p, i) => {
          const linked = data?.players.find((pl) => pl.profile_id === p.id);
          return (
            <ListRow
              key={p.id}
              last={i === list.length - 1}
              left={<Avatar name={p.full_name || p.email} tone={p.role === 'super_admin' ? 'brand' : 'light'} />}
              title={p.full_name || p.email}
              subtitle={[p.email, p.title, linked ? `Roster: ${data?.teams.find((t) => t.id === linked.team_id)?.name}` : null].filter(Boolean).join(' · ')}
              right={<Badge text={ROLE_LABEL[p.role]} tone={p.role === 'super_admin' ? 'brand' : p.role === 'coach' ? 'info' : p.role === 'player' ? 'success' : p.role === 'admin' ? 'warning' : 'neutral'} />}
              onPress={() => setEditing(p)}
            />
          );
        })}
      </Card>
      {creating && data ? <CreateAccount teams={data.teams} players={data.players} onClose={() => setCreating(false)} onDone={() => { setCreating(false); reload(); }} /> : null}
      {editing && data ? <EditAccount profile={editing} teams={data.teams} players={data.players} onClose={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} /> : null}
    </Screen>
  );
}

function CreateAccount({ teams, players, onClose, onDone }: { teams: { id: string; name: string }[]; players: Player[]; onClose: () => void; onDone: () => void }) {
  const [v, setV] = useState({ full_name: '', email: '', role: 'player' as Role, title: '', password: genPassword(), team_id: '', player_id: '' });
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const unlinked = players.filter((p) => !p.profile_id && (!v.team_id || p.team_id === v.team_id));

  const submit = () =>
    attempt(async () => {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: { ...v, email: v.email.trim().toLowerCase(), full_name: v.full_name.trim(), team_id: v.team_id || null, player_id: v.player_id || null },
      });
      if (error) {
        let msg = error.message;
        try {
          const ctx = (error as unknown as { context?: Response }).context;
          if (ctx) msg = (await ctx.json()).error ?? msg;
        } catch {
          // keep generic message
        }
        throw new Error(msg);
      }
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setCreated({ email: v.email.trim().toLowerCase(), password: v.password });
    });

  if (created) {
    return (
      <Sheet visible title="Account created" onClose={onDone} footer={<Button title="Done" onPress={onDone} />}>
        <Txt>Share these credentials with the account owner. They can change the password from their Profile.</Txt>
        <Card style={{ backgroundColor: colors.brandTint, gap: 4 }}>
          <Txt selectable>Email: {created.email}</Txt>
          <Txt selectable>Password: {created.password}</Txt>
        </Card>
      </Sheet>
    );
  }

  return (
    <Sheet visible title="Create account" onClose={onClose} footer={<Button title="Create account" icon="person-add" onPress={submit} disabled={!v.full_name || !v.email} />}>
      <Chips label="Role" value={v.role} onChange={(r) => setV({ ...v, role: r })} options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
      <Field label="Full name" value={v.full_name} onChangeText={(t) => setV({ ...v, full_name: t })} autoCapitalize="words" />
      <Field label="Email" value={v.email} onChangeText={(t) => setV({ ...v, email: t })} keyboardType="email-address" placeholder="name@aui.ma" />
      {v.role !== 'player' && v.role !== 'student' ? <Field label="Title" value={v.title} onChangeText={(t) => setV({ ...v, title: t })} placeholder="e.g. Head Coach — Men's Basketball" /> : null}
      <Field label="Temporary password" value={v.password} onChangeText={(t) => setV({ ...v, password: t })} hint="At least 8 characters" />
      {v.role === 'coach' || v.role === 'player' ? (
        <Chips label={v.role === 'coach' ? 'Team to coach' : 'Team'} value={v.team_id} onChange={(t) => setV({ ...v, team_id: t, player_id: '' })} options={[{ value: '', label: 'None' }, ...teams.map((t) => ({ value: t.id, label: t.name }))]} />
      ) : null}
      {v.role === 'player' ? (
        unlinked.length ? (
          <Chips label="Link to roster entry" value={v.player_id} onChange={(p) => setV({ ...v, player_id: p, full_name: v.full_name || players.find((x) => x.id === p)?.full_name || '' })} options={[{ value: '', label: 'Not now' }, ...unlinked.map((p) => ({ value: p.id, label: p.full_name }))]} />
        ) : (
          <Txt v="caption" color={colors.muted}>{v.team_id ? 'All players of this team already have accounts.' : 'Pick a team to link the account to a roster entry.'}</Txt>
        )
      ) : null}
    </Sheet>
  );
}

function EditAccount({ profile, teams, players, onClose, onDone }: { profile: Profile; teams: { id: string; name: string }[]; players: Player[]; onClose: () => void; onDone: () => void }) {
  const [role, setRole] = useState<Role>(profile.role);
  const [name, setName] = useState(profile.full_name);
  const [title, setTitle] = useState(profile.title ?? '');
  const [link, setLink] = useState(players.find((p) => p.profile_id === profile.id)?.id ?? '');
  const save = () =>
    attempt(async () => {
      must(await supabase.from('profiles').update({ role, full_name: name, title: title || null }).eq('id', profile.id));
      const current = players.find((p) => p.profile_id === profile.id);
      if (current && current.id !== link) must(await supabase.from('players').update({ profile_id: null }).eq('id', current.id));
      if (link && current?.id !== link) must(await supabase.from('players').update({ profile_id: profile.id, email: profile.email }).eq('id', link));
      onDone();
    });
  const options = players.filter((p) => !p.profile_id || p.profile_id === profile.id);
  return (
    <Sheet visible title={profile.email} onClose={onClose} footer={<Button title="Save" icon="checkmark" onPress={save} />}>
      <Field label="Full name" value={name} onChangeText={setName} />
      <Field label="Title" value={title} onChangeText={setTitle} />
      <Chips label="Role" value={role} onChange={setRole} options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))} />
      {role === 'player' ? (
        <Chips
          label="Linked roster entry"
          value={link}
          onChange={setLink}
          options={[{ value: '', label: 'None' }, ...options.map((p) => ({ value: p.id, label: `${p.full_name} (${teams.find((t) => t.id === p.team_id)?.name ?? ''})` }))]}
        />
      ) : null}
      <Row>
        <Badge text="Coach team assignments are managed on each team page" tone="info" icon="information-circle" />
      </Row>
    </Sheet>
  );
}
