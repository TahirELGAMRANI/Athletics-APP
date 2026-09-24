import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { FacilityLiveCard } from '@/components/shared';
import { Badge, Button, Card, Chips, Empty, ErrorBox, Field, Grid, Icon, ListRow, Loading, Row, Screen, SectionTitle, Sheet, Table, Txt } from '@/components/ui';
import { usePermissions } from '@/lib/auth';
import { fetchFacilitiesWithSchedule, fetchResources, fetchTeams } from '@/lib/db';
import { attempt, confirmAsync, useLoad, useTicker } from '@/lib/hooks';
import { must, supabase } from '@/lib/supabase';
import { campusNow, DAYS, DAYS_SHORT, fmtRange, fmtTime, freeWindows, openHours, toMin } from '@/lib/time';
import { colors, radius, space } from '@/lib/theme';
import type { ScheduleItem } from '@/lib/types';

type Tab = 'live' | 'week' | 'day';

export default function ScheduleScreen() {
  useTicker(30000);
  const params = useLocalSearchParams<{ facility?: string }>();
  const { isSuper } = usePermissions();
  const now = campusNow();
  const [tab, setTab] = useState<Tab>(params.facility ? 'week' : 'live');
  const [facilitySlug, setFacilitySlug] = useState<string | undefined>(params.facility);
  const [day, setDay] = useState(String(now.dow));
  const [editing, setEditing] = useState<Partial<ScheduleItem> | null>(null);

  const { data, error, loading, reload } = useLoad(async () => {
    const [fs, teams, resources, slots] = await Promise.all([
      fetchFacilitiesWithSchedule(),
      fetchTeams(),
      fetchResources(),
      supabase.rpc('booked_slots', { d: now.date }),
    ]);
    return { ...fs, teams, resources, slots: (slots.data ?? []) as { resource_id: string; start_time: string; end_time: string; taken: number }[] };
  }, []);

  const facility = useMemo(
    () => data?.facilities.find((f) => f.slug === facilitySlug) ?? data?.facilities[0],
    [data, facilitySlug],
  );
  const items = data && facility ? data.schedule.filter((s) => s.facility_id === facility.id) : [];

  /** A padel/tennis court booked by someone right now counts as busy. */
  const bookedNow = (facilityId: string) => {
    if (!data) return null;
    const res = data.resources.filter((r) => r.facility_id === facilityId);
    for (const r of res) {
      const hit = data.slots.find((s) => s.resource_id === r.id && toMin(s.start_time) <= now.minutes && now.minutes < toMin(s.end_time) && s.taken >= r.capacity);
      if (hit) return `Booked until ${fmtTime(hit.end_time)}`;
    }
    return null;
  };

  return (
    <Screen
      title="Facilities"
      subtitle="Live availability · Weekdays 8 AM–11 PM · Weekends 11 AM–9 PM"
      onRefresh={reload}
      actions={isSuper && tab !== 'live' && facility ? <Button small icon="add" title="Add slot" onPress={() => setEditing({ facility_id: facility.id, day_of_week: Number(day), start_time: '18:00', end_time: '19:00', activity: '' })} /> : null}>
      <Chips<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'live', label: 'Live now', icon: 'pulse' },
          { value: 'week', label: 'Weekly program', icon: 'grid-outline' },
          { value: 'day', label: 'Day timeline', icon: 'time-outline' },
        ]}
      />
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      {loading && !data ? <Loading /> : null}

      {data && tab === 'live' ? (
        <>
          <Row gap={space.md} wrap>
            <Badge text="Available" tone="success" icon="ellipse" />
            <Badge text="In use / booked" tone="warning" icon="ellipse" />
            <Badge text="Closed" tone="neutral" icon="ellipse" />
          </Row>
          <Grid min={280}>
            {data.facilities.map((f) => (
              <FacilityLiveCard
                key={f.id}
                facility={f}
                schedule={data.schedule}
                now={now}
                extraBusy={bookedNow(f.id)}
                onPress={() => {
                  setFacilitySlug(f.slug);
                  setTab('day');
                }}
              />
            ))}
          </Grid>
        </>
      ) : null}

      {data && tab !== 'live' ? (
        <Chips value={facility?.slug} onChange={setFacilitySlug} options={data.facilities.map((f) => ({ value: f.slug, label: f.name }))} />
      ) : null}

      {data && facility && tab === 'week' ? (
        <WeekTable items={items} onEdit={isSuper ? setEditing : undefined} facilityName={facility.name} />
      ) : null}

      {data && facility && tab === 'day' ? (
        <>
          <Chips value={day} onChange={setDay} options={DAYS_SHORT.map((d, i) => ({ value: String(i + 1), label: i + 1 === now.dow ? `${d} · today` : d }))} />
          <DayTimeline items={items.filter((i) => i.day_of_week === Number(day))} dow={Number(day)} nowMin={Number(day) === now.dow ? now.minutes : null} />
          <SectionTitle title="Free windows" />
          <Row wrap gap={8}>
            {freeWindows(items, Number(day)).map(([a, b]) => (
              <Badge key={a} text={`${fmtTime(a)} – ${fmtTime(b)}`} tone="success" />
            ))}
          </Row>
          <SectionTitle title="Program" />
          <Card padded={false}>
            {items.filter((i) => i.day_of_week === Number(day)).length === 0 ? (
              <Empty icon="sunny-outline" title="Nothing scheduled" subtitle="The facility is open for free use during opening hours." />
            ) : (
              items
                .filter((i) => i.day_of_week === Number(day))
                .sort((a, b) => toMin(a.start_time) - toMin(b.start_time))
                .map((i, idx, arr) => (
                  <ListRow
                    key={i.id}
                    last={idx === arr.length - 1}
                    title={i.activity}
                    subtitle={[fmtRange(i.start_time, i.end_time), i.note].filter(Boolean).join(' · ')}
                    onPress={isSuper ? () => setEditing(i) : undefined}
                    left={<Icon name="time-outline" size={20} color={colors.brand} />}
                  />
                ))
            )}
          </Card>
        </>
      ) : null}

      {data && editing ? (
        <SlotEditor
          value={editing}
          teams={data.teams}
          facilities={data.facilities}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      ) : null}
    </Screen>
  );
}

