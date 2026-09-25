import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Btn, Card, Icon, Label, Segmented } from '@/components/ui';
import { createMatch, sortPlayers, useStore } from '@/lib/store';
import { colors, radius } from '@/lib/theme';
import type { Side } from '@/lib/types';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function NewMatch() {
  const roster = useStore((s) => s.roster);
  const teamName = useStore((s) => s.teamName);
  const [opponent, setOpponent] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(today);
  const [bestOf, setBestOf] = useState<3 | 5>(5);
  const [firstServe, setFirstServe] = useState<Side>('us');
  const [selected, setSelected] = useState<string[]>(() => roster.map((p) => p.id));

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const start = () => {
    const id = createMatch({ opponent: opponent.trim() || 'Opponent', location: location.trim(), date, bestOf, firstServe, playerIds: selected });
    router.replace(`/match/${id}`);
  };

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Card>
        <Label>Opponent</Label>
        <TextInput value={opponent} onChangeText={setOpponent} placeholder="Opponent team" style={styles.input} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Label>Date</Label>
            <TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" style={styles.input} />
          </View>
          <View style={{ flex: 1.4, gap: 6 }}>
            <Label>Location</Label>
            <TextInput value={location} onChangeText={setLocation} placeholder="Gym" style={styles.input} />
          </View>
        </View>
      </Card>

      <Card>
        <Label>Format</Label>
        <Segmented
          value={bestOf}
          onChange={setBestOf}
          options={[
            { value: 5, label: 'Best of 5' },
            { value: 3, label: 'Best of 3' },
          ]}
        />
        <Label>First serve (set 1)</Label>
        <Segmented
          value={firstServe}
          onChange={setFirstServe}
          options={[
            { value: 'us', label: teamName },
            { value: 'them', label: opponent.trim() || 'Opponent' },
          ]}
        />
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Label style={{ flex: 1 }}>
            Match roster ({selected.length}/{roster.length})
          </Label>
          <Btn small variant="ghost" label={selected.length === roster.length ? 'None' : 'All'} onPress={() => setSelected(selected.length === roster.length ? [] : roster.map((p) => p.id))} />
        </View>
        <View style={styles.grid}>
          {sortPlayers(roster).map((p) => {
            const on = selected.includes(p.id);
            return (
              <Pressable key={p.id} onPress={() => toggle(p.id)} style={[styles.player, on && styles.playerOn]}>
                <Icon name={on ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={on ? colors.brand : colors.faint} />
                <Text numberOfLines={1} style={{ flex: 1, fontWeight: '600', color: colors.text }}>
                  {p.number ? `#${p.number} ` : ''}
                  {p.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Btn label="Start match" icon="play" onPress={start} disabled={selected.length === 0} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 14, maxWidth: 760, width: '100%', alignSelf: 'center', paddingBottom: 40 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    minHeight: 46,
    fontSize: 16,
    backgroundColor: colors.white,
    color: colors.text,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  player: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  playerOn: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
});
