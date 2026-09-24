import LegalPage, { Bullet, P, Section } from '@/components/LegalPage';
import { ORG_NAME, POLICY_UPDATED, SUPPORT_EMAIL } from '@/lib/config';

export default function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy" subtitle={`AUI Athletics · Last updated ${POLICY_UPDATED}`}>
      <P>
        AUI Athletics is the internal operations app of the {ORG_NAME} (“we”). It is used by athletics staff, coaches,
        student-athletes and AUI students. This policy explains what personal data the app handles, why, and your choices.
      </P>

      <Section title="Data we collect">
        <Bullet>Account data: AUI email address, name, password (stored encrypted), role, and optionally a phone number.</Bullet>
        <Bullet>Athlete data (team members only): roster details such as position and jersey number, physical test results, attendance, coach notes, performance KPIs and monthly training ratings.</Bullet>
        <Bullet>Documents uploaded by athletics staff: photos of medical records, psychological assessments and signed contracts.</Bullet>
        <Bullet>Bookings: the facility or equipment you booked (bikes, courts, ice bath, sauna) and when.</Bullet>
        <Bullet>Staff records (athletics staff only): role, employment status, contact details and salary, managed by the Athletic Director.</Bullet>
        <P>We do not collect location, contacts, advertising identifiers or browsing data, and the app contains no ads or third-party trackers.</P>
      </Section>

      <Section title="How we use it">
        <Bullet>To run teams, practices, games, facilities, bookings, inventory and clubs.</Bullet>
        <Bullet>To follow each athlete's physical condition, wellbeing and progress.</Bullet>
        <Bullet>To produce internal reports for the Athletics Department.</Bullet>
        <P>We never sell personal data or use it for advertising.</P>
      </Section>

      <Section title="Who can see it">
        <P>Access is enforced by the database and depends on your role:</P>
        <Bullet>Athletic Director and assistant: everything needed to run the department.</Bullet>
        <Bullet>Coaches: the roster, portfolio and attendance of the teams they coach.</Bullet>
        <Bullet>Athletes: their own portfolio, attendance and the notes their coach shares with them.</Bullet>
        <Bullet>Students: public information only (schedules, results, rosters and roles, clubs) and their own bookings.</Bullet>
        <P>Medical, psychological and contract documents are stored privately and are only visible to the athlete, their coaches and the Athletic Director.</P>
      </Section>

      <Section title="Where it is stored">
        <P>
          Data is stored with Supabase (database, login and file storage, hosted in the European Union, Ireland region) and
          the web version is served by Vercel. Connections are encrypted (HTTPS). These providers process data only on our behalf.
        </P>
      </Section>

      <Section title="How long we keep it">
        <P>
          Account data is kept while you use the app. Team records (rosters, results, attendance, test results) are kept by the
          Athletics Department for its sporting history and reporting. Staff can delete documents at any time.
        </P>
      </Section>

      <Section title="Your rights and account deletion">
        <P>
          You can view and correct your details in Profile. You can permanently delete your account at any time from
          Profile → Delete my account; this removes your login, profile and bookings. To request access to, correction or
          deletion of other records (such as documents in your portfolio), email {SUPPORT_EMAIL}. You may also contact
          Morocco's data protection authority (CNDP) under Law 09-08.
        </P>
      </Section>

      <Section title="Contact">
        <P>{ORG_NAME} · {SUPPORT_EMAIL}</P>
      </Section>
    </LegalPage>
  );
}
