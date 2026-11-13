# Arquitetura do Reader Desktop

O aplicativo é independente do código Android externo: a compilação usa os arquivos em `desktop/`, Electron, React e esbuild. O SDK original do LNReader está versionado em `vendor/lnreader/`.

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
│   ├── services/               # Adaptações de APIs do navegador
│   ├── i18n/                   # Catálogo original de textos
│   ├── styles/                 # Estilos agrupados por tela
│   └── ...                     # Serviços de domínio, dados e segurança
├── vendor/lnreader/            # Snapshot original e licença
├── test/                       # Testes Node e jornadas Electron
├── scripts/                    # Verificações e manutenção
└── build.mjs
```

Os arquivos de entrada `main.cjs`, `preload.cjs`, `renderer.jsx` e `plugin-worker.js` permanecem em seus caminhos originais para preservar o empacotamento. Os serviços centrais de persistência, rede e backup também não foram movidos nesta etapa: os testes existentes e os contratos do Electron dependem deles.

## Limites e fluxo

1. A interface React chama os métodos expostos pelo `preload.cjs`; não acessa diretamente os módulos Node.
2. `main.cjs` valida as chamadas IPC e controla janelas, rede e disco.
3. As extensões executam em Web Workers; `sourceClient.js` aplica limites e encaminha operações permitidas.
4. `storage.cjs` mantém metadados em JSON e conteúdo imutável em arquivos SHA-256.
5. A importação e exportação ZIP são processadas por workers, com streaming e verificações de integridade.
6. `renderer.jsx` coordena as telas, mas delega operações complexas às funcionalidades:
   - `features/downloads/downloadActions.js`: downloads, remoção e progresso da fila.
   - `features/sources/useSourceBrowse.js`: resultados e paginação de fontes.
   - `features/updates/refreshActions.js`: verificação de obras e atualizações.
   - `features/reader/chapterActions.js`: busca, cache e preparação de capítulos.

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
