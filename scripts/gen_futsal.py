"""Generates supabase/migrations/0005_flexible_physical_tests.sql:
 - adds flexible results/scores columns to physical_tests and back-fills volleyball rows
 - loads the Women's Futsal Physical Testing Results (Day 1 aerobic, Day 2 agility & explosivity)
Values are copied from the official results document. Re-run: python3 scripts/gen_futsal.py"""
import json
from pathlib import Path

def q(v):
    if v is None: return 'null'
    if isinstance(v, bool): return 'true' if v else 'false'
    if isinstance(v, (int, float)): return str(v)
    return "'" + str(v).replace("'", "''") + "'"

def j(v): return q(json.dumps(v, ensure_ascii=False)) + '::jsonb'

# results-document spelling -> roster spelling (roster uses the list given by the director)
ROSTER = {'Hiba Halim': 'Hiba Halym', 'Nourane Hajji': 'Norane Hajji', 'Ghita Adddioui': 'Ghita Addioui'}
def canon(n): return ROSTER.get(n, n)

# ---- Day 1 — Aerobic -------------------------------------------------------
d1_raw = {  # beep stage, 500 m (s), laps in 90 s
    'Ouissal Bouriche': (5.3, 130.51, 7.5), 'Aya Belbasbas': (6.6, 129.56, 7), 'Imane Ahyane': (5.8, 123.43, 7.5),
    'Hiba Halim': (6.1, 125.49, 6.5), 'Nourane Hajji': (4.7, 126.49, 7), 'Hind Ennakhli': (6.2, 125.00, 6.5),
    'Wiam Lamghari': (8.9, 126.89, 7.5), 'Yassmine Ait Oudaoud': (5.3, 121.59, 7.5), 'Rihab Chane': (8.5, 124.44, 7.5),
    'Ghita Addioui': (4.7, 121.46, 7.5), 'Aya Lemsiah': (6.1, 122.00, None),
}
d1_rank = [  # rank, athlete, beep, 500m, laps, composite
    (1, 'Rihab Chane', 9.05, 6.71, 10.00, 8.54), (2, 'Wiam Lamghari', 10.00, 4.00, 10.00, 8.20),
    (3, 'Yassmine Ait Oudaoud', 1.43, 9.86, 10.00, 5.67), (4, 'Imane Ahyane', 2.62, 7.82, 10.00, 5.66),
    (5, 'Aya Lemsiah', 3.33, 9.40, None, 5.61), (6, 'Ghita Addioui', 0.00, 10.00, 10.00, 5.00),
    (7, 'Hind Ennakhli', 3.57, 6.09, 0.00, 3.61), (8, 'Aya Belbasbas', 4.52, 1.05, 5.00, 3.58),
    (9, 'Hiba Halim', 3.33, 5.55, 0.00, 3.33), (10, 'Ouissal Bouriche', 1.43, 0.00, 10.00, 2.72),
    (11, 'Nourane Hajji', 0.00, 4.44, 5.00, 2.33),
]
# ---- Day 2 — Agility & Explosivity -------------------------------------------
d2_raw = {  # 5-10-5 (3 trials), Illinois (2), obstacle sprint (2), free sprint (2)
    'Ouissal Bouriche': ([3.97, 4.07, 4.45], [14.24, 15.28], [10.20, 9.76], [5.80, 5.94]),
    'Aya Belbasbas': ([4.29, 3.93, 3.98], [15.01, 14.71], [9.41, 9.33], [5.35, 5.66]),
    'Imane Ahyane': ([4.24, 4.25, 4.36], [15.13, 15.36], [11.13, 11.26], [5.81, 5.99]),
    'Hiba Halim': ([4.48, 4.43, 4.41], [15.76, 14.86], [11.40, 11.28], [5.76, 5.78]),
    'Nourane Hajji': ([4.50, 4.20, 4.76], [15.36, 15.63], [10.55, 10.70], [6.23, 6.36]),
    'Wiam Lamghari': ([4.52, 4.10, 3.90], [15.06, 15.09], [9.13, 9.04], [5.21, 5.53]),
    'Rihab Chane': ([4.50, 4.11, 4.26], [15.23, 14.81], [11.61, 11.46], [5.79, 5.98]),
    'Ghita Addioui': ([4.25, 3.68, 4.23], [14.03, 13.38], [9.40, 8.91], [5.49, 5.76]),
    'Aya Lemsiah': ([4.01, 4.03, 4.06], [14.46, 14.58], [9.84, 9.512], [5.78, 6.06]),
}
d2_rank = [  # rank, athlete, 5-10-5, illinois, obstacle, sprint, composite
    (1, 'Ghita Addioui', 10.00, 10.00, 10.00, 7.25, 9.31), (2, 'Wiam Lamghari', 6.99, 1.52, 9.49, 10.00, 7.00),
    (3, 'Aya Belbasbas', 6.58, 3.28, 8.35, 8.63, 6.71), (4, 'Ouissal Bouriche', 6.03, 5.66, 6.67, 4.22, 5.65),
    (5, 'Aya Lemsiah', 5.48, 4.55, 7.60, 4.41, 5.51), (6, 'Rihab Chane', 4.11, 2.78, 0.00, 4.31, 2.80),
    (7, 'Imane Ahyane', 2.33, 1.16, 1.29, 4.12, 2.23), (8, 'Hiba Halim', 0.00, 2.53, 0.71, 4.61, 1.96),
    (9, 'Nourane Hajji', 2.88, 0.00, 3.57, 0.00, 1.61),
]
d2_absent = ['Hind Ennakhli', 'Yassmine Ait Oudaoud']

