import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsWide } from '@/lib/hooks';
import { colors, radius, space } from '@/lib/theme';
import { Logo } from './Shell';
import { Txt } from './ui';

/** Split-screen auth layout: green brand panel + white form card. */
export default function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const wide = useIsWide();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.brandDark }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, flexDirection: wide ? 'row' : 'column' }} keyboardShouldPersistTaps="handled">
        <View style={[s.hero, wide ? { flex: 1, justifyContent: 'center' } : { paddingTop: insets.top + space.xl }]}>
          <View style={s.logoRing}>
            <Logo size={wide ? 140 : 96} />
          </View>
          <Text style={[s.heroTitle, { fontSize: wide ? 40 : 28 }]}>AUI Athletics</Text>
          <Text style={s.heroSub}>Teams, facilities, bookings and performance — in one place.</Text>
          {wide ? <Text style={s.motto}>ONCE A LION · ALWAYS A LION</Text> : null}
        </View>
        <View style={[s.formWrap, wide ? { flex: 1, justifyContent: 'center', borderTopLeftRadius: 0 } : null]}>
          <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center', gap: space.md, paddingBottom: insets.bottom + space.xl }}>
            <View style={{ gap: 4, marginBottom: space.sm }}>
              <Txt v="h1">{title}</Txt>
              <Txt v="small" color={colors.muted}>{subtitle}</Txt>
            </View>
            {children}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  hero: { alignItems: 'center', paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: space.sm },
  logoRing: { backgroundColor: colors.white, borderRadius: 999, padding: 8, marginBottom: space.md },
  heroTitle: { color: colors.white, fontWeight: '800', letterSpacing: -0.5 },
  heroSub: { color: 'rgba(255,255,255,0.75)', fontSize: 15, textAlign: 'center', maxWidth: 360 },
  motto: { color: colors.accent, fontWeight: '800', letterSpacing: 2, marginTop: space.xl, fontSize: 12 },
  formWrap: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.xl, flexGrow: 1 },
});
