<p align="center">
  <img src="./desktop/build/icon-256.png" width="112" alt="Ícone do Reader Desktop" />
</p>

<h1 align="center">Reader Desktop</h1>

<p align="center">
  <strong>Sua biblioteca de novels, do seu jeito e no seu computador.</strong>
</p>

<p align="center">
  Um leitor de light novels e web novels para <strong>Windows e Linux</strong>,<br>
  com uma experiência pensada para mouse, teclado e telas maiores.
</p>

<p align="center">
  <a href="https://github.com/GuilhermeLourenceto/lnreader-desktop/releases">
    <img src="https://img.shields.io/badge/vers%C3%A3o-0.4.5%20Beta-6479be?style=flat-square" alt="Versão 0.4.5 Beta" />
  </a>
  <img src="https://img.shields.io/badge/Windows%20%7C%20Linux-x64-2b3448?style=flat-square" alt="Windows e Linux x64" />
  <a href="./LICENSE"><img src="https://img.shields.io/badge/licen%C3%A7a-MIT-367c69?style=flat-square" alt="Licença MIT" /></a>
</p>

<p align="center">
  <a href="#conhe%C3%A7a-o-reader-desktop">Conheça</a> ·
  <a href="#o-que-voc%C3%AA-pode-fazer">Recursos</a> ·
  <a href="#baixar-e-instalar">Instalação</a> ·
  <a href="#rela%C3%A7%C3%A3o-com-o-lnreader">Créditos</a>
</p>

---

## Conheça o Reader Desktop

O **Reader Desktop** nasceu da vontade de ler e organizar novels no computador sem depender de uma interface feita para celular.

A proposta é simples: ter sua biblioteca em uma janela de verdade, com espaço para explorar obras, encontrar capítulos, ajustar a leitura e continuar de onde parou. Seja para acompanhar algumas histórias ou manter uma coleção grande, o aplicativo procura fazer o desktop parecer o lugar natural para ler.

