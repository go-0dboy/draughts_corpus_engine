import { useEffect, useState } from 'react';
import {
  BOARD_SKINS,
  loadPreferences,
  savePreferences,
  watchSystemAppearance,
  type AppPreferences,
  type AppTheme,
  type BoardSkin,
} from '../application/preferences';
import { Icon } from './Icon';

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
}

const THEME_OPTIONS: Array<{ id: AppTheme; label: string; hint: string }> = [
  { id: 'system', label: 'Системная', hint: 'Следовать Android' },
  { id: 'dark', label: 'Тёмная', hint: 'Всегда тёмная' },
  { id: 'light', label: 'Светлая', hint: 'Всегда светлая' },
];

const BOARD_LABELS: Record<BoardSkin, string> = {
  auto: 'Как приложение',
  classic: 'Классика',
  green: 'Сукно',
  graphite: 'Графит',
  sand: 'Песок',
  cherry: 'Вишня',
  ocean: 'Океан',
  marble: 'Мрамор',
};

export function SettingsSheet({ open, onClose }: SettingsSheetProps) {
  const [preferences, setPreferences] = useState<AppPreferences>(() => loadPreferences());

  useEffect(() => watchSystemAppearance(setPreferences), []);

  if (!open) return null;

  const update = (patch: Partial<AppPreferences>) => {
    setPreferences(savePreferences(patch));
  };

  return (
    <>
      <button className="sheet-backdrop" type="button" aria-label="Закрыть настройки" onClick={onClose} />
      <section className="bottom-sheet settings-sheet" role="dialog" aria-modal="true" aria-label="Настройки">
        <div className="sheet-handle" aria-hidden="true" />
        <div className="settings-title-row">
          <div>
            <span className="section-kicker">Приложение</span>
            <h2>Настройки</h2>
          </div>
          <button type="button" className="icon-button ghost-button" aria-label="Закрыть" onClick={onClose}>
            <Icon name="close" size={22} />
          </button>
        </div>

        <section className="settings-group" aria-labelledby="theme-heading">
          <div className="settings-group-heading">
            <h3 id="theme-heading">Оформление</h3>
            <span>По умолчанию используется тема Android</span>
          </div>
          <div className="segmented-control" role="radiogroup" aria-label="Тема приложения">
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={preferences.theme === option.id}
                className={preferences.theme === option.id ? 'active' : ''}
                onClick={() => update({ theme: option.id })}
              >
                <strong>{option.label}</strong>
                <small>{option.hint}</small>
              </button>
            ))}
          </div>
        </section>

        <section className="settings-group" aria-labelledby="board-heading">
          <div className="settings-group-heading">
            <h3 id="board-heading">Доска</h3>
            <span>«Как приложение» автоматически согласует палитру доски с темой интерфейса</span>
          </div>
          <div className="board-skin-grid" role="radiogroup" aria-label="Скин доски">
            {BOARD_SKINS.map((skin) => (
              <button
                key={skin}
                type="button"
                role="radio"
                aria-checked={preferences.boardSkin === skin}
                className={`board-skin-option ${preferences.boardSkin === skin ? 'active' : ''}`}
                onClick={() => update({ boardSkin: skin })}
              >
                <span className={`board-skin-preview skin-${skin}`} aria-hidden="true">
                  <i /><i /><i /><i />
                </span>
                <span>{BOARD_LABELS[skin]}</span>
              </button>
            ))}
          </div>
        </section>
      </section>
    </>
  );
}
