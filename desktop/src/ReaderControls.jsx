import React from 'react';
import ReaderThemes from './ReaderThemes';
export default function ReaderControls({
  settings,
  onChange,
  chapter,
  onChapterChange,
  onDelete,
  onRefresh,
  busy,
  Icon,
}) {
  const choice = (key, title, value, options) => (
    <label key={key}>
      {title}
      <select
        aria-label={title}
        value={settings[key] || value}
        onChange={event => onChange({ [key]: event.target.value })}
      >
        {options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
  const slider = (key, title, value, min, max, step = 1, suffix = '') => (
    <label key={key}>
      {title}{' '}
      <output>
        {settings[key] ?? value}
        {suffix}
      </output>
      <input
        type="range"
        aria-label={title}
        min={min}
        max={max}
        step={step}
        value={settings[key] ?? value}
        onChange={event => onChange({ [key]: Number(event.target.value) })}
      />
    </label>
  );
  return (
    <div
      className="reader-controls"
      role="region"
      aria-label="Controles do leitor"
    >
      <div className="reader-control-grid">
        {choice('desktopFontFamily', 'Fonte de leitura', 'serif', [
          ['serif', 'PT Serif'],
          ['sans', 'Noto Sans'],
          ['system', 'Sistema'],
        ])}
        <ReaderThemes
          value={settings.desktopReaderTheme || 'app'}
          onChange={value => onChange({ desktopReaderTheme: value })}
        />
        {choice('desktopTextAlign', 'Alinhamento do texto', 'left', [
          ['left', 'À esquerda'],
          ['justify', 'Justificado'],
        ])}
        {slider('desktopFontSize', 'Tamanho da fonte', 21, 14, 40)}
        {slider(
          'desktopLineHeight',
          'Espaçamento entre linhas',
          1.85,
          1.2,
          2.6,
          0.05,
        )}
        {slider(
          'desktopReaderWidth',
          'Largura do texto',
          820,
          500,
          1200,
          20,
          ' px',
        )}
        {choice('desktopPagination', 'Modo de leitura', 'scroll', [
          ['scroll', 'Rolagem contínua'],
          ['pages', 'Páginas horizontais'],
        ])}
        {slider('desktopPageStep', 'Avanço por página', 85, 30, 100, 5, '%')}
        <label className="reader-toggle">
          <input
            type="checkbox"
            checked={settings.desktopReaderAutoHide !== false}
            onChange={event =>
              onChange({ desktopReaderAutoHide: event.target.checked })
            }
          />
          Ocultar barras durante a leitura
        </label>
      </div>
      <p className="reader-shortcuts">
        Setas, Page Up/Page Down e espaço avançam uma página; Home e End vão ao
        início e ao fim do capítulo. Para trocar de capítulo, use Anterior ou
        Próximo.
      </p>
      <div className="reader-chapter-actions">
        <button
          aria-label="Alternar lido no leitor"
          disabled={busy}
          onClick={() =>
            onChapterChange(
              chapter.unread === false
                ? { unread: true, progress: 0, desktopProgressUnit: 'percent' }
                : { unread: false },
            )
          }
        >
          <Icon name={chapter.unread === false ? 'unread' : 'check'} />
          {chapter.unread === false
            ? 'Marcar como não lido'
            : 'Marcar como lido'}
        </button>
        <button
          disabled={busy}
          onClick={() => onChapterChange({ bookmark: !chapter.bookmark })}
        >
          <Icon name="bookmark" />
          {chapter.bookmark ? 'Remover marcador' : 'Adicionar marcador'}
        </button>
        <button disabled={busy || !chapter.isDownloaded} onClick={onDelete}>
          <Icon name="trash" />
          Apagar download do capítulo
        </button>
        <button
          disabled={busy}
          aria-label="Atualizar capítulo"
          onClick={onRefresh}
        >
          <Icon name="refresh" />
          Atualizar capítulo
        </button>
      </div>
    </div>
  );
}
