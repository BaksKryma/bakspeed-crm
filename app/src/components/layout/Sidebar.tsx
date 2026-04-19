import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard, Package, Bot, Truck, MapPinned, Building2, Users,
  Wallet, BarChart3, Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { to: '/',          key: 'dashboard',  icon: LayoutDashboard },
  { to: '/orders',    key: 'orders',     icon: Package },
  { to: '/ai',        key: 'ai',         icon: Bot },
  { to: '/fleet',     key: 'fleet',      icon: Truck },
  { to: '/spedition', key: 'spedition',  icon: MapPinned },
  { to: '/clients',   key: 'clients',    icon: Building2 },
  { to: '/carriers',  key: 'carriers',   icon: Users },
  { to: '/payments',  key: 'payments',   icon: Wallet },
  { to: '/reports',   key: 'reports',    icon: BarChart3 },
  { to: '/settings',  key: 'settings',   icon: Settings },
] as const;

export function Sidebar() {
  const { t } = useTranslation();
  return (
    <aside className="hidden md:flex w-56 flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-5 py-4 border-b border-white/10">
        <div className="text-lg font-bold text-primary">Bakspeed</div>
        <div className="text-xs text-white/50 tracking-wide">SPEED YOU CAN TRUST</div>
      </div>
      <nav className="flex-1 py-3 space-y-1">
        {items.map(({ to, key, icon: Icon }) => (
          <NavLink
            key={key}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-5 py-2 text-sm transition-colors',
                isActive ? 'bg-primary/90 text-white' : 'hover:bg-white/5',
              )
            }
          >
            <Icon className="h-4 w-4" />
            <span>{t(`nav.${key}`)}</span>
          </NavLink>
        ))}
      </nav>
      <div className="px-5 py-3 text-[10px] text-white/40 border-t border-white/10">
        v0.1 · Bakspeed Sp. z o.o.
      </div>
    </aside>
  );
}
