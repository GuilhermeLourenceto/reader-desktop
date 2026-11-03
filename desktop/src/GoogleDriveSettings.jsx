import React, { useEffect, useState } from 'react';
import { t, getLocale } from './i18n.cjs';
import { sortDriveBackups, createdAtMillis } from './driveBackupList.cjs';

export default function GoogleDriveSettings({ onBackup, onRestore, disabled }) {
  const [status, setStatus] = useState(null);
  const [files, setFiles] = useState([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [choosingBackup, setChoosingBackup] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const orderedFiles = sortDriveBackups(files);
  // If timestamps are missing, we cannot honestly label a backup "latest".
  const mostRecent = orderedFiles.find(file => createdAtMillis(file) > 0);
  const selectedBackup = orderedFiles.find(file => file.id === selectedId);
  const details = file => [
    createdAtMillis(file)
      ? new Date(file.createdTime).toLocaleString(getLocale())
      : t('Data indisponível'),
    Math.ceil(Math.max(0, Number(file.size) || 0) / 1024 / 1024) + ' MB',
  ].join(' · ');

  async function refresh() {
    const next = await window.desktop.driveStatus();
    setStatus(next);
    if (next.connected && next.secure) {
      const list = await window.desktop.driveList();
      setFiles(list);
      setSelectedId(previous => list.some(file => file.id === previous) ? previous : '');
    } else {
      setFiles([]);
    }
  }
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const next = await window.desktop.driveStatus();
        if (!active) return;
        setStatus(next);
        if (next.connected && next.secure) {
          const list = await window.desktop.driveList();
          if (active) setFiles(list);
        }
      } catch (cause) {
        if (active) setError(cause.message || String(cause));
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function action(handler) {
    if (working || disabled) return;
    setWorking(true);
    setError('');
    setNotice('');
    try {
      const message = await handler();
      if (message) setNotice(message);
      await refresh();
    } catch (cause) {
      setError(cause.message || String(cause));
    } finally {
      setWorking(false);
    }
  }
  const blocked = working || disabled || status?.busy;
  const canUse = status?.configured && status?.secure;
  return (
    <section className="cloud-settings" aria-label={t('Backup na nuvem')}>
      <h3 className="settings-section-title">{t('Google Drive')}</h3>
      <p className="settings-note">
        {t('Salve e restaure backups ZIP do LNReader na sua conta Google.')}
      </p>
      <p className="settings-note">
        {t('Os backups usam espaço no Drive e não possuem criptografia de ponta a ponta.')}
      </p>
      {!status && !error && <p role="status">{t('Carregando backups…')}</p>}
      {status && !status.configured && (
        <p className="settings-note" role="status">
          {t('Google Drive ainda não foi ativado nesta compilação.')}
        </p>
      )}
      {status && status.configured && !status.secure && (
        <p className="settings-note" role="alert">
          {t('É necessário um chaveiro seguro do sistema para conectar a conta.')}
        </p>
      )}
      {status && (
        <div className="settings-group">
          <div className="cloud-status">
            <span>{status.connected ? t('Conta conectada') : t('Ainda não conectado')}</span>
            {status.connected
              ? <button disabled={blocked} onClick={() => action(async () => {
                  await window.desktop.driveDisconnect();
                  return t('Conta desconectada.');
                })}>{t('Desconectar')}</button>
              : <button disabled={blocked || !canUse} onClick={() => action(async () => {
                  await window.desktop.driveConnect();
                  return t('Conta conectada');
                })}>{t('Conectar Google')}</button>}
          </div>
          <label className="cloud-toggle">
            <span>
              <strong>{t('Backup automático diário')}</strong>
              <small>{t('Enquanto o LNReader estiver aberto e conectado à internet.')}</small>
            </span>
            <input
              aria-label={t('Backup automático diário')}
              type="checkbox"
              checked={Boolean(status.automatic)}
              disabled={blocked || !status.connected || !status.secure}
              onChange={event => {
                const checked = event.target.checked;
                void action(async () => {
                  await window.desktop.driveAutomatic(checked);
                });
              }}
            />
          </label>
        </div>
      )}
      {status?.connected && status.secure && (
        <>
          <div className="cloud-buttons">
            <button disabled={blocked} onClick={() => action(async () => {
              const uploaded = await onBackup();
              return uploaded.missingCount
                ? t('Backup enviado com arquivos ausentes: {v0}', { v0: uploaded.missingCount })
                : t('Backup enviado ao Google Drive.');
            })}>
              {t('Salvar no Drive')}
            </button>
            <button disabled={blocked} onClick={() => action(async () => {
              await refresh();
            })}>
              {t('Atualizar')}
            </button>
          </div>
          <p className="settings-note">
            {status.lastBackupAt
              ? t('Último envio: {v0}', { v0: new Date(status.lastBackupAt).toLocaleString(getLocale()) })
              : t('Nenhum envio automático realizado.')}
          </p>
          <h3 className="settings-section-title">{t('Restaurar do Google Drive')}</h3>
          {orderedFiles.length === 0 && (
            <p className="settings-note">{t('Nenhum backup encontrado no Drive.')}</p>
          )}
          {mostRecent && (
            <div className="cloud-latest">
              <span className="cloud-file-name">
                <strong>{t('Backup mais recente')}</strong>
                <small title={mostRecent.name}>{mostRecent.name}</small>
                <small>{details(mostRecent)}</small>
              </span>
              <button disabled={blocked} onClick={() => action(async () => {
                const restored = await onRestore(mostRecent.id);
                if (restored) return t('Backup restaurado.');
              })}>
                {t('Restaurar último')}
              </button>
            </div>
          )}
          {orderedFiles.length > 0 && (
            <>
              <button
                className="cloud-choose-button"
                disabled={blocked}
                aria-expanded={choosingBackup}
                aria-controls="cloud-backup-choices"
                onClick={() => {
                  setChoosingBackup(value => !value);
                  setSelectedId('');
                }}
              >
                {choosingBackup ? t('Ocultar lista') : t('Escolher backup')}
              </button>
              {choosingBackup && (
                <div className="cloud-backup-choices" id="cloud-backup-choices">
                  <p className="settings-note">{t('Selecione a versão que deseja restaurar.')}</p>
                  <div className="cloud-files" role="radiogroup" aria-label={t('Escolher backup')}>
                    {orderedFiles.map(file => (
                      <label className="cloud-file cloud-choice" key={file.id}>
                        <input
                          type="radio"
                          name="cloud-backup-choice"
                          value={file.id}
                          checked={selectedId === file.id}
                          disabled={blocked}
                          onChange={() => setSelectedId(file.id)}
                          aria-label={file.name}
                        />
                        <span className="cloud-file-name" title={file.name}>
                          <strong>{file.name}</strong>
                          <small>{details(file)}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                  <button
                    className="cloud-restore-selected"
                    disabled={blocked || !selectedBackup}
                    onClick={() => action(async () => {
                      // The user explicitly chooses an ID; no fallback to a
                      // newer/different backup if the selected one disappears.
                      const restored = await onRestore(selectedBackup.id);
                      if (restored) return t('Backup restaurado.');
                    })}
                  >
                    {t('Restaurar selecionado')}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
      {working && <p role="status" className="settings-status">{t('Processando backup…')}</p>}
      {error && <p role="alert" className="settings-status">{error}</p>}
      {notice && <p role="status" className="settings-status">{notice}</p>}
      <p className="settings-note">
        {t('A restauração sempre pede confirmação e preserva uma cópia local anterior.')}
      </p>
    </section>
  );
}
