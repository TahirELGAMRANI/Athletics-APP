import {
  boxScore,
  fmtAvg,
  fmtNum,
  fmtPct,
  fmtPercent,
  hitPct,
  passAvg,
  recAtt,
  setsWon,
  totalBlocks,
  type BoxScore,
  type Line,
} from './stats';
import type { Match } from './types';

export type Column = { key: string; label: string; value: (l: Line) => string };
export type Group = { title: string; columns: Column[] };

const n = (v: number) => fmtNum(v);

/** Box score columns, grouped like the paper stat sheet (NCAA abbreviations). */
export const GROUPS: Group[] = [
  { title: '', columns: [{ key: 'sp', label: 'SP', value: (l) => n(l.sp) }] },
  {
    title: 'Serving',
    columns: [
      { key: 'srvTa', label: 'TA', value: (l) => n(l.srvTa) },
      { key: 'sa', label: 'Aces', value: (l) => n(l.sa) },
      { key: 'se', label: 'Err', value: (l) => n(l.se) },
      { key: 'srvIn', label: 'In%', value: (l) => fmtPercent(l.srvTa - l.se, l.srvTa) },
    ],
  },
  {
    title: 'Hitting',
    columns: [
      { key: 'ta', label: 'TA', value: (l) => n(l.ta) },
      { key: 'k', label: 'Kills', value: (l) => n(l.k) },
      { key: 'ae', label: 'Err', value: (l) => n(l.ae) },
      { key: 'pct', label: 'Pct', value: (l) => fmtPct(hitPct(l)) },
    ],
  },
  {
    title: 'Setting',
    columns: [
      { key: 'ast', label: 'Ast', value: (l) => n(l.ast) },
      { key: 'bhe', label: 'BHE', value: (l) => n(l.bhe) },
    ],
  },
  {
    title: 'Blocking',
    columns: [
      { key: 'bs', label: 'BS', value: (l) => n(l.bs) },
      { key: 'ba', label: 'BA', value: (l) => n(l.ba) },
      { key: 'be', label: 'Err', value: (l) => n(l.be) },
      { key: 'tb', label: 'Tot', value: (l) => fmtNum(totalBlocks(l)) },
    ],
  },
  {
    title: 'Passing / SR',
    columns: [
      { key: 'r3', label: '3', value: (l) => n(l.r3) },
      { key: 'r2', label: '2', value: (l) => n(l.r2) },
      { key: 'r1', label: '1', value: (l) => n(l.r1) },
      { key: 'r0', label: '0', value: (l) => n(l.r0) },
      { key: 'ra', label: 'Att', value: (l) => n(recAtt(l)) },
      { key: 'avg', label: 'Avg', value: (l) => fmtAvg(passAvg(l)) },
    ],
  },
  {
    title: 'Digging',
    columns: [
      { key: 'dig', label: 'Digs', value: (l) => n(l.dig) },
      { key: 'de', label: 'Err', value: (l) => n(l.de) },
    ],
  },
  { title: '', columns: [{ key: 'pts', label: 'PTS', value: (l) => fmtNum(l.pts) }] },
];

export const setScores = (m: Match) => m.sets.map((s) => `${s.us}-${s.them}`).join(', ');

export function resultLine(m: Match) {
  const w = setsWon(m);
  const verdict = !m.finished ? 'In progress' : w.us > w.them ? 'Win' : 'Loss';
  return `${verdict} ${w.us}-${w.them}${m.sets.length ? ` (${setScores(m)})` : ''}`;
}

