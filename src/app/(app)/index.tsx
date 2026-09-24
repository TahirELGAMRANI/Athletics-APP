import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FacilityLiveCard, GameCard, Hero } from '@/components/shared';
import { Logo } from '@/components/Shell';
import { Badge, Button, Card, Empty, Grid, Icon, ListRow, Loading, Row, Screen, SectionTitle, Stat, Txt, type IconName } from '@/components/ui';
import { useAuth, usePermissions } from '@/lib/auth';
import { fetchFacilitiesWithSchedule, fetchGames, fetchTeams, money } from '@/lib/db';
import { useIsWide, useLoad, useTicker } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { campusNow, DAYS, fmtDate, fmtTime, liveStatus, monthStart } from '@/lib/time';
import { colors, radius, space } from '@/lib/theme';
import { ROLE_LABEL } from '@/lib/types';

function greeting(minutes: number) {
  if (minutes < 12 * 60) return 'Good morning';
  if (minutes < 18 * 60) return 'Good afternoon';
  return 'Good evening';
}

function QuickAction({ icon, label, href }: { icon: IconName; label: string; href: string }) {
  return (
    <Pressable onPress={() => router.push(href as never)} style={({ pressed }) => [{ flex: 1, minWidth: 140, opacity: pressed ? 0.8 : 1 }]}>
      <Card style={{ alignItems: 'flex-start', gap: 10 }}>
        <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={22} color={colors.brand} />
        </View>
        <Txt v="h3">{label}</Txt>
      </Card>
    </Pressable>
  );
}

