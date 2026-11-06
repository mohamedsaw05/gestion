import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MenuItem } from '../context/AuthContext';
import { DOMAINS } from '../lib/navigation.config';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  menu: MenuItem[];
}

interface CommandItem {
  id: string;
  category: string;
  label: string;
  description?: string;
  path: string;
  icon?: string;
}

const RECENT_SEARCH_KEY = 'gestionnaire_recent_routes';

export function CommandPalette({ isOpen, onClose, menu }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recents, setRecents] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Load recents
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      try {
        const saved = localStorage.getItem(RECENT_SEARCH_KEY);
        if (saved) {
          setRecents(JSON.parse(saved) as string[]);
        }
      } catch {
        // no-op
      }
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Construct searchable items from granted menu items
  const menuMap = new Map(menu.map((m) => [m.key, m]));
  const allCommands: CommandItem[] = [
    {
      id: 'dashboard',
      category: 'Général',
      label: 'Tableau de bord',
      description: 'Vue d\'ensemble des indicateurs et alertes',
      path: '/',
      icon: '🏠',
    },
  ];

  for (const domain of DOMAINS) {
    for (const key of domain.moduleKeys) {
      const item = menuMap.get(key);
      if (item) {
        allCommands.push({
          id: item.key,
          category: domain.label,
          label: item.label,
          description: domain.description,
          path: item.path,
          icon: domain.icon,
        });
      }
    }
  }

  // Filter items
  const cleanQuery = query.trim().toLowerCase();
  const filtered = cleanQuery
    ? allCommands.filter(
        (cmd) =>
          cmd.label.toLowerCase().includes(cleanQuery) ||
          cmd.category.toLowerCase().includes(cleanQuery) ||
          (cmd.description && cmd.description.toLowerCase().includes(cleanQuery)),
      )
    : allCommands;

  // Add recent items section if query is empty
  const recentCommands = !cleanQuery
    ? recents
        .map((p) => allCommands.find((c) => c.path === p))
        .filter((c): c is CommandItem => Boolean(c))
    : [];

  const displayedList = cleanQuery ? filtered : [...recentCommands, ...filtered.filter((c) => !recents.includes(c.path))];

  const handleSelect = (item: CommandItem) => {
    // Save to recents
    try {
      const updated = [item.path, ...recents.filter((p) => p !== item.path)].slice(0, 5);
      localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(updated));
    } catch {
      // no-op
    }
    onClose();
    navigate(item.path);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < displayedList.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : displayedList.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = displayedList[selectedIndex];
      if (selected) {
        handleSelect(selected);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="command-palette-backdrop" onClick={onClose}>
      <div
        className="command-palette-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Recherche rapide"
      >
        <div className="command-palette-header">
          <span className="search-icon" aria-hidden="true">🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder="Rechercher un module, une page ou une action... (ex: Caisse, Stock, Facture)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <button type="button" className="command-palette-close" onClick={onClose} aria-label="Fermer">
            Esc
          </button>
        </div>

        <div className="command-palette-body">
          {displayedList.length === 0 ? (
            <div className="command-palette-empty">
              <span>Aucun résultat pour « {query} »</span>
            </div>
          ) : (
            <ul className="command-palette-list" role="listbox">
              {displayedList.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <li
                    key={item.id + item.path}
                    className={`command-palette-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span className="command-item-icon">{item.icon ?? '📁'}</span>
                    <div className="command-item-details">
                      <span className="command-item-label">{item.label}</span>
                      <span className="command-item-category">{item.category}</span>
                    </div>
                    <span className="command-item-action">Ouvrir ↵</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="command-palette-footer">
          <span>Utilisez <kbd>↑</kbd> <kbd>↓</kbd> pour naviguer</span>
          <span><kbd>Entrée</kbd> pour sélectionner</span>
          <span><kbd>Échap</kbd> pour fermer</span>
        </div>
      </div>
    </div>
  );
}