export function leaders(box: BoxScore) {
  const top = (f: (l: Line) => number, fmt: (v: number) => string = fmtNum) => {
    const best = [...box.players].sort((a, b) => f(b.line) - f(a.line))[0];
    return best && f(best.line) > 0 ? `${best.player.name} (${fmt(f(best.line))})` : '-';
  };
  return [
    { label: 'Kills', value: top((l) => l.k) },
    { label: 'Assists', value: top((l) => l.ast) },
    { label: 'Aces', value: top((l) => l.sa) },
    { label: 'Digs', value: top((l) => l.dig) },
    { label: 'Blocks', value: top(totalBlocks) },
    { label: 'Points', value: top((l) => l.pts) },
  ];
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Printable report laid out like the paper "Volleyball Stats" sheet. */
export function reportHtml(m: Match) {
  const box = boxScore(m);
  const cols = GROUPS.flatMap((g) => g.columns);
  const groupRow = GROUPS.map((g) => `<th colspan="${g.columns.length}" class="${g.title ? 'grp' : 'blank'}">${esc(g.title.toUpperCase())}</th>`).join('');
  const colRow = cols.map((c) => `<th class="sub">${esc(c.label.toUpperCase())}</th>`).join('');
  const rows = box.players
    .map(
      ({ player, line }) =>
        `<tr><td class="name">${esc(player.name)}</td><td>${esc(player.number)}</td>${cols.map((c) => `<td>${c.value(line)}</td>`).join('')}</tr>`,
    )
    .join('');
  const totals = `<tr class="tot"><td class="name">TEAM TOTALS</td><td></td>${cols.map((c) => `<td>${c.value(box.team)}</td>`).join('')}</tr>`;

  const setRows = box.bySet
    .map(
      (s) =>
        `<tr><td>Set ${s.set}</td><td><b>${s.us}-${s.them}</b></td><td>${s.line.k}</td><td>${s.line.ae}</td><td>${s.line.ta}</td><td>${fmtPct(hitPct(s.line))}</td><td>${s.line.ast}</td><td>${s.line.sa}</td><td>${s.line.se}</td><td>${fmtNum(totalBlocks(s.line))}</td><td>${s.line.dig}</td><td>${fmtAvg(passAvg(s.line))}</td><td>${s.oppErr}</td><td>${s.teamErr}</td></tr>`,
    )
    .join('');

  const lead = leaders(box)
    .map((l) => `<div><span>${l.label}</span>${esc(l.value)}</div>`)
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(m.teamName)} vs ${esc(m.opponent)}</title>
<style>
  @page { size: landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #111; margin: 0; padding: 16px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 14px; }
  h1 { font-size: 30px; font-weight: 900; margin: 6px 0 4px; letter-spacing: -0.5px; }
  .result { font-size: 14px; font-weight: 700; color: #1B5E32; }
  table { border-collapse: collapse; width: 100%; }
  .meta td { border: 1px solid #111; padding: 3px 10px; font-size: 11px; min-width: 110px; }
  .meta td:first-child { font-weight: 700; min-width: 90px; }
  .box th, .box td { border: 1px solid #111; font-size: 10px; text-align: center; padding: 4px 3px; }
  .box th.grp { font-size: 11px; font-weight: 800; letter-spacing: 0.5px; }
  .box th.blank { border-top: none; border-left: none; border-right: none; }
  .box th.sub { font-size: 8px; font-weight: 700; }
  .box td.name { text-align: left; padding-left: 6px; white-space: nowrap; font-size: 11px; }
  .box tr.tot td { font-weight: 800; background: #eef4f0; }
  h2 { font-size: 13px; margin: 18px 0 6px; letter-spacing: 0.5px; }
  .sets th, .sets td { border: 1px solid #111; font-size: 10px; padding: 4px; text-align: center; }
  .grid { display: flex; gap: 24px; }
  .grid > div { flex: 1; }
  .kpi { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .kpi div, .lead div { border: 1px solid #111; padding: 5px 8px; font-size: 11px; }
  .kpi span, .lead span { display: block; font-size: 8px; font-weight: 700; color: #555; text-transform: uppercase; }
  .lead { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
  .legend { margin-top: 14px; font-size: 8.5px; color: #555; line-height: 1.5; }
</style></head><body>
<div class="head">
  <div><h1>VOLLEYBALL STATS</h1><div class="result">${esc(resultLine(m))}</div></div>
  <table class="meta" style="width:auto">
    <tr><td>DATE</td><td>${esc(m.date)}</td></tr>
    <tr><td>TEAM NAME</td><td>${esc(m.teamName)}</td></tr>
    <tr><td>OPPONENT</td><td>${esc(m.opponent)}</td></tr>
    ${m.location ? `<tr><td>LOCATION</td><td>${esc(m.location)}</td></tr>` : ''}
  </table>
</div>
<table class="box">
  <tr><th class="blank"></th><th class="blank"></th>${groupRow}</tr>
  <tr><th class="sub" style="text-align:left;padding-left:6px">PLAYER NAME</th><th class="sub">#</th>${colRow}</tr>
  ${rows}${totals}
</table>
<div class="grid">
  <div>
    <h2>SET BY SET</h2>
    <table class="sets">
      <tr><th>Set</th><th>Score</th><th>K</th><th>E</th><th>TA</th><th>Pct</th><th>Ast</th><th>SA</th><th>SE</th><th>Blk</th><th>Digs</th><th>Pass</th><th>Opp Err</th><th>Team Err</th></tr>
      ${setRows}
    </table>
  </div>
  <div style="max-width:380px">
    <h2>TEAM EFFICIENCY</h2>
    <div class="kpi">
      <div><span>Side-out %</span>${fmtPercent(box.sideOut.won, box.sideOut.of)} (${box.sideOut.won}/${box.sideOut.of})</div>
      <div><span>Point-scoring %</span>${fmtPercent(box.pointScoring.won, box.pointScoring.of)} (${box.pointScoring.won}/${box.pointScoring.of})</div>
      <div><span>Longest run</span>${box.longestRun}</div>
      <div><span>Kills / set</span>${box.team.sp ? (box.team.k / box.team.sp).toFixed(2) : '-'}</div>
      <div><span>Opp. errors</span>${box.oppErrors}</div>
      <div><span>Team errors</span>${box.teamErrors}</div>
    </div>
    <h2>LEADERS</h2>
    <div class="lead">${lead}</div>
  </div>
</div>
<div class="legend">SP sets played · TA total attempts · Pct hitting % = (K − E) / TA · In% serves in play · BHE ball-handling errors · BS block solo · BA block assist · Tot blocks = BS + ½BA · Passing 3-2-1-0 scale, Avg = pass rating · PTS = K + Aces + BS + ½BA · Side-out % = points won on opponent serve.</div>
</body></html>`;
}

export function reportCsv(m: Match) {
  const box = boxScore(m);
  const cols = GROUPS.flatMap((g) => g.columns.map((c) => ({ ...c, label: g.title ? `${g.title} ${c.label}` : c.label })));
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [
    [q('Player'), q('#'), ...cols.map((c) => q(c.label))].join(','),
    ...box.players.map(({ player, line }) => [q(player.name), q(player.number), ...cols.map((c) => q(c.value(line)))].join(',')),
    [q('TEAM TOTALS'), q(''), ...cols.map((c) => q(c.value(box.team)))].join(','),
  ];
  return `${q(`${m.teamName} vs ${m.opponent} - ${m.date} - ${resultLine(m)}`)}\n${lines.join('\n')}\n`;
}
