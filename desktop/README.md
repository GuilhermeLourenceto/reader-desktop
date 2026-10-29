# LNReader Desktop — versão experimental

Port para Windows 10/11 e Linux usando Electron. A interface desktop é nova,
adaptada para mouse, teclado e telas maiores. Em janelas largas, os detalhes da
obra ficam à esquerda e a lista de capítulos à direita; em telas menores, as
seções ficam empilhadas. Em telas largas, a lista de capítulos permanece fixa
à direita e rola independentemente. A lista mantém a ordem da fonte por padrão;
o painel de filtros oferece ordem inversa e ordenação por nome/número.
As opções para definir a direção
da fonte e ler desde o início também ficam nesse painel. O app Android continua
separado.

Versão atual: **0.1.0**.

A interface usa diretamente a paleta escura original de
`src/theme/md3/defaultTheme.ts` e as fontes Noto Sans, PT Sans e PT Serif
incluídas no projeto. A navegação inferior, abas de categorias, contadores nas
capas, ícones das fontes e leitor em tela inteira seguem o visual do Android.
Os backups ficam em **Mais → Backups e ajustes**.
A revisão das regras de funcionamento do Android está em
[`docs/COMPATIBILIDADE-ORIGINAL.md`](./docs/COMPATIBILIDADE-ORIGINAL.md), com os
arquivos originais consultados, adaptações, testes e diferenças ainda pendentes.
Abrir detalhes não adiciona mais uma obra automaticamente à biblioteca.
O progresso usa a escala nativa 0–100 e capítulos são marcados como lidos a
partir de 97%, com histórico registrado separadamente.
Na busca e na lista de novels de uma fonte, a próxima página é carregada
automaticamente ao rolar perto do fim. Um indicador giratório aparece durante
o carregamento; erros mantêm a lista e oferecem nova tentativa. Novas buscas
reiniciam a lista e descartam respostas atrasadas da pesquisa anterior.

Em **Fontes → Buscar obras em todas as fontes**, a pesquisa consulta as fontes
instaladas, com resultados agrupados, paginação e nova tentativa por fonte.
O filtro por nome ou idioma em **Gerenciar fontes** é independente dessa busca.
Na biblioteca, use o botão direito em uma capa ou as caixas de seleção para
remover obras, resetar a leitura ou baixar capítulos pendentes em lote.
Resetar a leitura limpa progresso e histórico, preservando downloads e favoritos
dos capítulos. Remover da biblioteca também preserva os arquivos baixados.
O histórico mostra as capas, e as configurações do leitor oferecem uma prévia
ao vivo e em tamanho real, renderizada pelo mesmo componente da leitura.
As cinco paletas originais do leitor também estão disponíveis nas configurações
e nos controles durante a leitura, com amostras de cores. A lista e o leitor
mostram a posição local do capítulo (1 de N), independente do número no título.
Os números seguem a sequência de leitura: em fontes decrescentes, a lista
continua na ordem da fonte e a contagem vai de N até 1. A direção é identificada
pelos títulos, números ou datas da fonte; quando não há informação suficiente,
a interface pede confirmação. A opção de início/final da lista é salva por obra.
"Ler desde o início" carrega as páginas pendentes antes de abrir o primeiro
capítulo. Próximo/anterior seguem a direção da leitura, e continuar sem histórico
começa pelo capítulo mais antigo. Filtros e ordenação não alteram a numeração.
O total acompanha os capítulos
carregados da fonte. A data de lançamento aparece quando fornecida pelo plugin;
uma atualização sem data mantém a informação já salva.

## Executar a partir do código

Requer Node.js 24 e npm. Na pasta `desktop`:

```sh
npm ci
npm run setup
npm start
```

Não é necessário instalar o Android SDK ou as dependências React Native da raiz.
`setup` baixa o runtime do Electron, inclusive nas versões do npm que não
executam automaticamente scripts de instalação de dependências.

## Gerar instaladores

No Windows:

```sh
npm run dist:win
```

No Linux:

```sh
npm run dist:linux
```

Saída: `desktop/release/`. O Windows produz instalador NSIS `.exe`; Linux
produz `.AppImage` e `.deb`. Gere cada instalador no respectivo sistema.
Para executar um AppImage, habilite a permissão de execução; algumas
distribuições precisam do pacote de compatibilidade do FUSE.

A automação `.github/workflows/desktop.yml` compila e testa Windows por padrão.
Linux é opcional, habilitado por `include_linux` na execução manual, para
continuação futura do port. Os instaladores são disponibilizados como artefatos
do GitHub Actions. A execução local no Windows não valida o funcionamento em
Linux. Os binários locais não possuem assinatura digital de distribuição.

## Código original reaproveitado

O build importa **diretamente**, sem copiar ou modificar:

- `src/plugins/pluginManager.ts`: descoberta, instalação, atualização,
  carregamento e execução das mesmas extensões JavaScript do Android;
