import { useLocalSearchParams } from 'expo-router';

import Portfolio from '@/components/Portfolio';
import { Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function PlayerScreen() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const { myPlayers } = useAuth();
  return (
    <Screen title="Player portfolio" back>
      <Portfolio playerId={id} initialTab={tab} selfView={myPlayers.some((p) => p.id === id)} />
    </Screen>
  );
}
