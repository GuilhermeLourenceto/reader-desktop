import React from 'react';
import { t as translateMessage } from '../i18n.cjs';
import { appThemes } from '../appThemes';

function PalettePicker({ value = 'default', onChange }) {
  return (
    <div
      className="palette-picker"
      role="group"
      aria-label="Paleta do aplicativo"
    >
      {appThemes.map((theme) => (
        <button
          key={theme.id}
          type="button"
          className="palette-swatch"
          aria-pressed={value === theme.id}
          aria-label={translateMessage('Paleta {v0}', { v0: translateMessage(theme.name) })}
          title={translateMessage(theme.name)}
          onClick={() => onChange(theme.id)}
        >
          <span className="palette-dots" aria-hidden="true">
            <i style={{ '--swatch-light': theme.light.primary, '--swatch-dark': theme.dark.primary }} />
            <i style={{ '--swatch-light': theme.light.secondary, '--swatch-dark': theme.dark.secondary }} />
            <i style={{ '--swatch-light': theme.light.tertiary, '--swatch-dark': theme.dark.tertiary }} />
          </span>
          <span>{translateMessage(theme.name)}</span>
        </button>
      ))}
    </div>
  );
}

function SettingIcon({ name }) {
  const paths = {
    general:
      'M3 6h10v2H3V6m14 0h4v2h-4V6M3 16h4v2H3v-2m8 0h10v2H11v-2M13 3h4v8h-4V3M7 13h4v8H7v-8Z',
    appearance:
      'M12 2a10 10 0 1 0 0 20h1.5a3 3 0 0 0 2-5.2 1 1 0 0 1 .7-1.8H18a4 4 0 0 0 4-4c0-5-4.5-9-10-9m-5 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m3-4a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0m7 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z',
    library: 'M3 3h4v18H3V3m6 0h4v18H9V3m6 1 4-1 4 17-4 1-4-17Z',
    reader:
      'M12 5C8 2 3 3 2 4v15c3-2 7-2 10 1 3-3 7-3 10-1V4c-3-2-7-2-10 1m-1 12c-2-1-4-2-7-1V5c3-1 5 0 7 1v11m9-1c-3-1-5 0-7 1V6c2-1 4-2 7-1v11Z',
    backup:
      'M19 11h-1.26A6 6 0 0 0 6.1 9.03 5 5 0 0 0 6 19h13a4 4 0 0 0 0-8m-6 1v5h-2v-5H8l4-4 4 4h-3Z',
    about:
      'M11 17h2v-6h-2v6m0-8h2V7h-2v2m1-7a10 10 0 1 0 0 20 10 10 0 0 0 0-20m0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z',
    settings:
      'm19.4 13 .1-1-.1-1 2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L15 3h-4l-.4 3a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6-.1 1 .1 1-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 3h4l.4-3a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2.1-1.6M13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z',
  };
  return (
    <svg viewBox="0 0 24 24" className="icon" aria-hidden="true">
      <path d={paths[name] || paths.general} />
    </svg>
  );
}
function Toggle({ title, description, value, onChange }) {
  return (
    <button
      type="button"
      className="setting-row toggle-row"
      role="switch"
      aria-label={title}
      aria-checked={value}
      onClick={() => onChange(!value)}
    >
      <span className="setting-copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <span
        className={`setting-switch ${value ? 'checked' : ''}`}
        aria-hidden="true"
      >
        <span />
      </span>
    </button>
  );
}
function Choice({ title, description, value, options, onChange }) {
  return (
    <label className="setting-row choice-row">
      <span className="setting-copy">
        <strong>{title}</strong>
        {description && <small>{description}</small>}
      </span>
      <select
        aria-label={title}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([value, label]) => (
          <option value={value} key={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
function Slider({ title, value, min, max, step = 1, suffix = '', disabled = false, onChange }) {
  return (
    <label className="setting-slider">
      <span>
        <strong>{title}</strong>
        <output>
          {value}
          {suffix}
        </output>
      </span>
      <input
        aria-label={title}
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export { PalettePicker, SettingIcon, Toggle, Choice, Slider };
