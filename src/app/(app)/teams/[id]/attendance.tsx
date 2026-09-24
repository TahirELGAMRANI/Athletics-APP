import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Avatar, Badge, Button, Card, ErrorBox, Field, Loading, Row, Screen, Txt } from '@/components/ui';
import { usePermissions } from '@/lib/auth';
import { fetchPlayers } from '@/lib/db';
import { attempt, confirmAsync, useLoad } from '@/lib/hooks';
import { must, supabase } from '@/lib/supabase';
import { campusNow } from '@/lib/time';
import { colors, radius, space } from '@/lib/theme';
import type { AttendanceStatus } from '@/lib/types';

const OPTIONS: { value: AttendanceStatus; label: string; short: string; color: string; soft: string }[] = [
  { value: 'present', label: 'Present', short: 'P', color: colors.success, soft: colors.successSoft },
  { value: 'absent', label: 'Absent', short: 'A', color: colors.danger, soft: colors.dangerSoft },
  { value: 'excused', label: 'Excused', short: 'E', color: colors.warning, soft: colors.warningSoft },
];

export default function AttendanceScreen() {
  const { id, session } = useLocalSearchParams<{ id: string; session?: string }>();
  const { canManageTeam } = usePermissions();
  const [date, setDate] = useState(campusNow().date);
  const [title, setTitle] = useState('Practice');
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});

  const { data, error, loading } = useLoad(async () => {
    const players = (await fetchPlayers(id)).filter((p) => p.status !== 'inactive');
    let existing: { session_date: string; title: string } | null = null;
    let rows: { player_id: string; status: AttendanceStatus }[] = [];
    if (session) {
      existing = must(await supabase.from('practice_sessions').select('session_date,title').eq('id', session).single());
      rows = must(await supabase.from('attendance').select('player_id,status').eq('session_id', session)) as typeof rows;
    }
    return { players, existing, rows };
  }, [id, session]);

  useEffect(() => {
    if (!data) return;
    if (data.existing) {
      setDate(data.existing.session_date);
      setTitle(data.existing.title);
    }
    const m: Record<string, AttendanceStatus> = {};
    data.rows.forEach((r) => (m[r.player_id] = r.status));
    setMarks(m);
  }, [data]);

  if (!canManageTeam(id)) return <Screen title="Attendance" back><ErrorBox message="Only the team's coaches can mark attendance." /></Screen>;

  const counts = OPTIONS.map((o) => ({ ...o, n: Object.values(marks).filter((m) => m === o.value).length }));
  const unmarked = (data?.players.length ?? 0) - Object.keys(marks).length;

  const save = () =>
    attempt(async () => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Date must be YYYY-MM-DD');
      if (unmarked > 0) throw new Error(`${unmarked} player(s) not marked yet`);
      const { data: u } = await supabase.auth.getUser();
      let sid = session;
      if (sid) must(await supabase.from('practice_sessions').update({ session_date: date, title }).eq('id', sid));
      else sid = (must(await supabase.from('practice_sessions').insert({ team_id: id, session_date: date, title, created_by: u.user?.id }).select('id').single()) as { id: string }).id;
      must(await supabase.from('attendance').upsert(Object.entries(marks).map(([player_id, status]) => ({ session_id: sid, player_id, status }))));
      router.back();
    }, 'Attendance saved');

  const remove = async () => {
    if (!session || !(await confirmAsync('Delete this session?'))) return;
    await attempt(async () => {
      must(await supabase.from('practice_sessions').delete().eq('id', session));
      router.back();
    });
  };

  return (
    <Screen back title={session ? 'Edit attendance' : 'Take attendance'} subtitle="Mark every player present, absent or excused">
      {error ? <ErrorBox message={error} /> : null}
      {loading && !data ? <Loading /> : null}
      {data ? (
        <>
          <Card style={{ gap: space.md }}>
            <Row>
              <Field label="Date" value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" style={{ flex: 1 }} />
              <Field label="Session" value={title} onChangeText={setTitle} style={{ flex: 1 }} />
            </Row>
            <Row wrap gap={8}>
              {counts.map((c) => (
                <Badge key={c.value} text={`${c.n} ${c.label.toLowerCase()}`} tone={c.value === 'present' ? 'success' : c.value === 'absent' ? 'danger' : 'warning'} />
              ))}
              {unmarked > 0 ? <Badge text={`${unmarked} unmarked`} /> : null}
            </Row>
            <Button
              small
              variant="secondary"
              icon="checkmark-done"
              title="Mark all present"
              onPress={() => {
                const m: Record<string, AttendanceStatus> = {};
                data.players.forEach((p) => (m[p.id] = 'present'));
                setMarks(m);
              }}
              style={{ alignSelf: 'flex-start' }}
            />
          </Card>
          <Card padded={false}>
            {data.players.map((p, i) => (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderBottomWidth: i === data.players.length - 1 ? 0 : 1, borderBottomColor: colors.border }}>
                <Avatar name={p.full_name} number={p.jersey_number} tone="light" size={38} />
                <View style={{ flex: 1 }}>
                  <Txt v="h3" numberOfLines={1}>{p.full_name}</Txt>
                  <Txt v="caption" color={colors.muted}>{p.position}</Txt>
                </View>
                <Row gap={6}>
                  {OPTIONS.map((o) => {
                    const active = marks[p.id] === o.value;
                    return (
                      <Pressable
                        key={o.value}
                        onPress={() => setMarks({ ...marks, [p.id]: o.value })}
                        accessibilityLabel={`${o.label} ${p.full_name}`}
                        style={{ width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? o.color : o.soft, borderWidth: 1, borderColor: active ? o.color : 'transparent' }}>
                        <Text style={{ fontWeight: '800', color: active ? colors.white : o.color }}>{o.short}</Text>
                      </Pressable>
                    );
                  })}
                </Row>
              </View>
            ))}
          </Card>
          <Txt v="caption" color={colors.muted}>P = present · A = absent · E = excused absence</Txt>
          <Row>
            {session ? <Button variant="danger" icon="trash-outline" title="Delete" onPress={remove} /> : null}
            <Button title="Save attendance" icon="save-outline" onPress={save} style={{ flex: 1 }} />
          </Row>
        </>
      ) : null}
    </Screen>
  );
}
