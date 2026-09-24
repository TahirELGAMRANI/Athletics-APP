import { useLocalSearchParams } from 'expo-router';

import Portfolio from '@/components/Portfolio';
import { Card, Empty, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function MyPortfolio() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const { myPlayers } = useAuth();
  const me = myPlayers[0];
  return (
    <Screen title="My portfolio" subtitle="Your profile, tests, notes and attendance">
      {me ? (
        <Portfolio key={tab ?? 'x'} playerId={me.id} initialTab={tab} selfView />
      ) : (
        <Card>
          <Empty icon="ribbon-outline" title="No roster entry linked" subtitle="Ask the Athletic Director to link your account to your team roster." />
        </Card>
      )}
    </Screen>
  );
}
