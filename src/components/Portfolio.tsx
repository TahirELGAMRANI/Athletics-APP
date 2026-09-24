import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';

import { usePermissions } from '@/lib/auth';
import { attempt, confirmAsync, useIsWide, useLoad } from '@/lib/hooks';
import { must, supabase } from '@/lib/supabase';
import { campusNow, fmtDate, monthStart } from '@/lib/time';
import { colors, space } from '@/lib/theme';
import type { AttendanceStatus, PhysicalTest, Player, Team } from '@/lib/types';
import { pickAndUpload, signedUrls } from '@/lib/upload';
import { Badge, Button, Card, Chips, Empty, ErrorBox, Field, Icon, IconButton, ListRow, Loading, Row, SectionTitle, Sheet, Stat, Table, Toggle, Txt } from './ui';

type Tab = 'overview' | 'physical' | 'medical' | 'psychology' | 'contract' | 'notes' | 'kpis' | 'attendance' | 'feedback';

type Doc = { id: string; category: string; title: string; file_path: string | null; notes: string | null; doc_date: string | null; created_at: string };
type Note = { id: string; body: string; visible_to_player: boolean; created_at: string; author_id: string | null };
type Kpi = { id: string; name: string; unit: string | null; target: number | null; higher_is_better: boolean };
type KpiEntry = { id: string; kpi_id: string; value: number; recorded_on: string; note: string | null };

export const ATT_TONE: Record<AttendanceStatus, 'success' | 'danger' | 'warning'> = { present: 'success', absent: 'danger', excused: 'warning' };