- `src/plugins/helpers/fetch.ts`: fetch de texto, API e protobuf;
- `src/plugins/helpers/storage.ts`: armazenamento e expiração das extensões;
- tipos de filtros, status de novels, constantes e auxiliares das fontes;
- comparação de versões de `src/utils/compareVersion.ts`;
- nomes de entradas ZIP e opções de `src/services/backup`.

`src/adapters.js` substitui os módulos nativos exigidos por esse código:
MMKV por armazenamento do Chromium e arquivos por uma ponte limitada com o
processo principal. HTTP passa pela sessão do Electron para suportar cookies
e pedidos das fontes fora das restrições de CORS do navegador.

A interface React Native, as consultas Drizzle/SQLite e os serviços Android
não foram portados nesta etapa. O desktop persiste os metadados em
um arquivo JSON com substituição por arquivo temporário e cópia de recuperação.
Os arquivos baixados ficam separados em `content/`, referenciados por hash;
bibliotecas anteriores são migradas automaticamente. As capas são carregadas
sob demanda e os backups ZIP continuam incluindo o conteúdo real dos arquivos.
Não é uma versão
completa com todos os recursos do Android.

## Fontes

Em **Fontes**, adicione a mesma URL do índice JSON usada no Android, clique
em **Carregar repositórios**, instale uma fonte e escolha **Abrir**. O índice
usa os mesmos campos `id`, `name`, `lang`, `version`, `url`, `site` etc.
Nenhuma fonte ou URL de repositório de terceiros é incluída por padrão.

São aceitos os bundles CommonJS JavaScript do LNReader. Fontes que exigem
Cloudflare, login interativo, sincronização de WebStorage ou execução de
`custom.js`/`custom.css` em WebView ainda podem falhar. Os arquivos de scripts
e estilos personalizados são preservados nos backups, mas não são executados
no leitor desktop. Instale fontes apenas de repositórios confiáveis.

## Biblioteca, leitura e backups

- Biblioteca, filtros por categoria importada, busca nas fontes, capítulos
  paginados quando a fonte oferece `parsePage`, atualização de capítulos,
  progresso e tamanho de fonte.
- Capítulos abertos são armazenados como `Novels/<fonte>/<obra>/<capítulo>/index.html`,
  com os mesmos IDs e caminhos do Android. Texto fica disponível offline.
- ZIP v2 mantém `Version.json`, `Category.json`, `Setting.json`, `Plugins.json`,
  `NovelAndChapters/`, `Covers/`, `plugins.zip` e `novel-files.zip`.
- Importação do formato antigo com `download.zip` contendo `Plugins/` e `Novels/`.
- Importação de backups Android organizados em uma pasta externa com
  `data.zip`, `plugins.zip` e `novel-files.zip`.
- As seções presentes no backup **substituem** suas equivalentes locais;
  a restauração não mescla bibliotecas. IDs são preservados para manter arquivos,
  capítulos e categorias associados. Confirmação ocorre depois da leitura e
  validação do arquivo. A cópia `before-restore.json` permite recuperação manual.
- Configurações Android sem equivalente desktop são preservadas na exportação;
  somente o tamanho de fonte desktop é aplicado pela interface nesta etapa.
- Imagens já contidas em backups Android são preservadas e podem ser exibidas
  offline. As ações de download também armazenam imagens quando a fonte permite.
  Há download individual, dos próximos 10 e dos capítulos selecionados, com
  interrupção após o capítulo atual. A fila exige que o aplicativo permaneça aberto.

Use uma cópia de seu backup na primeira migração. A compatibilidade foi
verificada com arquivos de teste seguindo a estrutura do código original;
ainda falta validação com backups reais do usuário e fontes reais variadas.
Em 28/10/2026, o índice oficial `plugins/v3.0.0/.dist/plugins.min.json`
foi testado pelo desktop: 327 fontes listadas e instalação/inicialização da
fonte real Better Novels concluída. A leitura do site dessa fonte não foi
testada. Repita essa conferência opcional de rede com
`npx electron test/repository-smoke.cjs` após compilar.
Também foi validada a Central Novel com
`npx electron test/repository-smoke.cjs --source=centralnovel --browse --read`:
50 obras listadas, detalhes de uma obra com 121 capítulos e leitura de um
capítulo concluída. A chamada de `popularNovels` agora envia as opções de
filtros esperadas pelo Android, e a ponte HTTP preserva a URL final, inclusive
em redirecionamentos. O teste local cobre esse contrato, redirecionamento e
envio de corpo POST em UTF-8.
Backups importados têm limite de 512 MB compactados e 512 MB descompactados
no total, além de 100 mil entradas. O processamento acontece em segundo plano.
O resultado da revisão de persistência, memória, rede e fontes está em
[`docs/REVISAO-ESTABILIDADE.md`](./docs/REVISAO-ESTABILIDADE.md), incluindo testes e limitações.

## Leitura

Detalhes em [`docs/LEITOR.md`](./docs/LEITOR.md).

