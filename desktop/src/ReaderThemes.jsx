import React from 'react';
import { readerThemes } from './readerThemes.js';

export default function ReaderThemes({ value = 'app', onChange }) {
  return (
    <div className="reader-theme-picker">
      <label>
        Fundo da leitura
        <select
          aria-label="Fundo da leitura"
          value={value}
          onChange={event => onChange(event.target.value)}
        >
          {readerThemes.map(theme => (
            <option key={theme.id} value={theme.id}>
              {theme.name}
            </option>
          ))}
        </select>
      </label>
      <div
        className="reader-theme-swatches"
        role="group"
        aria-label="Paleta de temas do leitor"
      >
        {readerThemes.map(theme => (
          <button
            key={theme.id}
            type="button"
            title={theme.name}
            aria-label={`Tema de leitura: ${theme.name}`}
            aria-pressed={value === theme.id}
            style={{
              backgroundColor: theme.backgroundColor || 'var(--surface)',
              color: theme.textColor || 'var(--onSurface)',
            }}
            onClick={() => onChange(theme.id)}
          >
            Aa
          </button>
        ))}
      </div>
    </div>
  );
}
