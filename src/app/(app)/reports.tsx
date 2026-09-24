import { useMemo, useState } from 'react';
import { Platform, Share, Text, View } from 'react-native';

import { Button, Card, Chips, ErrorBox, Loading, Row, Screen, SectionTitle, Stat, Table, Txt } from '@/components/ui';
import { usePermissions } from '@/lib/auth';
import { money } from '@/lib/db';
import { useLoad } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { addDays, campusNow, fmtDate } from '@/lib/time';
import { colors, space } from '@/lib/theme';
import type { Game, Team } from '@/lib/types';

type Section = { title: string; columns: string[]; rows: (string | number)[][] };
type Report = { title: string; stats: { label: string; value: string }[]; sections: Section[] };

export default function ReportsScreen() {
  const { isSuper } = usePermissions();
  const [scope, setScope] = useState<'overall' | 'team' | 'club'>('overall');
  const [target, setTarget] = useState('');

  const { data, error, loading, reload } = useLoad(async () => {
    const q = <T,>(p: PromiseLike<{ data: T[] | null }>) => Promise.resolve(p).then((r) => r.data ?? []);
    const since = addDays(campusNow().date, -30);
    const [teams, players, games, att, tests, fb, clubs, members, events, txns, inv, bookings, resources] = await Promise.all([
      q<Team>(supabase.from('teams').select('*').order('name')),
      q<{ id: string; team_id: string; full_name: string; position: string | null }>(supabase.from('players').select('id,team_id,full_name,position')),
      q<Game>(supabase.from('games').select('*').order('game_date', { ascending: false })),
      q<{ player_id: string; status: string }>(supabase.from('attendance').select('player_id,status')),
      q<{ team_id: string; player_id: string | null; athlete_name: string; composite: number | null; passed: boolean | null; absent: boolean; session_label: string }>(supabase.from('physical_tests').select('team_id,player_id,athlete_name,composite,passed,absent,session_label')),
      q<{ team_id: string; rating: number }>(supabase.from('session_feedback').select('team_id,rating')),
      q<{ id: string; name: string; category: string | null; president: string | null }>(supabase.from('clubs').select('*').order('name')),
      q<{ club_id: string; full_name: string; role: string }>(supabase.from('club_members').select('club_id,full_name,role')),
      q<{ club_id: string; title: string; event_date: string | null; status: string; budget: number | null }>(supabase.from('club_events').select('*')),
      q<{ txn_type: string; amount: number; team_id: string | null; club_id: string | null; category: string; txn_date: string }>(supabase.from('transactions').select('*')),
      q<{ name: string; quantity: number; min_quantity: number; category: string }>(supabase.from('inventory_items').select('*')),
      q<{ resource_id: string; status: string }>(supabase.from('bookings').select('resource_id,status').gte('booking_date', since)),
      q<{ id: string; name: string }>(supabase.from('booking_resources').select('id,name')),
    ]);
    return { teams, players, games, att, tests, fb, clubs, members, events, txns, inv, bookings, resources };
  }, []);

  const report = useMemo<Report | null>(() => {
    if (!data) return null;
    const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');
    const teamStats = (t: Team) => {
      const pl = data.players.filter((p) => p.team_id === t.id);
      const ids = new Set(pl.map((p) => p.id));
      const g = data.games.filter((x) => x.team_id === t.id && x.status === 'completed');
      const w = g.filter((x) => (x.our_score ?? 0) > (x.their_score ?? 0)).length;
      const l = g.filter((x) => (x.our_score ?? 0) < (x.their_score ?? 0)).length;
      const a = data.att.filter((x) => ids.has(x.player_id));
      const f = data.fb.filter((x) => x.team_id === t.id);
      const spend = data.txns.filter((x) => x.team_id === t.id && x.txn_type === 'expense').reduce((s, x) => s + Number(x.amount), 0);
      return { pl, g, w, l, d: g.length - w - l, a, att: pct(a.filter((x) => x.status === 'present').length, a.length), rating: f.length ? (f.reduce((s, x) => s + x.rating, 0) / f.length).toFixed(1) : '—', spend };
    };
    const clubStats = (c: { id: string }) => {
      const m = data.members.filter((x) => x.club_id === c.id);
      const e = data.events.filter((x) => x.club_id === c.id);
      const spend = data.txns.filter((x) => x.club_id === c.id && x.txn_type === 'expense').reduce((s, x) => s + Number(x.amount), 0);
      return { m, e, spend };
    };

    if (scope === 'team') {
      const t = data.teams.find((x) => x.id === target) ?? data.teams[0];
      if (!t) return null;
      const s = teamStats(t);
      const tests = data.tests.filter((x) => x.team_id === t.id && !x.absent);
      const graded = tests.filter((x) => x.passed != null);
      return {
        title: `${t.name} — Team report`,
        stats: [
          { label: 'Players', value: String(s.pl.length) },
          { label: 'Record (W-D-L)', value: `${s.w}-${s.d}-${s.l}` },
          { label: 'Attendance', value: s.att },
          { label: 'Training rating', value: `${s.rating} / 5` },
          { label: 'Physical pass rate', value: graded.length ? pct(graded.filter((x) => x.passed).length, graded.length) : 'n/a' },
          { label: 'Expenses', value: money(s.spend) },
        ],
        sections: [
          {
            title: 'Roster & attendance',
            columns: ['Player', 'Position', 'Present', 'Absent', 'Excused', 'Rate'],
            rows: s.pl.map((p) => {
              const a = data.att.filter((x) => x.player_id === p.id);
              const c = (st: string) => a.filter((x) => x.status === st).length;
              return [p.full_name, p.position ?? '', c('present'), c('absent'), c('excused'), pct(c('present'), a.length)];
            }),
          },
          { title: 'Physical testing', columns: ['Athlete', 'Session', 'Composite', 'Result'], rows: tests.sort((a, b) => a.session_label.localeCompare(b.session_label) || Number(b.composite) - Number(a.composite)).map((x) => [x.athlete_name, x.session_label, x.composite != null ? Number(x.composite).toFixed(2) : '—', x.passed == null ? '' : x.passed ? 'Pass' : 'Fail']) },
          { title: 'Games', columns: ['Date', 'Opponent', 'Type', 'Score'], rows: data.games.filter((g) => g.team_id === t.id).map((g) => [g.game_date, g.opponent, g.game_type, g.status === 'completed' ? `${g.our_score}-${g.their_score}` : g.status]) },
        ],
      };
    }
    if (scope === 'club') {
      const c = data.clubs.find((x) => x.id === target) ?? data.clubs[0];
      if (!c) return { title: 'Club report', stats: [], sections: [] };
      const s = clubStats(c);
      return {
        title: `${c.name} — Club report`,
        stats: [
          { label: 'Members', value: String(s.m.length) },
          { label: 'Events planned', value: String(s.e.filter((e) => e.status === 'planned').length) },
          { label: 'Events done', value: String(s.e.filter((e) => e.status === 'done').length) },
          { label: 'Expenses', value: money(s.spend) },
        ],
        sections: [
          { title: 'Members', columns: ['Name', 'Role'], rows: s.m.map((m) => [m.full_name, m.role]) },
          { title: 'Events', columns: ['Date', 'Event', 'Status', 'Budget'], rows: s.e.map((e) => [e.event_date ?? '', e.title, e.status, e.budget != null ? money(Number(e.budget)) : '']) },
        ],
      };
    }
    const income = data.txns.filter((x) => x.txn_type === 'income').reduce((s, x) => s + Number(x.amount), 0);
    const expense = data.txns.filter((x) => x.txn_type === 'expense').reduce((s, x) => s + Number(x.amount), 0);
    return {
      title: 'AUI Athletics — Final report (all teams & clubs)',
      stats: [
        { label: 'Teams', value: String(data.teams.length) },
        { label: 'Players', value: String(data.players.length) },
        { label: 'Games played', value: String(data.games.filter((g) => g.status === 'completed').length) },
        { label: 'Overall attendance', value: pct(data.att.filter((x) => x.status === 'present').length, data.att.length) },
        { label: 'Clubs', value: String(data.clubs.length) },
        { label: 'Net balance', value: money(income - expense) },
      ],
      sections: [
        {
          title: 'Teams',
          columns: ['Team', 'Players', 'W-D-L', 'Attendance', 'Rating', 'Expenses'],
          rows: data.teams.map((t) => {
            const s = teamStats(t);
            return [t.name, s.pl.length, `${s.w}-${s.d}-${s.l}`, s.att, s.rating, money(s.spend)];
          }),
        },
        {
          title: 'Clubs',
          columns: ['Club', 'Members', 'Events', 'Expenses'],
          rows: data.clubs.map((c) => {
            const s = clubStats(c);
            return [c.name, s.m.length, s.e.length, money(s.spend)];
          }),
        },
        { title: 'Finance', columns: ['Income', 'Expenses', 'Net'], rows: [[money(income), money(expense), money(income - expense)]] },
        { title: 'Inventory alerts', columns: ['Item', 'Category', 'Qty', 'Min'], rows: data.inv.filter((i) => i.quantity <= i.min_quantity).map((i) => [i.name, i.category, i.quantity, i.min_quantity]) },
        { title: 'Bookings (last 30 days)', columns: ['Resource', 'Bookings'], rows: data.resources.map((r) => [r.name, data.bookings.filter((b) => b.resource_id === r.id && b.status !== 'cancelled').length]) },
      ],
    };
  }, [data, scope, target]);

  if (!isSuper) return <Screen title="Reports"><ErrorBox message="Only super admins can generate reports." /></Screen>;

  const exportReport = async () => {
    if (!report) return;
    const date = fmtDate(campusNow().date, { day: 'numeric', month: 'long', year: 'numeric' });
    if (Platform.OS === 'web') {
      const esc = (s: unknown) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(report.title)}</title><style>
        body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0F1C14;margin:32px}
        h1{color:#0F3F21;margin:0}h2{color:#1B5E32;border-bottom:2px solid #1B5E32;padding-bottom:4px;margin-top:28px}
        .stats{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0}.stat{border:1px solid #E2E9E4;border-radius:10px;padding:10px 14px;min-width:130px}
        .stat b{display:block;font-size:20px}table{border-collapse:collapse;width:100%;font-size:13px}
        th{background:#0F3F21;color:#fff;text-align:left;padding:6px 8px}td{padding:6px 8px;border-bottom:1px solid #E2E9E4}
        tr:nth-child(even) td{background:#F3F9F5}.meta{color:#667468}</style></head><body>
        <h1>${esc(report.title)}</h1><div class="meta">Al Akhawayn University Athletics Department · Generated ${esc(date)}</div>
        <div class="stats">${report.stats.map((s) => `<div class="stat">${esc(s.label)}<b>${esc(s.value)}</b></div>`).join('')}</div>
        ${report.sections.map((sec) => `<h2>${esc(sec.title)}</h2>${sec.rows.length ? `<table><tr>${sec.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>${sec.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>` : '<p class="meta">No data.</p>'}`).join('')}
        <script>window.onload=()=>window.print()</script></body></html>`;
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(html);
        w.document.close();
      }
    } else {
      const text = [
        report.title,
        `Generated ${date}`,
        '',
        ...report.stats.map((s) => `${s.label}: ${s.value}`),
        ...report.sections.flatMap((sec) => ['', `== ${sec.title} ==`, sec.columns.join(' | '), ...sec.rows.map((r) => r.join(' | '))]),
      ].join('\n');
      await Share.share({ title: report.title, message: text });
    }
  };

  return (
    <Screen title="Reports" subtitle="Team, club and department reports" onRefresh={reload} actions={report ? <Button small icon={Platform.OS === 'web' ? 'print-outline' : 'share-outline'} title={Platform.OS === 'web' ? 'Print / PDF' : 'Share'} onPress={exportReport} /> : null}>
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      <Chips value={scope} onChange={(s) => { setScope(s); setTarget(''); }} options={[{ value: 'overall', label: 'Final report' }, { value: 'team', label: 'Team report' }, { value: 'club', label: 'Club report' }]} />
      {data && scope === 'team' ? <Chips value={target || data.teams[0]?.id} onChange={setTarget} options={data.teams.map((t) => ({ value: t.id, label: t.name }))} /> : null}
      {data && scope === 'club' ? (data.clubs.length ? <Chips value={target || data.clubs[0]?.id} onChange={setTarget} options={data.clubs.map((c) => ({ value: c.id, label: c.name }))} /> : <Txt color={colors.muted}>No clubs yet.</Txt>) : null}
      {loading && !data ? <Loading /> : null}
      {report ? (
        <>
          <Card style={{ backgroundColor: colors.brandDark, borderColor: colors.brandDark }}>
            <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 12, letterSpacing: 1 }}>REPORT</Text>
            <Text style={{ color: colors.white, fontSize: 20, fontWeight: '800' }}>{report.title}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>Generated {fmtDate(campusNow().date, { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
          </Card>
          <Row wrap gap={space.md}>
            {report.stats.map((s) => (
              <Stat key={s.label} label={s.label} value={s.value} icon="stats-chart" />
            ))}
          </Row>
          {report.sections.map((sec) => (
            <View key={sec.title}>
              <SectionTitle title={sec.title} />
              <Card padded={false} style={{ overflow: 'hidden' }}>
                {sec.rows.length ? (
                  <Table columns={sec.columns.map((c, i) => ({ key: String(i), label: c, width: i === 0 ? 180 : 110 }))} rows={sec.rows.map((r) => Object.fromEntries(r.map((c, i) => [String(i), String(c)])))} />
                ) : (
                  <Txt color={colors.muted} style={{ padding: space.lg }}>No data yet.</Txt>
                )}
              </Card>
            </View>
          ))}
        </>
      ) : null}
    </Screen>
  );
}
