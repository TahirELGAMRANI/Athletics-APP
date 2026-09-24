import type { IconName } from '@/components/ui';
import type { Role } from './types';

export type NavItem = { href: string; label: string; icon: IconName; iconActive: IconName };

const I = {
  home: { href: '/', label: 'Home', icon: 'home-outline', iconActive: 'home' },
  schedule: { href: '/schedule', label: 'Facilities', icon: 'calendar-outline', iconActive: 'calendar' },
  teams: { href: '/teams', label: 'Teams', icon: 'people-outline', iconActive: 'people' },
  myTeam: { href: '/teams', label: 'My Team', icon: 'people-outline', iconActive: 'people' },
  games: { href: '/games', label: 'Games', icon: 'trophy-outline', iconActive: 'trophy' },
  bookings: { href: '/bookings', label: 'Bookings', icon: 'bicycle-outline', iconActive: 'bicycle' },
  inventory: { href: '/inventory', label: 'Inventory', icon: 'cube-outline', iconActive: 'cube' },
  clubs: { href: '/clubs', label: 'Clubs', icon: 'sparkles-outline', iconActive: 'sparkles' },
  staff: { href: '/staff', label: 'Staff', icon: 'id-card-outline', iconActive: 'id-card' },
  finance: { href: '/finance', label: 'Transactions', icon: 'wallet-outline', iconActive: 'wallet' },
  reports: { href: '/reports', label: 'Reports', icon: 'document-text-outline', iconActive: 'document-text' },
  accounts: { href: '/accounts', label: 'Accounts', icon: 'person-add-outline', iconActive: 'person-add' },
  portfolio: { href: '/me', label: 'My Portfolio', icon: 'ribbon-outline', iconActive: 'ribbon' },
  profile: { href: '/profile', label: 'Profile', icon: 'person-circle-outline', iconActive: 'person-circle' },
} satisfies Record<string, NavItem>;

/** Navigation per role. The first four entries become the phone tab bar; the rest go under "More". */
export function navFor(role: Role | undefined): NavItem[] {
  switch (role) {
    case 'super_admin':
      return [I.home, I.teams, I.schedule, I.games, I.bookings, I.inventory, I.clubs, I.staff, I.finance, I.reports, I.accounts, I.profile];
    case 'admin':
      return [I.home, I.bookings, I.inventory, I.schedule, I.teams, I.games, I.profile];
    case 'coach':
      return [I.home, I.myTeam, I.games, I.schedule, I.bookings, I.clubs, I.profile];
    case 'player':
      return [I.home, I.portfolio, I.schedule, I.games, I.bookings, I.teams, I.clubs, I.profile];
    default:
      return [I.home, I.schedule, I.bookings, I.games, I.teams, I.clubs, I.profile];
  }
}
