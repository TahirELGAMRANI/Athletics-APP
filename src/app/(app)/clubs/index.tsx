import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ClubForm, type Club } from '@/components/ClubForm';
import { Badge, Button, Card, Empty, ErrorBox, Grid, Icon, Loading, Row, Screen, Txt } from '@/components/ui';
import { usePermissions } from '@/lib/auth';
import { useLoad } from '@/lib/hooks';
import { must, supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export default function ClubsScreen() {
  const { isSuper } = usePermissions();
  const [adding, setAdding] = useState(false);
  const { data, error, loading, reload } = useLoad(async () => {
    const [clubs, members, events] = await Promise.all([
      supabase.from('clubs').select('*').order('name'),
      supabase.from('club_members').select('club_id'),
      supabase.from('club_events').select('club_id,status'),
    ]);
    const m: Record<string, number> = {};
    (members.data ?? []).forEach((x) => (m[x.club_id] = (m[x.club_id] ?? 0) + 1));
    const e: Record<string, number> = {};
    (events.data ?? []).filter((x) => x.status === 'planned').forEach((x) => (e[x.club_id] = (e[x.club_id] ?? 0) + 1));
    return { clubs: must(clubs) as Club[], m, e };
  }, []);

  return (
    <Screen title="Clubs" subtitle="Sports clubs, members and events" onRefresh={reload} actions={isSuper ? <Button small icon="add" title="New club" onPress={() => setAdding(true)} /> : null}>
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      {loading && !data ? <Loading /> : null}
      {data && data.clubs.length === 0 ? (
        <Card><Empty icon="sparkles-outline" title="No clubs yet" subtitle={isSuper ? 'Create the first club — e.g. Hiking Club, Chess Club, Running Club.' : 'Clubs added by the athletics office will appear here.'} /></Card>
      ) : null}
      <Grid min={300}>
        {(data?.clubs ?? []).map((c) => (
          <Card key={c.id} onPress={() => router.push(`/clubs/${c.id}`)} style={{ gap: 10 }}>
            <Row>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="sparkles" size={22} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt v="h3">{c.name}</Txt>
                <Txt v="caption" color={colors.muted}>{c.category ?? 'Club'}{c.president ? ` · President: ${c.president}` : ''}</Txt>
              </View>
            </Row>
            {c.description ? <Txt v="small" color={colors.muted} numberOfLines={2}>{c.description}</Txt> : null}
            <Row gap={6}>
              <Badge text={`${data?.m[c.id] ?? 0} members`} tone="brand" icon="people" />
              <Badge text={`${data?.e[c.id] ?? 0} upcoming events`} tone="info" icon="calendar" />
            </Row>
          </Card>
        ))}
      </Grid>
      {adding ? <ClubForm onClose={() => setAdding(false)} onSaved={() => { setAdding(false); reload(); }} /> : null}
    </Screen>
  );
}