export default function Home() {
  useTicker(30000);
  const { profile, myPlayers, coachedTeamIds } = useAuth();
  const perms = usePermissions();
  const insets = useSafeAreaInsets();
  const wide = useIsWide();
  const now = campusNow();

  const { data, loading, reload } = useLoad(async () => {
    const [fs, teams, upcoming, results] = await Promise.all([
      fetchFacilitiesWithSchedule(),
      fetchTeams(),
      fetchGames({ upcoming: true, limit: 6 }),
      fetchGames({ upcoming: false, limit: 6 }),
    ]);
    const extra: Record<string, number | string | null> = {};
    if (perms.isSuper) {
      const [players, inv, bookings, txns] = await Promise.all([
        supabase.from('players').select('id', { count: 'exact', head: true }),
        supabase.from('inventory_items').select('quantity,min_quantity'),
        supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('booking_date', now.date).neq('status', 'cancelled'),
        supabase.from('transactions').select('txn_type,amount').gte('txn_date', monthStart(now.date)),
      ]);
      extra.players = players.count ?? 0;
      extra.lowStock = (inv.data ?? []).filter((i) => i.quantity <= i.min_quantity).length;
      extra.bookingsToday = bookings.count ?? 0;
      extra.balance = (txns.data ?? []).reduce((s, t) => s + (t.txn_type === 'income' ? 1 : -1) * Number(t.amount), 0);
    }
    if (perms.isAdmin) {
      const [inv, bookings] = await Promise.all([
        supabase.from('inventory_items').select('quantity,min_quantity'),
        supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('booking_date', now.date).neq('status', 'cancelled'),
      ]);
      extra.lowStock = (inv.data ?? []).filter((i) => i.quantity <= i.min_quantity).length;
      extra.bookingsToday = bookings.count ?? 0;
    }
    if (perms.isPlayer && myPlayers[0]) {
      const pid = myPlayers[0].id;
      const [att, test, notes] = await Promise.all([
        supabase.from('attendance').select('status').eq('player_id', pid),
        supabase.from('physical_tests').select('composite,passed,rank').eq('player_id', pid).eq('absent', false).order('session_order', { ascending: false }).order('created_at', { ascending: false }).limit(1),
        supabase.from('player_notes').select('body,created_at').eq('player_id', pid).order('created_at', { ascending: false }).limit(1),
      ]);
      const a = att.data ?? [];
      extra.attendance = a.length ? Math.round((a.filter((x) => x.status === 'present').length / a.length) * 100) : null;
      extra.composite = test.data?.[0]?.composite ?? null;
      extra.passed = test.data?.[0]?.passed == null ? null : test.data[0].passed ? 'Pass' : 'Fail';
      extra.lastNote = notes.data?.[0]?.body ?? null;
    }
    return { ...fs, teams, upcoming, results, extra };
  }, [profile?.id]);

  const teamName = (id: string) => data?.teams.find((t) => t.id === id);
  const freeNow = data ? data.facilities.filter((f) => liveStatus(data.schedule.filter((s) => s.facility_id === f.id), now).state === 'free').length : 0;

  const hero = (
    <Hero>
      <View style={{ paddingTop: (wide ? space.xl : insets.top + space.md), paddingHorizontal: wide ? space.xxl : space.lg, paddingBottom: space.xl, gap: space.md }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row>
            {!wide ? (
              <View style={{ backgroundColor: colors.white, borderRadius: 22, padding: 2 }}>
                <Logo size={38} />
              </View>
            ) : null}
            <View>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{greeting(now.minutes)},</Text>
              <Text style={{ color: colors.white, fontSize: wide ? 30 : 24, fontWeight: '800', letterSpacing: -0.5 }}>{profile?.full_name?.split(' ')[0] || 'Lion'}</Text>
            </View>
          </Row>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 12 }}>{profile ? ROLE_LABEL[profile.role] : ''}</Text>
          </View>
        </Row>
        <Row style={{ gap: space.md }} wrap>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radius.lg, padding: space.md, flex: 1, minWidth: 150 }}>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>Campus time</Text>
            <Text style={{ color: colors.white, fontSize: 20, fontWeight: '800' }}>{fmtTime(now.minutes)}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>{DAYS[now.dow - 1]}, {fmtDate(now.date, { day: 'numeric', month: 'long' })}</Text>
          </View>
          <Pressable onPress={() => router.navigate('/schedule')} style={{ backgroundColor: colors.accent, borderRadius: radius.lg, padding: space.md, flex: 1, minWidth: 150 }}>
            <Text style={{ color: colors.brandDark, fontSize: 12, fontWeight: '600' }}>Facilities free now</Text>
            <Text style={{ color: colors.brandDark, fontSize: 20, fontWeight: '800' }}>{data ? `${freeNow} / ${data.facilities.length}` : '—'}</Text>
            <Text style={{ color: colors.brandDark, fontSize: 12 }}>See live availability →</Text>
          </Pressable>
        </Row>
      </View>
    </Hero>
  );

  return (
    <Screen title="Home" hero={hero} onRefresh={reload}>
      {loading && !data ? <Loading /> : null}
      {data ? (
        <>
          {perms.isSuper ? (
            <>
              <Row wrap gap={space.md}>
                <Stat label="Teams" value={data.teams.length} icon="people" />
                <Stat label="Players" value={Number(data.extra.players ?? 0)} icon="body" tone="info" />
                <Stat label="Bookings today" value={Number(data.extra.bookingsToday ?? 0)} icon="calendar" tone="warning" />
                <Stat label="Low-stock items" value={Number(data.extra.lowStock ?? 0)} icon="cube" tone={Number(data.extra.lowStock) ? 'danger' : 'success'} />
                <Stat label="Net this month" value={money(Number(data.extra.balance ?? 0))} icon="wallet" tone="brand" />
              </Row>
              <SectionTitle title="Quick actions" />
              <Row wrap gap={space.md}>
                <QuickAction icon="person-add" label="Create account" href="/accounts" />
                <QuickAction icon="trophy" label="Games & results" href="/games" />
                <QuickAction icon="cube" label="Inventory" href="/inventory" />
                <QuickAction icon="document-text" label="Reports" href="/reports" />
              </Row>
            </>
          ) : null}

          {perms.isAdmin ? (
            <>
              <Row wrap gap={space.md}>
                <Stat label="Bookings today" value={Number(data.extra.bookingsToday ?? 0)} icon="calendar" tone="warning" />
                <Stat label="Low-stock items" value={Number(data.extra.lowStock ?? 0)} icon="cube" tone={Number(data.extra.lowStock) ? 'danger' : 'success'} />
              </Row>
              <Row wrap gap={space.md}>
                <QuickAction icon="bicycle" label="Manage bookings" href="/bookings" />
                <QuickAction icon="cube" label="Stock availability" href="/inventory" />
              </Row>
            </>
          ) : null}

          {perms.isCoach || coachedTeamIds.length ? (
            <>
              <SectionTitle title={perms.isCoach ? 'My teams' : 'Teams you coach'} />
              {coachedTeamIds.length === 0 ? (
                <Card><Empty icon="people-outline" title="No team assigned yet" subtitle="Ask the Athletic Director to assign you a team." /></Card>
              ) : (
                coachedTeamIds.map((id) => (
                  <Card key={id} onPress={() => router.push(`/teams/${id}`)} style={{ backgroundColor: colors.brand, borderColor: colors.brand }}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <View>
                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{teamName(id)?.sport}</Text>
                        <Text style={{ color: colors.white, fontSize: 20, fontWeight: '800' }}>{teamName(id)?.name}</Text>
                      </View>
                      <Icon name="arrow-forward-circle" size={32} color={colors.accent} />
                    </Row>
                  </Card>
                ))
              )}
              {coachedTeamIds[0] ? (
                <Row wrap gap={space.md}>
                  <QuickAction icon="checkmark-done" label="Take attendance" href={`/teams/${coachedTeamIds[0]}/attendance`} />
                  <QuickAction icon="clipboard" label="Plan a game" href={`/games?team=${coachedTeamIds[0]}`} />
                  <QuickAction icon="analytics" label="KPIs & tests" href={`/teams/${coachedTeamIds[0]}?tab=performance`} />
                </Row>
              ) : null}
            </>
          ) : null}

          {perms.isPlayer ? (
            myPlayers[0] ? (
              <>
                <Card onPress={() => router.push('/me')} style={{ gap: space.md }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <View>
                      <Txt v="caption" color={colors.muted}>{teamName(myPlayers[0].team_id)?.name}</Txt>
                      <Txt v="h2">My portfolio</Txt>
                    </View>
                    <Icon name="chevron-forward" size={20} color={colors.faint} />
                  </Row>
                  <Row wrap gap={space.md}>
                    <Stat label="Attendance" value={data.extra.attendance != null ? `${data.extra.attendance}%` : '—'} icon="checkmark-circle" tone="success" />
                    <Stat label="Physical composite" value={data.extra.composite != null ? `${Number(data.extra.composite).toFixed(2)}/10` : '—'} icon="flash" tone={data.extra.passed === 'Fail' ? 'danger' : 'brand'} sub={data.extra.passed ? String(data.extra.passed) : undefined} />
                  </Row>
                </Card>
                {data.extra.lastNote ? (
                  <Card style={{ backgroundColor: colors.brandTint }}>
                    <Row style={{ alignItems: 'flex-start' }}>
                      <Icon name="chatbubble-ellipses" size={20} color={colors.brand} />
                      <View style={{ flex: 1, gap: 4 }}>
                        <Txt v="label" color={colors.brand}>Latest note from your coach</Txt>
                        <Txt>{String(data.extra.lastNote)}</Txt>
                      </View>
                    </Row>
                  </Card>
                ) : null}
                <Row wrap gap={space.md}>
                  <QuickAction icon="star" label="Rate this month" href="/me?tab=feedback" />
                  <QuickAction icon="calendar-number" label="My attendance" href="/me?tab=attendance" />
                </Row>
              </>
            ) : (
              <Card><Empty icon="ribbon-outline" title="Your account is not linked to a roster yet" subtitle="The Athletic Director can link it from Accounts." /></Card>
            )
          ) : null}

          {perms.isStudent ? (
            <Row wrap gap={space.md}>
              <QuickAction icon="bicycle" label="Book a bike" href="/bookings" />
              <QuickAction icon="tennisball" label="Book padel / tennis" href="/bookings" />
              <QuickAction icon="trophy" label="Results" href="/games" />
              <QuickAction icon="people" label="Teams" href="/teams" />
            </Row>
          ) : null}

          <SectionTitle title="Live facilities" subtitle="Updated from the official programs" action={<Button small variant="ghost" title="All" onPress={() => router.navigate('/schedule')} />} />
          <Grid min={260}>
            {data.facilities.slice(0, wide ? 6 : 4).map((f) => (
              <FacilityLiveCard key={f.id} facility={f} schedule={data.schedule} now={now} onPress={() => router.push({ pathname: '/schedule', params: { facility: f.slug } })} />
            ))}
          </Grid>

          <SectionTitle title="Upcoming games" action={<Button small variant="ghost" title="All games" onPress={() => router.navigate('/games')} />} />
          {data.upcoming.length ? (
            <Grid min={320}>{data.upcoming.map((g) => <GameCard key={g.id} game={g} team={teamName(g.team_id)} />)}</Grid>
          ) : (
            <Card><Empty icon="calendar-outline" title="No upcoming games scheduled" subtitle="Games added by coaches or the athletics office appear here." /></Card>
          )}

          {data.results.length ? (
            <>
              <SectionTitle title="Latest results" />
              <Card padded={false}>
                {data.results.map((g, i) => (
                  <ListRow
                    key={g.id}
                    last={i === data.results.length - 1}
                    title={`${teamName(g.team_id)?.name ?? ''} vs ${g.opponent}`}
                    subtitle={`${fmtDate(g.game_date)} · ${g.game_type}`}
                    right={<Badge text={`${g.our_score}–${g.their_score}`} tone={(g.our_score ?? 0) > (g.their_score ?? 0) ? 'success' : (g.our_score ?? 0) < (g.their_score ?? 0) ? 'danger' : 'neutral'} />}
                  />
                ))}
              </Card>
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
