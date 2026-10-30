# Preparação do LNReader Desktop para Linux

## Objetivo desta branch

**Branch de trabalho:** `linux/prepare-packaging-and-tests` (base: `main`).

A preparação inicial foi feita antes da publicação v0.4.3. A partir da integração com a `main`, a v0.4.3 é uma release **beta/experimental** para Windows e Linux. Os passos manuais abaixo continuam necessários para confirmar suporte em máquinas reais.

## Auditoria da independência Android na main

Auditoria da `main` (commit `86e1350`):

- `desktop/build.mjs`, `desktop/src` e os scripts normais de `npm run
  build` carregam apenas fontes locais de `desktop/` e
  `desktop/vendor/lnreader/`. O checkout isolado `desktop/` já é testado
  pelo CI.
- Há **uma referência residual fora do Desktop** em
  `desktop/build/make-icon.cjs`, que usava
  `../../assets/android-icons/release/web/ic_launcher-1024.png`.
  **Corrigida nesta branch** para
  `../vendor/lnreader/assets/native/ic_launcher.png`.
- `desktop/scripts/check-standalone.cjs` foi reforçado nesta branch para
  verificar também os scripts de manutenção, o gerador de ícones e o
  importador local do SDK; ele rejeita referências diretas a arquivos
  Android externos. O gerador de ícones é opcional e não roda nos builds
  normais.
- `desktop/scripts/sync-original-sdk.cjs` foi ajustado nesta branch:
  não aceita caminhos externos e só lê um snapshot de origem colocado em
  `desktop/.tmp/lnreader-original/`. Exige arquivos completos, recusa
  links simbólicos e não remove arquivos já presentes em
  `desktop/vendor/lnreader/`. O script é **manual**, nunca executado
  pelo aplicativo ou pelo instalador. Os módulos originais versionados
  permanecem intactos até que o mantenedor solicite explicitamente
  uma atualização.
- Menções ao Android em README, testes de backup e documentação são
  referências de origem/compatibilidade, não importações externas.

A `main` **não foi alterada** por esta auditoria. Quando planejarmos o
merge da branch Linux, a correção do gerador de ícones e a guarda de
independência deverão ser incorporadas. Sem novo build solicitado, as
alterações de hoje ainda precisam passar pelo CI na próxima validação.

## O que já é multiplataforma

- UI React, renderização Electron, carregamento das fontes, leitura e biblioteca.
- Caminhos de arquivos por `node:path` e diretório de dados por
  `app.getPath('userData')`, respeitando XDG no Linux.
- Backups ZIP, downloads de capítulos e arquivos do leitor.
- Build independente em `desktop/`, com o SDK de extensões fixado em
  `desktop/vendor/lnreader/`. **Não** requer a pasta Android nem React Native.
- `F11` usa eventos do Electron em vez de atalhos específicos do Windows.

Essas áreas precisam de testes no Linux; compartilhar código não comprova
que cada funcionalidade funciona em todas as distribuições.

## Primeira etapa preparada aqui

1. Empacotamento `AppImage` e `.deb` usando ícone próprio do LNReader (PNG).
2. Workflow separado em `.github/workflows/linux-preparation.yml`,
   executado **somente sob solicitação explícita** nesta etapa: compila em Ubuntu x64,
   roda lint, testes unitários e smoke tests gráficos via Xvfb, gera os
   dois pacotes e verifica seus arquivos. A checagem inclui o worker de
   backup dentro do ASAR Linux. **Não** publica GitHub Release nem muda tags.
   O fluxo Windows automático só dispara em pushes para a `main`.
   Como o workflow Linux existe apenas nesta branch, para acionar uma nova
   validação sem depender do botão manual do GitHub é necessário alterar
   intencionalmente o arquivo marcador `desktop/.ci/REQUEST_LINUX_VALIDATION`
   num commit separado. **Não criar/alterar esse marcador até solicitarmos
   outro build.** Alterações comuns no código não geram novos instaladores.
3. `desktop/scripts/verify-linux-packages.sh` verifica cabeçalho AppImage,
   versão e arquitetura do DEB, lançador `.desktop`, associação do ícone
   (`StartupWMClass`), arquivos de recursos e `app.asar`, sem instalar
   nada no computador onde o teste é executado.
4. A automação Windows existente e sua release permanecem intactas.

### Executar em Linux (desenvolvimento)

Requisitos: Node.js 24, npm, ambiente gráfico e bibliotecas do Electron.

```bash
cd desktop
npm ci
npm run setup
npm run build
npm test
npm start
```

Testar a interface com a janela aberta. Para CI gráfico sem desktop (somente
em runner isolado, nunca na distribuição final):

```bash
xvfb-run -a npx electron --no-sandbox test/smoke.cjs --visual-preview
xvfb-run -a npx electron --no-sandbox test/pagination-smoke.cjs --visual-preview
xvfb-run -a npx electron --no-sandbox test/reader-rules-smoke.cjs --visual-preview
```

### Gerar os pacotes

```bash
npm run dist:linux
bash scripts/verify-linux-packages.sh
```

Arquivos gerados em `desktop/release/`. `AppImage` é portátil; `.deb`
atende distribuições baseadas em Debian (Ubuntu e Linux Mint, por exemplo).
Para usar AppImage, autorize a execução do arquivo. Dependendo da
distribuição/runtime, pode ser necessária uma biblioteca de compatibilidade
FUSE; isso **não** foi resolvido nem validado em todas as versões do Linux.
Não desabilite permanentemente o sandbox do aplicativo para contornar
erros no computador do usuário.

## Testes manuais ainda necessários para validar o beta Linux

- [ ] Executar AppImage como usuário comum numa sessão X11 real.
- [ ] Executar AppImage numa sessão Wayland e conferir comportamento da janela.
- [ ] Instalar e remover o DEB em ambiente de teste; conferir ícone, menu,
      abertura por atalho, permissões, múltiplas janelas e foco.
- [ ] Confirmar persistência de `library.json` em `~/.config/` ou
      `$XDG_CONFIG_HOME` e ausência de perda de dados após reinstalação.
- [ ] Instalar fonte real, listar obras, pesquisar, abrir detalhes e capítulo.
- [ ] Testar login/cookies das fontes em sessão gráfica real.
- [ ] Exportar e importar um backup real do LNReader Android (v1/v2).
- [ ] Ler capítulos offline, retomar progresso e verificar imagens/capas.
- [ ] Testar download e restauração depois de fechar/reabrir.
- [ ] Verificar consumo, rolagem, F11, temas, fontes, diálogos e clipboard.
- [ ] Testar Linux Mint/Ubuntu em pelo menos uma máquina real.
- [ ] Investigar soluções seguras para o sandbox quando namespaces estiverem
      indisponíveis; não alterar a segurança global só para fazer o CI passar.

## Critérios de estabilização após a release beta

Workflow Linux executado manualmente e verde (incluindo inspeção dos pacotes), Windows não regredido,
pelo menos uma validação real de AppImage e DEB e documentação das falhas
restantes. A matriz de fontes externas continua **diagnóstica**: aprovar
a auditoria não prova compatibilidade de todas as fontes.

A release beta automatizada deve deixar explícitas essas limitações. Não considerar o suporte Linux estável sem instalação real e verificação dos cenários acima.
