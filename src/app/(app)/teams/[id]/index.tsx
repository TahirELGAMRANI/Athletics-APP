import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { PlayerForm } from '@/components/Portfolio';
import { GameCard } from '@/components/shared';
import { Avatar, Badge, Button, Card, Chips, Empty, ErrorBox, Field, Grid, IconButton, ListRow, Loading, Row, Screen, SectionTitle, Sheet, Stat, Table, Toggle, Txt } from '@/components/ui';
import { usePermissions } from '@/lib/auth';
import { fetchGames, fetchPlayers } from '@/lib/db';
import { attempt, confirmAsync, useLoad } from '@/lib/hooks';
import { must, supabase } from '@/lib/supabase';
import { fmtDate } from '@/lib/time';
import { colors, space } from '@/lib/theme';
import type { PhysicalTest, Profile, Team } from '@/lib/types';
import { TeamForm } from '@/components/TeamForm';

type Tab = 'roster' | 'games' | 'performance' | 'attendance' | 'feedback' | 'coaches';

export default function TeamScreen() {
  const { id, tab: initial } = useLocalSearchParams<{ id: string; tab?: Tab }>();
  const perms = usePermissions();
  const canManage = perms.canManageTeam(id);
  const [tab, setTab] = useState<Tab>(initial ?? 'roster');
  const [playerForm, setPlayerForm] = useState(false);
  const [editTeam, setEditTeam] = useState(false);

  const { data, error, loading, reload } = useLoad(async () => {
    const [team, players, games, coaches] = await Promise.all([
      supabase.from('teams').select('*').eq('id', id).single(),
      fetchPlayers(id),
      fetchGames({ teamId: id }),
      supabase.from('team_coaches').select('profile_id, profiles(id, full_name, email, title)').eq('team_id', id),
    ]);
    const extra: {
      tests: PhysicalTest[];
      sessions: { id: string; session_date: string; title: string; attendance: { status: string }[] }[];
      kpis: { id: string; name: string; unit: string | null; target: number | null; higher_is_better: boolean }[];
      feedback: { id: string; month: string; rating: number; feedback: string | null; players: { full_name: string } | null }[];
    } = { tests: [], sessions: [], kpis: [], feedback: [] };
    if (canManage) {
      const [t, s, k, f] = await Promise.all([
        supabase.from('physical_tests').select('*').eq('team_id', id).order('rank'),
        supabase.from('practice_sessions').select('id, session_date, title, attendance(status)').eq('team_id', id).order('session_date', { ascending: false }),
        supabase.from('kpis').select('*').eq('team_id', id).order('created_at'),
        supabase.from('session_feedback').select('id, month, rating, feedback, players(full_name)').eq('team_id', id).order('month', { ascending: false }),
      ]);
      extra.tests = (t.data ?? []) as PhysicalTest[];
      extra.sessions = (s.data ?? []) as typeof extra.sessions;
      extra.kpis = (k.data ?? []) as typeof extra.kpis;
      extra.feedback = (f.data ?? []) as unknown as typeof extra.feedback;
    }
    return {
      team: must(team) as Team,
      players,
      games,
      coaches: ((coaches.data ?? []) as unknown as { profile_id: string; profiles: Pick<Profile, 'id' | 'full_name' | 'email' | 'title'> | null }[]).map((c) => c.profiles).filter(Boolean) as Pick<Profile, 'id' | 'full_name' | 'email' | 'title'>[],
      ...extra,
    };
  }, [id, canManage]);

  const tabs: { value: Tab; label: string }[] = [
    { value: 'roster', label: 'Roster' },
    { value: 'games', label: 'Games' },
  ];
  if (canManage) {
    tabs.push({ value: 'performance', label: 'Performance' }, { value: 'attendance', label: 'Attendance' }, { value: 'feedback', label: 'Feedback' });
  }
  if (perms.isSuper) tabs.push({ value: 'coaches', label: 'Coaches' });

  const upcoming = data?.games.filter((g) => g.status === 'scheduled') ?? [];
  const done = data?.games.filter((g) => g.status === 'completed') ?? [];
  const wins = done.filter((g) => (g.our_score ?? 0) > (g.their_score ?? 0)).length;
  const losses = done.filter((g) => (g.our_score ?? 0) < (g.their_score ?? 0)).length;

  return (
    <Screen
      back
      title={data?.team.name ?? 'Team'}
      subtitle={data ? `${data.team.sport} · ${data.coaches.map((c) => c.full_name).join(', ') || 'No coach assigned'}` : undefined}
      onRefresh={reload}
      actions={perms.isSuper && data ? <IconButton icon="create-outline" onPress={() => setEditTeam(true)} /> : null}>
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      {loading && !data ? <Loading /> : null}
      {data ? (
        <>
          <Row wrap gap={space.md}>
            <Stat label="Players" value={data.players.length} icon="people" />
            <Stat label="Record (W–L)" value={`${wins}–${losses}`} icon="trophy" tone="warning" sub={`${done.length} games played`} />
            <Stat label="Upcoming" value={upcoming.length} icon="calendar" tone="info" />
          </Row>
          <Chips value={tab} onChange={setTab} options={tabs} />

          {tab === 'roster' ? (
            <>
              <SectionTitle
                title="Roster"
                subtitle={`${data.players.length} players`}
                action={canManage ? <Button small icon="person-add-outline" title="Add player" onPress={() => setPlayerForm(true)} /> : null}
              />
              <Card padded={false}>
                {data.players.length === 0 ? <Empty icon="people-outline" title="No players yet" /> : null}
                {data.players.map((p, i) => {
                  const canOpen = perms.canSeePortfolio(p);
                  return (
                    <ListRow
                      key={p.id}
                      last={i === data.players.length - 1}
                      left={<Avatar name={p.full_name} number={p.jersey_number} tone={p.team_role ? 'brand' : 'light'} />}
                      title={p.full_name}
                      subtitle={[p.position, p.jersey_number == null ? 'No number yet' : null].filter(Boolean).join(' · ')}
                      right={
                        <Row gap={6}>
                          {p.team_role ? <Badge text={p.team_role} tone="warning" /> : null}
                          {p.status !== 'active' ? <Badge text={p.status} tone="danger" /> : null}
                          {canManage ? (
                            <IconButton
                              icon="person-remove-outline"
                              size={16}
                              color={colors.danger}
                              onPress={async () => {
                                if (!(await confirmAsync('Remove from roster?', `${p.full_name} and their portfolio will be deleted.`, 'Remove'))) return;
                                await attempt(async () => {
                                  must(await supabase.from('players').delete().eq('id', p.id));
                                  reload();
                                });
                              }}
                            />
                          ) : null}
                        </Row>
                      }
                      onPress={canOpen ? () => router.push(`/players/${p.id}`) : undefined}
                    />
                  );
                })}
              </Card>
            </>
          ) : null}

          {tab === 'games' ? (
            <>
              <SectionTitle title="Games" action={canManage ? <Button small icon="add" title="Manage games" onPress={() => router.push({ pathname: '/games', params: { team: id } })} /> : null} />
              {data.games.length === 0 ? <Card><Empty icon="trophy-outline" title="No games yet" /></Card> : <Grid min={320}>{data.games.map((g) => <GameCard key={g.id} game={g} team={data.team} />)}</Grid>}
            </>
          ) : null}

          {tab === 'performance' ? <Performance teamId={id} tests={data.tests} kpis={data.kpis} players={data.players} onChanged={reload} /> : null}

          {tab === 'attendance' ? (
            <>
              <SectionTitle title="Practice sessions" action={<Button small icon="checkmark-done" title="Take attendance" onPress={() => router.push(`/teams/${id}/attendance`)} />} />
              <Card padded={false}>
                {data.sessions.length === 0 ? <Empty icon="calendar-outline" title="No sessions yet" /> : null}
                {data.sessions.map((s, i) => {
                  const pres = s.attendance.filter((a) => a.status === 'present').length;
                  const exc = s.attendance.filter((a) => a.status === 'excused').length;
                  const abs = s.attendance.filter((a) => a.status === 'absent').length;
                  return (
                    <ListRow
                      key={s.id}
                      last={i === data.sessions.length - 1}
                      title={`${s.title} · ${fmtDate(s.session_date)}`}
                      subtitle={`${pres} present · ${abs} absent · ${exc} excused`}
                      right={<Badge text={`${s.attendance.length ? Math.round((pres / s.attendance.length) * 100) : 0}%`} tone="success" />}
                      onPress={() => router.push({ pathname: '/teams/[id]/attendance', params: { id, session: s.id } })}
                    />
                  );
                })}
              </Card>
              <SectionTitle title="Attendance by player" />
              <AttendanceByPlayer teamId={id} />
            </>
          ) : null}

          {tab === 'feedback' ? (
            <>
              <SectionTitle title="Monthly training ratings" subtitle={data.feedback.length ? `Average ${(data.feedback.reduce((s, f) => s + f.rating, 0) / data.feedback.length).toFixed(1)} / 5` : undefined} />
              <Card padded={false}>
                {data.feedback.length === 0 ? <Empty icon="star-outline" title="No ratings yet" subtitle="Players rate their training once a month." /> : null}
                {data.feedback.map((f, i) => (
                  <ListRow key={f.id} last={i === data.feedback.length - 1} title={`${f.players?.full_name ?? 'Player'} · ${fmtDate(f.month, { month: 'long', year: 'numeric' })}`} subtitle={f.feedback} right={<Badge text={'★'.repeat(f.rating)} tone="warning" />} />
                ))}
              </Card>
            </>
          ) : null}

          {tab === 'coaches' ? <Coaches teamId={id} coaches={data.coaches} onChanged={reload} /> : null}
        </>
      ) : null}
      {playerForm ? <PlayerForm teamId={id} onClose={() => setPlayerForm(false)} onSaved={() => { setPlayerForm(false); reload(); }} /> : null}
      {editTeam && data ? <TeamForm team={data.team} onClose={() => setEditTeam(false)} onSaved={() => { setEditTeam(false); reload(); }} /> : null}
    </Screen>
  );
}