rows = []  # (athlete, session, order, results, scores, composite, rank, absent, notes)
for rk, name, sb, s5, sl, comp in d1_rank:
    beep, t500, laps = d1_raw[name]
    results = [
        {'test': 'Beep test', 'unit': 'stage', 'trials': [beep], 'best': beep},
        {'test': '500 m run', 'unit': 's', 'trials': [t500], 'best': t500},
        {'test': 'Laps in 90 s (20 m/lap)', 'unit': 'laps', 'trials': [laps] if laps is not None else [], 'best': laps},
    ]
    scores = [{'label': 'Beep', 'score': sb, 'weight': 0.5}, {'label': '500 m', 'score': s5, 'weight': 0.3},
              {'label': 'Laps', 'score': sl, 'weight': 0.2}]
    note = 'No laps result — composite averaged from Beep + 500 m only' if laps is None else None
    rows.append((name, 'Day 1 — Aerobic', 1, results, scores, comp, rk, False, note))
for rk, name, sa, si, so, ss, comp in d2_rank:
    a, il, ob, sp = d2_raw[name]
    results = [
        {'test': '5-10-5 pro agility', 'unit': 's', 'trials': a, 'best': min(a)},
        {'test': 'Illinois agility', 'unit': 's', 'trials': il, 'best': min(il)},
        {'test': '30 m slalom sprint with agility-ladder obstacles', 'unit': 's', 'trials': ob, 'best': min(ob)},
        {'test': 'Free sprint', 'unit': 's', 'trials': sp, 'best': min(sp)},
    ]
    scores = [{'label': '5-10-5', 'score': sa, 'weight': 0.25}, {'label': 'Illinois', 'score': si, 'weight': 0.25},
              {'label': 'Obstacle', 'score': so, 'weight': 0.25}, {'label': 'Sprint', 'score': ss, 'weight': 0.25}]
    note = 'First 5-10-5 trial marked with * on the original sheet' if name == 'Rihab Chane' else None
    rows.append((name, 'Day 2 — Agility & Explosivity', 2, results, scores, comp, rk, False, note))
for name in d2_absent:
    rows.append((name, 'Day 2 — Agility & Explosivity', 2, [], [], None, None, True, 'Absent'))

