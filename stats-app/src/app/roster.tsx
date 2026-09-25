import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Btn, Card, Icon, Label } from '@/components/ui';
import { removePlayer, savePlayer, setTeamName, sortPlayers, uid, useStore } from '@/lib/store';
import { colors, radius } from '@/lib/theme';
import type { Player, Position } from '@/lib/types';

const POSITIONS: Position[] = ['OH', 'MB', 'OPP', 'S', 'L', 'DS'];

export default function Roster() {
  const teamName = useStore((s) => s.teamName);
  const roster = useStore((s) => s.roster);
  const [editing, setEditing] = useState<Player | null>(null);

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Card>
        <Label>Team name</Label>
        <TextInput value={teamName} onChangeText={setTeamName} style={styles.input} placeholder="Team name" />
      </Card>

      <Card>
        <Label>{editing && roster.some((p) => p.id === editing.id) ? 'Edit player' : 'Add player'}</Label>
        <PlayerForm key={editing?.id ?? 'new'} initial={editing} onDone={() => setEditing(null)} />
      </Card>

      <Label>Players ({roster.length})</Label>
      <Card style={{ padding: 0, gap: 0 }}>
        {sortPlayers(roster).map((p, i) => (
          <Pressable key={p.id} onPress={() => setEditing(p)} style={[styles.row, i > 0 && styles.rowBorder]}>
            <View style={styles.num}>
              <Text style={styles.numText}>{p.number || '–'}</Text>
            </View>
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.text }}>{p.name}</Text>
            <Text style={styles.pos}>{p.position}</Text>
            <Icon name="create-outline" size={18} color={colors.faint} />
          </Pressable>
        ))}
      </Card>
    </ScrollView>
  );
}

function PlayerForm({ initial, onDone }: { initial: Player | null; onDone: () => void }) {
  const [number, setNumber] = useState(initial?.number ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [position, setPosition] = useState<Position>(initial?.position ?? 'OH');

  const save = () => {
    if (!name.trim()) return;
    savePlayer({ id: initial?.id ?? uid(), number: number.trim(), name: name.trim(), position });
    setNumber('');
    setName('');
    onDone();
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput value={number} onChangeText={setNumber} placeholder="#" keyboardType="number-pad" maxLength={3} style={[styles.input, { width: 64, textAlign: 'center' }]} />
        <TextInput value={name} onChangeText={setName} placeholder="Player name" style={[styles.input, { flex: 1 }]} onSubmitEditing={save} />
      </View>
      <View style={styles.chips}>
        {POSITIONS.map((p) => (
          <Pressable key={p} onPress={() => setPosition(p)} style={[styles.chip, position === p && styles.chipOn]}>
            <Text style={[styles.chipText, position === p && { color: colors.white }]}>{p}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn label={initial ? 'Save' : 'Add player'} icon="checkmark" onPress={save} disabled={!name.trim()} style={{ flex: 1 }} />
        {initial && (
          <>
            <Btn label="Cancel" variant="outline" onPress={onDone} />
            <Btn
              label="Remove"
              variant="danger"
              icon="trash"
              onPress={() => {
                removePlayer(initial.id);
                onDone();
              }}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 14, maxWidth: 760, width: '100%', alignSelf: 'center' },
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  num: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  numText: { fontWeight: '800', color: colors.brand },
  pos: { fontWeight: '700', color: colors.muted, fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, minHeight: 36, justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontWeight: '700', color: colors.text },
});
