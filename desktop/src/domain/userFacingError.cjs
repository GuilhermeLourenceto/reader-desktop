'use strict';

// Only present actionable, non-sensitive messages to users. The original
// exception belongs in the private, redacted diagnostic report.
const ACTIONABLE = new Set([
  'Exportação anterior ainda está em andamento',
  'Fonte não instalada',
  'Fonte não instalada. Instale-a em Fontes.',
  'Capítulo vazio',
  'Capítulo sem conteúdo',
  'Este capítulo não está disponível offline e a fonte não está instalada.',
  'A fonte retornou um capítulo vazio. Atualize a fonte ou tente novamente.',
  'Este capítulo não contém texto ou imagens. Tente novamente ou atualize a fonte.',
  'Esta fonte não oferece paginação de capítulos.',
  'A fonte retornou uma página de capítulos inválida.',
  'Esta página não retornou capítulos. Tente novamente; a página não será pulada.',
  'Esta fonte não oferece pesquisa de obras.',
  'Esta fonte não oferece uma lista de obras populares.',
  'Aguarde ou pare os downloads antes de atualizar a biblioteca.',
  'Aguarde ou pare a fila de downloads antes de restaurar um backup.',
  'Aguarde ou pare a fila de downloads antes de desinstalar fontes.',
  'Aguarde ou pare a fila de downloads antes de instalar ou atualizar fontes.',
]);

function userMessageForError(error) {
  const detail = String(error?.message ?? error ?? '').slice(0, 4096);
  if (ACTIONABLE.has(detail)) return detail;
  if (detail.includes('Página temporariamente indisponível'))
    return 'Página temporariamente indisponível';
  if (/\bENOSPC\b|no space left|disk full|espaço (livre )?insuficiente/i.test(detail))
    return 'Não há espaço suficiente para concluir a operação.';
  if (/\bEACCES\b|\bEPERM\b|permission denied|acesso negado|permiss[aã]o negada/i.test(detail))
    return 'Não foi possível acessar os arquivos. Verifique as permissões.';
  if (/\b(?:ZIP|CRC|backup|manifesto)\b|arquivo (corrompido|inválido)|restaura[cç][aã]o|\brestore\b|central directory|invalid signature|novel inv[aá]lida|categorias inv[aá]lidas/i.test(detail))
    return 'Não foi possível ler o backup. Verifique o arquivo e tente novamente.';
  if (/\b(?:fetch|network|ETIMEDOUT|ENOTFOUND|ECONNREFUSED|ECONNRESET|timeout)\b|conex[aã]o|fonte n[aã]o respondeu/i.test(detail))
    return 'Não foi possível acessar a fonte. Verifique a conexão e tente novamente.';
  return 'Não foi possível concluir esta ação. Tente novamente.';
}
module.exports = { userMessageForError };