O projeto tem raízes no [LNReader para Android](https://github.com/LNReader/lnreader), mas segue um caminho próprio: interface adaptada ao PC, integração com Windows e Linux e funcionalidades específicas para esse ambiente.

> **Projeto independente e não oficial.** O Reader Desktop não é desenvolvido, mantido ou distribuído pela equipe do LNReader e **não possui associação, parceria ou endosso oficial** do projeto original. Reutilizamos partes do código do LNReader, com os devidos créditos e preservação da licença.

## Veja o aplicativo

| Sua biblioteca | Detalhes de uma obra |
| :---: | :---: |
| ![Biblioteca do Reader Desktop](./desktop/docs/screenshots/desktop-library.png) | ![Detalhes da obra e lista de capítulos](./desktop/docs/screenshots/desktop-novel.png) |

<p align="center">
  <img src="./desktop/docs/screenshots/desktop-reader.png" width="790" alt="Tela de leitura de capítulos do Reader Desktop" />
</p>

<p align="center"><sub>Capturas da versão desktop; a interface pode mudar durante o desenvolvimento.</sub></p>

## O que você pode fazer

- **Organizar sua biblioteca:** pesquisar por título ou autor, filtrar por categorias e estado de leitura, ordenar obras e selecionar várias de uma vez. A interface utiliza virtualização para lidar melhor com bibliotecas grandes.
- **Ler com conforto:** ajustar fonte, espaçamento, largura do texto e aparência; alternar entre rolagem contínua e páginas horizontais; usar a leitura em tela cheia.
- **Continuar de onde parou:** acompanhar capítulos lidos, progresso, histórico e marcadores.
- **Ler offline:** baixar capítulos e acessar os conteúdos já armazenados, mesmo sem conexão.
- **Descobrir novas histórias:** instalar fontes compatíveis com o ecossistema LNReader, explorar catálogos e pesquisar em múltiplas fontes, inclusive com filtros por idioma.
- **Personalizar a experiência:** escolher entre temas claros, escuros e preto OLED, nove paletas do aplicativo e interface em dez idiomas.
- **Proteger sua biblioteca:** criar e restaurar backups locais, inclusive backups automáticos com retenção dos cinco mais recentes. Os backups manuais não entram nessa rotação.

As fontes dependem de serviços de terceiros. Algumas podem deixar de funcionar, exigir login ou apresentar bloqueios do próprio site; **nem toda extensão do LNReader Android funciona integralmente no desktop**.

## Baixar e instalar

A versão publicada mais recente é a **[v0.4.5 Beta](https://github.com/GuilhermeLourenceto/lnreader-desktop/releases/tag/v0.4.5)**. Os arquivos estão disponíveis na página de releases:

**[Ver versões e instaladores](https://github.com/GuilhermeLourenceto/lnreader-desktop/releases)**

| Sistema | Formato | Observações |
| --- | --- | --- |
| Windows 10/11 (x64) | Instalador `.exe` | Instalação convencional. |
| Linux (x64) | `.AppImage` | Executável portátil; pode precisar de suporte a FUSE na distribuição. |
| Linux (x64) | `.deb` | Pacote para distribuições compatíveis com Debian/Ubuntu. |

**Importante:** o Reader Desktop ainda está em **beta**. Os pacotes não têm assinatura digital de distribuição, e a versão Linux ainda precisa de validação manual mais ampla em diferentes ambientes gráficos. Faça backup dos seus dados antes de atualizar ou testar uma nova versão. Ainda não há um instalador para macOS.

### Primeiros passos

1. Instale o aplicativo e escolha o idioma, a aparência e a pasta de backups no primeiro acesso.
2. Em **Fontes**, adicione um repositório de extensões confiável e instale as fontes que deseja usar.
3. Procure suas obras, adicione-as à biblioteca e comece a ler.

O Reader Desktop **não hospeda novels nem inclui um catálogo próprio de obras**. O conteúdo é disponibilizado pelos sites acessados por extensões de terceiros. Respeite as regras desses sites e os direitos dos autores.

## Levando sua biblioteca do LNReader

Você já usa o LNReader no Android? O Reader Desktop permite **importar backups ZIP compatíveis**, aproveitando dados como obras, capítulos, categorias e progresso quando essas informações estão presentes no arquivo. Também é possível exportar backups no formato compartilhado com o projeto original.

A compatibilidade é uma prioridade, **não uma garantia de funcionamento com todos os backups ou versões**. A restauração pode substituir as seções correspondentes dos dados locais, em vez de mesclá-las. Por segurança, guarde o ZIP original e teste a migração com uma cópia.

No momento, os backups têm limite de **512 MiB**. Para detalhes técnicos, consulte a [documentação do desktop](desktop/README.md) e as [diferenças em relação ao LNReader Android](desktop/docs/COMPATIBILIDADE-ORIGINAL.md).

## Executar pelo código-fonte

O projeto usa **Electron, React e Node.js**. Para desenvolver ou compilar, você precisa de **Git, Node.js 24 e npm**.

```bash
git clone https://github.com/GuilhermeLourenceto/lnreader-desktop.git
cd lnreader-desktop/desktop
npm ci
npm start
```

Para gerar instaladores no sistema correspondente:

```bash
npm run dist:win    # Windows: instalador .exe
npm run dist:linux  # Linux: .AppImage e .deb
```

Os pacotes gerados ficam em `desktop/release/`. O projeto desktop compila sem Android SDK, Expo ou React Native.

Para executar as verificações automatizadas:

```bash
npm run check
npm run test:journeys
```

Mais informações estão em [Arquitetura](desktop/docs/ARCHITECTURE.md), [Histórico de versões](desktop/CHANGELOG.md) e [Contribuição](CONTRIBUTING.md).

## Contribua com o Reader Desktop

O projeto está em evolução. Relatos de bugs, sugestões de melhorias, traduções e contribuições de código são bem-vindos.

Você pode abrir uma [issue](https://github.com/GuilhermeLourenceto/lnreader-desktop/issues) ou consultar o [guia de contribuição](CONTRIBUTING.md). Ao relatar um problema, informe a versão, o sistema operacional e como reproduzi-lo, sem compartilhar senhas, cookies ou dados pessoais. Questões de segurança devem seguir a [política de segurança](SECURITY.md).

## Relação com o LNReader

Um agradecimento especial aos **desenvolvedores e contribuidores do [LNReader](https://github.com/LNReader/lnreader)**. O trabalho e a decisão de disponibilizar o projeto como código aberto tornaram possível construir esta adaptação para computadores.

O Reader Desktop reutiliza partes importantes da base original, especialmente o **motor de extensões, contratos de dados e backups, temas e recursos de leitura**. Esses componentes são mantidos de forma identificável em [`desktop/vendor/lnreader/`](desktop/vendor/lnreader/), junto da licença e das informações de procedência. Já a interface desktop, sua integração com o sistema operacional e as funcionalidades próprias deste aplicativo são desenvolvidas aqui.

**Reader Desktop é um projeto independente.** Compartilhar tecnologia e compatibilidade com o LNReader não significa fazer parte de sua equipe, nem representar um lançamento oficial dela.

O código é disponibilizado sob a [licença MIT](LICENSE), mantendo os avisos de direitos autorais e os créditos aplicáveis ao código reutilizado.

---

<p align="center"><strong>Feito para que suas próximas páginas também tenham um lugar no desktop.</strong></p>
