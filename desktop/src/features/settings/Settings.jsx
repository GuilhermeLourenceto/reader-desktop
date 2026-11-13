import { t as translateMessage } from '../../i18n.cjs';
import React, { useEffect, useState } from 'react';
import DiagnosticsPanel from './DiagnosticsPanel';
import ReaderPreview from '../reader/ReaderPreview';
import ReaderThemes from '../reader/ReaderThemes';
import Spinner from '../../components/Spinner';
import { languages } from '../../i18n.cjs';
import { DEFAULT_DESKTOP_SETTINGS } from '../../state/defaultSettings.cjs';
import {
  READER_HIDE_DELAY_MIN,
  READER_HIDE_DELAY_MAX,
  readerHideDelaySeconds,
} from '../../domain/readerChromeDelay.cjs';

import { PalettePicker, SettingIcon, Toggle, Choice, Slider } from './Controls';

export default function Settings({
  settings,
  onChange,
  onBackup,
  onRestore,
  onChooseBackupFolder,
  onSources,
  onReset,
  busy,
  version,
  openDiagnosticsRequest = 0,
}) {
  const [page, setPage] = useState('more');
  useEffect(() => {
    if (openDiagnosticsRequest) setPage('diagnostics');
  }, [openDiagnosticsRequest]);
  const change = (key, value) => onChange({ [key]: value });
  const entries = [
    ['general', 'Geral', 'Privacidade e opções de navegação'],
    ['appearance', 'Aparência', 'Tema e cores do aplicativo'],
    ['library', 'Biblioteca', 'Tamanho das capas e contadores'],
    ['reader', 'Leitor', 'Fonte, espaçamento e cores da leitura'],
    ['backup', 'Backups', 'Exportar e restaurar sua biblioteca'],
    ['diagnostics', 'Diagnósticos', 'Erros, atividades e relatórios para issues'],
    ['about', 'Sobre', 'Reader Desktop e informações da versão'],
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
            <h3>Reader Desktop</h3>
            <span>Desktop · {version || '…'}</span>
          </div>
          <div className="settings-group">{quick}</div>
          <div className="settings-group">
            {row(
              'settings',
              'Configurações',
              'Personalize o aplicativo e sua leitura',
            )}
            {row('backup', 'Backups', 'Crie ou restaure um backup local')}
            {row('diagnostics', 'Diagnósticos', 'Consultar ou salvar relatório de erros')}
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
              value={settings.desktopInterfaceLanguage || DEFAULT_DESKTOP_SETTINGS.desktopInterfaceLanguage}
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
                ['oled', 'Preto OLED'],
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
                value={Math.max(10, settings.desktopPageStep ?? 50)}
                min={10}
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
              <Slider
                title="Tempo para ocultar as barras"
                value={readerHideDelaySeconds(settings.desktopReaderHideDelay)}
                min={READER_HIDE_DELAY_MIN}
                max={READER_HIDE_DELAY_MAX}
                step={0.2}
                suffix=" s"
                disabled={settings.desktopReaderAutoHide === false}
                onChange={(value) => change('desktopReaderHideDelay', value)}
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
            no formato ZIP do Reader Desktop.
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
              'Importar um backup do Reader Desktop',
              onRestore,
            )}
          </div>
          <h3 className="settings-section-title">Backup automático</h3>
          <div className="settings-group">
            <Choice title="Frequência"
              description="Verificar ao abrir e enquanto o aplicativo estiver funcionando"
              value={String(settings.desktopBackupFrequency ?? 'off')}
              options={[
                ['off', 'Desativado'],
                ['launch', 'A cada inicialização'],
                ['6', 'A cada 6 horas'],
                ['12', 'A cada 12 horas'],
                ['24', 'Diariamente'],
                ['48', 'A cada 2 dias'],
                ['168', 'Semanalmente'],
              ]}
              onChange={value => change('desktopBackupFrequency', value)}
            />
            <button type="button" className="setting-row setting-link"
              onClick={async () => {
                const folder = await onChooseBackupFolder();
                if (folder) change('desktopBackupDirectory', folder);
              }}>
              <SettingIcon name="backup" />
              <span className="setting-copy">
                <strong>Pasta dos backups automáticos</strong>
                <small>{settings.desktopBackupDirectory || 'Nenhuma pasta selecionada'}</small>
              </span>
            </button>
            <Toggle title="Incluir capítulos baixados"
              description="Preserva o conteúdo offline e aumenta o tamanho do backup"
              value={settings.desktopBackupIncludeDownloads !== false}
              onChange={value => change('desktopBackupIncludeDownloads', value)}
            />
          </div>
          <p className="settings-note">
            Os backups automáticos são criados enquanto o aplicativo está aberto e somente quando existem alterações.
            Os últimos cinco backups automáticos são mantidos.
          </p>
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
      {page === 'diagnostics' && <DiagnosticsPanel />}
      {page === 'about' && (
        <>
          <div className="settings-brand">
            <img src="logo.png" alt="" />
            <h3>Reader Desktop</h3>
            <span>{version || '…'} · Versão experimental para Windows e Linux</span>
          </div>
          <div className="settings-group">
            <p>Leitor de novels com o motor original de fontes do Reader Desktop.</p>
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
