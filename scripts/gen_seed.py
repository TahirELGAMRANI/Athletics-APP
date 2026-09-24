"""Generates supabase/migrations/0002_seed_reference.sql from the official AUI program posters
and the Volleyball 1st Physical Testing results. Re-run: python3 scripts/gen_seed.py"""
from pathlib import Path

def q(v):
    if v is None: return 'null'
    if isinstance(v, bool): return 'true' if v else 'false'
    if isinstance(v, (int, float)): return str(v)
    return "'" + str(v).replace("'", "''") + "'"

facilities = [
    ('gymnasium', 'Gymnasium', 'Main indoor court — futsal, basketball, volleyball, badminton, table tennis'),
    ('fitness-center', 'Fitness Center', 'Cardio and strength equipment'),
    ('soccer-field', 'Soccer Field (Annex)', 'Football, rugby and American football'),
    ('martial-arts-room', 'Martial Arts Room', 'Boxing, fight camp and kickboxing'),
    ('swimming-pool', 'Swimming Pool', 'Indoor pool'),
    ('padel-court', 'Padel Court', 'Bookable same-day outside program hours'),
    ('tennis-court-1', 'Tennis Court 1', 'Bookable same-day'),
    ('tennis-court-2', 'Tennis Court 2', 'Bookable same-day'),
    ('old-weight-room', 'Old Weight Room (Old Fitness Room)', 'Secondary training room used by teams on alternate days'),
]

teams = [
    ("Women's Futsal", 'Futsal', 'women'), ("Men's Futsal", 'Futsal', 'men'),
    ("Women's Basketball", 'Basketball', 'women'), ("Men's Basketball", 'Basketball', 'men'),
    ("Women's Volleyball", 'Volleyball', 'women'), ("Men's Volleyball", 'Volleyball', 'men'),
    ('Badminton', 'Badminton', 'mixed'), ('Table Tennis', 'Table Tennis', 'mixed'),
    ('Boxing Club', 'Boxing', 'mixed'), ('Fight Camp', 'MMA / Fight Camp', 'mixed'),
    ('Kick Boxing', 'Kickboxing', 'mixed'), ('Padel', 'Padel', 'mixed'),
    ('Football Team A', 'Football', 'mixed'), ('Football Team B', 'Football', 'mixed'),
    ('Rugby', 'Rugby', 'mixed'), ('American Football', 'American Football', 'mixed'),
]

OFR = 'old-weight-room'
GYM = 'gymnasium'
rows = []  # (facility, dow, start, end, activity, team, note)
def add(fac, days, s, e, team, activity=None, note=None, alt=None):
    for d in days:
        f = alt.get(d, fac) if alt else fac
        rows.append((f, d, s, e, activity or team, team, note))

wk = [1, 2, 3, 4, 5]
# Gymnasium program — "(Old Fitness Room)" days move to the old weight room
add(GYM, wk, '14:30', '16:00', "Women's Futsal", alt={2: OFR, 4: OFR})
add(GYM, wk, '22:00', '23:00', "Men's Futsal", note='End time not listed on the official poster', alt={2: OFR, 4: OFR})
add(GYM, wk, '16:00', '17:30', "Women's Basketball", alt={1: OFR, 3: OFR})
add(GYM, wk, '17:30', '19:00', "Men's Basketball", alt={1: OFR, 3: OFR})
add(GYM, wk, '19:00', '20:30', "Women's Volleyball", alt={2: OFR, 4: OFR})
add(GYM, wk, '20:30', '22:00', "Men's Volleyball", alt={2: OFR, 4: OFR})
add(GYM, [2, 4], '19:00', '21:30', 'Table Tennis')
add(GYM, [2, 4], '21:30', '23:00', 'Badminton')
# Martial arts program
add('martial-arts-room', [1, 4], '20:00', '22:00', 'Boxing Club')
add('martial-arts-room', [2, 4], '18:00', '20:00', 'Fight Camp')
add('martial-arts-room', [5], '19:00', '20:00', 'Fight Camp')
add('martial-arts-room', [2, 4], '20:00', '22:00', 'Kick Boxing')
add('martial-arts-room', [5], '20:00', '21:00', 'Kick Boxing')
# Padel program
add('padel-court', [1, 2, 3, 4], '20:00', '22:00', 'Padel')
# Soccer field annex program
add('soccer-field', [1, 3], '20:00', '22:00', 'Football Team A')
add('soccer-field', [2, 4], '20:00', '22:00', 'Football Team B')
add('soccer-field', [1, 3], '22:00', '23:30', 'Rugby')
add('soccer-field', [2, 4], '22:00', '23:30', 'American Football')

resources = [
    # slug, name, kind, facility, capacity, slot, same_day, notice, roles, sort
    ('bikes', 'Bikes', 'bike', None, 10, 60, True, 0, None, 1),
    ('padel', 'Padel Court', 'padel', 'padel-court', 1, 60, True, 0, None, 2),
    ('tennis-1', 'Tennis Court 1', 'tennis', 'tennis-court-1', 1, 60, True, 0, None, 3),
    ('tennis-2', 'Tennis Court 2', 'tennis', 'tennis-court-2', 1, 60, True, 0, None, 4),
    ('ice-bath', 'Ice Bath', 'ice_bath', None, 1, 30, False, 24, '{super_admin,admin,coach,player}', 5),
    ('sauna', 'Sauna', 'sauna', None, 4, 60, False, 0, '{super_admin,admin,coach,player}', 6),
]

