import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { GameCard } from '@/components/shared';
import { Button, Card, Chips, Empty, ErrorBox, Field, Grid, Loading, Row, Screen, Sheet, Toggle, Txt } from '@/components/ui';
import { useAuth, usePermissions } from '@/lib/auth';
import { fetchGames, fetchTeams } from '@/lib/db';
import { attempt, confirmAsync, useLoad } from '@/lib/hooks';
import { must, supabase } from '@/lib/supabase';
import { campusNow } from '@/lib/time';
import { colors } from '@/lib/theme';
import type { Game } from '@/lib/types';

type Filter = 'upcoming' | 'results' | 'all';

export default function GamesScreen() {
  const params = useLocalSearchParams<{ team?: string }>();
  const perms = usePermissions();
  const { coachedTeamIds } = useAuth();
  const [team, setTeam] = useState<string>(params.team ?? '');
  const [filter, setFilter] = useState<Filter>('upcoming');
  const [editing, setEditing] = useState<Partial<Game> | null>(null);

  const { data, error, loading, reload } = useLoad(async () => {
    const [teams, games] = await Promise.all([fetchTeams(), fetchGames()]);
    return { teams, games };
  }, []);

  const today = campusNow().date;
  const games = (data?.games ?? [])
    .filter((g) => !team || g.team_id === team)
    .filter((g) => (filter === 'upcoming' ? g.status === 'scheduled' && g.game_date >= today : filter === 'results' ? g.status === 'completed' : true))
    .sort((a, b) => (filter === 'upcoming' ? a.game_date.localeCompare(b.game_date) : b.game_date.localeCompare(a.game_date)));

  const manageable = (data?.teams ?? []).filter((t) => perms.canManageTeam(t.id));
  const canAdd = manageable.length > 0;
  const teamName = (id: string) => data?.teams.find((t) => t.id === id);

  return (
    <Screen
      title="Games"
      subtitle="Schedules, results and competitions"
      onRefresh={reload}
      actions={canAdd ? <Button small icon="add" title="Add game" onPress={() => setEditing({ team_id: team && perms.canManageTeam(team) ? team : coachedTeamIds[0] ?? manageable[0]?.id, game_date: today, game_type: 'official', status: 'scheduled', home: true })} /> : null}>
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      <Chips<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'upcoming', label: 'Upcoming', icon: 'time-outline' },
          { value: 'results', label: 'Results', icon: 'podium-outline' },
          { value: 'all', label: 'All', icon: 'list-outline' },
        ]}
      />
      {data ? <Chips value={team} onChange={setTeam} options={[{ value: '', label: 'All teams' }, ...data.teams.map((t) => ({ value: t.id, label: t.name }))]} /> : null}
      {loading && !data ? <Loading /> : null}
      {data && games.length === 0 ? (
        <Card>
          <Empty icon="trophy-outline" title={filter === 'upcoming' ? 'No upcoming games' : filter === 'results' ? 'No results yet' : 'No games yet'} subtitle={canAdd ? 'Tap "Add game" to schedule one.' : undefined} />
        </Card>
      ) : null}
      <Grid min={340}>
        {games.map((g) => (
          <GameCard key={g.id} game={g} team={teamName(g.team_id)} onPress={() => setEditing(g)} />
        ))}
      </Grid>
      {editing && data ? (
        <GameSheet
          game={editing}
          teams={data.teams}
          canEdit={!editing.team_id || perms.canManageTeam(editing.team_id)}
          manageableIds={manageable.map((t) => t.id)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      ) : null}
    </Screen>
  );
}