function AttendanceByPlayer({ teamId }: { teamId: string }) {
  const { data } = useLoad(async () => {
    const { data: rows } = await supabase
      .from('attendance')
      .select('status, players!inner(id, full_name, team_id)')
      .eq('players.team_id', teamId);
    const by: Record<string, { name: string; present: number; absent: number; excused: number }> = {};
    ((rows ?? []) as unknown as { status: 'present' | 'absent' | 'excused'; players: { id: string; full_name: string } }[]).forEach((r) => {
      const b = (by[r.players.id] ??= { name: r.players.full_name, present: 0, absent: 0, excused: 0 });
      b[r.status] += 1;
    });
    return Object.values(by).sort((a, b) => a.name.localeCompare(b.name));
  }, [teamId]);
  if (!data) return <Loading />;
  return (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      <Table
        columns={[
          { key: 'name', label: 'Player', width: 190 },
          { key: 'p', label: 'Present', width: 80, align: 'center' },
          { key: 'a', label: 'Absent', width: 80, align: 'center' },
          { key: 'e', label: 'Excused', width: 80, align: 'center' },
          { key: 'r', label: 'Rate', width: 80, align: 'center' },
        ]}
        rows={data.map((d) => {
          const tot = d.present + d.absent + d.excused;
          return { name: d.name, p: String(d.present), a: String(d.absent), e: String(d.excused), r: tot ? `${Math.round((d.present / tot) * 100)}%` : '—' };
        })}
      />
    </Card>
  );
}