export default function Portfolio({ playerId, initialTab, selfView }: { playerId: string; initialTab?: string; selfView?: boolean }) {
  const perms = usePermissions();
  const [tab, setTab] = useState<Tab>((initialTab as Tab) ?? 'overview');
  const { data, error, loading, reload } = useLoad(async () => {
    const player = must(await supabase.from('players').select('*').eq('id', playerId).single()) as Player;
    const [team, tests, docs, notes, kpis, entries, att, fb] = await Promise.all([
      supabase.from('teams').select('*').eq('id', player.team_id).single(),
      supabase.from('physical_tests').select('*').eq('player_id', playerId).order('created_at'),
      supabase.from('player_documents').select('*').eq('player_id', playerId).order('created_at', { ascending: false }),
      supabase.from('player_notes').select('*').eq('player_id', playerId).order('created_at', { ascending: false }),
      supabase.from('kpis').select('*').eq('team_id', player.team_id).order('created_at'),
      supabase.from('kpi_entries').select('*').eq('player_id', playerId).order('recorded_on', { ascending: false }),
      supabase.from('attendance').select('status,note,practice_sessions(session_date,title)').eq('player_id', playerId),
      supabase.from('session_feedback').select('*').eq('player_id', playerId).order('month', { ascending: false }),
    ]);
    const d = (docs.data ?? []) as Doc[];
    const urls = await signedUrls(d.map((x) => x.file_path).filter(Boolean) as string[]);
    type AttRow = { status: AttendanceStatus; note: string | null; practice_sessions: { session_date: string; title: string } | null };
    const attendance = ((att.data ?? []) as unknown as AttRow[]).sort((a, b) =>
      (b.practice_sessions?.session_date ?? '').localeCompare(a.practice_sessions?.session_date ?? ''),
    );
    return {
      player,
      team: team.data as Team,
      tests: (tests.data ?? []) as PhysicalTest[],
      docs: d,
      urls,
      notes: (notes.data ?? []) as Note[],
      kpis: (kpis.data ?? []) as Kpi[],
      entries: (entries.data ?? []) as KpiEntry[],
      attendance,
      feedback: (fb.data ?? []) as { id: string; month: string; rating: number; feedback: string | null }[],
    };
  }, [playerId]);

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (loading && !data) return <Loading />;
  if (!data) return null;

  const { player, team } = data;
  const canEdit = perms.canManageTeam(player.team_id);
  const present = data.attendance.filter((a) => a.status === 'present').length;
  const rate = data.attendance.length ? Math.round((present / data.attendance.length) * 100) : null;
  const latest = data.tests[data.tests.length - 1];

  const tabs: { value: Tab; label: string }[] = [
    { value: 'overview', label: 'Overview' },
    { value: 'physical', label: 'Physical' },
    { value: 'medical', label: 'Medical' },
    { value: 'psychology', label: 'Psychology' },
    { value: 'contract', label: 'Contracts' },
    { value: 'notes', label: 'Coach notes' },
    { value: 'kpis', label: 'KPIs' },
    { value: 'attendance', label: 'Attendance' },
  ];
  if (selfView || canEdit) tabs.push({ value: 'feedback', label: selfView ? 'Rate training' : 'Feedback' });

  return (
    <View style={{ gap: space.md }}>
      <Card style={{ backgroundColor: colors.brandDark, borderColor: colors.brandDark, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', right: -40, top: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: colors.brandMid, opacity: 0.6 }} />
        <Row gap={space.lg}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 26, fontWeight: '900', color: colors.brandDark }}>{player.jersey_number ?? '–'}</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: colors.white, fontSize: 22, fontWeight: '800' }}>{player.full_name}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.75)' }}>{[player.position, team?.name].filter(Boolean).join(' · ')}</Text>
            <Row gap={6} wrap>
              {player.team_role ? <Badge text={player.team_role} tone="warning" icon="star" /> : null}
              <Badge text={player.status} tone={player.status === 'active' ? 'success' : 'danger'} />
            </Row>
          </View>
        </Row>
      </Card>

      <Row wrap gap={space.md}>
        <Stat label="Attendance rate" value={rate != null ? `${rate}%` : '—'} icon="checkmark-done" tone="success" sub={`${present}/${data.attendance.length} sessions`} />
        <Stat label="Physical composite" value={latest?.composite != null ? `${Number(latest.composite).toFixed(2)}` : '—'} icon="flash" tone={latest?.passed === false ? 'danger' : 'brand'} sub={latest ? `${latest.passed ? 'Pass' : 'Fail'} · rank ${latest.rank ?? '–'}` : 'No test yet'} />
        <Stat label="Documents" value={data.docs.length} icon="folder-open" tone="info" />
      </Row>

      <Chips value={tab} onChange={setTab} options={tabs} />

      {tab === 'overview' ? <Overview player={player} canEdit={canEdit} onSaved={reload} /> : null}
      {tab === 'physical' ? <Physical tests={data.tests} /> : null}
      {tab === 'medical' || tab === 'psychology' || tab === 'contract' || tab === 'physical' ? (
        <Docs category={tab} playerId={player.id} docs={data.docs.filter((d) => d.category === tab)} urls={data.urls} canEdit={canEdit} onChanged={reload} />
      ) : null}
      {tab === 'notes' ? <Notes playerId={player.id} notes={data.notes} canEdit={canEdit} onChanged={reload} /> : null}
      {tab === 'kpis' ? <Kpis playerId={player.id} kpis={data.kpis} entries={data.entries} canEdit={canEdit} onChanged={reload} /> : null}
      {tab === 'attendance' ? (
        <Card padded={false}>
          {data.attendance.length === 0 ? (
            <Empty icon="calendar-outline" title="No attendance recorded yet" />
          ) : (
            data.attendance.map((a, i) => (
              <ListRow
                key={i}
                last={i === data.attendance.length - 1}
                title={a.practice_sessions?.title ?? 'Session'}
                subtitle={[fmtDate(a.practice_sessions?.session_date), a.note].filter(Boolean).join(' · ')}
                right={<Badge text={a.status} tone={ATT_TONE[a.status]} />}
              />
            ))
          )}
        </Card>
      ) : null}
      {tab === 'feedback' ? <Feedback player={player} rows={data.feedback} selfView={!!selfView} onChanged={reload} /> : null}
    </View>
  );
}

function InfoLine({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <View style={{ flexBasis: '45%', flexGrow: 1, gap: 2, paddingVertical: 6 }}>
      <Txt v="label" color={colors.faint}>{label}</Txt>
      <Txt>{value == null || value === '' ? '—' : String(value)}</Txt>
    </View>
  );
}

