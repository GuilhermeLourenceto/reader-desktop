# Preparação do LNReader Desktop para Linux

## Objetivo desta branch

**Branch de trabalho:** `linux/prepare-packaging-and-tests` (base: `main`).

Preparar uma primeira etapa de compatibilidade Linux **sem alterar a versão
publicada para Windows**. Este trabalho não deve ser considerado uma release
Linux nem mesclado automaticamente à `main`.

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
   executado **somente manualmente** nesta etapa: compila em Ubuntu x64,
   roda lint, testes unitários e smoke tests gráficos via Xvfb, gera os
   dois pacotes e verifica seus arquivos. A checagem inclui o worker de
   backup dentro do ASAR Linux. **Não** publica GitHub Release nem muda tags.
   O fluxo Windows automático só dispara em pushes para a `main`.
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

## Testes manuais ainda necessários antes do merge

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

## Critérios para propor merge à main

Workflow Linux executado manualmente e verde (incluindo inspeção dos pacotes), Windows não regredido,
pelo menos uma validação real de AppImage e DEB e documentação das falhas
restantes. A matriz de fontes externas continua **diagnóstica**: aprovar
a auditoria não prova compatibilidade de todas as fontes.

Quando chegar essa etapa, revisar as diferenças em um PR separado. Não criar
uma release Linux antes de validar as instalações reais.
