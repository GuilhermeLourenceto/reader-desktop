import React, { useRef, useState } from 'react';
import ReaderText, { readerPresentation } from './ReaderText';
const sample =
  '<h2>Capítulo 1 — Uma nova história</h2><p>A luz da manhã atravessava a janela quando ela abriu o livro. Lá fora, a cidade despertava lentamente, mas entre aquelas páginas havia um mundo inteiro esperando.</p><p>O caminho seguia entre as árvores, dobrando a cada descoberta. Nada parecia urgente: havia tempo para observar os detalhes, ouvir o vento e escolher a próxima direção.</p><p>— Toda jornada começa com uma primeira página — disse o viajante.</p><p>Ela sorriu e continuou a leitura. Algumas histórias não precisavam de pressa; precisavam apenas de espaço para acontecer.</p>';
export default function ReaderPreview({ settings }) {
  const dialog = useRef(null);
  const scroll = useRef(null);
  const [opened, setOpened] = useState(false);
  const paged = settings.desktopPagination === 'pages';
  const surface = readerPresentation(settings).surface;
  return (
    <div className="reader-preview-section">
      <div className="preview-heading">
        <h3>Prévia da leitura</h3>
        <button
          onClick={() => {
            dialog.current.showModal();
            setOpened(true);
          }}
        >
          Ver em tamanho real
        </button>
      </div>
      <p className="settings-note">
        Mesma fonte, cores, margens e espaçamento usados no leitor.
      </p>
      <div className="reading-preview reader-preview-frame" style={surface}>
        <ReaderText settings={settings} html={sample} />
      </div>
      <dialog
        ref={dialog}
        className="reader-preview-dialog"
        aria-label="Prévia do leitor em tamanho real"
        onClose={() => setOpened(false)}
      >
        <div className="reader-view" style={surface}>
          <header>
            <div className="reader-title">
              <strong>Prévia da leitura</strong>
              <small>Capítulo de exemplo</small>
            </div>
            <button onClick={() => dialog.current.close()}>
              Fechar prévia
            </button>
          </header>
          <div
            ref={scroll}
            className={paged ? 'reader-scroll paged' : 'reader-scroll'}
          >
            {opened && (
              <ReaderText
                settings={settings}
                html={sample.repeat(3)}
                paged={paged}
              />
            )}
          </div>
          {paged && (
            <footer>
              <button
                onClick={() =>
                  scroll.current.scrollBy({ left: -scroll.current.clientWidth })
                }
              >
                Página anterior
              </button>
              <button
                onClick={() =>
                  scroll.current.scrollBy({ left: scroll.current.clientWidth })
                }
              >
                Próxima página
              </button>
            </footer>
          )}
        </div>
      </dialog>
    </div>
  );
}
