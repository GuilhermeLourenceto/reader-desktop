'use strict';

// Only present actionable, non-sensitive messages to users. The original
// exception belongs in the private, redacted diagnostic report.
function userMessageForError(error) {
  const detail = String(error?.message ?? error ?? '').slice(0, 4096);
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
