# Leitor no desktop

Documentação da implementação em `src/features/reader/`, com regras
compartilhadas em `src/domain/readerPaging.cjs` e
`src/domain/readerChromeDelay.cjs`.

## Barras que somem

Durante a leitura, a barra superior (voltar, título, ajustes, tamanho da fonte) e
a barra inferior (navegação e posição) se escondem sozinhas após um período
configurável de **1 a 10 segundos** sem interação (**2,6 s por padrão**). Elas voltam ao mover o mouse, clicar ou usar o teclado.

- A opção fica em **Mais → Configurações → Leitor → Ocultar barras durante a
  leitura** (`desktopReaderAutoHide`, ligada por padrão).
- **Tempo para ocultar as barras** fica na mesma tela e aceita passos de 0,2 s.
- Enquanto os ajustes de leitura estão abertos, as barras ficam visíveis.
- Com as barras escondidas elas também saem da navegação por teclado (`inert`),
  então Tab não foca botões invisíveis.

## Atalhos

| Tecla | Ação |
| --- | --- |
| ↓, →, Page Down, espaço | Avança uma página |
| ↑, ←, Page Up, Shift+espaço | Volta uma página |
| Home / End | Início / fim do capítulo |
| Esc | Fecha os ajustes de leitura |

As teclas e os botões de página ficam dentro do capítulo atual, inclusive quando
se chega ao início ou ao fim. Os botões **Anterior/Próximo** trocam de capítulo.
No modo horizontal, a roda do mouse também vira uma página por vez.

### Amplitude

Em **Modo de leitura → Rolagem contínua**, a opção **Avanço por página** define
quanto do visível é percorrido a cada tecla (**10% a 100%, padrão 50%**). Em
**Páginas horizontais** cada passo vira uma página inteira.

## Modos de leitura

- **Rolagem contínua** (padrão): o capítulo rola na vertical, como antes.
- **Páginas horizontais**: o texto é dividido em colunas da largura escolhida em
  **Largura do texto**; a leitura avança para o lado, uma página por vez, com o
  indicador `Página X de Y` na barra inferior e sem barra de rolagem visível.

A posição em ambos os modos usa o mesmo progresso salvo (0–100), então trocar de
modo mantém o ponto de leitura.

## Lista de capítulos

A lista carrega 100 capítulos por vez e **carrega mais sozinha** quando a rolagem
chega ao fim, com a bolinha girando durante a espera. Se a obra tem páginas de
capítulos na fonte (`totalPages > 1`), a próxima página também é buscada
automaticamente. O botão "Mostrar mais capítulos (n restantes)" foi removido.
Uma falha interrompe o carregamento automático e oferece nova tentativa da
mesma página, preservando os capítulos existentes e a posição da lista.

## Paletas

**Mais → Configurações → Aparência → Paleta do aplicativo** oferece as nove
paletas Material 3 do aplicativo Android (Padrão, Crepúsculo, Turquesa, Yotsuba,
Lavanda, Morango, Tako, Catppuccin, Yin Yang). A paleta vale para o app inteiro e
o tema **Seguir aplicativo** do leitor usa o fundo e o texto dela.

As cinco paletas de leitura do Android continuam em **Fundo da leitura**.

## Carregamento

A bolinha de carregamento tem animação circular em toda a interface: abertura do
app, avisos de processamento, carregamento de capítulo, lista de capítulos e
paginação das fontes. Com "reduzir movimento" ativo no Windows ela continua
girando, só que mais devagar — antes ela ficava estática.
