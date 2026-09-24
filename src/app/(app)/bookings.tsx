import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Badge, Button, Card, Chips, Empty, ErrorBox, Field, Icon, ListRow, Loading, Row, Screen, SectionTitle, Sheet, Txt, type IconName } from '@/components/ui';
import { useAuth, usePermissions } from '@/lib/auth';
import { fetchResources } from '@/lib/db';
import { attempt, confirmAsync, useLoad, useTicker } from '@/lib/hooks';
import { must, supabase } from '@/lib/supabase';
import { addDays, campusNow, dowOf, fmtDate, fmtRange, fmtTime, fromMin, openHours, toMin } from '@/lib/time';
import { colors, radius, space } from '@/lib/theme';
import type { Booking, Resource, ScheduleItem } from '@/lib/types';

const KIND_ICON: Record<Resource['kind'], IconName> = {
  bike: 'bicycle',
  padel: 'tennisball',
  tennis: 'tennisball-outline',
  ice_bath: 'snow',
  sauna: 'flame',
};

type Mode = 'book' | 'mine' | 'manage';

export default function BookingsScreen() {
  useTicker(60000);
  const { profile, session } = useAuth();
  const { isSuper, isAdmin } = usePermissions();
  const staff = isSuper || isAdmin;
  const now = campusNow();
  const [mode, setMode] = useState<Mode>(staff ? 'manage' : 'book');
  const [resId, setResId] = useState<string | null>(null);
  const [date, setDate] = useState(now.date);
  const [pick, setPick] = useState<{ start: number; end: number } | null>(null);

  const { data, error, loading, reload } = useLoad(async () => {
    const [resources, schedule, slots, mine] = await Promise.all([
      fetchResources(),
      supabase.from('facility_schedule').select('*'),
      supabase.rpc('booked_slots', { d: date }),
      supabase.from('bookings').select('*').eq('user_id', session!.user.id).gte('booking_date', addDays(now.date, -30)).order('booking_date', { ascending: false }).order('start_time'),
    ]);
    return {
      resources: resources.filter((r) => staff || (profile && r.allowed_roles.includes(profile.role))),
      schedule: (schedule.data ?? []) as ScheduleItem[],
      slots: (slots.data ?? []) as { resource_id: string; start_time: string; end_time: string; taken: number }[],
      mine: (mine.data ?? []) as Booking[],
    };
  }, [date]);

  const resource = data?.resources.find((r) => r.id === resId) ?? data?.resources[0];

  const dates = useMemo(() => {
    if (!resource) return [now.date];
    if (resource.same_day_only && !staff) return [now.date];
    return Array.from({ length: 8 }, (_, i) => addDays(now.date, i));
  }, [resource, staff, now.date]);

  const slotList = useMemo(() => {
    if (!data || !resource) return [];
    const dow = dowOf(date);
    const { open, close } = openHours(dow);
    const blocks = resource.facility_id ? data.schedule.filter((s) => s.facility_id === resource.facility_id && s.day_of_week === dow) : [];
    const out: { start: number; end: number; state: 'free' | 'full' | 'past' | 'program' | 'notice'; left: number; label?: string }[] = [];
    for (let t = open; t + resource.slot_minutes <= close; t += resource.slot_minutes) {
      const end = t + resource.slot_minutes;
      const prog = blocks.find((b) => toMin(b.start_time) < end && toMin(b.end_time) > t);
      const taken = data.slots
        .filter((s) => s.resource_id === resource.id && toMin(s.start_time) < end && toMin(s.end_time) > t)
        .reduce((sum, s) => sum + s.taken, 0);
      const dayDiff = Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse(now.date + 'T00:00:00Z')) / 86400000);
      const minutesFromNow = dayDiff * 1440 + t - now.minutes;
      let state: (typeof out)[number]['state'] = 'free';
      if (dayDiff < 0 || (dayDiff === 0 && end <= now.minutes)) state = 'past';
      else if (prog) state = 'program';
      else if (taken >= resource.capacity) state = 'full';
      else if (!staff && resource.min_notice_hours > 0 && minutesFromNow < resource.min_notice_hours * 60) state = 'notice';
      out.push({ start: t, end, state, left: resource.capacity - taken, label: prog?.activity });
    }
    return out;
  }, [data, resource, date, now.date, now.minutes, staff]);

  const book = (notes: string) =>
    attempt(async () => {
      if (!resource || !pick) return;
      must(
        await supabase.from('bookings').insert({
          resource_id: resource.id,
          user_id: session!.user.id,
          booking_date: date,
          start_time: fromMin(pick.start),
          end_time: fromMin(pick.end),
          notes: notes || null,
          status: 'confirmed',
        }),
      );
      setPick(null);
      reload();
    }, 'Booked! See "My bookings".');

  const cancel = async (b: Booking) => {
    if (!(await confirmAsync('Cancel this booking?', '', 'Cancel booking'))) return;
    await attempt(async () => {
      must(await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', b.id));
      reload();
    });
  };

  const resName = (id: string) => data?.resources.find((r) => r.id === id)?.name ?? 'Resource';
  const modes: { value: Mode; label: string }[] = [
    ...(staff ? [{ value: 'manage' as Mode, label: 'All bookings' }] : []),
    { value: 'book', label: 'Book' },
    { value: 'mine', label: 'My bookings' },
  ];

  return (
    <Screen title="Bookings" subtitle={staff ? 'Bikes, courts, ice bath & sauna' : 'Book bikes, padel and tennis for today'} onRefresh={reload}>
      <Chips value={mode} onChange={setMode} options={modes} />
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      {loading && !data ? <Loading /> : null}

      {data && mode === 'book' ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
            {data.resources.map((r) => {
              const active = r.id === resource?.id;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => {
                    setResId(r.id);
                    if (r.same_day_only && !staff) setDate(now.date);
                    else if (r.min_notice_hours >= 24 && date === now.date) setDate(addDays(now.date, 1));
                  }}
                  style={{ flexBasis: 150, flexGrow: 1, padding: space.md, borderRadius: radius.lg, borderWidth: 1.5, borderColor: active ? colors.brand : colors.border, backgroundColor: active ? colors.brand : colors.card, gap: 6 }}>
                  <Icon name={KIND_ICON[r.kind]} size={24} color={active ? colors.accent : colors.brand} />
                  <Text style={{ fontWeight: '800', color: active ? colors.white : colors.text }}>{r.name}</Text>
                  <Text style={{ fontSize: 12, color: active ? 'rgba(255,255,255,0.75)' : colors.muted }}>
                    {r.same_day_only ? 'Same-day booking' : r.min_notice_hours ? `Book ${r.min_notice_hours}h ahead` : 'Advance booking'}
                    {r.capacity > 1 ? ` · ${r.capacity} available` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {data.resources.length === 0 ? <Card><Empty icon="lock-closed-outline" title="Nothing bookable for your role" /></Card> : null}
          {resource ? (
            <>
              <SectionTitle title={resource.name} subtitle={`${fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${resource.slot_minutes}-minute slots`} />
              {dates.length > 1 ? <Chips value={date} onChange={setDate} options={dates.map((d) => ({ value: d, label: d === now.date ? 'Today' : fmtDate(d) }))} /> : null}
              {resource.min_notice_hours > 0 ? <Badge tone="info" icon="information-circle" text={`${resource.name} must be booked at least ${resource.min_notice_hours} hours in advance`} /> : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {slotList.map((s) => {
                  const ok = s.state === 'free';
                  const palette = ok
                    ? { bg: colors.successSoft, fg: colors.success, border: '#BFE5CB' }
                    : s.state === 'program'
                      ? { bg: colors.warningSoft, fg: colors.warning, border: '#F3D9A8' }
                      : { bg: '#F0F2F1', fg: colors.faint, border: colors.border };
                  return (
                    <Pressable
                      key={s.start}
                      disabled={!ok}
                      onPress={() => setPick({ start: s.start, end: s.end })}
                      style={({ pressed }) => ({ width: 104, padding: 10, borderRadius: radius.md, backgroundColor: palette.bg, borderWidth: 1, borderColor: palette.border, opacity: pressed ? 0.7 : 1, gap: 2 })}>
                      <Text style={{ fontWeight: '800', color: ok ? colors.text : colors.faint, fontSize: 13 }}>{fmtTime(s.start)}</Text>
                      <Text numberOfLines={1} style={{ fontSize: 11, color: palette.fg, fontWeight: '600' }}>
                        {ok ? (resource.capacity > 1 ? `${s.left} left` : 'Available') : s.state === 'program' ? s.label ?? 'Team program' : s.state === 'full' ? 'Fully booked' : s.state === 'notice' ? 'Too soon' : 'Passed'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {slotList.every((s) => s.state !== 'free') ? <Card><Empty icon="moon-outline" title="No free slots left" subtitle="Try another resource or come back tomorrow." /></Card> : null}
            </>
          ) : null}
        </>
      ) : null}

      {data && mode === 'mine' ? (
        <Card padded={false}>
          {data.mine.length === 0 ? <Empty icon="calendar-outline" title="No bookings yet" /> : null}
          {data.mine.map((b, i) => {
            const upcoming = b.status !== 'cancelled' && (b.booking_date > now.date || (b.booking_date === now.date && toMin(b.end_time) > now.minutes));
            return (
              <ListRow
                key={b.id}
                last={i === data.mine.length - 1}
                left={<Icon name={KIND_ICON[data.resources.find((r) => r.id === b.resource_id)?.kind ?? 'bike']} size={22} color={colors.brand} />}
                title={resName(b.resource_id)}
                subtitle={`${fmtDate(b.booking_date)} · ${fmtRange(b.start_time, b.end_time)}`}
                right={
                  <Row gap={6}>
                    <Badge text={b.status} tone={b.status === 'cancelled' ? 'danger' : b.status === 'confirmed' ? 'success' : 'neutral'} />
                    {upcoming ? <Button small variant="ghost" title="Cancel" onPress={() => cancel(b)} /> : null}
                  </Row>
                }
              />
            );
          })}
        </Card>
      ) : null}

      {data && mode === 'manage' && staff ? <ManageBookings resources={data.resources} /> : null}

      {pick && resource ? <ConfirmSheet title={`${resource.name} · ${fmtDate(date)} · ${fmtTime(pick.start)} – ${fmtTime(pick.end)}`} onClose={() => setPick(null)} onConfirm={book} /> : null}
    </Screen>
  );
}

function ConfirmSheet({ title, onClose, onConfirm }: { title: string; onClose: () => void; onConfirm: (notes: string) => Promise<unknown> }) {
  const [notes, setNotes] = useState('');
  return (
    <Sheet visible title="Confirm booking" onClose={onClose} footer={<Button title="Confirm booking" icon="checkmark-circle" onPress={() => onConfirm(notes)} />}>
      <Card style={{ backgroundColor: colors.brandTint }}>
        <Txt v="h3">{title}</Txt>
      </Card>
      <Field label="Notes" value={notes} onChangeText={setNotes} placeholder="Optional (e.g. playing partner)" />
    </Sheet>
  );
}

function ManageBookings({ resources }: { resources: Resource[] }) {
  const now = campusNow();
  const [date, setDate] = useState(now.date);
  const [res, setRes] = useState('');
  const { data, loading, reload } = useLoad(async () => {
    let q = supabase.from('bookings').select('*, profiles(full_name, email, role)').eq('booking_date', date).order('start_time');
    if (res) q = q.eq('resource_id', res);
    return must(await q) as (Booking & { profiles: { full_name: string; email: string; role: string } | null })[];
  }, [date, res]);

  const setStatus = (b: Booking, status: Booking['status']) =>
    attempt(async () => {
      must(await supabase.from('bookings').update({ status }).eq('id', b.id));
      reload();
    });

  return (
    <>
      <Chips value={date} onChange={setDate} options={Array.from({ length: 10 }, (_, i) => addDays(now.date, i - 2)).map((d) => ({ value: d, label: d === now.date ? 'Today' : fmtDate(d) }))} />
      <Chips value={res} onChange={setRes} options={[{ value: '', label: 'All resources' }, ...resources.map((r) => ({ value: r.id, label: r.name }))]} />
      {loading && !data ? <Loading /> : null}
      <Card padded={false}>
        {data && data.length === 0 ? <Empty icon="calendar-clear-outline" title="No bookings for this day" /> : null}
        {(data ?? []).map((b, i) => (
          <View key={b.id} style={{ padding: space.md, gap: 8, borderBottomWidth: i === (data?.length ?? 0) - 1 ? 0 : 1, borderBottomColor: colors.border }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Txt v="h3">{resources.find((r) => r.id === b.resource_id)?.name} · {fmtRange(b.start_time, b.end_time)}</Txt>
                <Txt v="small" color={colors.muted}>{b.profiles?.full_name} · {b.profiles?.email}{b.notes ? ` · ${b.notes}` : ''}</Txt>
              </View>
              <Badge text={b.status} tone={b.status === 'cancelled' ? 'danger' : b.status === 'confirmed' ? 'success' : b.status === 'completed' ? 'info' : 'warning'} />
            </Row>
            {b.status !== 'cancelled' ? (
              <Row wrap gap={6}>
                {b.status === 'pending' ? <Button small variant="secondary" title="Confirm" onPress={() => setStatus(b, 'confirmed')} /> : null}
                {b.status !== 'completed' ? <Button small variant="secondary" icon="checkmark-done" title="Mark returned / done" onPress={() => setStatus(b, 'completed')} /> : null}
                <Button small variant="danger" title="Cancel" onPress={() => setStatus(b, 'cancelled')} />
              </Row>
            ) : null}
          </View>
        ))}
      </Card>
    </>
  );
}