function Overview({ player, canEdit, onSaved }: { player: Player; canEdit: boolean; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt v="h3">Player information</Txt>
        {canEdit ? <Button small variant="secondary" icon="create-outline" title="Edit" onPress={() => setOpen(true)} /> : null}
      </Row>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: space.sm }}>
        <InfoLine label="Position" value={player.position} />
        <InfoLine label="Jersey" value={player.jersey_number != null ? `#${player.jersey_number}` : 'Not assigned'} />
        <InfoLine label="Team role" value={player.team_role} />
        <InfoLine label="Status" value={player.status} />
        <InfoLine label="Date of birth" value={player.date_of_birth ? fmtDate(player.date_of_birth, { day: 'numeric', month: 'long', year: 'numeric' }) : null} />
        <InfoLine label="Major" value={player.major} />
        <InfoLine label="Height" value={player.height_cm ? `${player.height_cm} cm` : null} />
        <InfoLine label="Weight" value={player.weight_kg ? `${player.weight_kg} kg` : null} />
        <InfoLine label="Email" value={player.email} />
        <InfoLine label="Phone" value={player.phone} />
      </View>
      {player.bio ? <Txt color={colors.muted} style={{ marginTop: space.sm }}>{player.bio}</Txt> : null}
      {open ? <PlayerForm teamId={player.team_id} player={player} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); onSaved(); }} /> : null}
    </Card>
  );
}

