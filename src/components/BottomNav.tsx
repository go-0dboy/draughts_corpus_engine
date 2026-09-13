import { Icon, type IconName } from './Icon';

export type AppTab = 'games' | 'position' | 'import' | 'tools' | 'settings';

interface BottomNavProps {
  active: AppTab;
  onChange: (tab: AppTab) => void;
}

const ITEMS: Array<{ id: AppTab; icon: IconName; label: string }> = [
  { id: 'games', icon: 'games', label: 'Партии' },
  { id: 'position', icon: 'position', label: 'Позиция' },
  { id: 'import', icon: 'import', label: 'Импорт' },
  { id: 'tools', icon: 'tools', label: 'Инструменты' },
  { id: 'settings', icon: 'settings', label: 'Настройки' },
];

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Основная навигация">
      {ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={active === item.id ? 'active' : ''}
          onClick={() => onChange(item.id)}
          aria-current={active === item.id ? 'page' : undefined}
        >
          <span className="bottom-nav-indicator" aria-hidden="true">
            <Icon name={item.icon} size={21} />
          </span>
          <span className="bottom-nav-label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