function WeekTable({ items, onEdit, facilityName }: { items: ScheduleItem[]; onEdit?: (i: ScheduleItem) => void; facilityName: string }) {
  const activities = Array.from(new Set(items.map((i) => i.activity)));
  if (!activities.length) {
    return (
      <Card>
        <Empty icon="calendar-clear-outline" title={`No program for ${facilityName}`} subtitle="The facility is open for free use during opening hours." />
      </Card>
    );
  }
  const days = [1, 2, 3, 4, 5, 6, 7].filter((d) => d <= 5 || items.some((i) => i.day_of_week === d));
  const rows = activities.map((a) => {
    const r: Record<string, React.ReactNode> = {
      activity: <Text style={{ fontWeight: '800', color: colors.brandDark, fontSize: 13 }}>{a.toUpperCase()}</Text>,
    };
    for (const d of days) {
      const cell = items.filter((i) => i.activity === a && i.day_of_week === d);
      r[`d${d}`] = cell.length ? (
        <View style={{ gap: 4 }}>
          {cell.map((c) => (
            <Text key={c.id} onPress={onEdit ? () => onEdit(c) : undefined} style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
              {fmtRange(c.start_time, c.end_time)}
            </Text>
          ))}
        </View>
      ) : (
        <Text style={{ color: colors.faint }}>—</Text>
      );
    }
    return r;
  });
  return (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      <View style={{ backgroundColor: colors.brand, padding: space.md }}>
        <Text style={{ color: colors.white, fontSize: 20, fontWeight: '900', letterSpacing: 0.5, textAlign: 'center' }}>{facilityName.toUpperCase()} PROGRAM</Text>
      </View>
      <Table
        columns={[{ key: 'activity', label: 'Activity', width: 170 }, ...days.map((d) => ({ key: `d${d}`, label: DAYS[d - 1], width: 150, align: 'center' as const }))]}
        rows={rows}
      />
      {onEdit ? <Txt v="caption" color={colors.muted} style={{ padding: space.md }}>Tip: tap a time to edit or delete it.</Txt> : null}
    </Card>
  );
}

