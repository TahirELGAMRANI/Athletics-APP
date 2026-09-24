import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { TeamForm } from '@/components/TeamForm';
import { Button, Card, Empty, ErrorBox, Grid, Icon, Loading, Row, Screen, SectionTitle } from '@/components/ui';
import { useAuth, usePermissions } from '@/lib/auth';
import { useLoad } from '@/lib/hooks';
import { must, supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';
import type { Team } from '@/lib/types';

const SPORT_ICON: Record<string, 'basketball' | 'football' | 'tennisball' | 'fitness' | 'american-football' | 'people'> = {
  Basketball: 'basketball',
  Futsal: 'football',
  Football: 'football',
  Volleyball: 'tennisball',
  Padel: 'tennisball',
  Badminton: 'tennisball',
  'Table Tennis': 'tennisball',
  Rugby: 'american-football',
  'American Football': 'american-football',
};

export default function TeamsScreen() {
  const { coachedTeamIds, myPlayers } = useAuth();
  const { isSuper, isCoach } = usePermissions();
  const [adding, setAdding] = useState(false);
  const { data, error, loading, reload } = useLoad(async () => {
    const [teams, counts, coaches] = await Promise.all([
      supabase.from('teams').select('*').order('name'),
      supabase.from('players').select('team_id'),
      supabase.from('team_coaches').select('team_id, profiles(full_name)'),
    ]);
    const count: Record<string, number> = {};
    (counts.data ?? []).forEach((p) => (count[p.team_id] = (count[p.team_id] ?? 0) + 1));
    const coachBy: Record<string, string[]> = {};
    ((coaches.data ?? []) as unknown as { team_id: string; profiles: { full_name: string } | null }[]).forEach((c) => {
      (coachBy[c.team_id] ??= []).push(c.profiles?.full_name ?? 'Coach');
    });
    return { teams: must(teams) as Team[], count, coachBy };
  }, []);

  const mine = data?.teams.filter((t) => coachedTeamIds.includes(t.id) || myPlayers.some((p) => p.team_id === t.id)) ?? [];
  const others = data?.teams.filter((t) => !mine.includes(t)) ?? [];

  const TeamCard = ({ t, highlight }: { t: Team; highlight?: boolean }) => (
    <Card onPress={() => router.push(`/teams/${t.id}`)} style={highlight ? { backgroundColor: colors.brand, borderColor: colors.brand } : undefined}>
      <Row gap={space.md}>
        <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: highlight ? 'rgba(255,255,255,0.15)' : colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={SPORT_ICON[t.sport] ?? 'fitness'} size={24} color={highlight ? colors.accent : colors.brand} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontWeight: '800', fontSize: 16, color: highlight ? colors.white : colors.text }} numberOfLines={1}>{t.name}</Text>
          <Text style={{ fontSize: 13, color: highlight ? 'rgba(255,255,255,0.75)' : colors.muted }} numberOfLines={1}>
            {t.sport} · {data?.count[t.id] ?? 0} players{data?.coachBy[t.id] ? ` · ${data.coachBy[t.id].join(', ')}` : ''}
          </Text>
        </View>
        <Icon name="chevron-forward" size={18} color={highlight ? colors.accent : colors.faint} />
      </Row>
    </Card>
  );

  return (
    <Screen
      title={isCoach ? 'My Team' : 'Teams'}
      subtitle="Rosters, results and upcoming games"
      onRefresh={reload}
      actions={isSuper ? <Button small icon="add" title="New team" onPress={() => setAdding(true)} /> : null}>
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      {loading && !data ? <Loading /> : null}
      {mine.length ? (
        <>
          <SectionTitle title={isCoach ? 'Teams you coach' : 'Your team'} />
          <Grid min={320}>{mine.map((t) => <TeamCard key={t.id} t={t} highlight />)}</Grid>
        </>
      ) : null}
      {others.length ? (
        <>
          <SectionTitle title={mine.length ? 'All teams' : 'AUI teams'} subtitle={`${others.length} teams`} />
          <Grid min={320}>{others.map((t) => <TeamCard key={t.id} t={t} />)}</Grid>
        </>
      ) : null}
      {data && !data.teams.length ? <Card><Empty icon="people-outline" title="No teams yet" /></Card> : null}
      {adding ? <TeamForm onClose={() => setAdding(false)} onSaved={() => { setAdding(false); reload(); }} /> : null}
    </Screen>
  );
}
