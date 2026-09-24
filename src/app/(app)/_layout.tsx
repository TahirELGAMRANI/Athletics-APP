import { Redirect, Stack } from 'expo-router';

import Shell from '@/components/Shell';
import { Loading } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';

export default function AppLayout() {
  const { session, loading, profile } = useAuth();
  if (loading) return <Loading />;
  if (!session) return <Redirect href="/sign-in" />;
  if (!profile) return <Loading />;
  return (
    <Shell>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'fade' }} />
    </Shell>
  );
}