function DayTimeline({ items, dow, nowMin }: { items: ScheduleItem[]; dow: number; nowMin: number | null }) {
  const { open, close } = openHours(dow);
  const span = close - open;
  const hours: number[] = [];
  for (let h = open; h <= close; h += 60) hours.push(h);
  const HOUR_H = 44;
  const height = (span / 60) * HOUR_H;
  return (
    <Card>
      <View style={{ height, flexDirection: 'row' }}>
        <View style={{ width: 62 }}>
          {hours.map((h) => (
            <Text key={h} style={{ position: 'absolute', top: ((h - open) / 60) * HOUR_H - 7, fontSize: 11, color: colors.muted }}>{fmtTime(h)}</Text>
          ))}
        </View>
        <View style={{ flex: 1, backgroundColor: colors.successSoft, borderRadius: radius.md, overflow: 'hidden' }}>
          {hours.map((h) => (
            <View key={h} style={{ position: 'absolute', left: 0, right: 0, top: ((h - open) / 60) * HOUR_H, height: 1, backgroundColor: 'rgba(27,94,50,0.08)' }} />
          ))}
          {items.map((i, idx) => {
            const a = Math.max(open, toMin(i.start_time));
            const b = Math.min(close, toMin(i.end_time));
            if (b <= a) return null;
            const overlapping = items.filter((o) => toMin(o.start_time) < b && toMin(o.end_time) > a);
            const col = overlapping.indexOf(i);
            const w = 100 / overlapping.length;
            return (
              <View
                key={i.id}
                style={{
                  position: 'absolute',
                  top: ((a - open) / 60) * HOUR_H + 2,
                  height: ((b - a) / 60) * HOUR_H - 4,
                  left: `${col * w}%`,
                  width: `${w}%`,
                  padding: 2,
                }}>
                <View style={{ flex: 1, backgroundColor: idx % 2 ? colors.brandMid : colors.brand, borderRadius: 10, padding: 8 }}>
                  <Text numberOfLines={1} style={{ color: colors.white, fontWeight: '800', fontSize: 12 }}>{i.activity}</Text>
                  <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>{fmtRange(i.start_time, i.end_time)}</Text>
                </View>
              </View>
            );
          })}
          {nowMin != null && nowMin >= open && nowMin <= close ? (
            <View style={{ position: 'absolute', left: 0, right: 0, top: ((nowMin - open) / 60) * HOUR_H, height: 2, backgroundColor: colors.danger }}>
              <View style={{ position: 'absolute', left: -4, top: -4, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger }} />
            </View>
          ) : null}
        </View>
      </View>
    </Card>
  );
}

function SlotEditor({
  value,
  teams,
  facilities,
  onClose,
  onSaved,
}: {
  value: Partial<ScheduleItem>;
  teams: { id: string; name: string }[];
  facilities: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [v, setV] = useState({
    facility_id: value.facility_id ?? facilities[0]?.id,
    day_of_week: value.day_of_week ?? 1,
    start_time: (value.start_time ?? '18:00').slice(0, 5),
    end_time: (value.end_time ?? '19:00').slice(0, 5),
    activity: value.activity ?? '',
    team_id: value.team_id ?? null,
    note: value.note ?? '',
  });
  const save = () =>
    attempt(async () => {
      if (!v.activity.trim()) throw new Error('Activity is required');
      if (!/^\d{1,2}:\d{2}$/.test(v.start_time) || !/^\d{1,2}:\d{2}$/.test(v.end_time)) throw new Error('Use HH:MM for times (24h), e.g. 19:30');
      const row = { ...v, activity: v.activity.trim(), note: v.note || null };
      if (value.id) must(await supabase.from('facility_schedule').update(row).eq('id', value.id));
      else must(await supabase.from('facility_schedule').insert(row));
      onSaved();
    });
  const remove = async () => {
    if (!value.id || !(await confirmAsync('Delete this slot?'))) return;
    await attempt(async () => {
      must(await supabase.from('facility_schedule').delete().eq('id', value.id!));
      onSaved();
    });
  };
  return (
    <Sheet
      visible
      title={value.id ? 'Edit slot' : 'New slot'}
      onClose={onClose}
      footer={
        <Row>
          {value.id ? <Button variant="danger" icon="trash-outline" title="Delete" onPress={remove} /> : null}
          <Button title="Save" icon="checkmark" onPress={save} style={{ flex: 1 }} />
        </Row>
      }>
      <Chips label="Facility" value={v.facility_id} onChange={(x) => setV({ ...v, facility_id: x })} options={facilities.map((f) => ({ value: f.id, label: f.name }))} />
      <Chips label="Day" value={String(v.day_of_week)} onChange={(x) => setV({ ...v, day_of_week: Number(x) })} options={DAYS_SHORT.map((d, i) => ({ value: String(i + 1), label: d }))} />
      <Row>
        <Field label="Start (24h)" value={v.start_time} onChangeText={(t) => setV({ ...v, start_time: t })} placeholder="18:00" style={{ flex: 1 }} />
        <Field label="End (24h)" value={v.end_time} onChangeText={(t) => setV({ ...v, end_time: t })} placeholder="19:30" style={{ flex: 1 }} />
      </Row>
      <Field label="Activity" value={v.activity} onChangeText={(t) => setV({ ...v, activity: t })} placeholder="e.g. Women's Volleyball" />
      <Chips label="Team (optional)" value={v.team_id ?? ''} onChange={(x) => setV({ ...v, team_id: x || null })} options={[{ value: '', label: 'None' }, ...teams.map((t) => ({ value: t.id, label: t.name }))]} />
      <Field label="Note" value={v.note} onChangeText={(t) => setV({ ...v, note: t })} placeholder="Optional" />
    </Sheet>
  );
}