function Performance({
  teamId,
  tests,
  kpis,
  players,
  onChanged,
}: {
  teamId: string;
  tests: PhysicalTest[];
  kpis: { id: string; name: string; unit: string | null; target: number | null; higher_is_better: boolean }[];
  players: { id: string; full_name: string }[];
  onChanged: () => void;
}) {
  const [kpiForm, setKpiForm] = useState(false);
  const [k, setK] = useState({ name: '', unit: '', target: '', higher: true });
  const sessions = Array.from(new Set(tests.slice().sort((a, b) => a.session_order - b.session_order).map((t) => t.session_label)));
  const [session, setSession] = useState(sessions[sessions.length - 1]);
  const shown = tests.filter((t) => t.session_label === session).sort((a, b) => (a.absent ? 1 : 0) - (b.absent ? 1 : 0) || (a.rank ?? 99) - (b.rank ?? 99));
  const tested = shown.filter((t) => !t.absent);
  const hasPass = tested.some((t) => t.passed != null);
  const passCount = tested.filter((t) => t.passed).length;
  const scoreLabels = Array.from(new Set(tested.flatMap((t) => t.scores.map((x) => x.label))));
  const method = shown.find((t) => t.method)?.method;

  const saveKpi = () =>
    attempt(async () => {
      if (!k.name.trim()) throw new Error('KPI name is required');
      const { data: u } = await supabase.auth.getUser();
      must(await supabase.from('kpis').insert({ team_id: teamId, name: k.name.trim(), unit: k.unit || null, target: k.target ? Number(k.target) : null, higher_is_better: k.higher, created_by: u.user?.id }));
      setKpiForm(false);
      setK({ name: '', unit: '', target: '', higher: true });
      onChanged();
    });

  return (
    <>
      <SectionTitle title="Physical testing" subtitle={method ?? undefined} />
      {tests.length === 0 ? (
        <Card><Empty icon="stopwatch-outline" title="No physical tests yet" /></Card>
      ) : (
        <>
          {sessions.length > 1 ? <Chips value={session} onChange={setSession} options={sessions.map((s) => ({ value: s, label: s }))} /> : null}
          <Row wrap gap={space.md}>
            <Stat label="Athletes tested" value={tested.length} icon="people" sub={shown.length > tested.length ? `${shown.length - tested.length} absent` : undefined} />
            {hasPass ? <Stat label="Passed" value={`${passCount}/${tested.length}`} icon="checkmark-circle" tone="success" /> : null}
            <Stat label="Team average" value={(tested.reduce((s, t) => s + Number(t.composite ?? 0), 0) / (tested.length || 1)).toFixed(2)} icon="podium" tone="info" />
          </Row>
          <Card padded={false} style={{ overflow: 'hidden' }}>
            <Table
              onRowPress={(i) => shown[i].player_id && router.push({ pathname: '/players/[id]', params: { id: shown[i].player_id!, tab: 'physical' } })}
              columns={[
                { key: 'rank', label: '#', width: 44, align: 'center' },
                { key: 'name', label: 'Athlete', width: 160 },
                ...scoreLabels.map((l) => ({ key: `s:${l}`, label: l, width: 78, align: 'right' as const })),
                { key: 'comp', label: 'Composite', width: 96, align: 'right' },
                ...(hasPass || tested.length < shown.length ? [{ key: 'res', label: 'Result', width: 84, align: 'center' as const }] : []),
              ]}
              rows={shown.map((t) => {
                const row: Record<string, React.ReactNode> = {
                  rank: t.absent ? '—' : String(t.rank ?? '–'),
                  name: (
                    <View>
                      <Text style={{ fontWeight: '700', fontSize: 13, color: colors.text }}>{t.athlete_name}</Text>
                      {!t.player_id ? <Text style={{ fontSize: 11, color: colors.faint }}>not on roster</Text> : null}
                    </View>
                  ),
                  comp: t.absent ? '—' : <Text style={{ fontWeight: '800', textAlign: 'right', color: colors.brandDark }}>{Number(t.composite ?? 0).toFixed(2)}</Text>,
                  res: t.absent ? <Badge text="Absent" /> : t.passed != null ? <Badge text={t.passed ? 'Pass' : 'Fail'} tone={t.passed ? 'success' : 'danger'} /> : '',
                };
                for (const l of scoreLabels) {
                  const v = t.scores.find((x) => x.label === l)?.score;
                  row[`s:${l}`] = t.absent ? '—' : v == null ? 'n/a' : Number(v).toFixed(2);
                }
                return row;
              })}
            />
          </Card>
        </>
      )}

      <SectionTitle title="Team KPIs" subtitle="Personalised metrics — record values from each player's portfolio" action={<Button small icon="add" title="New KPI" onPress={() => setKpiForm(true)} />} />
      <Card padded={false}>
        {kpis.length === 0 ? <Empty icon="analytics-outline" title="No KPIs yet" /> : null}
        {kpis.map((x, i) => (
          <ListRow
            key={x.id}
            last={i === kpis.length - 1}
            title={x.name}
            subtitle={`Target ${x.target ?? '—'} ${x.unit ?? ''} · ${x.higher_is_better ? 'higher is better' : 'lower is better'}`}
            right={
              <IconButton
                icon="trash-outline"
                size={16}
                color={colors.danger}
                onPress={async () => {
                  if (!(await confirmAsync('Delete KPI?', 'All recorded values will be removed.'))) return;
                  await attempt(async () => {
                    must(await supabase.from('kpis').delete().eq('id', x.id));
                    onChanged();
                  });
                }}
              />
            }
          />
        ))}
      </Card>
      <Txt v="caption" color={colors.muted}>{players.length} players can be tracked. Open a player → KPIs to record a value.</Txt>
      {kpiForm ? (
        <Sheet visible title="New KPI" onClose={() => setKpiForm(false)} footer={<Button title="Create KPI" icon="checkmark" onPress={saveKpi} />}>
          <Field label="Name" value={k.name} onChangeText={(t) => setK({ ...k, name: t })} placeholder="e.g. Serve accuracy" />
          <Row>
            <Field label="Unit" value={k.unit} onChangeText={(t) => setK({ ...k, unit: t })} placeholder="%, cm, s…" style={{ flex: 1 }} />
            <Field label="Target" value={k.target} onChangeText={(t) => setK({ ...k, target: t })} keyboardType="decimal-pad" style={{ flex: 1 }} />
          </Row>
          <Toggle label="Higher values are better" value={k.higher} onChange={(h) => setK({ ...k, higher: h })} />
        </Sheet>
      ) : null}
    </>
  );
}