function GameSheet({
  game,
  teams,
  canEdit,
  manageableIds,
  onClose,
  onSaved,
}: {
  game: Partial<Game>;
  teams: { id: string; name: string }[];
  canEdit: boolean;
  manageableIds: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [v, setV] = useState({
    team_id: game.team_id ?? manageableIds[0],
    opponent: game.opponent ?? '',
    game_date: game.game_date ?? '',
    game_time: game.game_time?.slice(0, 5) ?? '',
    location: game.location ?? '',
    home: game.home ?? true,
    game_type: game.game_type ?? 'official',
    competition: game.competition ?? '',
    status: game.status ?? 'scheduled',
    our_score: game.our_score != null ? String(game.our_score) : '',
    their_score: game.their_score != null ? String(game.their_score) : '',
    game_plan: game.game_plan ?? '',
    notes: game.notes ?? '',
  });
  const set = <K extends keyof typeof v>(k: K) => (x: (typeof v)[K]) => setV({ ...v, [k]: x });

  const save = () =>
    attempt(async () => {
      if (!v.opponent.trim()) throw new Error('Opponent is required');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v.game_date)) throw new Error('Date must be YYYY-MM-DD');
      if (v.game_time && !/^\d{1,2}:\d{2}$/.test(v.game_time)) throw new Error('Time must be HH:MM (24h)');
      if (v.status === 'completed' && (v.our_score === '' || v.their_score === '')) throw new Error('Enter both scores to record a result');
      const row = {
        team_id: v.team_id,
        opponent: v.opponent.trim(),
        game_date: v.game_date,
        game_time: v.game_time || null,
        location: v.location || null,
        home: v.home,
        game_type: v.game_type,
        competition: v.competition || null,
        status: v.status,
        our_score: v.our_score === '' ? null : Number(v.our_score),
        their_score: v.their_score === '' ? null : Number(v.their_score),
        game_plan: v.game_plan || null,
        notes: v.notes || null,
      };
      if (game.id) must(await supabase.from('games').update(row).eq('id', game.id));
      else must(await supabase.from('games').insert(row));
      onSaved();
    });

  const remove = async () => {
    if (!game.id || !(await confirmAsync('Delete this game?'))) return;
    await attempt(async () => {
      must(await supabase.from('games').delete().eq('id', game.id!));
      onSaved();
    });
  };

  if (!canEdit) {
    const t = teams.find((x) => x.id === game.team_id);
    return (
      <Sheet visible title={`${t?.name ?? ''} vs ${game.opponent}`} onClose={onClose}>
        <Txt>{game.game_date} {game.game_time ? `· ${game.game_time.slice(0, 5)}` : ''}</Txt>
        <Txt color={colors.muted}>{[game.location, game.home ? 'Home' : 'Away', game.game_type, game.competition].filter(Boolean).join(' · ')}</Txt>
        {game.status === 'completed' ? <Txt v="h1">Final: {game.our_score} – {game.their_score}</Txt> : null}
        {game.notes ? <Txt>{game.notes}</Txt> : null}
      </Sheet>
    );
  }

  return (
    <Sheet
      visible
      title={game.id ? 'Edit game' : 'New game'}
      onClose={onClose}
      footer={
        <Row>
          {game.id ? <Button variant="danger" icon="trash-outline" title="Delete" onPress={remove} /> : null}
          <Button title="Save" icon="checkmark" onPress={save} style={{ flex: 1 }} />
        </Row>
      }>
      <Chips label="Team" value={v.team_id} onChange={set('team_id')} options={teams.filter((t) => manageableIds.includes(t.id)).map((t) => ({ value: t.id, label: t.name }))} />
      <Field label="Opponent" value={v.opponent} onChangeText={set('opponent')} placeholder="e.g. UIR" />
      <Row>
        <Field label="Date" value={v.game_date} onChangeText={set('game_date')} placeholder="YYYY-MM-DD" style={{ flex: 1 }} />
        <Field label="Time (24h)" value={v.game_time} onChangeText={set('game_time')} placeholder="18:00" style={{ flex: 1 }} />
      </Row>
      <Field label="Location" value={v.location} onChangeText={set('location')} placeholder="e.g. AUI Gymnasium" />
      <Toggle label="Home game" value={v.home} onChange={set('home')} />
      <Chips label="Type" value={v.game_type} onChange={set('game_type')} options={[{ value: 'official', label: 'Official' }, { value: 'friendly', label: 'Friendly' }]} />
      <Field label="Competition" value={v.competition} onChangeText={set('competition')} placeholder="e.g. FRMSU League" />
      <Chips label="Status" value={v.status} onChange={set('status')} options={[{ value: 'scheduled', label: 'Scheduled' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }]} />
      {v.status === 'completed' ? (
        <Row>
          <Field label="AUI score" value={v.our_score} onChangeText={set('our_score')} keyboardType="numeric" style={{ flex: 1 }} />
          <Field label="Opponent score" value={v.their_score} onChangeText={set('their_score')} keyboardType="numeric" style={{ flex: 1 }} />
        </Row>
      ) : null}
      <Field label="Game plan" value={v.game_plan} onChangeText={set('game_plan')} multiline placeholder="Line-up, tactics, key match-ups, logistics…" hint="Visible to coaches and the athletics office" />
      <Field label="Notes" value={v.notes} onChangeText={set('notes')} multiline />
    </Sheet>
  );
}
