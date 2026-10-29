// Cálculo de posição do leitor, compartilhado entre a rolagem contínua e o
// modo de páginas (colunas horizontais). Mantido puro para poder ser testado.
function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function readerProgress({
  paged = false,
  scrollTop = 0,
  scrollLeft = 0,
  scrollHeight = 0,
  clientHeight = 0,
  scrollWidth = 0,
  clientWidth = 0,
} = {}) {
  const max = Math.max(
    0,
    paged
      ? number(scrollWidth) - number(clientWidth)
      : number(scrollHeight) - number(clientHeight),
  );
  const position = Math.min(
    max,
    Math.max(0, paged ? number(scrollLeft) : number(scrollTop)),
  );
  return {
    progress: max === 0 ? 100 : Math.min(100, (100 * position) / max),
    atStart: position <= 1,
    atEnd: max === 0 || position >= max - 1,
    position,
    max,
  };
}

function pageAmplitude(percent) {
  const value = Number(percent);
  const clamped = Number.isFinite(value)
    ? Math.min(100, Math.max(20, value))
    : 85;
  return clamped / 100;
}

module.exports = { readerProgress, pageAmplitude };
