import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Btn, Icon, Label } from '@/components/ui';
import { deleteEvent, endSet, record, reopenMatch, setFirstServe, undo, useMatch } from '@/lib/store';
import { ACTION_LABEL, isSetOver, liveState, setsWon } from '@/lib/stats';
import { colors, radius } from '@/lib/theme';
import type { Action, Match, Player } from '@/lib/types';

type Pad = { title: string; color: string; buttons: { action: Action; label: string; hint?: string }[] };

// Button pad grouped by skill, NCAA stat codes as hints.
const PADS: Pad[] = [
  {
    title: 'Serve',
    color: colors.serve,
    buttons: [
      { action: 'SRV', label: 'In play' },
      { action: 'ACE', label: 'Ace', hint: '+1' },
      { action: 'SE', label: 'Error', hint: '−1' },
    ],
  },
  {
    title: 'Attack',
    color: colors.attack,
    buttons: [
      { action: 'ATT', label: 'Attempt' },
      { action: 'K', label: 'Kill', hint: '+1' },
      { action: 'AE', label: 'Error', hint: '−1' },
    ],
  },
  {
    title: 'Set',
    color: colors.set,
    buttons: [
      { action: 'AST', label: 'Assist' },
      { action: 'BHE', label: 'Ball handling err', hint: '−1' },
    ],
  },
  {
    title: 'Block',
    color: colors.block,
    buttons: [
      { action: 'BS', label: 'Solo', hint: '+1' },
      { action: 'BA', label: 'Assist', hint: '+1' },
      { action: 'BE', label: 'Error', hint: '−1' },
    ],
  },
  {
    title: 'Serve receive',
    color: colors.pass,
    buttons: [
      { action: 'R3', label: '3' },
      { action: 'R2', label: '2' },
      { action: 'R1', label: '1' },
      { action: 'R0', label: '0 / Err', hint: '−1' },
    ],
  },
  {
    title: 'Defense',
    color: colors.dig,
    buttons: [
      { action: 'DIG', label: 'Dig' },
      { action: 'DE', label: 'Dig error', hint: '−1' },
    ],
  },
];

const tap = () => {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
};

