export type AppTab = 'games' | 'position' | 'import' | 'tools';

interface BottomNavProps {
  active: AppTab;
  onChange: (tab: AppTab) => void;
}

const ITEMS: Array<{ id: AppTab; icon: string; label: string }> = [
  { id: 'games', icon: '▤', label: 'Партии' },
  { id: 'position', icon: '◫', label: 'Позиция' },
  { id: 'import', icon: '⇩', label: 'Импорт' },
  { id: 'tools', icon: '◇', label: 'Инструменты' },
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
          <span className="bottom-nav-icon" aria-hidden="true">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
