import { Link } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import AuthCard from '@/components/AuthCard';
import { Button, ErrorBox, Field, Txt } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (e) setError(e.message === 'Invalid login credentials' ? 'Wrong email or password.' : e.message);
  };

  return (
    <AuthCard title="Welcome back" subtitle="Sign in with your AUI account">
      {error ? <ErrorBox message={error} /> : null}
      <Field label="AUI email" value={email} onChangeText={setEmail} placeholder="name@aui.ma" keyboardType="email-address" />
      <Field label="Password" value={password} onChangeText={setPassword} placeholder="••••••••" secure />
      <Button title="Sign in" icon="log-in-outline" onPress={submit} disabled={!email || !password} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 }}>
        <Txt v="small" color={colors.muted}>New student?</Txt>
        <Link href="/sign-up">
          <Txt v="small" color={colors.brand} style={{ fontWeight: '700' }}>Create an account</Txt>
        </Link>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 4 }}>
        <Link href="/privacy">
          <Txt v="caption" color={colors.muted}>Privacy policy</Txt>
        </Link>
        <Link href="/support">
          <Txt v="caption" color={colors.muted}>Help & support</Txt>
        </Link>
      </View>
    </AuthCard>
  );
}
