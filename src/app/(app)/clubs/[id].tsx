import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ClubForm, type Club } from '@/components/ClubForm';
import { Avatar, Badge, Button, Card, Chips, Empty, ErrorBox, Field, IconButton, ListRow, Loading, Row, Screen, SectionTitle, Sheet, Txt } from '@/components/ui';
import { usePermissions } from '@/lib/auth';
import { attempt, confirmAsync, useLoad } from '@/lib/hooks';
import { must, supabase } from '@/lib/supabase';
import { campusNow, fmtDate } from '@/lib/time';
import { colors, space } from '@/lib/theme';

type Member = { id: string; club_id: string; full_name: string; email: string | null; role: string; joined_on: string | null };
type Event = { id: string; club_id: string; title: string; description: string | null; event_date: string | null; location: string | null; planning: string | null; status: string; budget: number | null };

export default function ClubScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isSuper } = usePermissions();
  const [tab, setTab] = useState<'events' | 'members'>('events');
  const [member, setMember] = useState<Partial<Member> | null>(null);
  const [event, setEvent] = useState<Partial<Event> | null>(null);
  const [editClub, setEditClub] = useState(false);

  const { data, error, loading, reload } = useLoad(async () => {
    const [c, m, e] = await Promise.all([
      supabase.from('clubs').select('*').eq('id', id).single(),
      supabase.from('club_members').select('*').eq('club_id', id).order('full_name'),
      supabase.from('club_events').select('*').eq('club_id', id).order('event_date', { ascending: true }),
    ]);
    return { club: must(c) as Club, members: (m.data ?? []) as Member[], events: (e.data ?? []) as Event[] };
  }, [id]);

  const removeClub = async () => {
    if (!(await confirmAsync('Delete this club?', 'Members and events will be deleted too.'))) return;
    await attempt(async () => {
      must(await supabase.from('clubs').delete().eq('id', id));
      router.back();
    });
  };

  return (
    <Screen back title={data?.club.name ?? 'Club'} subtitle={data?.club.category ?? undefined} onRefresh={reload} actions={isSuper && data ? <IconButton icon="create-outline" onPress={() => setEditClub(true)} /> : null}>
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      {loading && !data ? <Loading /> : null}
      {data ? (
        <>
          <Card style={{ gap: 8 }}>
            <Txt>{data.club.description || 'No description yet.'}</Txt>
            <Row wrap gap={6}>
              {data.club.president ? <Badge text={`President: ${data.club.president}`} tone="brand" icon="person" /> : null}
              {data.club.contact_email ? <Badge text={data.club.contact_email} tone="info" icon="mail" /> : null}
              <Badge text={`${data.members.length} members`} icon="people" />
            </Row>
          </Card>
          <Chips value={tab} onChange={setTab} options={[{ value: 'events', label: `Events & planning (${data.events.length})` }, { value: 'members', label: `Members (${data.members.length})` }]} />

          {tab === 'events' ? (
            <>
              <SectionTitle title="Events" action={isSuper ? <Button small icon="add" title="Add event" onPress={() => setEvent({ status: 'planned', event_date: campusNow().date })} /> : null} />
              {data.events.length === 0 ? <Card><Empty icon="calendar-outline" title="No events planned" /></Card> : null}
              {data.events.map((e) => (
                <Card key={e.id} onPress={isSuper ? () => setEvent(e) : undefined} style={{ gap: 8 }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Txt v="h3">{e.title}</Txt>
                      <Txt v="caption" color={colors.muted}>{[fmtDate(e.event_date), e.location, e.budget != null ? `Budget ${e.budget} MAD` : null].filter(Boolean).join(' · ')}</Txt>
                    </View>
                    <Badge text={e.status} tone={e.status === 'done' ? 'success' : e.status === 'cancelled' ? 'danger' : 'warning'} />
                  </Row>
                  {e.description ? <Txt v="small">{e.description}</Txt> : null}
                  {e.planning ? (
                    <View style={{ backgroundColor: colors.brandTint, borderRadius: 12, padding: space.md, gap: 4 }}>
                      <Txt v="label" color={colors.brand}>Planning</Txt>
                      <Txt v="small">{e.planning}</Txt>
                    </View>
                  ) : null}
                </Card>
              ))}
            </>
          ) : (
            <>
              <SectionTitle title="Members" action={isSuper ? <Button small icon="person-add-outline" title="Add member" onPress={() => setMember({ role: 'Member' })} /> : null} />
              <Card padded={false}>
                {data.members.length === 0 ? <Empty icon="people-outline" title="No members yet" /> : null}
                {data.members.map((m, i) => (
                  <ListRow key={m.id} last={i === data.members.length - 1} left={<Avatar name={m.full_name} tone="light" />} title={m.full_name} subtitle={[m.role, m.email].filter(Boolean).join(' · ')} onPress={isSuper ? () => setMember(m) : undefined} />
                ))}
              </Card>
            </>
          )}
          {isSuper ? <Button variant="danger" icon="trash-outline" title="Delete club" onPress={removeClub} style={{ alignSelf: 'flex-start', marginTop: space.lg }} /> : null}
        </>
      ) : null}

      {member ? <MemberForm clubId={id} member={member} onClose={() => setMember(null)} onSaved={() => { setMember(null); reload(); }} /> : null}
      {event ? <EventForm clubId={id} event={event} onClose={() => setEvent(null)} onSaved={() => { setEvent(null); reload(); }} /> : null}
      {editClub && data ? <ClubForm club={data.club} onClose={() => setEditClub(false)} onSaved={() => { setEditClub(false); reload(); }} /> : null}
    </Screen>
  );
}

