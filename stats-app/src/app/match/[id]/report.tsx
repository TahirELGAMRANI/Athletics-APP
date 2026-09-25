import * as Print from 'expo-print';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Btn, Card, Label, Segmented } from '@/components/ui';
import { GROUPS, leaders, reportCsv, reportHtml, resultLine } from '@/lib/report';
import { ACTION_LABEL, boxScore, fmtAvg, fmtNum, fmtPct, fmtPercent, hitPct, passAvg, totalBlocks } from '@/lib/stats';
import { useMatch } from '@/lib/store';
import { colors, radius } from '@/lib/theme';
import type { Match } from '@/lib/types';

const NUM_W = 36;
const COL_W = 44;

export default function Report() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const match = useMatch(id);
  const [set, setSet] = useState(0);
  const [busy, setBusy] = useState(false);

  if (!match) {
    return (
      <View style={{ padding: 24 }}>
        <Text>Match not found.</Text>
      </View>
    );
  }

  const setNumbers = [...new Set(match.events.map((e) => e.set))].sort((a, b) => a - b);
  const box = boxScore(match, set || undefined);
  const full = boxScore(match);

  const exportPdf = async () => {
    setBusy(true);
    try {
      const html = reportHtml(match);
      if (Platform.OS === 'web') {
        const w = window.open('', '_blank');
        if (w) {
          w.document.write(html);
          w.document.close();
          w.focus();
          setTimeout(() => w.print(), 300);
        }
      } else {
        const { uri } = await Print.printToFileAsync({ html, width: 842, height: 595 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Share box score' });
        } else {
          await Print.printAsync({ uri });
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    const csv = reportCsv(match);
    if (Platform.OS === 'web') {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = `${match.date}-${match.opponent.replace(/\W+/g, '-')}.csv`;
      a.click();
    } else {
      await Share.share({ message: csv, title: `${match.teamName} vs ${match.opponent}` });
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Stack.Screen options={{ title: `Box score · vs ${match.opponent}` }} />

      <Card style={{ gap: 6 }}>
        <Text style={styles.title}>VOLLEYBALL STATS</Text>
        <Meta label="Date" value={match.date} />
        <Meta label="Team" value={match.teamName} />
        <Meta label="Opponent" value={match.opponent} />
        {!!match.location && <Meta label="Location" value={match.location} />}
        <Text style={styles.result}>{resultLine(match)}</Text>
      </Card>

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn label={busy ? 'Preparing…' : Platform.OS === 'web' ? 'Print / PDF' : 'Export PDF'} icon="print" onPress={exportPdf} disabled={busy} style={{ flex: 1, minWidth: 160 }} />
        <Btn label="Export CSV" icon="grid" variant="outline" onPress={exportCsv} style={{ flex: 1, minWidth: 140 }} />
      </View>

      {setNumbers.length > 1 && (
        <Segmented value={set} onChange={setSet} options={[{ value: 0, label: 'Match' }, ...setNumbers.map((n) => ({ value: n, label: `Set ${n}` }))]} />
      )}

      <BoxTable match={match} box={box} />

      <Label>Team efficiency{set ? ` · set ${set}` : ''}</Label>
      <View style={styles.kpis}>
        <Kpi label="Hitting %" value={fmtPct(hitPct(box.team))} sub={`${box.team.k} K · ${box.team.ae} E · ${box.team.ta} TA`} />
        <Kpi label="Side-out %" value={fmtPercent(box.sideOut.won, box.sideOut.of)} sub={`${box.sideOut.won}/${box.sideOut.of} on their serve`} />
        <Kpi label="Point-scoring %" value={fmtPercent(box.pointScoring.won, box.pointScoring.of)} sub={`${box.pointScoring.won}/${box.pointScoring.of} on our serve`} />
        <Kpi label="Pass rating" value={fmtAvg(passAvg(box.team))} sub={`${box.team.r0} reception errors`} />
        <Kpi label="Serving" value={fmtPercent(box.team.srvTa - box.team.se, box.team.srvTa)} sub={`${box.team.sa} aces · ${box.team.se} errors`} />
        <Kpi label="Blocks" value={fmtNum(totalBlocks(box.team))} sub={`${box.team.bs} solo · ${box.team.ba} assists`} />
        <Kpi label="Opponent errors" value={String(box.oppErrors)} sub={`Our faults: ${box.teamErrors}`} />
        <Kpi label="Longest run" value={String(box.longestRun)} sub="consecutive points" />
      </View>

      {!set && full.bySet.length > 0 && (
        <>
          <Label>Set by set</Label>
          <ScrollView horizontal>
            <View>
              <View style={[styles.tr, styles.thead]}>
                {['Set', 'Score', 'K', 'E', 'TA', 'Pct', 'Ast', 'SA', 'SE', 'Blk', 'Digs', 'Pass', 'Opp E'].map((h) => (
                  <Text key={h} style={[styles.th, { width: h === 'Score' ? 64 : COL_W }]}>
                    {h}
                  </Text>
                ))}
              </View>
              {full.bySet.map((s) => (
                <View key={s.set} style={styles.tr}>
                  {[
                    `S${s.set}`,
                    `${s.us}-${s.them}`,
                    s.line.k,
                    s.line.ae,
                    s.line.ta,
                    fmtPct(hitPct(s.line)),
                    s.line.ast,
                    s.line.sa,
                    s.line.se,
                    fmtNum(totalBlocks(s.line)),
                    s.line.dig,
                    fmtAvg(passAvg(s.line)),
                    s.oppErr,
                  ].map((v, i) => (
                    <Text key={i} style={[styles.td, { width: i === 1 ? 64 : COL_W, fontWeight: i < 2 ? '800' : '500' }]}>
                      {v}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        </>
      )}

      <Label>Leaders</Label>
      <View style={styles.kpis}>
        {leaders(box).map((l) => (
          <Kpi key={l.label} label={l.label} value={l.value} small />
        ))}
      </View>

      <PlayByPlay match={match} set={set} />
    </ScrollView>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Text style={{ width: 80, fontWeight: '800', fontSize: 12, color: colors.muted }}>{label.toUpperCase()}</Text>
      <Text style={{ flex: 1, fontWeight: '600', color: colors.text }}>{value}</Text>
    </View>
  );
}

function Kpi({ label, value, sub, small }: { label: string; value: string; sub?: string; small?: boolean }) {
  return (
    <View style={styles.kpi}>
      <Label>{label}</Label>
      <Text style={{ fontSize: small ? 14 : 22, fontWeight: '800', color: colors.text }}>{value}</Text>
      {sub && <Text style={{ fontSize: 11, color: colors.muted }}>{sub}</Text>}
    </View>
  );
}

function BoxTable({ match, box }: { match: Match; box: ReturnType<typeof boxScore> }) {
  const NAME_W = useWindowDimensions().width < 600 ? 112 : 170;
  const rows = [...box.players.map((r) => ({ key: r.player.id, name: r.player.name, num: r.player.number, line: r.line })), { key: 'team', name: 'TEAM TOTALS', num: '', line: box.team }];
  return (
    <View style={styles.table}>
      {/* Fixed name column */}
      <View style={{ width: NAME_W + NUM_W }}>
        <View style={[styles.tr, styles.group]} />
        <View style={[styles.tr, styles.thead]}>
          <Text style={[styles.th, { width: NAME_W, textAlign: 'left', paddingLeft: 8 }]}>PLAYER</Text>
          <Text style={[styles.th, { width: NUM_W }]}>#</Text>
        </View>
        {rows.map((r) => (
          <View key={r.key} style={[styles.tr, r.key === 'team' && styles.total]}>
            <Text numberOfLines={1} style={[styles.td, { width: NAME_W, textAlign: 'left', paddingLeft: 8, fontWeight: r.key === 'team' ? '800' : '600' }]}>
              {r.name}
            </Text>
            <Text style={[styles.td, { width: NUM_W }]}>{r.num}</Text>
          </View>
        ))}
      </View>
      <ScrollView horizontal>
        <View>
          <View style={[styles.tr, styles.group]}>
            {GROUPS.map((g, i) => (
              <Text key={i} style={[styles.groupText, { width: g.columns.length * COL_W }]}>
                {g.title.toUpperCase()}
              </Text>
            ))}
          </View>
          <View style={[styles.tr, styles.thead]}>
            {GROUPS.flatMap((g) => g.columns).map((c) => (
              <Text key={c.key} style={[styles.th, { width: COL_W }]}>
                {c.label.toUpperCase()}
              </Text>
            ))}
          </View>
          {rows.map((r) => (
            <View key={r.key} style={[styles.tr, r.key === 'team' && styles.total]}>
              {GROUPS.flatMap((g) => g.columns).map((c) => (
                <Text key={c.key} style={[styles.td, { width: COL_W, fontWeight: r.key === 'team' || c.key === 'pct' || c.key === 'pts' ? '800' : '500' }]}>
                  {c.value(r.line)}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
      {match.players.length === 0 && <Text style={{ padding: 12 }}>No players.</Text>}
    </View>
  );
}

function PlayByPlay({ match, set }: { match: Match; set: number }) {
  const [open, setOpen] = useState(false);
  const byId = new Map(match.players.map((p) => [p.id, p]));
  const events = match.events.filter((e) => !set || e.set === set);
  return (
    <View style={{ gap: 8 }}>
      <Btn label={open ? 'Hide play by play' : `Show play by play (${events.length})`} icon="list" variant="outline" onPress={() => setOpen(!open)} />
      {open && (
        <Card style={{ gap: 4 }}>
          {events.map((e) => {
            const p = e.playerId ? byId.get(e.playerId) : null;
            return (
              <View key={e.id} style={{ flexDirection: 'row', gap: 10 }}>
                <Text style={{ width: 64, color: colors.muted, fontWeight: '700', fontSize: 12 }}>
                  S{e.set} {e.us}-{e.them}
                </Text>
                <Text style={{ flex: 1, fontSize: 13, color: colors.text, fontWeight: e.point ? '700' : '400' }}>
                  {p ? `#${p.number || '–'} ${p.name} · ` : ''}
                  {ACTION_LABEL[e.action]}
                  {e.point ? ` → point ${e.point === 'us' ? match.teamName : match.opponent}` : ''}
                </Text>
              </View>
            );
          })}
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 14, maxWidth: 1200, width: '100%', alignSelf: 'center', paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: '900', letterSpacing: -0.4, color: colors.text, marginBottom: 4 },
  result: { marginTop: 6, fontWeight: '800', color: colors.brand, fontSize: 15 },
  table: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  tr: { flexDirection: 'row', height: 34, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  group: { height: 24, backgroundColor: colors.brandDark, borderBottomWidth: 0 },
  groupText: { color: colors.white, fontWeight: '800', fontSize: 10, letterSpacing: 0.6, textAlign: 'center' },
  thead: { backgroundColor: colors.brandSoft },
  th: { fontSize: 10, fontWeight: '800', color: colors.brandDark, textAlign: 'center' },
  td: { fontSize: 13, color: colors.text, textAlign: 'center', fontVariant: ['tabular-nums'] },
  total: { backgroundColor: '#EEF4F0' },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { flexGrow: 1, flexBasis: 150, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 4 },
});