export function PlayerForm({ teamId, player, onClose, onSaved }: { teamId: string; player?: Player; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({
    full_name: player?.full_name ?? '',
    position: player?.position ?? '',
    jersey_number: player?.jersey_number != null ? String(player.jersey_number) : '',
    team_role: player?.team_role ?? '',
    status: player?.status ?? 'active',
    email: player?.email ?? '',
    phone: player?.phone ?? '',
    date_of_birth: player?.date_of_birth ?? '',
    height_cm: player?.height_cm != null ? String(player.height_cm) : '',
    weight_kg: player?.weight_kg != null ? String(player.weight_kg) : '',
    major: player?.major ?? '',
    bio: player?.bio ?? '',
  });
  const set = (k: keyof typeof v) => (t: string) => setV({ ...v, [k]: t });
  const num = (s: string) => (s.trim() === '' ? null : Number(s));
  const save = () =>
    attempt(async () => {
      if (!v.full_name.trim()) throw new Error('Name is required');
      if (v.date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(v.date_of_birth)) throw new Error('Date of birth must be YYYY-MM-DD');
      const row = {
        team_id: teamId,
        full_name: v.full_name.trim(),
        position: v.position || null,
        jersey_number: num(v.jersey_number),
        team_role: v.team_role || null,
        status: v.status,
        email: v.email || null,
        phone: v.phone || null,
        date_of_birth: v.date_of_birth || null,
        height_cm: num(v.height_cm),
        weight_kg: num(v.weight_kg),
        major: v.major || null,
        bio: v.bio || null,
      };
      if (player) must(await supabase.from('players').update(row).eq('id', player.id));
      else must(await supabase.from('players').insert(row));
      onSaved();
    });
  return (
    <Sheet visible title={player ? 'Edit player' : 'Add player'} onClose={onClose} footer={<Button title="Save" icon="checkmark" onPress={save} />}>
      <Field label="Full name" value={v.full_name} onChangeText={set('full_name')} autoCapitalize="words" />
      <Row>
        <Field label="Position" value={v.position} onChangeText={set('position')} placeholder="e.g. Setter" style={{ flex: 2 }} />
        <Field label="Jersey #" value={v.jersey_number} onChangeText={set('jersey_number')} keyboardType="numeric" style={{ flex: 1 }} />
      </Row>
      <Chips label="Team role" value={v.team_role} onChange={set('team_role')} options={[{ value: '', label: 'Player' }, { value: 'Captain', label: 'Captain' }, { value: 'Vice Captain', label: 'Vice Captain' }]} />
      <Chips label="Status" value={v.status} onChange={set('status')} options={[{ value: 'active', label: 'Active' }, { value: 'injured', label: 'Injured' }, { value: 'inactive', label: 'Inactive' }]} />
      <Row>
        <Field label="Email" value={v.email} onChangeText={set('email')} keyboardType="email-address" style={{ flex: 1 }} />
        <Field label="Phone" value={v.phone} onChangeText={set('phone')} keyboardType="phone-pad" style={{ flex: 1 }} />
      </Row>
      <Row>
        <Field label="Date of birth" value={v.date_of_birth} onChangeText={set('date_of_birth')} placeholder="YYYY-MM-DD" style={{ flex: 1 }} />
        <Field label="Major" value={v.major} onChangeText={set('major')} style={{ flex: 1 }} />
      </Row>
      <Row>
        <Field label="Height (cm)" value={v.height_cm} onChangeText={set('height_cm')} keyboardType="decimal-pad" style={{ flex: 1 }} />
        <Field label="Weight (kg)" value={v.weight_kg} onChangeText={set('weight_kg')} keyboardType="decimal-pad" style={{ flex: 1 }} />
      </Row>
      <Field label="Bio / notes" value={v.bio} onChangeText={set('bio')} multiline />
    </Sheet>
  );
}

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  const v = value ?? 0;
  const color = v >= 7 ? colors.success : v >= 4 ? colors.brandMid : colors.danger;
  return (
    <View style={{ gap: 4 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt v="small">{label}</Txt>
        <Txt v="small" style={{ fontWeight: '700' }}>{value != null ? Number(value).toFixed(2) : '—'} / 10</Txt>
      </Row>
      <View style={{ height: 8, backgroundColor: colors.brandSoft, borderRadius: 4, overflow: 'hidden' }}>
        <View style={{ width: `${Math.min(100, v * 10)}%`, height: 8, backgroundColor: color, borderRadius: 4 }} />
      </View>
    </View>
  );
}

function Physical({ tests }: { tests: PhysicalTest[] }) {
  if (!tests.length) {
    return <Card><Empty icon="stopwatch-outline" title="No physical tests yet" /></Card>;
  }
  return (
    <>
      {tests
        .slice()
        .reverse()
        .map((t) => (
          <Card key={t.id} style={{ gap: space.md }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <Txt v="h3">{t.session_label}</Txt>
                <Txt v="caption" color={colors.muted}>{t.test_date ? fmtDate(t.test_date) : 'Aerobic, agility & sprint assessment'}</Txt>
              </View>
              <Badge text={t.passed ? 'PASS' : 'FAIL'} tone={t.passed ? 'success' : 'danger'} icon={t.passed ? 'checkmark-circle' : 'close-circle'} />
            </Row>
            <Row wrap gap={space.md}>
              <Stat label="Composite" value={t.composite != null ? Number(t.composite).toFixed(2) : '—'} icon="podium" sub="Pass threshold 4.0 / 10" />
              <Stat label="Team rank" value={t.rank != null ? `#${t.rank}` : '—'} icon="trophy" tone="warning" />
            </Row>
            <ScoreBar label="Beep test" value={t.score_beep} />
            <ScoreBar label="Pro agility (5-10-5)" value={t.score_agility} />
            <ScoreBar label="Illinois agility" value={t.score_illinois} />
            <ScoreBar label="30 m sprint" value={t.score_sprint} />
            <ScoreBar label="Distance (1 min 30 s)" value={t.score_distance} />
            <Table
              columns={[
                { key: 'test', label: 'Test', width: 150 },
                { key: 't1', label: 'Trial 1', width: 80, align: 'right' },
                { key: 't2', label: 'Trial 2', width: 80, align: 'right' },
                { key: 'best', label: 'Best', width: 90, align: 'right' },
              ]}
              rows={[
                { test: 'Beep test (stage)', t1: t.beep_stage != null ? String(t.beep_stage) : '—', t2: '', best: t.beep_stage != null ? String(t.beep_stage) : '—' },
                { test: 'Pro agility (s)', t1: String(t.agility_t1 ?? '—'), t2: String(t.agility_t2 ?? '—'), best: String(t.best_agility ?? '—') },
                { test: 'Illinois (s)', t1: String(t.illinois_t1 ?? '—'), t2: String(t.illinois_t2 ?? '—'), best: String(t.best_illinois ?? '—') },
                { test: '30 m sprint (s)', t1: String(t.sprint_t1 ?? '—'), t2: String(t.sprint_t2 ?? '—'), best: String(t.best_sprint ?? '—') },
                { test: 'Distance (m)', t1: t.laps != null ? `${t.laps} laps` : '—', t2: '', best: String(t.distance_m ?? '—') },
              ]}
            />
          </Card>
        ))}
    </>
  );
}

const DOC_META: Record<string, { title: string; icon: 'medkit-outline' | 'happy-outline' | 'document-text-outline' | 'barbell-outline' }> = {
  medical: { title: 'Medical records', icon: 'medkit-outline' },
  psychology: { title: 'Psychology assessments', icon: 'happy-outline' },
  contract: { title: 'Signed contracts', icon: 'document-text-outline' },
  physical: { title: 'Physical test sheets', icon: 'barbell-outline' },
};

function Docs({ category, playerId, docs, urls, canEdit, onChanged }: { category: string; playerId: string; docs: Doc[]; urls: Record<string, string>; canEdit: boolean; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const wide = useIsWide();
  const meta = DOC_META[category];

  const upload = (source: 'library' | 'camera') =>
    attempt(async () => {
      const path = await pickAndUpload(playerId, source);
      if (!path) return;
      must(
        await supabase.from('player_documents').insert({
          player_id: playerId,
          category,
          title: title.trim() || meta.title.replace(/s$/, ''),
          notes: notes || null,
          file_path: path,
        }),
      );
      setAdding(false);
      setTitle('');
      setNotes('');
      onChanged();
    });

  const remove = async (d: Doc) => {
    if (!(await confirmAsync('Delete this document?', d.title))) return;
    await attempt(async () => {
      if (d.file_path) await supabase.storage.from('player-docs').remove([d.file_path]);
      must(await supabase.from('player_documents').delete().eq('id', d.id));
      onChanged();
    });
  };

  return (
    <>
      <SectionTitle
        title={meta.title}
        subtitle={category === 'physical' ? 'Scanned result sheets (optional)' : 'Picture entries — upload a photo of the document'}
        action={canEdit ? <Button small icon="cloud-upload-outline" title="Upload" onPress={() => setAdding(true)} /> : null}
      />
      {docs.length === 0 ? (
        category === 'physical' ? null : (
          <Card>
            <Empty icon={meta.icon} title={`No ${meta.title.toLowerCase()} yet`} subtitle={canEdit ? 'Tap Upload to add a picture.' : undefined} />
          </Card>
        )
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
          {docs.map((d) => (
            <Card key={d.id} padded={false} style={{ width: wide ? 220 : '47%', overflow: 'hidden' }}>
              <Pressable onPress={() => d.file_path && urls[d.file_path] && setPreview(urls[d.file_path])}>
                {d.file_path && urls[d.file_path] ? (
                  <Image source={{ uri: urls[d.file_path] }} style={{ width: '100%', height: 140, backgroundColor: colors.brandSoft }} contentFit="cover" />
                ) : (
                  <View style={{ height: 140, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={meta.icon} size={32} color={colors.brand} />
                  </View>
                )}
              </Pressable>
              <View style={{ padding: space.md, gap: 2 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Txt v="h3" numberOfLines={1} style={{ flex: 1 }}>{d.title}</Txt>
                  {canEdit ? <IconButton icon="trash-outline" size={16} color={colors.danger} onPress={() => remove(d)} /> : null}
                </Row>
                <Txt v="caption" color={colors.muted}>{fmtDate(d.doc_date ?? d.created_at)}</Txt>
                {d.notes ? <Txt v="caption" color={colors.muted} numberOfLines={2}>{d.notes}</Txt> : null}
              </View>
            </Card>
          ))}
        </View>
      )}
      {adding ? (
        <Sheet visible title={`Upload — ${meta.title}`} onClose={() => setAdding(false)}>
          <Field label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Pre-season medical check" />
          <Field label="Notes" value={notes} onChangeText={setNotes} multiline placeholder="Optional" />
          <Button title="Choose photo" icon="images-outline" onPress={() => upload('library')} />
          {Platform.OS !== 'web' ? <Button variant="secondary" title="Take photo" icon="camera-outline" onPress={() => upload('camera')} /> : null}
        </Sheet>
      ) : null}
      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' }} onPress={() => setPreview(null)}>
          {preview ? <Image source={{ uri: preview }} style={{ width: '94%', height: '84%' }} contentFit="contain" /> : null}
          <Text style={{ color: colors.white, marginTop: 12 }}>Tap to close</Text>
        </Pressable>
      </Modal>
    </>
  );
}

function Notes({ playerId, notes, canEdit, onChanged }: { playerId: string; notes: Note[]; canEdit: boolean; onChanged: () => void }) {
  const [body, setBody] = useState('');
  const [visible, setVisible] = useState(true);
  const add = () =>
    attempt(async () => {
      if (!body.trim()) return;
      const { data: u } = await supabase.auth.getUser();
      must(await supabase.from('player_notes').insert({ player_id: playerId, body: body.trim(), visible_to_player: visible, author_id: u.user?.id }));
      setBody('');
      onChanged();
    });
  const remove = async (id: string) => {
    if (!(await confirmAsync('Delete this note?'))) return;
    await attempt(async () => {
      must(await supabase.from('player_notes').delete().eq('id', id));
      onChanged();
    });
  };
  return (
    <>
      {canEdit ? (
        <Card style={{ gap: space.sm }}>
          <Field label="New note" value={body} onChangeText={setBody} multiline placeholder="Feedback, goals, technical points…" />
          <Row style={{ justifyContent: 'space-between' }}>
            <Toggle label="Visible to player" value={visible} onChange={setVisible} />
            <Button small title="Add note" icon="send" onPress={add} disabled={!body.trim()} />
          </Row>
        </Card>
      ) : null}
      {notes.length === 0 ? (
        <Card><Empty icon="chatbubbles-outline" title="No notes yet" /></Card>
      ) : (
        notes.map((n) => (
          <Card key={n.id} style={{ gap: 6, borderLeftWidth: 4, borderLeftColor: colors.brand }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt v="caption" color={colors.muted}>{fmtDate(n.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</Txt>
              <Row gap={6}>
                {canEdit ? <Badge text={n.visible_to_player ? 'Shared' : 'Private'} tone={n.visible_to_player ? 'success' : 'neutral'} /> : null}
                {canEdit ? <IconButton icon="trash-outline" size={15} color={colors.danger} onPress={() => remove(n.id)} /> : null}
              </Row>
            </Row>
            <Txt>{n.body}</Txt>
          </Card>
        ))
      )}
    </>
  );
}

function Kpis({ playerId, kpis, entries, canEdit, onChanged }: { playerId: string; kpis: Kpi[]; entries: KpiEntry[]; canEdit: boolean; onChanged: () => void }) {
  const [kpiId, setKpiId] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const save = () =>
    attempt(async () => {
      if (!kpiId || value.trim() === '' || Number.isNaN(Number(value))) throw new Error('Enter a numeric value');
      must(await supabase.from('kpi_entries').insert({ kpi_id: kpiId, player_id: playerId, value: Number(value), note: note || null, recorded_on: campusNow().date }));
      setKpiId(null);
      setValue('');
      setNote('');
      onChanged();
    });
  if (!kpis.length) return <Card><Empty icon="analytics-outline" title="No KPIs defined for this team" subtitle="Coaches can create KPIs from the team's Performance tab." /></Card>;
  return (
    <>
      {kpis.map((k) => {
        const list = entries.filter((e) => e.kpi_id === k.id);
        const last = list[0];
        const prev = list[1];
        const pct = last && k.target ? Math.max(0, Math.min(100, k.higher_is_better ? (last.value / k.target) * 100 : (k.target / last.value) * 100)) : 0;
        const trend = last && prev ? (last.value > prev.value ? 'up' : last.value < prev.value ? 'down' : 'flat') : null;
        const good = trend === 'flat' || trend == null ? null : (trend === 'up') === k.higher_is_better;
        return (
          <Card key={k.id} style={{ gap: 8 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Txt v="h3">{k.name}</Txt>
                <Txt v="caption" color={colors.muted}>Target {k.target ?? '—'} {k.unit ?? ''} · {k.higher_is_better ? 'higher is better' : 'lower is better'}</Txt>
              </View>
              <Row gap={6}>
                <Txt v="h2">{last ? `${last.value}${k.unit ?? ''}` : '—'}</Txt>
                {trend ? <Icon name={trend === 'up' ? 'trending-up' : trend === 'down' ? 'trending-down' : 'remove'} size={20} color={good == null ? colors.muted : good ? colors.success : colors.danger} /> : null}
              </Row>
            </Row>
            <View style={{ height: 8, backgroundColor: colors.brandSoft, borderRadius: 4, overflow: 'hidden' }}>
              <View style={{ width: `${pct}%`, height: 8, backgroundColor: colors.brand }} />
            </View>
            {list.length ? (
              <Row wrap gap={6}>
                {list.slice(0, 8).map((e) => (
                  <Badge key={e.id} text={`${fmtDate(e.recorded_on, { day: 'numeric', month: 'short' })}: ${e.value}`} />
                ))}
              </Row>
            ) : (
              <Txt v="caption" color={colors.faint}>No entries yet</Txt>
            )}
            {canEdit ? <Button small variant="secondary" icon="add" title="Record value" onPress={() => setKpiId(k.id)} style={{ alignSelf: 'flex-start' }} /> : null}
          </Card>
        );
      })}
      {kpiId ? (
        <Sheet visible title={`Record — ${kpis.find((k) => k.id === kpiId)?.name}`} onClose={() => setKpiId(null)} footer={<Button title="Save" icon="checkmark" onPress={save} />}>
          <Field label="Value" value={value} onChangeText={setValue} keyboardType="decimal-pad" />
          <Field label="Note" value={note} onChangeText={setNote} placeholder="Optional" />
        </Sheet>
      ) : null}
    </>
  );
}

function Feedback({ player, rows, selfView, onChanged }: { player: Player; rows: { id: string; month: string; rating: number; feedback: string | null }[]; selfView: boolean; onChanged: () => void }) {
  const month = monthStart(campusNow().date);
  const current = rows.find((r) => r.month === month);
  const [rating, setRating] = useState(current?.rating ?? 0);
  const [text, setText] = useState(current?.feedback ?? '');
  const save = () =>
    attempt(async () => {
      if (!rating) throw new Error('Pick a rating from 1 to 5');
      must(
        await supabase
          .from('session_feedback')
          .upsert({ player_id: player.id, team_id: player.team_id, month, rating, feedback: text || null }, { onConflict: 'player_id,month' }),
      );
      onChanged();
    }, 'Thanks — your feedback was saved.');
  return (
    <>
      {selfView ? (
        <Card style={{ gap: space.md }}>
          <Txt v="h3">How were this month's training sessions?</Txt>
          <Txt v="small" color={colors.muted}>{fmtDate(month, { month: 'long', year: 'numeric' })} · one rating per month, you can update it until the month ends.</Txt>
          <Row gap={6}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
                <Icon name={n <= rating ? 'star' : 'star-outline'} size={34} color={n <= rating ? '#E8A317' : colors.faint} />
              </Pressable>
            ))}
          </Row>
          <Field label="Feedback" value={text} onChangeText={setText} multiline placeholder="What worked? What should change?" />
          <Button title={current ? 'Update rating' : 'Submit rating'} icon="send" onPress={save} />
        </Card>
      ) : null}
      <SectionTitle title="History" />
      {rows.length === 0 ? (
        <Card><Empty icon="star-outline" title="No ratings yet" /></Card>
      ) : (
        <Card padded={false}>
          {rows.map((r, i) => (
            <ListRow key={r.id} last={i === rows.length - 1} title={fmtDate(r.month, { month: 'long', year: 'numeric' })} subtitle={r.feedback} right={<Badge text={`${'★'.repeat(r.rating)}`} tone="warning" />} />
          ))}
        </Card>
      )}
    </>
  );
}

