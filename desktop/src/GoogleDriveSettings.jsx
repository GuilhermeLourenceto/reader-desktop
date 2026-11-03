import React, { useEffect, useState } from 'react';
import { t } from './i18n.cjs';

export default function GoogleDriveSettings({ onBackup, onRestore, disabled }) {
  const [status, setStatus] = useState(null);
  const [files, setFiles] = useState([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh() {
    const next = await window.desktop.driveStatus();
    setStatus(next);
    if (next.connected && next.secure) {
      setFiles(await window.desktop.driveList());
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
                })}>{t('Desconectar conta')}</button>
              : <button disabled={blocked || !canUse} onClick={() => action(async () => {
                  await window.desktop.driveConnect();
                  return t('Conta conectada');
                })}>{t('Conectar conta Google')}</button>}
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
              {t('Salvar no Drive agora')}
            </button>
            <button disabled={blocked} onClick={() => action(async () => {
              await refresh();
            })}>
              {t('Atualizar lista de backups')}
            </button>
          </div>
          <p className="settings-note">
            {status.lastBackupAt
              ? t('Último envio: {v0}', { v0: new Date(status.lastBackupAt).toLocaleString() })
              : t('Nenhum envio automático realizado.')}
          </p>
          <h3 className="settings-section-title">{t('Backups disponíveis')}</h3>
          {files.length === 0 && (
            <p className="settings-note">{t('Nenhum backup encontrado no Drive.')}</p>
          )}
          <div className="cloud-files">
            {files.map(file => (
              <div className="cloud-file" key={file.id}>
                <span className="cloud-file-name" title={file.name}>
                  <strong>{file.name}</strong>
                  <small>
                    {file.createdTime ? new Date(file.createdTime).toLocaleString() : ''}
                    {file.size ? ' · ' + Math.ceil(file.size / 1024 / 1024) + ' MB' : ''}
                  </small>
                </span>
                <button disabled={blocked} onClick={() => action(async () => {
                  const result = await onRestore(file.id);
                  if (result) return t('Backup restaurado.');
                })}>
                  {t('Restaurar deste backup')}
                </button>
              </div>
            ))}
          </div>
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
