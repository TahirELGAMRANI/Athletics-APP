import type { ReactNode } from 'react';
import { View } from 'react-native';

import { colors, space } from '@/lib/theme';
import { Card, Screen, Txt } from './ui';

/** Public, login-free text page (privacy policy, support). */
export default function LegalPage({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <Screen title={title} subtitle={subtitle} back>
      <Card style={{ gap: space.lg, maxWidth: 820 }}>{children}</Card>
    </Screen>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Txt v="h3" color={colors.brandDark}>{title}</Txt>
      {children}
    </View>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <Txt style={{ lineHeight: 22 }}>{children}</Txt>;
}

export function Bullet({ children }: { children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, paddingLeft: 4 }}>
      <Txt color={colors.brand}>•</Txt>
      <Txt style={{ flex: 1, lineHeight: 22 }}>{children}</Txt>
    </View>
  );
}
