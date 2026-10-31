import { t as translateMessage } from './i18n.cjs';
import React, { useState } from 'react';
import ReaderPreview from './ReaderPreview';
import ReaderThemes from './ReaderThemes';
import Spinner from './Spinner';
import { appThemes } from './appThemes';
import { languages } from './i18n.cjs';

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
            <i style={{ background: theme.dark.primary }} />
            <i style={{ background: theme.dark.secondary }} />
            <i style={{ background: theme.dark.tertiary }} />
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
function Slider({ title, value, min, max, step = 1, suffix = '', onChange }) {
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
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export default function Settings({
  settings,
  onChange,
  onBackup,
  onRestore,
  onSources,
  onReset,
  busy,
  version,
}) {
  const [page, setPage] = useState('more');
  const change = (key, value) => onChange({ [key]: value });
  const entries = [
    ['general', 'Geral', 'Privacidade e opções de navegação'],
    ['appearance', 'Aparência', 'Tema e cores do aplicativo'],
    ['library', 'Biblioteca', 'Tamanho das capas e contadores'],
    ['reader', 'Leitor', 'Fonte, espaçamento e cores da leitura'],
    ['backup', 'Backups', 'Exportar e restaurar sua biblioteca'],
    ['about', 'Sobre', 'LNReader Desktop e informações da versão'],
  ];
  const row = (key, title, description, action) => (
    <button
      key={key}
      className="setting-row setting-link"
      aria-label={title}
      disabled={busy}
      onClick={action || (() => setPage(key))}
    >
      <SettingIcon name={key} />
      <span className="setting-copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <span className="setting-chevron" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="icon" aria-hidden="true">
          <path d="m9 5 7 7-7 7-1.4-1.4 5.6-5.6-5.6-5.6L9 5Z" />
        </svg>
      </span>
    </button>
  );
  const quick = (
    <>
      <Toggle
        title="Somente baixados"
        description="Mostrar na biblioteca apenas obras com capítulos baixados"
        value={Boolean(settings.desktopDownloadedOnly)}
        onChange={(value) => change('desktopDownloadedOnly', value)}
      />
      <Toggle
        title="Modo anônimo"
        description="Não salvar histórico nem progresso das próximas leituras"
        value={Boolean(settings.desktopIncognito)}
        onChange={(value) => change('desktopIncognito', value)}
      />
    </>
  );
  const title =
    page === 'more'
      ? 'Mais'
      : page === 'settings'
        ? 'Configurações'
        : entries.find((entry) => entry[0] === page)?.[1];
  return (
    <div className="settings-screen" data-settings-page={page}>
      <header className="settings-header">
        {page !== 'more' && (
          <button
            className="icon-button"
            aria-label="Voltar nas configurações"
            onClick={() => setPage(page === 'settings' ? 'more' : 'settings')}
          >
            <svg viewBox="0 0 24 24" className="icon" aria-hidden="true">
              <path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20v-2Z" />
            </svg>
          </button>
        )}
        <h2>{title}</h2>
      </header>
      {page === 'more' && (
        <>
          <div className="settings-brand">
            <img src="logo.png" alt="" />
            <h3>LNReader</h3>
            <span>Desktop · {version || '0.2.0'}</span>
          </div>
          <div className="settings-group">{quick}</div>
          <div className="settings-group">
            {row(
              'settings',
              'Configurações',
              'Personalize o aplicativo e sua leitura',
            )}
            {row('backup', 'Backups', 'Crie ou restaure um backup local')}
            {row('about', 'Sobre', 'Informações da versão')}
          </div>
        </>
      )}{' '}
      {page === 'settings' && (
        <>
          <div className="settings-group">
          {entries.map(([key, title, description]) =>
            row(key, title, description),
          )}
          {row(
            'sources',
            'Repositórios',
            'Gerenciar os repositórios de fontes',
            onSources,
          )}
        </div>
        <div className="settings-group">
          <button
            type="button"
            className="setting-row setting-link"
            aria-label="Restaurar configurações padrão"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  translateMessage(
                    'Restaurar as configurações do aplicativo? Sua biblioteca, fontes, downloads, histórico e progresso serão mantidos.',
                  ),
                )
              )
                onReset();
            }}
          >
            <SettingIcon name="settings" />
            <span className="setting-copy">
              <strong>Restaurar configurações padrão</strong>
              <small>
                Voltar às preferências iniciais sem apagar suas obras ou fontes.
              </small>
            </span>
          </button>
        </div>
        </>
      )}
      {page === 'general' && (
        <>
          <div className="settings-group">
            <Choice
              title="Idioma da interface"
              value={settings.desktopInterfaceLanguage || 'pt-BR'}
              options={languages}
              onChange={(value) => change('desktopInterfaceLanguage', value)}
            />
          </div>
          <h3 className="settings-section-title">Privacidade e navegação</h3>
          <div className="settings-group">{quick}</div>
          <p className="settings-note">
            O histórico anterior é mantido. F11 alterna a tela cheia.
          </p>
        </>
      )}
      {page === 'appearance' && (
        <>
          <h3 className="settings-section-title">Tema</h3>
          <div className="settings-group">
            <Choice
              title="Tema do aplicativo"
              value={settings.desktopTheme || 'dark'}
              options={[
                ['system', 'Seguir tema do sistema'],
                ['light', 'Claro'],
                ['dark', 'Escuro'],
              ]}
              onChange={(value) => change('desktopTheme', value)}
            />
          </div>
          <h3 className="settings-section-title">Paleta do aplicativo</h3>
          <div className="settings-group">
            <PalettePicker
              value={settings.desktopPalette || 'default'}
              onChange={(value) => change('desktopPalette', value)}
            />
          </div>
          <p className="settings-note">
            As cores escolhidas também se aplicam ao leitor quando ele segue o
            tema do aplicativo.
          </p>
        </>
      )}
      {page === 'library' && (
        <>
          <h3 className="settings-section-title">Exibição</h3>
          <div className="settings-group">
            <Choice
              title="Tamanho das capas"
              value={settings.desktopCoverSize || 'normal'}
              options={[
                ['compact', 'Compacto'],
                ['normal', 'Padrão'],
                ['large', 'Grande'],
              ]}
              onChange={(value) => change('desktopCoverSize', value)}
            />
            <Toggle
              title="Mostrar contadores nas capas"
              description="Exibir capítulos baixados e não lidos"
              value={settings.desktopShowBadges !== false}
              onChange={(value) => change('desktopShowBadges', value)}
            />
            <Toggle
              title="Mostrar quantidade de capítulos"
              description="Exibir o resumo de capítulos abaixo de cada capa"
              value={settings.desktopShowChapterCount !== false}
              onChange={(value) => change('desktopShowChapterCount', value)}
            />
          </div>
        </>
      )}
      {page === 'reader' && (
        <>
          <h3 className="settings-section-title">Texto</h3>
          <div className="reader-settings-layout">
            <div className="settings-group">
              <Choice
                title="Fonte de leitura"
                value={settings.desktopFontFamily || 'serif'}
                options={[
                  ['serif', 'PT Serif'],
                  ['sans', 'Noto Sans'],
                  ['system', 'Fonte do sistema'],
                ]}
                onChange={(value) => change('desktopFontFamily', value)}
              />
              <Slider
                title="Tamanho da fonte"
                value={settings.desktopFontSize || 21}
                min={14}
                max={40}
                suffix=" px"
                onChange={(value) => change('desktopFontSize', value)}
              />
              <Slider
                title="Espaçamento entre linhas"
                value={settings.desktopLineHeight || 1.85}
                min={1.2}
                max={2.6}
                step={0.05}
                onChange={(value) => change('desktopLineHeight', value)}
              />
              <Slider
                title="Largura do texto"
                value={settings.desktopReaderWidth || 820}
                min={500}
                max={1200}
                step={20}
                suffix=" px"
                onChange={(value) => change('desktopReaderWidth', value)}
              />
              <Choice
                title="Alinhamento do texto"
                value={settings.desktopTextAlign || 'left'}
                options={[
                  ['left', 'À esquerda'],
                  ['justify', 'Justificado'],
                ]}
                onChange={(value) => change('desktopTextAlign', value)}
              />
              <ReaderThemes
                value={settings.desktopReaderTheme || 'app'}
                onChange={(value) => change('desktopReaderTheme', value)}
              />
              <Choice
                title="Modo de leitura"
                value={settings.desktopPagination || 'scroll'}
                options={[
                  ['scroll', 'Rolagem contínua'],
                  ['pages', 'Páginas horizontais'],
                ]}
                onChange={(value) => change('desktopPagination', value)}
              />
              <Slider
                title="Avanço por página (rolagem)"
                value={settings.desktopPageStep ?? 50}
                min={0}
                max={100}
                step={5}
                suffix=" %"
                onChange={(value) => change('desktopPageStep', value)}
              />
              <Toggle
                title="Ocultar barras durante a leitura"
                description="Aparecem ao aproximar o mouse das bordas ou clicar na página."
                value={settings.desktopReaderAutoHide !== false}
                onChange={(value) => change('desktopReaderAutoHide', value)}
              />
            </div>
            <ReaderPreview settings={settings} />
          </div>
          <p className="settings-note">
            Setas e espaço rolam a página. Home e End vão ao início e ao fim.
            Anterior e Próximo trocam de capítulo.
          </p>
        </>
      )}
      {page === 'backup' && (
        <>
          <h3 className="settings-section-title">Backup local</h3>
          <p className="settings-note">
            Biblioteca, categorias, capítulos, progresso, configurações e fontes
            no formato ZIP do LNReader.
          </p>
          <div className="settings-group">
            {row(
              'backup',
              'Exportar backup',
              'Salvar uma cópia dos seus dados',
              onBackup,
            )}
            {row(
              'backup-restore',
              'Restaurar backup',
              'Importar um backup do LNReader',
              onRestore,
            )}
          </div>
          {busy && (
            <p className="settings-status" role="status">
              <Spinner small label="Processando backup" />
              Processando backup…
            </p>
          )}
          <p className="settings-note">
            A restauração pede confirmação antes de substituir os dados e guarda
            uma cópia do estado anterior.
          </p>
        </>
      )}
      {page === 'about' && (
        <>
          <div className="settings-brand">
            <img src="logo.png" alt="" />
            <h3>LNReader Desktop</h3>
            <span>{version || '0.2.0'} · Versão experimental para Windows</span>
          </div>
          <div className="settings-group">
            <p>Leitor de novels com o motor original de fontes do LNReader.</p>
            <p>
              Backups ZIP locais e leitura offline dos capítulos armazenados.
            </p>
            <p>Algumas fontes podem exigir login ou bloquear o acesso.</p>
          </div>
        </>
      )}
    </div>
  );
}
