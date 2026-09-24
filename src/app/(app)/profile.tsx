import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Avatar, Badge, Button, Card, Field, Row, Screen, SectionTitle, Txt } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { attempt, confirmAsync } from '@/lib/hooks';
import { must, supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';
import { ROLE_LABEL } from '@/lib/types';

export default function ProfileScreen() {
  const { profile, signOut, refresh, session } = useAuth();
  const [name, setName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [pw, setPw] = useState('');
  if (!profile) return null;

  const save = () =>
    attempt(async () => {
      must(await supabase.from('profiles').update({ full_name: name.trim(), phone: phone || null }).eq('id', profile.id));
      await refresh();
    }, 'Profile updated');

  const changePw = () =>
    attempt(async () => {
      if (pw.length < 8) throw new Error('Use at least 8 characters');
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw new Error(error.message);
      setPw('');
    }, 'Password changed');

  const deleteAccount = async () => {
    const ok = await confirmAsync(
      'Delete your account?',
      'Your login, profile and bookings are permanently deleted. Team records kept by the athletics office (roster, results, attendance) stay but are no longer linked to you. This cannot be undone.',
      'Delete account',
    );
    if (!ok) return;
    await attempt(async () => {
      const { data, error } = await supabase.functions.invoke('delete-account', { body: {} });
      if (error || (data as { error?: string })?.error) throw new Error((data as { error?: string })?.error ?? error?.message);
      await signOut();
    }, 'Your account has been deleted.');
  };

  return (
    <Screen title="Profile" subtitle="Your account">
      <Card>
        <Row gap={space.lg}>
          <Avatar name={profile.full_name || profile.email} size={64} />
          <View style={{ flex: 1, gap: 4 }}>
            <Txt v="h2">{profile.full_name}</Txt>
            <Txt v="small" color={colors.muted}>{session?.user.email}</Txt>
            <Row gap={6}>
              <Badge text={ROLE_LABEL[profile.role]} tone="brand" />
              {profile.title ? <Badge text={profile.title} /> : null}
            </Row>
          </View>
        </Row>
      </Card>
      <SectionTitle title="Personal details" />
      <Card style={{ gap: space.md }}>
        <Field label="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
        <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Button title="Save" icon="checkmark" onPress={save} />
      </Card>
      <SectionTitle title="Security" />
      <Card style={{ gap: space.md }}>
        <Field label="New password" value={pw} onChangeText={setPw} secure />
        <Button variant="secondary" title="Change password" icon="key-outline" onPress={changePw} disabled={!pw} />
      </Card>
      <SectionTitle title="About" />
      <Card style={{ gap: 6 }}>
        <Txt v="small" color={colors.muted}>AUI Athletics · Al Akhawayn University in Ifrane</Txt>
        <Txt v="small" color={colors.muted}>Facilities open 8 AM–11 PM on weekdays and 11 AM–9 PM on weekends.</Txt>
        <Txt v="small" color={colors.brand} style={{ fontWeight: '700' }}>Once a Lion, Always a Lion 🦁</Txt>
      </Card>
      <Row wrap>
        <Button variant="ghost" icon="shield-checkmark-outline" title="Privacy policy" onPress={() => router.push('/privacy')} style={{ flex: 1 }} />
        <Button variant="ghost" icon="help-circle-outline" title="Help & support" onPress={() => router.push('/support')} style={{ flex: 1 }} />
      </Row>
      <Button variant="secondary" icon="log-out-outline" title="Sign out" onPress={signOut} />
      <SectionTitle title="Danger zone" />
      <Card style={{ gap: space.sm, borderColor: '#F6C9C9' }}>
        <Txt v="small" color={colors.muted}>Permanently delete your account and personal data.</Txt>
        <Button variant="danger" icon="trash-outline" title="Delete my account" onPress={deleteAccount} />
      </Card>
    </Screen>
  );
}
