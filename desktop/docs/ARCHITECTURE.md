# Arquitetura do Reader Desktop

Para começar a contribuir, consulte [DEVELOPMENT.md](DEVELOPMENT.md). O aplicativo é independente do código Android externo: a compilação usa os arquivos em `desktop/`, Electron, React e esbuild. O SDK original do LNReader está versionado em `vendor/lnreader/`.

## Organização do código

```text
desktop/
├── src/
│   ├── main.cjs                # Inicialização Electron e IPC
│   ├── preload.cjs             # Ponte de APIs para o renderer
│   ├── renderer.jsx            # Composição, navegação e estado do App
│   ├── plugin-worker.js        # Entrada do Worker de extensões
│   ├── components/             # Icon, Spinner, DesktopErrorBoundary
│   ├── features/
│   │   ├── library/            # Biblioteca, detalhes e grid virtualizado
│   │   ├── reader/             # Leitura, temas, controles e carregamento
│   │   ├── downloads/          # Fila, cancelamento e arquivos offline
│   │   ├── sources/            # Pesquisa, filtros e paginação de fontes
│   │   ├── updates/            # Atualizações e verificação de capítulos
│   │   ├── history/            # Histórico de leitura
│   │   ├── settings/           # Configurações e diagnósticos
│   │   └── onboarding/         # Primeiro acesso e traduções do assistente
│   ├── domain/                 # Regras puras de biblioteca, leitura e fontes
│   ├── state/                  # Hidratação e snapshot da biblioteca
│   ├── infrastructure/         # Política de rede e diagnósticos
│   ├── services/               # Adaptações de APIs do navegador
│   ├── i18n/                   # Catálogo original e tabelas de tradução
│   │   └── catalogs/          # Traduções adicionais por área
│   ├── styles/                 # Estilos agrupados por tela
│   └── ...                     # Entrypoints, persistência e backups
├── vendor/lnreader/            # Snapshot original e licença
├── test/                       # Testes Node e jornadas Electron
├── scripts/                    # Verificações e manutenção
└── build.mjs
```

Os arquivos de entrada `main.cjs`, `preload.cjs`, `renderer.jsx` e `plugin-worker.js` permanecem em seus caminhos originais para preservar o empacotamento. As regras compartilhadas ficam em `domain/`, a serialização da interface em `state/` e a política de rede/diagnósticos em `infrastructure/`. Os serviços centrais de backup e armazenamento em disco permanecem na raiz para preservar os contratos já exercitados pelos testes e pelo build.

## Limites e fluxo

1. A interface React chama os métodos expostos pelo `preload.cjs`; não acessa diretamente os módulos Node.
2. `main.cjs` valida as chamadas IPC e controla janelas, rede e disco.
3. As extensões executam em Web Workers; `sourceClient.js` aplica limites e encaminha operações permitidas.
4. `storage.cjs` mantém metadados em JSON e conteúdo imutável em arquivos SHA-256.
5. A importação e exportação ZIP são processadas por workers, com streaming e verificações de integridade.
6. `renderer.jsx` coordena as telas, mas delega operações complexas às funcionalidades:
   - `features/downloads/downloadActions.js`: downloads, remoção e progresso da fila.
   - `features/library/libraryActions.js`: operações em lote da biblioteca.
   - `features/sources/useSourceBrowse.js`: resultados e paginação de fontes.
   - `features/updates/refreshActions.js`: verificação de obras e atualizações.
   - `features/reader/chapterActions.js`: busca, cache e preparação de capítulos.
   - `features/reader/novelPagingActions.js`: paginação e navegação entre capítulos.

## Regras de manutenção

- Componentes visuais novos entram na funcionalidade correspondente; componentes genéricos vão em `components/`.
- Não acrescentar regras extensas ao `renderer.jsx`; preferir controladores com dependências explícitas.
- Não modificar o SDK em `vendor/` para adaptar a interface Desktop.
- Para verificar imports relativos, rodar `npm test` (o teste `source-module-imports.test.cjs` verifica os caminhos locais).
- Antes de distribuir, rodar `npm run build`, `npm run check`, testes Electron e empacotamento Windows/Linux.
- A refatoração é estrutural: alterações de protocolo IPC, dados, formato de backup ou execução de extensões exigem testes específicos.

## Limitações conhecidas

O estado React ainda mantém metadados da biblioteca em memória; `renderer.jsx` continua responsável por parte dos efeitos e pela composição do leitor. A modularização pode prosseguir em etapas pequenas, sem reescrita geral. Web Workers isolam a execução das extensões do renderer, mas não equivalem a processos com memória independente.

## Branch

A `main` é a branch de desenvolvimento e distribuição do Reader Desktop. O histórico preserva as versões anteriores e o código Android antigo.