roster = [
    ('Oumnia Rida', 'Outside Hitter', 9, 'Captain'),
    ('Rim Namiri', 'Setter', 2, 'Vice Captain'),
    ('Zineb Andaloussi', 'Setter', None, None),
    ('Meryem Ahmedechrif', 'Outside Hitter', None, None),
    ('Rim Maouni', 'Outside Hitter', None, None),
    ('Hajar Ouardighi', 'Outside Hitter', 13, None),
    ('Weam Rochdi', 'Outside Hitter', 15, None),
    ('Nourane Benmansour', 'Middle Blocker', 3, None),
    ('Amal Kabbaj', 'Middle Blocker', 5, None),
    ('Riham', 'Middle Blocker', None, None),
    ('Hiba', 'Opposite Hitter', None, None),
    ('Iman El Isamy', 'Opposite Hitter', 10, None),
    ('Aya Kamili', 'Libero', 1, None),
    ('Alaa', 'Libero', None, None),
]

# name in results doc -> roster name (None = athlete tested but not on the current roster)
link = {'Oumnia': 'Oumnia Rida', 'Rim': 'Rim Namiri', 'Amal': 'Amal Kabbaj', 'Sara': None,
        'Aya': 'Aya Kamili', 'Meryem': 'Meryem Ahmedechrif', 'Lilya': None, 'Hiba': 'Hiba',
        'Riham': 'Riham', 'Hossna': None}
raw = {  # beep, agi1, agi2, ill1, ill2, spr1, spr2, laps
    'Oumnia': (4.30, 4.33, 4.19, 14.58, 14.91, 5.64, 5.64, 7),
    'Rim': (5.70, 4.25, 4.35, 17.03, 15.81, 5.73, 6.86, 8),
    'Amal': (4.40, 4.56, 4.42, 19.05, 19.15, 6.00, 5.88, 7),
    'Sara': (4.40, 4.12, 4.12, 15.45, 17.91, 5.60, 5.64, 6.5),
    'Aya': (7.00, 4.35, 4.29, 16.31, 16.20, 5.41, 5.66, 7.5),
    'Meryem': (5.00, 4.18, 4.19, 16.65, 16.23, 5.46, 5.34, 7),
    'Lilya': (4.40, 4.72, 4.65, 20.01, 20.17, 6.28, 6.31, 6.5),
    'Hiba': (4.40, 4.39, 4.15, 16.76, 16.20, 5.35, 5.42, 7),
    'Riham': (6.00, 4.19, 4.19, 17.22, 16.58, 5.81, 5.09, 6.5),
    'Hossna': (7.00, 4.42, 4.35, 16.58, 16.61, 6.16, 6.02, 7),
}
# Best trial table exactly as published in the report
best = {  # beep, agility, illinois, sprint, distance
    'Oumnia': (4.30, 4.19, 14.58, 5.64, 140), 'Rim': (5.70, 4.25, 15.81, 5.73, 160),
    'Amal': (4.40, 4.42, 19.05, 5.88, 140), 'Sara': (4.40, 4.12, 15.45, 5.60, 130),
    'Aya': (7.00, 4.29, 16.20, 5.41, 150), 'Meryem': (5.00, 4.18, 16.23, 5.34, 140),
    'Lilya': (4.40, 4.65, 20.01, 6.28, 130), 'Hiba': (4.40, 4.15, 16.20, 5.35, 140),
    'Riham': (6.00, 4.19, 16.58, 5.09, 130), 'Hossna': (7.00, 4.35, 16.58, 6.02, 140),
}
ranking = [  # rank, name, beep, agility, illinois, sprint, distance, composite, pass
    (1, 'Aya', 10.00, 6.79, 7.02, 7.31, 6.67, 7.56, True),
    (2, 'Rim', 5.19, 7.55, 7.73, 4.62, 10.00, 7.02, True),
    (3, 'Riham', 6.30, 8.68, 6.32, 10.00, 0.00, 6.26, True),
    (4, 'Meryem', 2.59, 8.87, 6.96, 7.90, 3.33, 5.93, True),
    (5, 'Hiba', 0.37, 9.43, 7.02, 7.82, 3.33, 5.59, True),
    (6, 'Hossna', 10.00, 5.66, 6.32, 2.18, 3.33, 5.50, True),
    (7, 'Oumnia', 0.00, 8.68, 10.00, 5.38, 3.33, 5.48, True),
    (8, 'Sara', 0.37, 10.00, 8.40, 5.71, 0.00, 4.90, True),
    (9, 'Amal', 0.37, 4.34, 1.77, 3.36, 3.33, 2.63, False),
    (10, 'Lilya', 0.37, 0.00, 0.00, 0.00, 0.00, 0.07, False),
]

