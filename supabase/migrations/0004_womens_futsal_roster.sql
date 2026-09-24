-- Women's Futsal roster (positions and jersey numbers not provided yet).
insert into public.players (team_id, full_name)
select t.id, v.n from (values
  ('Ouissal Bouriche'),
  ('Aya Belbasbas'),
  ('Norane Hajji'),
  ('Aya Lemsiah'),
  ('Hiba Halim'),
  ('Imane Ahyane'),
  ('Wiam Lamghari'),
  ('Ghita Addioui'),
  ('Wiam Darmam'),
  ('Nihad Larghi'),
  ('Rihab Chane'),
  ('Yassmine Ait Oudaoud'),
  ('Insaf El Adelouny'),
  ('Hind Ennakhli'),
  ('Ouboukhliq Lylia')
) v(n)
cross join public.teams t
where t.name = 'Women''s Futsal'
  and not exists (select 1 from public.players p where p.team_id = t.id and lower(p.full_name) = lower(v.n));