function Coaches({ teamId, coaches, onChanged }: { teamId: string; coaches: Pick<Profile, 'id' | 'full_name' | 'email' | 'title'>[]; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const { data: all } = useLoad(async () => must(await supabase.from('profiles').select('id, full_name, email, title').eq('role', 'coach').order('full_name')) as Pick<Profile, 'id' | 'full_name' | 'email' | 'title'>[], []);
  const available = (all ?? []).filter((c) => !coaches.some((x) => x.id === c.id));
  return (
    <>
      <SectionTitle title="Coaching staff" action={<Button small icon="add" title="Assign coach" onPress={() => setAdding(true)} />} />
      <Card padded={false}>
        {coaches.length === 0 ? <Empty icon="person-outline" title="No coach assigned" /> : null}
        {coaches.map((c, i) => (
          <ListRow
            key={c.id}
            last={i === coaches.length - 1}
            left={<Avatar name={c.full_name} />}
            title={c.full_name}
            subtitle={[c.title, c.email].filter(Boolean).join(' · ')}
            right={
              <IconButton
                icon="close"
                size={16}
                color={colors.danger}
                onPress={() =>
                  attempt(async () => {
                    must(await supabase.from('team_coaches').delete().eq('team_id', teamId).eq('profile_id', c.id));
                    onChanged();
                  })
                }
              />
            }
          />
        ))}
      </Card>
      {adding ? (
        <Sheet visible title="Assign a coach" onClose={() => setAdding(false)}>
          {available.length === 0 ? <Empty icon="person-add-outline" title="No other coach accounts" subtitle="Create coach accounts from Accounts first." /> : null}
          {available.map((c) => (
            <Card
              key={c.id}
              onPress={() =>
                attempt(async () => {
                  must(await supabase.from('team_coaches').insert({ team_id: teamId, profile_id: c.id }));
                  setAdding(false);
                  onChanged();
                })
              }>
              <Row>
                <Avatar name={c.full_name} />
                <View style={{ flex: 1 }}>
                  <Txt v="h3">{c.full_name}</Txt>
                  <Txt v="caption" color={colors.muted}>{c.email}</Txt>
                </View>
              </Row>
            </Card>
          ))}
        </Sheet>
      ) : null}
    </>
  );
}
