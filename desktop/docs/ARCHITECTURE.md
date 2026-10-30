# Arquitetura do LNReader Desktop

## Limites do aplicativo

O projeto fica inteiro em `desktop/`, inclusive o SDK original versionado.
A compilação usa Node.js 24, esbuild e Electron sem React Native/Expo.

| Área | Arquivos principais | Papel |
| --- | --- | --- |
| Processo principal Electron | `src/main.cjs`, `src/preload.cjs` | Janelas, ponte IPC e acesso controlado ao sistema |
| Rede e segurança | `src/request.cjs`, `src/networkPolicy.cjs` | Requisições de fontes e política de destinos |
| Interface React | `src/renderer.jsx`, `src/Library.jsx`, `src/NovelDetails.jsx`, `src/Settings.jsx` | Navegação, biblioteca e leitura |
| Componentes compartilháveis | `src/Icon.jsx`, `src/SourceFilters.jsx`, `src/DesktopErrorBoundary.jsx` | Ícones, filtros e falhas de renderização |
| Estado e busca | `src/libraryState.js`, `src/sourceRuntime.js` | Serialização, identificadores, paginação e busca |
| Fontes e Workers | `src/sourceClient.js`, `src/plugin-worker.js`, `src/sources.js` | Ciclo de vida das extensões |
| Dados e backups | `src/storage.cjs`, `src/backup.cjs`, `src/backup-worker.cjs` | Persistência e formato ZIP compatível |
| Código original | `vendor/lnreader/` | SDK de plugins, contratos de backup, paletas, fontes e licença |
| Testes | `test/` | Unidade, interface Electron, persistência e diagnóstico |

## Dependências e fluxo de dados

1. O React chama APIs limitadas expostas em `preload.cjs`, sem acesso
   direto a Node.js no renderer.
2. O processo principal controla operações de rede, armazenamento e
   acesso a arquivos pelo IPC.
3. Extensões são executadas em Workers separados, com mensagens e
   limites de tempo. Isso reduz travamentos da interface, mas não equivale
   a isolamento de processo por extensão.
4. Os metadados da biblioteca e os conteúdos baixados são persistidos
   localmente; backups ZIP podem ser importados/exportados, preservando
   os identificadores usados pelo formato Android.

## Princípios de manutenção

- Não importar `../src`, `../assets` ou arquivos Android externos:
  `scripts/check-standalone.cjs` protege o isolamento.
- Alterações no snapshot `vendor/` são revisadas separadamente;
  `scripts/sync-original-sdk.cjs` não participa do build.
- Evitar expandir o `renderer.jsx`: extrair módulos com responsabilidades
  claras e manter comportamento comprovado pelos testes.
- Antes de liberar alterações, rodar `npm run check`, os testes Electron
  e verificar os workflows de empacotamento.

## Cobertura conhecida e lacunas

O CI verifica build isolado, testes de leitura, jornadas comuns de usuário
e compilação Windows. A matriz de fontes é **diagnóstica**: concluir o job
não significa que todas as fontes funcionaram. A Central Novel pode receber
desafios Cloudflare em ambientes automatizados. Linux e instalações reais
em máquinas variadas ainda precisam de validação.

## Política de branches

A partir da v0.3.0, a branch `main` concentra o Desktop;
`seguranca-e-estabilidade` continua como referência histórica desta etapa.
O código Android anterior permanece acessível no histórico Git. Git não
admite branches dentro de uma pasta. Uma futura migração para outro repositório
exigiria decisão e trabalho separados.