function MemberForm({ clubId, member, onClose, onSaved }: { clubId: string; member: Partial<Member>; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ full_name: member.full_name ?? '', email: member.email ?? '', role: member.role ?? 'Member' });
  const save = () =>
    attempt(async () => {
      if (!v.full_name.trim()) throw new Error('Name is required');
      const row = { club_id: clubId, full_name: v.full_name.trim(), email: v.email || null, role: v.role || 'Member' };
      if (member.id) must(await supabase.from('club_members').update(row).eq('id', member.id));
      else must(await supabase.from('club_members').insert(row));
      onSaved();
    });
  const remove = async () => {
    if (!member.id || !(await confirmAsync('Remove member?', member.full_name))) return;
    await attempt(async () => {
      must(await supabase.from('club_members').delete().eq('id', member.id!));
      onSaved();
    });
  };
  return (
    <Sheet visible title={member.id ? 'Edit member' : 'Add member'} onClose={onClose} footer={<Row>{member.id ? <Button variant="danger" icon="trash-outline" title="Remove" onPress={remove} /> : null}<Button title="Save" icon="checkmark" onPress={save} style={{ flex: 1 }} /></Row>}>
      <Field label="Full name" value={v.full_name} onChangeText={(t) => setV({ ...v, full_name: t })} autoCapitalize="words" />
      <Field label="Email" value={v.email} onChangeText={(t) => setV({ ...v, email: t })} keyboardType="email-address" />
      <Chips label="Role" value={v.role} onChange={(r) => setV({ ...v, role: r })} options={['Member', 'President', 'Vice President', 'Treasurer', 'Secretary', 'Event Manager'].map((r) => ({ value: r, label: r }))} />
    </Sheet>
  );
}

function EventForm({ clubId, event, onClose, onSaved }: { clubId: string; event: Partial<Event>; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({
    title: event.title ?? '',
    description: event.description ?? '',
    event_date: event.event_date ?? '',
    location: event.location ?? '',
    planning: event.planning ?? '',
    status: event.status ?? 'planned',
    budget: event.budget != null ? String(event.budget) : '',
  });
  const save = () =>
    attempt(async () => {
      if (!v.title.trim()) throw new Error('Title is required');
      if (v.event_date && !/^\d{4}-\d{2}-\d{2}$/.test(v.event_date)) throw new Error('Date must be YYYY-MM-DD');
      const row = { club_id: clubId, title: v.title.trim(), description: v.description || null, event_date: v.event_date || null, location: v.location || null, planning: v.planning || null, status: v.status, budget: v.budget ? Number(v.budget) : null };
      if (event.id) must(await supabase.from('club_events').update(row).eq('id', event.id));
      else must(await supabase.from('club_events').insert(row));
      onSaved();
    });
  const remove = async () => {
    if (!event.id || !(await confirmAsync('Delete event?', event.title))) return;
    await attempt(async () => {
      must(await supabase.from('club_events').delete().eq('id', event.id!));
      onSaved();
    });
  };
  return (
    <Sheet visible title={event.id ? 'Edit event' : 'New event'} onClose={onClose} footer={<Row>{event.id ? <Button variant="danger" icon="trash-outline" title="Delete" onPress={remove} /> : null}<Button title="Save" icon="checkmark" onPress={save} style={{ flex: 1 }} /></Row>}>
      <Field label="Title" value={v.title} onChangeText={(t) => setV({ ...v, title: t })} />
      <Row>
        <Field label="Date" value={v.event_date} onChangeText={(t) => setV({ ...v, event_date: t })} placeholder="YYYY-MM-DD" style={{ flex: 1 }} />
        <Field label="Budget (MAD)" value={v.budget} onChangeText={(t) => setV({ ...v, budget: t })} keyboardType="decimal-pad" style={{ flex: 1 }} />
      </Row>
      <Field label="Location" value={v.location} onChangeText={(t) => setV({ ...v, location: t })} />
      <Field label="Description" value={v.description} onChangeText={(t) => setV({ ...v, description: t })} multiline />
      <Field label="Planning" value={v.planning} onChangeText={(t) => setV({ ...v, planning: t })} multiline placeholder="Timeline, tasks, responsibilities, logistics…" />
      <Chips label="Status" value={v.status} onChange={(s) => setV({ ...v, status: s })} options={[{ value: 'planned', label: 'Planned' }, { value: 'done', label: 'Done' }, { value: 'cancelled', label: 'Cancelled' }]} />
    </Sheet>
  );
}