METHOD = {
    'Day 1 — Aerobic': 'Composite = Beep × 50% + 500 m × 30% + Laps × 20%. Beep/Laps score = (value − min) ÷ (max − min) × 10; 500 m score = (max − value) ÷ (max − min) × 10.',
    'Day 2 — Agility & Explosivity': 'Composite = average of 4 scores (25% each). Score = (max − value) ÷ (max − min) × 10 (lower time is better).',
}

out = ['-- GENERATED by scripts/gen_futsal.py', '',
'-- 1. Flexible test format: any tests, any number of trials, any scoring',
'alter table public.physical_tests',
'  add column if not exists results jsonb not null default \'[]\'::jsonb,   -- [{test, unit, trials[], best}]',
'  add column if not exists scores jsonb not null default \'[]\'::jsonb,    -- [{label, score, weight}]',
'  add column if not exists method text,',
'  add column if not exists session_order int not null default 1,',
'  add column if not exists absent boolean not null default false;', '',
'-- 2. Back-fill the volleyball rows into the flexible format',
"""update public.physical_tests set
  results = jsonb_build_array(
    jsonb_build_object('test', 'Beep test', 'unit', 'stage', 'trials', jsonb_build_array(beep_stage), 'best', beep_stage),
    jsonb_build_object('test', 'Pro agility (5-10-5)', 'unit', 's', 'trials', jsonb_build_array(agility_t1, agility_t2), 'best', best_agility),
    jsonb_build_object('test', 'Illinois agility', 'unit', 's', 'trials', jsonb_build_array(illinois_t1, illinois_t2), 'best', best_illinois),
    jsonb_build_object('test', '30 m sprint', 'unit', 's', 'trials', jsonb_build_array(sprint_t1, sprint_t2), 'best', best_sprint),
    jsonb_build_object('test', 'Distance in 1 min 30 s (laps × 20 m)', 'unit', 'm', 'trials', jsonb_build_array(laps * 20), 'best', distance_m)),
  scores = jsonb_build_array(
    jsonb_build_object('label', 'Beep', 'score', score_beep, 'weight', 0.2),
    jsonb_build_object('label', 'Agility', 'score', score_agility, 'weight', 0.2),
    jsonb_build_object('label', 'Illinois', 'score', score_illinois, 'weight', 0.2),
    jsonb_build_object('label', 'Sprint', 'score', score_sprint, 'weight', 0.2),
    jsonb_build_object('label', 'Distance', 'score', score_distance, 'weight', 0.2)),
  method = 'Composite = average of 5 scores (20% each). Pass threshold: 4.0 / 10.'
where results = '[]'::jsonb and score_beep is not null;""", '',
'-- 3. Women\'s Futsal physical testing results',
'insert into public.physical_tests (team_id, player_id, athlete_name, session_label, session_order, results, scores, composite, rank, passed, absent, method, notes)',
'select t.id, p.id, v.athlete, v.session, v.ord, v.results, v.scores, v.comp, v.rk, null, v.absent, v.method, v.note from (values']
vals = []
for name, sess, order, results, scores, comp, rk, absent, note in rows:
    vals.append('  (' + ', '.join([q(canon(name)), q(sess), str(order), j(results), j(scores), q(comp) + '::numeric', q(rk) + '::int', q(absent), q(METHOD[sess]), q(note)]) + ')')
out.append(',\n'.join(vals))
out.append(') v(athlete, session, ord, results, scores, comp, rk, absent, method, note)')
out.append("cross join public.teams t left join public.players p on p.team_id = t.id and lower(p.full_name) = lower(v.athlete)")
out.append("where t.name = 'Women''s Futsal'")
out.append("  and not exists (select 1 from public.physical_tests x where x.team_id = t.id and x.session_label = v.session and x.athlete_name = v.athlete);")
Path(__file__).resolve().parent.parent.joinpath('supabase/migrations/0005_flexible_physical_tests.sql').write_text('\n'.join(out) + '\n')
print(len(rows), 'futsal rows')
