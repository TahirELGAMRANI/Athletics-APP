import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth';
import { useIsWide } from '@/lib/hooks';
import { navFor, type NavItem } from '@/lib/nav';
import { colors, radius, space } from '@/lib/theme';
import { ROLE_LABEL } from '@/lib/types';
import { Avatar, Txt } from './ui';

const logo = require('@/assets/images/logo.png');

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

export function Logo({ size = 40 }: { size?: number }) {
  return <Image source={logo} style={{ width: size, height: size }} contentFit="contain" />;
}

export default function Shell({ children }: { children: ReactNode }) {
  const wide = useIsWide();
  const { profile } = useAuth();
  const items = navFor(profile?.role);
  return wide ? <Sidebar items={items}>{children}</Sidebar> : <BottomTabs items={items}>{children}</BottomTabs>;
}

function Sidebar({ items, children }: { items: NavItem[]; children: ReactNode }) {
  const pathname = usePathname();
  const { profile } = useAuth();
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.bg }}>
      <View style={s.sidebar}>
        <View style={s.brandRow}>
          <View style={s.logoWrap}>
            <Logo size={40} />
          </View>
          <View>
            <Text style={{ color: colors.white, fontWeight: '800', fontSize: 16 }}>AUI Athletics</Text>
            <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>Once a Lion, Always a Lion</Text>
          </View>
        </View>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 2, paddingVertical: space.md }}>
          {items.map((it) => {
            const active = isActive(pathname, it.href);
            return (
              <Pressable key={it.href + it.label} onPress={() => router.navigate(it.href as never)} style={(state) => [s.sideItem, active && s.sideItemActive, !active && (state as { hovered?: boolean }).hovered && { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                <Ionicons name={active ? it.iconActive : it.icon} size={19} color={active ? colors.brandDark : 'rgba(255,255,255,0.8)'} />
                <Text style={{ color: active ? colors.brandDark : 'rgba(255,255,255,0.88)', fontWeight: active ? '700' : '500', fontSize: 14 }}>{it.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {profile ? (
          <Pressable onPress={() => router.navigate('/profile')} style={s.userCard}>
            <Avatar name={profile.full_name || profile.email} size={36} tone="light" />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: colors.white, fontWeight: '700', fontSize: 13 }}>{profile.full_name}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{ROLE_LABEL[profile.role]}</Text>
            </View>
          </Pressable>
        ) : null}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

function BottomTabs({ items, children }: { items: NavItem[]; children: ReactNode }) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [more, setMore] = useState(false);
  const primary = items.slice(0, 4);
  const rest = items.slice(4);
  const moreActive = rest.some((r) => isActive(pathname, r.href));
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1 }}>{children}</View>
      <View style={[s.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {primary.map((it) => {
          const active = isActive(pathname, it.href);
          return (
            <Pressable key={it.href + it.label} style={s.tab} onPress={() => router.navigate(it.href as never)}>
              <View style={[s.tabIcon, active && { backgroundColor: colors.brandSoft }]}>
                <Ionicons name={active ? it.iconActive : it.icon} size={21} color={active ? colors.brand : colors.muted} />
              </View>
              <Text style={[s.tabLabel, active && { color: colors.brand, fontWeight: '700' }]} numberOfLines={1}>{it.label}</Text>
            </Pressable>
          );
        })}
        {rest.length ? (
          <Pressable style={s.tab} onPress={() => setMore(true)}>
            <View style={[s.tabIcon, moreActive && { backgroundColor: colors.brandSoft }]}>
              <Ionicons name={moreActive ? 'grid' : 'grid-outline'} size={21} color={moreActive ? colors.brand : colors.muted} />
            </View>
            <Text style={[s.tabLabel, moreActive && { color: colors.brand, fontWeight: '700' }]}>More</Text>
          </Pressable>
        ) : null}
      </View>
      <Modal visible={more} transparent animationType="slide" onRequestClose={() => setMore(false)}>
        <Pressable style={s.backdrop} onPress={() => setMore(false)}>
          <Pressable onPress={() => {}} style={[s.moreSheet, { paddingBottom: insets.bottom + space.lg }]}>
            <View style={s.grabber} />
            <Txt v="h2" style={{ marginBottom: space.md }}>More</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
              {rest.map((it) => {
                const active = isActive(pathname, it.href);
                return (
                  <Pressable
                    key={it.href + it.label}
                    onPress={() => {
                      setMore(false);
                      router.navigate(it.href as never);
                    }}
                    style={[s.moreItem, active && { borderColor: colors.brand, backgroundColor: colors.brandTint }]}>
                    <View style={[s.tabIcon, { backgroundColor: colors.brandSoft, width: 44, height: 44, borderRadius: 14 }]}>
                      <Ionicons name={it.iconActive} size={22} color={colors.brand} />
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text, textAlign: 'center' }} numberOfLines={1}>{it.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  sidebar: { width: 256, backgroundColor: colors.brandDark, paddingHorizontal: space.md, paddingVertical: space.lg },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingBottom: space.md },
  logoWrap: { backgroundColor: colors.white, borderRadius: 24, padding: 3 },
  sideItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, height: 44, borderRadius: radius.md },
  sideItemActive: { backgroundColor: colors.accent },
  userCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.08)' },
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabIcon: { width: 52, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 11, color: colors.muted, fontWeight: '500' },
  backdrop: { flex: 1, backgroundColor: 'rgba(8, 28, 16, 0.45)', justifyContent: 'flex-end' },
  moreSheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.xl },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: space.md },
  moreItem: { width: '30%', flexGrow: 1, alignItems: 'center', gap: 8, paddingVertical: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
});