- As barras superior e inferior somem sozinhas durante a leitura e voltam ao
  aproximar o mouse do topo/rodapé, clicar na página ou navegar com Tab (configurável em
  **Configurações → Leitor**).
- Atalhos: setas, Page Up/Page Down e espaço avançam uma página **dentro do
  capítulo**; Home/End vão ao início e ao fim. As teclas permanecem no capítulo
  atual; Anterior/Próximo trocam de capítulo.
- **Modo de leitura** escolhe entre rolagem contínua (padrão) e páginas
  horizontais; a amplitude do avanço na rolagem vai de 30% a 100%.
- A lista de capítulos carrega mais 100 sozinha ao chegar ao fim, com a bolinha
  girando; páginas de capítulos da fonte também são buscadas automaticamente.
- **Aparência** oferece as nove paletas Material 3 do aplicativo Android
  (incluindo verde, lavanda e roxo), além das cinco paletas de leitura originais.
- A bolinha de carregamento é animada em toda a interface, inclusive com
  "reduzir movimento" ativo no Windows.

## Isolamento das fontes

As fontes executam em Web Workers dedicados, separados da thread da interface.
O carregador e os auxiliares originais continuam sendo usados dentro dos workers.
Cada chamada tem prazo e pode ser interrompida; o pool mantém no máximo seis
workers e libera fontes ociosas quando precisa abrir outra. Arquivos, cache e
HTTP passam por uma ponte limitada. Um loop síncrono em uma fonte pode ser
cancelado sem recarregar o leitor. Detalhes e limites estão em
[`docs/ISOLAMENTO-FONTES.md`](./docs/ISOLAMENTO-FONTES.md).

Dados em `%APPDATA%/lnreader-desktop` no Windows e
`~/.config/lnreader-desktop` no Linux (ou a pasta XDG correspondente).
Feche o app antes de restaurar manualmente `before-restore.json` sobre `library.json`.
Mantenha a pasta `content/` junto desses arquivos; os índices novos dependem dela.

## Validação

```sh
npm run build
npm test
npm run test:smoke
npm run test:pagination
npm run test:reader
```

Os testes verificam ZIP antigo/atual, ida e volta de dados/arquivos/progresso,
backup parcial e entradas inválidas. O teste Electron usa uma fonte de teste
local e uma pasta temporária própria: instala o plugin pelo carregador original,
abre uma obra, lê e salva um capítulo, rejeita scripts no HTML e repete a leitura
offline. A janela de teste fica oculta e fecha ao terminar.

Validação desta entrega em Windows (28/10/2026): build e instalador NSIS da
versão 0.1.0 gerados; **35 testes de dados** passaram. A interface foi validada
no Electron, incluindo barras sem espaço reservado, amplitude das teclas,
páginas horizontais alinhadas, posição ao redimensionar a janela, nove paletas,
carregamento automático e nova tentativa de páginas sem repetir chamadas.
Uma fonte de teste com `while(true)` foi interrompida com a interface respondendo.
A Central Novel passou por instalação, listagem, detalhes e leitura no worker.
Capturas reais ficam em `docs/previews/version01-*.png`.
Lint da raiz passou com avisos existentes e a checagem TypeScript passou após
gerar os metadados com
`node scripts/generate-env-file.cjs --build-type Debug --git-hash source-archive`.
O comando geral `pnpm run check` permanece bloqueado por problemas de
formatação já existentes em 20 arquivos Android. A formatação dos arquivos
desktop foi verificada separadamente e passou. Falta validar backups e fontes
reais e executar em outras versões do Windows e no Linux.

## Estrutura da pasta

```
desktop/
  src/            código da interface, processo principal, backup e leitor
  test/           testes node e testes Electron de interface
  docs/           documentação (compatibilidade, estabilidade, leitor, isolamento)
  docs/previews/  capturas de tela usadas na documentação
  tools/          ui-harness.cjs (renderiza a interface no Chrome) e diagnóstico de fonte
  build/          ícone do instalador
  dist/           saída do build (gerada)
  release/        instaladores e app descompactado (gerada)
```

`dist/` e `release/` são ignorados pelo Git; `npm run build` recria `dist/` e
`npm run dist:win` recria `release/`.

Para conferir telas sem abrir o Electron, `node tools/ui-harness.cjs` gera
páginas em `.tmp/` que carregam o bundle real com uma ponte `desktop` falsa; elas
podem ser abertas no navegador ou capturadas com o Chrome headless.

Ainda não disponíveis: backup em nuvem, rastreadores, TTS, EPUB, sincronização,
gerenciamento de categorias e configurações avançadas de fontes,
atualizações automáticas e tarefas executadas com o aplicativo fechado.

A janela usa isolamento de contexto, sandbox e Node desabilitado. O leitor
sanitiza HTML. `unsafe-eval` permanece necessário para o carregador original
dentro dos workers. Eles não têm acesso ao DOM nem a Node; Web Worker não é
equivalente a um processo do sistema com memória independente.
