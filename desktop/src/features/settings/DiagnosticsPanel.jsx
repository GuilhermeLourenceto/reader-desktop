import React, { useEffect, useState } from 'react';
import { t as translateMessage } from '../../i18n.cjs';

const EMPTY = {
  entries: [],
  usedBytes: 0,
  limitBytes: 15 * 1024 * 1024,
  retentionDays: 14,
};
const textForLevel = { error: 'Erro', warning: 'Aviso', info: 'Atividade' };
const operationLabels = {
  app: 'Problema no aplicativo',
  backup: 'Problema no backup',
  restore: 'Problema na restauração',
  storage: 'Problema ao salvar dados',
  source: 'Problema com uma fonte',
  reader: 'Problema no leitor',
  interface: 'Problema na interface',
  network: 'Problema na conexão',
};
const shortDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Data indisponível'
    : date.toLocaleString();
};

export default function DiagnosticsPanel() {
  const [history, setHistory] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [filter, setFilter] = useState('error');
  const [expanded, setExpanded] = useState(null);
  const reload = async () => {
    const result = await window.desktop.diagnostics.list({ limit: 100 });
    setHistory(result);
  };
  useEffect(() => {
    let active = true;
    window.desktop.diagnostics
      .list({ limit: 100 })
      .then((result) => {
        if (active) setHistory(result);
      })
      .catch(() => {
        if (active) setFeedback('Não foi possível consultar o histórico.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  const action = async (task) => {
    if (busy) return;
    setBusy(true);
    setFeedback('');
    try {
      await task();
    } catch {
      setFeedback('A operação não pôde ser concluída. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };
  const saveReport = () =>
    action(async () => {
      const result = await window.desktop.diagnostics.export();
      if (result?.saved)
        setFeedback(
          'Relatório salvo. Revise o arquivo antes de anexar a uma issue.',
        );
    });
  const clear = () =>
    action(async () => {
      const removed = await window.desktop.diagnostics.clear();
      if (!removed) return;
      await reload();
      setExpanded(null);
      setFeedback(
        'Histórico automático apagado. Relatórios salvos manualmente não foram alterados.',
      );
    });
  const openIssue = () =>
    action(async () => {
      await window.desktop.diagnostics.openIssue();
    });
  const records = history.entries.filter(
    (entry) => filter === 'all' || entry.level === filter,
  );
  const size = (history.usedBytes / (1024 * 1024)).toFixed(1);
  const maximum = Math.round(history.limitBytes / (1024 * 1024));
  return (
    <section
      className="diagnostics-panel"
      aria-label="Histórico de diagnósticos"
    >
      <div className="diagnostics-overview">
        <strong>Erros recentes</strong>
        <p>
          Erros e avisos ficam armazenados apenas neste computador. Nenhum
          relatório é enviado automaticamente.
        </p>
        <small>
          {size} MiB utilizados de até {maximum} MiB · Retenção de{' '}
          {history.retentionDays} dias
        </small>
      </div>
      <div className="diagnostics-actions">
        <button type="button" disabled={busy} onClick={saveReport}>
          Salvar relatório (.txt)
        </button>
        <button type="button" disabled={busy} onClick={openIssue}>
          Relatar bug no GitHub
        </button>
        <button type="button" disabled={busy} onClick={clear}>
          Limpar histórico
        </button>
      </div>
      <p className="settings-note">
        O relatório inclui a versão do aplicativo, erros recentes e códigos de
        diagnóstico. Confira o texto antes de compartilhar.
      </p>
      {feedback && (
        <p className="diagnostics-feedback" role="status">
          {feedback}
        </p>
      )}
      <div className="diagnostics-history-heading">
        <h3 className="settings-section-title">Registros recentes</h3>
        <button
          type="button"
          onClick={() => action(reload)}
          disabled={busy || loading}
        >
          Atualizar
        </button>
      </div>
      <div
        className="diagnostics-filters"
        role="group"
        aria-label="Filtrar registros"
      >
        {[
          ['all', 'Todos'],
          ['error', 'Erros'],
          ['warning', 'Avisos'],
          ['info', 'Atividades'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {loading && (
        <p className="settings-note" role="status">
          Carregando registros…
        </p>
      )}
      {!loading && records.length === 0 && (
        <p className="diagnostics-empty">Nenhum registro nesta categoria.</p>
      )}
      <div className="diagnostics-history">
        {records.map((entry) => (
          <div className="diagnostics-entry" key={entry.id}>
            <button
              type="button"
              className="diagnostics-entry-summary"
              aria-expanded={expanded === entry.id}
              onClick={() =>
                setExpanded(expanded === entry.id ? null : entry.id)
              }
            >
              <span
                className={`diagnostics-level diagnostics-level-${entry.level}`}
              >
                {textForLevel[entry.level] || 'Registro'}
              </span>
              <span className="diagnostics-entry-copy">
                <strong>
                  {entry.level === 'info'
                    ? 'Atividade'
                    : operationLabels[entry.operation] || 'Erro'}
                </strong>
                <small>{shortDate(entry.at)}</small>
              </span>
              <span aria-hidden="true">
                {expanded === entry.id ? '−' : '+'}
              </span>
            </button>
            {expanded === entry.id && (
              <div className="diagnostics-entry-details">
                <small>
                  {entry.code} · {translateMessage('ID do evento:')} {entry.id}
                </small>
                <span className="diagnostics-technical-message">
                  {entry.message}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    action(async () => {
                      await window.desktop.diagnostics.copy(
                        `${entry.code} · ${entry.id}`,
                      );
                      setFeedback('Código do diagnóstico copiado.');
                    })
                  }
                >
                  Copiar código e ID
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
