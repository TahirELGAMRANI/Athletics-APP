import { router } from 'expo-router';
import { Linking } from 'react-native';

import LegalPage, { Bullet, P, Section } from '@/components/LegalPage';
import { Button } from '@/components/ui';
import { ORG_NAME, SUPPORT_EMAIL } from '@/lib/config';

export default function Support() {
  return (
    <LegalPage title="Help & Support" subtitle="AUI Athletics">
      <Section title="Getting an account">
        <Bullet>Students: tap “Create an account” on the sign-in screen and use your @aui.ma email. Confirm the email we send you, then sign in.</Bullet>
        <Bullet>Athletes, coaches and staff: your account is created by the Athletic Director. You receive your email and a temporary password — change it in Profile.</Bullet>
      </Section>
      <Section title="Common questions">
        <Bullet>Forgot your password? Contact the athletics office to have it reset.</Bullet>
        <Bullet>Bikes, padel and tennis can be booked for the same day. The ice bath must be booked at least 24 hours in advance.</Bullet>
        <Bullet>Facilities are open 8 AM–11 PM on weekdays and 11 AM–9 PM on weekends. Team programs take priority.</Bullet>
        <Bullet>To delete your account: Profile → Delete my account.</Bullet>
      </Section>
      <Section title="Contact">
        <P>{ORG_NAME}</P>
        <Button icon="mail-outline" title={SUPPORT_EMAIL} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} />
        <Button variant="ghost" icon="shield-checkmark-outline" title="Privacy policy" onPress={() => router.push('/privacy')} />
      </Section>
    </LegalPage>
  );
}
