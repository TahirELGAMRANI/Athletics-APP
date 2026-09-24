import { Link } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import AuthCard from '@/components/AuthCard';
import { Button, Card, ErrorBox, Field, Row, Icon, Txt } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setError(null);
    const e = email.trim().toLowerCase();
    if (!/^[^@\s]+@aui\.ma$/.test(e)) return setError('Please use your AUI email address (…@aui.ma).');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    const { data, error: err } = await supabase.auth.signUp({
      email: e,
      password,
      options: { data: { full_name: name.trim() } },
    });
    if (err) return setError(err.message.includes('AUI email') ? 'Please use your AUI email address (…@aui.ma).' : err.message);
    if (!data.session) setSent(true);
  };

  if (sent) {
    return (
      <AuthCard title="Check your inbox" subtitle="One last step">
        <Card>
          <Row style={{ alignItems: 'flex-start' }}>
            <Icon name="mail-unread-outline" size={24} color={colors.brand} />
            <Txt style={{ flex: 1 }}>
              We sent a confirmation link to {email}. Open it, then come back and sign in.
            </Txt>
          </Row>
        </Card>
        <Link href="/sign-in">
          <Txt color={colors.brand} style={{ fontWeight: '700' }}>Back to sign in</Txt>
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Create your account" subtitle="Students sign up with their AUI email">
      {error ? <ErrorBox message={error} /> : null}
      <Field label="Full name" value={name} onChangeText={setName} placeholder="First Last" autoCapitalize="words" />
      <Field label="AUI email" value={email} onChangeText={setEmail} placeholder="name@aui.ma" keyboardType="email-address" />
      <Field label="Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secure />
      <Field label="Confirm password" value={confirm} onChangeText={setConfirm} secure />
      <Button title="Create account" icon="person-add-outline" onPress={submit} disabled={!name || !email || !password} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 }}>
        <Txt v="small" color={colors.muted}>Already registered?</Txt>
        <Link href="/sign-in">
          <Txt v="small" color={colors.brand} style={{ fontWeight: '700' }}>Sign in</Txt>
        </Link>
      </View>
    </AuthCard>
  );
}