export default function LiveStats() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const match = useMatch(id);
  const [selected, setSelected] = useState<string | null>(null);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= 900;

  if (!match) {
    return (
      <View style={{ padding: 24 }}>
        <Text>Match not found.</Text>
      </View>
    );
  }

  const player = match.players.find((p) => p.id === selected) ?? null;

  const onAction = (action: Action) => {
    if (!player) return;
    tap();
    record(match.id, player.id, action);
    setSelected(null);
  };

  const onTeam = (action: Action) => {
    tap();
    record(match.id, null, action);
    setSelected(null);
  };

  const players = <PlayerGrid match={match} selected={selected} onSelect={(pid) => {
        tap();
        setSelected(pid === selected ? null : pid);
      }} wide={wide} />;
  const pad = <StatPad disabled={!player || match.finished} onAction={onAction} />;
  const team = <TeamRow match={match} onTeam={onTeam} />;
  const log = <PlayLog match={match} />;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: `${match.teamName.split(' ')[0]} vs ${match.opponent}`,
          headerRight: () => (
            <Pressable onPress={() => router.push(`/match/${match.id}/report`)} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8 }}>
              <Icon name="document-text" size={20} color={colors.brand} />
              <Text style={{ color: colors.brand, fontWeight: '700' }}>Report</Text>
            </Pressable>
          ),
        }}
      />
      <Scoreboard match={match} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <Prompt player={player} finished={match.finished} />
        {match.finished ? (
          <View style={styles.finished}>
            <Text style={{ fontWeight: '800', fontSize: 16, color: colors.brand }}>Match complete</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn label="View report" icon="document-text" onPress={() => router.push(`/match/${match.id}/report`)} style={{ flex: 1 }} />
              <Btn label="Reopen last set" variant="outline" icon="refresh" onPress={() => reopenMatch(match.id)} />
            </View>
          </View>
        ) : wide ? (
          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: 14 }}>
              {players}
              {log}
            </View>
            <View style={{ flex: 1.1, gap: 14 }}>
              {pad}
              {team}
            </View>
          </View>
        ) : (
          <>
            {players}
            {pad}
            {team}
            {log}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Scoreboard({ match }: { match: Match }) {
  const live = liveState(match);
  const won = setsWon(match);
  const over = !match.finished && isSetOver(match, live.us, live.them);
  const noRallies = !live.events.some((e) => e.point);
  const serveToggle = () => noRallies && setFirstServe(match.id, live.serving === 'us' ? 'them' : 'us');

  return (
    <View style={styles.board}>
      <View style={styles.boardRow}>
        <Side name={match.teamName} score={live.us} sets={won.us} serving={live.serving === 'us'} onServe={serveToggle} />
        <View style={{ alignItems: 'center', gap: 4, minWidth: 74 }}>
          <Text style={styles.setLabel}>{match.finished ? 'FINAL' : `SET ${match.currentSet}`}</Text>
          <Pressable onPress={() => {
              tap();
              undo(match.id);
            }} style={styles.undo} accessibilityLabel="Undo">
            <Icon name="arrow-undo" size={16} color={colors.white} />
            <Text style={{ color: colors.white, fontWeight: '700', fontSize: 12 }}>Undo</Text>
          </Pressable>
        </View>
        <Side name={match.opponent} score={live.them} sets={won.them} serving={live.serving === 'them'} onServe={serveToggle} right />
      </View>
      {match.sets.length > 0 && <Text style={styles.setScores}>{match.sets.map((s, i) => `S${i + 1} ${s.us}-${s.them}`).join('   ')}</Text>}
      {!match.finished && (
        <Btn
          small
          label={over ? `End set ${match.currentSet} (${live.us}-${live.them})` : `End set ${match.currentSet} early`}
          icon="flag"
          variant={over ? 'primary' : 'ghost'}
          color={over ? colors.attack : '#CFE6D6'}
          onPress={() => endSet(match.id)}
          disabled={live.us === live.them}
        />
      )}
    </View>
  );
}

function Side({ name, score, sets, serving, onServe, right }: { name: string; score: number; sets: number; serving: boolean; onServe: () => void; right?: boolean }) {
  return (
    <Pressable onPress={onServe} style={{ flex: 1, alignItems: right ? 'flex-end' : 'flex-start', gap: 2 }}>
      <Text numberOfLines={1} style={styles.teamName}>
        {name}
      </Text>
      <View style={{ flexDirection: right ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
        <Text style={styles.score}>{score}</Text>
        <View style={{ alignItems: 'center', gap: 2 }}>
          <MaterialCommunityIcons name="volleyball" size={18} color={serving ? colors.white : 'transparent'} />
          <Text style={styles.sets}>{sets} sets</Text>
        </View>
      </View>
    </Pressable>
  );
}

function Prompt({ player, finished }: { player: Player | null; finished: boolean }) {
  if (finished) return null;
  return (
    <View style={[styles.prompt, player && { backgroundColor: colors.brand }]}>
      <Icon name={player ? 'person' : 'hand-left'} size={16} color={player ? colors.white : colors.muted} />
      <Text style={{ fontWeight: '700', color: player ? colors.white : colors.muted }}>
        {player ? `#${player.number || '–'} ${player.name}: tap a stat` : '1. Tap a player   2. Tap the stat'}
      </Text>
    </View>
  );
}

/** First name, plus last initial when two players share a first name. */
function shortNames(players: Player[]) {
  const first = (p: Player) => p.name.split(' ')[0];
  const count = new Map<string, number>();
  players.forEach((p) => count.set(first(p), (count.get(first(p)) ?? 0) + 1));
  return new Map(
    players.map((p) => {
      const parts = p.name.split(' ');
      return [p.id, count.get(first(p))! > 1 && parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0]];
    }),
  );
}

function PlayerGrid({ match, selected, onSelect, wide }: { match: Match; selected: string | null; onSelect: (id: string) => void; wide: boolean }) {
  const names = shortNames(match.players);
  return (
    <View style={styles.playerGrid}>
      {match.players.map((p) => {
        const on = p.id === selected;
        return (
          <Pressable key={p.id} onPress={() => onSelect(p.id)} style={[styles.playerBtn, { flexBasis: wide ? '23%' : '31%' }, on && styles.playerOn]}>
            <Text style={[styles.playerNum, on && { color: colors.white }]}>{p.number || '–'}</Text>
            <Text numberOfLines={1} style={[styles.playerName, on && { color: colors.white }]}>
              {names.get(p.id)}
            </Text>
            <Text style={[styles.playerPos, on && { color: '#CFE6D6' }]}>{p.position}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function StatPad({ disabled, onAction }: { disabled: boolean; onAction: (a: Action) => void }) {
  return (
    <View style={{ gap: 10, opacity: disabled ? 0.45 : 1 }}>
      {PADS.map((g) => (
        <View key={g.title} style={{ gap: 6 }}>
          <Label style={{ color: g.color }}>{g.title}</Label>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {g.buttons.map((b) => (
              <Pressable
                key={b.action}
                disabled={disabled}
                onPress={() => onAction(b.action)}
                style={({ pressed }) => [styles.statBtn, { backgroundColor: g.color }, pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] }]}>
                <Text style={styles.statText} numberOfLines={2}>
                  {b.label}
                </Text>
                {b.hint && <Text style={styles.statHint}>{b.hint === '+1' ? 'point us' : 'point them'}</Text>}
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function TeamRow({ match, onTeam }: { match: Match; onTeam: (a: Action) => void }) {
  return (
    <View style={{ gap: 6 }}>
      <Label>Rally ended without a player stat</Label>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Pressable onPress={() => onTeam('OPP_ERR')} style={[styles.statBtn, { backgroundColor: colors.brand }]}>
          <Text style={styles.statText}>{match.opponent} error</Text>
          <Text style={styles.statHint}>point us</Text>
        </Pressable>
        <Pressable onPress={() => onTeam('OPP_PT')} style={[styles.statBtn, { backgroundColor: colors.opp }]}>
          <Text style={styles.statText}>{match.opponent} point</Text>
          <Text style={styles.statHint}>point them</Text>
        </Pressable>
        <Pressable onPress={() => onTeam('TEAM_ERR')} style={[styles.statBtn, { backgroundColor: colors.danger }]}>
          <Text style={styles.statText}>Our fault</Text>
          <Text style={styles.statHint}>net · rotation</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PlayLog({ match }: { match: Match }) {
  const recent = [...match.events].reverse().slice(0, 12);
  const byId = new Map(match.players.map((p) => [p.id, p]));
  if (!recent.length) return null;
  return (
    <View style={styles.log}>
      <Label>Play by play (tap ✕ to remove)</Label>
      {recent.map((e) => {
        const p = e.playerId ? byId.get(e.playerId) : null;
        return (
          <View key={e.id} style={styles.logRow}>
            <Text style={styles.logScore}>
              S{e.set} {e.us}-{e.them}
            </Text>
            <Text style={{ flex: 1, color: colors.text }} numberOfLines={1}>
              {p ? `#${p.number || '–'} ${p.name} · ` : ''}
              <Text style={{ fontWeight: '700' }}>{ACTION_LABEL[e.action]}</Text>
            </Text>
            {e.point && <Text style={{ fontWeight: '800', color: e.point === 'us' ? colors.brand : colors.danger }}>{e.point === 'us' ? '+1' : '−1'}</Text>}
            <Pressable onPress={() => deleteEvent(match.id, e.id)} hitSlop={8}>
              <Icon name="close-circle" size={20} color={colors.faint} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  board: { backgroundColor: colors.brandDark, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, gap: 8 },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  teamName: { color: '#CFE6D6', fontWeight: '700', fontSize: 13, maxWidth: '100%' },
  score: { color: colors.white, fontSize: 44, fontWeight: '900', fontVariant: ['tabular-nums'] },
  sets: { color: '#CFE6D6', fontSize: 11, fontWeight: '700' },
  setLabel: { color: colors.white, fontWeight: '800', letterSpacing: 1, fontSize: 12 },
  setScores: { color: '#CFE6D6', textAlign: 'center', fontWeight: '700', fontSize: 12 },
  undo: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  body: { padding: 12, gap: 14, maxWidth: 1200, width: '100%', alignSelf: 'center' },
  prompt: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  finished: { gap: 10, padding: 16, backgroundColor: colors.brandSoft, borderRadius: radius.lg },
  playerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  playerBtn: {
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  playerOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  playerNum: { fontSize: 22, fontWeight: '900', color: colors.text },
  playerName: { fontSize: 12, fontWeight: '600', color: colors.text, maxWidth: '90%' },
  playerPos: { fontSize: 10, fontWeight: '700', color: colors.faint },
  statBtn: { flex: 1, minHeight: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  statText: { color: colors.white, fontWeight: '800', fontSize: 15, textAlign: 'center' },
  statHint: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '600' },
  log: { gap: 6, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 12 },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  logScore: { width: 64, fontWeight: '700', color: colors.muted, fontVariant: ['tabular-nums'], fontSize: 12 },
});
