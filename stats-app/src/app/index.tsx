import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Btn, Card, Icon, Label } from '@/components/ui';
import { resultLine } from '@/lib/report';
import { deleteMatch, useStore } from '@/lib/store';
import { colors, radius } from '@/lib/theme';
import type { Match } from '@/lib/types';

export default function Home() {
  const matches = useStore((s) => s.matches);
  const teamName = useStore((s) => s.teamName);
  const rosterSize = useStore((s) => s.roster.length);
  const insets = useSafeAreaInsets();

  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.hero}>
        <Icon name="stats-chart" size={28} color={colors.white} />
        <Text style={styles.heroTitle}>{teamName}</Text>
        <Text style={styles.heroSub}>Tap-only match stats · NCAA box score · {rosterSize} players</Text>
      </View>

      <View style={styles.actions}>
        <Btn label="New match" icon="add-circle" onPress={() => router.push('/new-match')} style={{ flex: 1 }} />
        <Btn label="Roster" icon="people" variant="outline" onPress={() => router.push('/roster')} style={{ flex: 1 }} />
      </View>

      <Label>Matches</Label>
      {matches.length === 0 && (
        <Card>
          <Text style={{ color: colors.muted }}>No matches yet. Start one with “New match”: tap a player, then tap what they did. The score and the box score update on their own.</Text>
        </Card>
      )}
      {matches.map((m) => (
        <MatchRow key={m.id} match={m} />
      ))}
    </ScrollView>
  );
}

function MatchRow({ match }: { match: Match }) {
  const [confirm, setConfirm] = useState(false);
  const live = !match.finished;
  return (
    <Card style={{ gap: 10 }}>
      <Pressable onPress={() => router.push(live ? `/match/${match.id}` : `/match/${match.id}/report`)} style={styles.matchHead}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.matchTitle}>vs {match.opponent}</Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            {match.date}
            {match.location ? ` · ${match.location}` : ''}
          </Text>
          <Text style={{ fontWeight: '700', color: live ? colors.attack : colors.brand }}>{resultLine(match)}</Text>
        </View>
        <Icon name="chevron-forward" size={20} color={colors.faint} />
      </Pressable>
      <View style={styles.rowBtns}>
        {live && <Btn small label="Continue" icon="play" onPress={() => router.push(`/match/${match.id}`)} />}
        <Btn small label="Report" icon="document-text" variant="outline" onPress={() => router.push(`/match/${match.id}/report`)} />
        <View style={{ flex: 1 }} />
        <Btn
          small
          label={confirm ? 'Tap to confirm' : 'Delete'}
          icon="trash"
          variant={confirm ? 'danger' : 'ghost'}
          color={colors.danger}
          onPress={() => (confirm ? deleteMatch(match.id) : setConfirm(true))}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 14, maxWidth: 760, width: '100%', alignSelf: 'center' },
  hero: { backgroundColor: colors.brand, borderRadius: radius.lg, padding: 20, gap: 6 },
  heroTitle: { color: colors.white, fontSize: 22, fontWeight: '800' },
  heroSub: { color: '#CFE6D6', fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10 },
  matchHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  matchTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  rowBtns: { flexDirection: 'row', gap: 8, alignItems: 'center' },
});
