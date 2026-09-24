import { router } from 'expo-router';
import { View } from 'react-native';

import { gameResult } from '@/lib/db';
import { campusNow, fmtDate, fmtTime, liveStatus, type CampusNow } from '@/lib/time';
import { colors, space } from '@/lib/theme';
import type { Facility, Game, ScheduleItem, Team } from '@/lib/types';
import { Badge, Card, Dot, Icon, Row, Txt } from './ui';

const stateColor = { free: colors.success, busy: colors.warning, closed: colors.faint } as const;

export function FacilityLiveCard({
  facility,
  schedule,
  now = campusNow(),
  onPress,
  extraBusy,
}: {
  facility: Facility;
  schedule: ScheduleItem[];
  now?: CampusNow;
  onPress?: () => void;
  /** Booking-based occupancy (e.g. a padel court booked right now). */
  extraBusy?: string | null;
}) {
  const items = schedule.filter((i) => i.facility_id === facility.id);
  let st = liveStatus(items, now);
  if (st.state === 'free' && extraBusy) st = { state: 'busy', label: 'Booked', detail: extraBusy, item: items[0] };
  const tone = st.state === 'free' ? 'success' : st.state === 'busy' ? 'warning' : 'neutral';
  return (
    <Card onPress={onPress} style={{ gap: 10 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row style={{ flex: 1 }}>
          <Dot color={stateColor[st.state]} />
          <Txt v="h3" numberOfLines={1} style={{ flex: 1 }}>{facility.name}</Txt>
        </Row>
        <Badge text={st.label} tone={tone} />
      </Row>
      <Txt v="small" color={colors.muted} numberOfLines={2}>{st.detail}</Txt>
    </Card>
  );
}

export function GameCard({ game, team, onPress }: { game: Game; team?: Team; onPress?: () => void }) {
  const r = gameResult(game);
  return (
    <Card onPress={onPress ?? (() => router.push({ pathname: '/games', params: { team: game.team_id } }))} style={{ gap: 10 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={6}>
          <Badge text={game.game_type === 'official' ? 'Official' : 'Friendly'} tone={game.game_type === 'official' ? 'brand' : 'info'} />
          {game.competition ? <Badge text={game.competition} /> : null}
        </Row>
        <Txt v="caption" color={colors.muted}>
          {fmtDate(game.game_date)}
          {game.game_time ? ` · ${fmtTime(game.game_time)}` : ''}
        </Txt>
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt v="caption" color={colors.muted}>{team?.name ?? 'AUI'}</Txt>
          <Txt v="h3" numberOfLines={1}>vs {game.opponent}</Txt>
          <Row gap={4}>
            <Icon name="location-outline" size={13} color={colors.faint} />
            <Txt v="caption" color={colors.faint}>{game.location || (game.home ? 'Home' : 'Away')}</Txt>
          </Row>
        </View>
        {game.status === 'completed' && r ? (
          <Row gap={space.sm}>
            <Txt v="h1" color={r.tone === 'success' ? colors.success : r.tone === 'danger' ? colors.danger : colors.text}>
              {game.our_score}–{game.their_score}
            </Txt>
            <Badge text={r.label} tone={r.tone} />
          </Row>
        ) : game.status === 'cancelled' ? (
          <Badge text="Cancelled" tone="danger" />
        ) : (
          <Badge text="Upcoming" tone="warning" icon="time-outline" />
        )}
      </Row>
    </Card>
  );
}

/** Coloured green hero banner used on dashboards. */
export function Hero({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.brandDark, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', right: -60, top: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: colors.brandMid, opacity: 0.55 }} />
      <View style={{ position: 'absolute', right: 90, bottom: -90, width: 160, height: 160, borderRadius: 80, backgroundColor: colors.accent, opacity: 0.18 }} />
      {children}
    </View>
  );
}
