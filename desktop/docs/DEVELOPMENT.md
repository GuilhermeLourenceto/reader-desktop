# Guia de desenvolvimento do Reader Desktop

Este guia ajuda a localizar o código, reproduzir mudanças e preparar pull requests. O aplicativo é independente do Android SDK e usa **Node.js 24, React 19, Electron e esbuild**.

## Preparar o ambiente

```bash
git clone https://github.com/GuilhermeLourenceto/lnreader-desktop.git
cd lnreader-desktop/desktop
npm ci
npm run setup
npm run build
npm start
```

No Linux, os testes que abrem janelas precisam de um servidor gráfico; em ambientes sem desktop, use um ambiente com Xvfb. O comando `npm start` compila novamente antes de abrir o aplicativo. Instale o runtime Electron apenas pelo fluxo já definido no projeto.

## Onde fazer cada alteração

| Necessidade | Pasta/arquivo principal |
| --- | --- |
| Layout e componentes compartilhados | `src/components/` |
| Biblioteca, capítulos e grade | `src/features/library/` |
| Leitura, navegação e progresso | `src/features/reader/` |
| Downloads offline | `src/features/downloads/` |
| Fontes, filtros e pesquisas | `src/features/sources/` |
| Atualizações e histórico | `src/features/updates/`, `src/features/history/` |
| Configurações e assistente inicial | `src/features/settings/`, `src/features/onboarding/` |
| Regras puras compartilhadas | `src/domain/` |
| Serialização e hidratação da biblioteca | `src/state/libraryState.js` |
| Rede segura e diagnósticos do processo principal | `src/infrastructure/` |
| Adaptadores da interface para APIs do Electron | `src/services/` |
| Inicialização e contratos IPC | `src/main.cjs`, `src/preload.cjs` |
| Backups e persistência de arquivos | `src/storage.cjs`, `src/backup.cjs`, `src/zipStreaming.cjs`, `src/restorePlan.cjs` |
| Traduções | `src/i18n/`, `src/locales.cjs` |
| Testes | `test/` |

## Regras de dependências

- **Features** podem importar componentes, regras de domínio e o estado exposto pelo aplicativo. Prefira funções com dependências explícitas a acrescentar lógica ao `renderer.jsx`.
- **Domain** deve manter cálculos determinísticos sempre que possível; não acessar DOM, React ou IPC. As exceções atuais são `domain/libraryCategoryLabels.cjs` e `domain/novels.cjs`, que consultam `i18n.cjs` para apresentação localizada.
- **State** faz a ponte entre metadados React e `localStorage`, sem definir regras visuais.
- **Infrastructure** e módulos do processo principal validam rede, logs e operações privilegiadas; não importe módulos Node diretamente na interface.
- **Vendor** contém o snapshot do LNReader: nunca reformatar ou modificar junto com mudanças de interface. As alterações de compatibilidade precisam ser revisadas separadamente.
- Os pontos de entrada `renderer.jsx`, `main.cjs`, `preload.cjs` e `plugin-worker.js` têm caminhos estáveis no build.

## Verificação antes de abrir um PR

```bash
cd desktop
npm run lint
npm test
npm run format:check
npm run build
```

`npm run check` reúne lint, formatação parcial e testes Node. `npm test` inclui a verificação de imports relativos e das fronteiras entre domínio, infraestrutura e UI depois de movimentar módulos. Para testar os fluxos no Electron:

```bash
npm run test:smoke
npm run test:pagination
npm run test:reader
npm run test:visual
npm run test:journeys
```

Os testes de interface podem precisar de um display gráfico e de mais tempo. Os testes e o GitHub Actions podem apresentar falhas ambientais; nunca marque uma verificação como aprovada sem ter executado o comando correspondente. Registre o erro e o sistema operacional no PR.

## Checklist por área

- **Leitura:** histórico, marcação de lido, restauração de posição e páginas horizontais.
- **Biblioteca:** filtros, seleção múltipla, categorias e listas grandes.
- **Fontes:** extensão instalada/ausente, cancelamento, filtros, pesquisa e cookies por sessão.
- **Backup:** importação Android, merge de IDs, ZIP grande e falhas intermediárias; **nunca testar com o backup pessoal de outra pessoa**.
- **Rede:** endereços privados, redirecionamentos e requisições autenticadas.
- **UI:** tema claro/escuro/OLED, teclado, janelas pequenas e tradução nos dez idiomas.

## Política de mudanças

Faça commits pequenos, com testes para regras de domínio. Não altere formato de backup, política de rede, assinatura IPC ou estrutura de armazenamento durante uma refatoração puramente organizacional. Se algo não pôde ser testado, documente a limitação no PR. Para entender o fluxo completo, consulte [ARCHITECTURE.md](ARCHITECTURE.md).