out = ['-- GENERATED by scripts/gen_seed.py — reference data from the official program posters',
       '-- and the Volleyball 1st Physical Testing report.', '']
out.append('insert into public.facilities (slug, name, description, sort) values')
out.append(',\n'.join(f'  ({q(s)}, {q(n)}, {q(d)}, {i})' for i, (s, n, d) in enumerate(facilities)) + ';\n')
out.append('insert into public.teams (name, sport, gender) values')
out.append(',\n'.join(f'  ({q(n)}, {q(s)}, {q(g)})' for n, s, g in teams) + ';\n')
out.append('insert into public.facility_schedule (facility_id, day_of_week, start_time, end_time, activity, team_id, note)')
out.append('select f.id, v.d, v.s::time, v.e::time, v.act, t.id, v.note from (values')
out.append(',\n'.join(f'  ({q(f)}, {d}, {q(s)}, {q(e)}, {q(a)}, {q(t)}, {q(n)})' for f, d, s, e, a, t, n in rows))
out.append(') v(fac, d, s, e, act, team, note)')
out.append('join public.facilities f on f.slug = v.fac left join public.teams t on t.name = v.team;\n')
out.append('insert into public.booking_resources (slug, name, kind, facility_id, capacity, slot_minutes, same_day_only, min_notice_hours, allowed_roles, sort)')
out.append('select v.slug, v.name, v.kind, f.id, v.cap, v.slot, v.same_day, v.notice, coalesce(v.roles::public.app_role[], \'{super_admin,admin,coach,player,student}\'), v.sort from (values')
out.append(',\n'.join(f'  ({q(s)}, {q(n)}, {q(k)}, {q(f)}, {c}, {sl}, {q(sd)}, {nt}, {q(r)}, {so})'
                      for s, n, k, f, c, sl, sd, nt, r, so in resources))
out.append(') v(slug, name, kind, fac, cap, slot, same_day, notice, roles, sort)')
out.append('left join public.facilities f on f.slug = v.fac;\n')
out.append('insert into public.players (team_id, full_name, position, jersey_number, team_role)')
out.append("select t.id, v.n, v.p, v.num, v.r from (values")
out.append(',\n'.join(f'  ({q(n)}, {q(p)}, {q(num)}::int, {q(r)})' for n, p, num, r in roster))
out.append(") v(n, p, num, r) cross join public.teams t where t.name = 'Women''s Volleyball';\n")

vals = []
for rk, name, sb, sa, si, ss, sd, comp, ok in ranking:
    r = raw[name]; b = best[name]
    vals.append('  (' + ', '.join(q(x) for x in [name, link[name], r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7],
                                                 b[1], b[2], b[3], b[4], sb, sa, si, ss, sd, comp, rk, ok,
                                                 None if link[name] else 'Tested athlete not on the current roster']) + ')')
out.append('insert into public.physical_tests (team_id, player_id, athlete_name, session_label, beep_stage, agility_t1, agility_t2,')
out.append('  illinois_t1, illinois_t2, sprint_t1, sprint_t2, laps, best_agility, best_illinois, best_sprint, distance_m,')
out.append('  score_beep, score_agility, score_illinois, score_sprint, score_distance, composite, rank, passed, notes)')
out.append("select t.id, p.id, v.n, '1st Physical Testing', v.beep, v.a1, v.a2, v.i1, v.i2, v.s1, v.s2, v.laps, v.ba, v.bi, v.bs, v.dist,")
out.append('  v.sb, v.sa, v.si, v.ss, v.sd, v.comp, v.rk, v.ok, v.note from (values')
out.append(',\n'.join(vals))
out.append(') v(n, roster, beep, a1, a2, i1, i2, s1, s2, laps, ba, bi, bs, dist, sb, sa, si, ss, sd, comp, rk, ok, note)')
out.append("cross join public.teams t left join public.players p on p.full_name = v.roster and p.team_id = t.id")
out.append("where t.name = 'Women''s Volleyball';\n")

out.append("-- One test practice session with everyone marked present")
out.append("with s as (insert into public.practice_sessions (team_id, session_date, title, notes)")
out.append("  select id, date '2026-09-22', 'Practice', 'Test session — everyone present' from public.teams where name = 'Women''s Volleyball' returning id, team_id)")
out.append("insert into public.attendance (session_id, player_id, status)")
out.append("select s.id, p.id, 'present' from s join public.players p on p.team_id = s.team_id;\n")

out.append("-- Default KPIs for the volleyball team (coaches can add their own)")
out.append("insert into public.kpis (team_id, name, unit, target, higher_is_better)")
out.append("select t.id, v.n, v.u, v.tg, v.h from (values ('Serve accuracy', '%', 85, true), ('Attack efficiency', '%', 30, true),")
out.append("  ('Reception quality', '/3', 2.2, true), ('Vertical jump', 'cm', 45, true)) v(n, u, tg, h)")
out.append("cross join public.teams t where t.name = 'Women''s Volleyball';")

Path(__file__).resolve().parent.parent.joinpath('supabase/migrations/0002_seed_reference.sql').write_text('\n'.join(out) + '\n')
print('ok', len(rows), 'schedule rows')
