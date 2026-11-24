<p align="center">
  <img src="./desktop/build/icon-256.png" width="112" alt="Ícone do Reader Desktop" />
</p>

<h1 align="center">Reader Desktop</h1>

<p align="center">
  <strong>Suas novels, sua biblioteca, seu espaço de leitura.</strong>
</p>

<p align="center">
  Leitor de light novels e web novels para <strong>Windows e Linux</strong>,<br>
  criado para uma experiência confortável no computador.
</p>

<p align="center">
  <a href="https://github.com/GuilhermeLourenceto/reader-desktop/releases"><img src="https://img.shields.io/badge/vers%C3%A3o-0.4.6%20Beta-6479be?style=flat-square" alt="Versão 0.4.6 Beta" /></a>
  <img src="https://img.shields.io/badge/Windows%20%7C%20Linux-x64-2b3448?style=flat-square" alt="Windows e Linux x64" />
  <a href="./LICENSE"><img src="https://img.shields.io/badge/licen%C3%A7a-MIT-367c69?style=flat-square" alt="Licença MIT" /></a>
</p>

<p align="center">
  <a href="#sobre-o-projeto">Sobre</a> ·
  <a href="#funcionalidades">Recursos</a> ·
  <a href="#download">Download</a> ·
  <a href="#cr%C3%A9ditos-e-origem">Créditos</a>
</p>

---

## Sobre o projeto

O **Reader Desktop** é um aplicativo para descobrir, organizar e ler light novels e web novels diretamente no PC.

Inspirado pelo ecossistema do [LNReader](https://github.com/LNReader/lnreader), o projeto foi adaptado para o uso em **janelas redimensionáveis, mouse, teclado e telas maiores**, com uma interface própria para Windows e Linux. A ideia é reunir biblioteca, capítulos, progresso de leitura e personalização em um só lugar.

## Interface

| Biblioteca | Detalhes da obra |
| :---: | :---: |
| ![Biblioteca do Reader Desktop](./desktop/docs/screenshots/desktop-library.png) | ![Detalhes de uma obra](./desktop/docs/screenshots/desktop-novel.png) |

<p align="center">
  <img src="./desktop/docs/screenshots/desktop-reader.png" width="790" alt="Leitor de capítulos do Reader Desktop" />
</p>

## Funcionalidades

- **Biblioteca organizada:** busca por título e autor, categorias, filtros, ordenação e seleção múltipla.
- **Leitura personalizada:** fontes, espaçamento, largura do texto, rolagem contínua, páginas horizontais e tela cheia.
- **Progresso e histórico:** acompanhe capítulos lidos, marcadores e continue sua leitura.
- **Leitura offline:** baixe capítulos para ler sem conexão.
- **Fontes e descoberta:** instale extensões compatíveis e pesquise obras em diferentes catálogos e idiomas.
- **Temas e idiomas:** modo claro, escuro, preto OLED, diferentes paletas e interface em dez idiomas.
- **Backups compatíveis com LNReader:** importe backups do aplicativo Android, exporte no formato baseado no LNReader e programe cópias automáticas.

## Download

A versão declarada no código-fonte (`desktop/package.json`) é **0.4.6 Beta**. Para baixar instaladores, consulte a página de lançamentos **quando houver artefatos publicados**. A versão do código não garante que um instalador correspondente esteja disponível:

<p align="center">
  <a href="https://github.com/GuilhermeLourenceto/reader-desktop/releases"><strong>Ver releases e baixar o Reader Desktop</strong></a>
</p>

| Sistema | Arquivo |
| --- | --- |
| **Windows 10/11 (x64)** | Instalador `.exe` |
| **Linux (x64)** | `.AppImage` ou `.deb` |

> O Reader Desktop ainda está em **beta** e pode apresentar instabilidades.

### Começando a ler

1. Instale e personalize o idioma e o tema.
2. Em **Fontes**, adicione um repositório de extensões e instale as fontes desejadas.
3. Encontre uma novel, adicione à biblioteca e comece a leitura.

## Compatibilidade com o LNReader

O Reader Desktop utiliza um **formato de backup baseado no LNReader** e aceita a **importação de backups ZIP do LNReader Android**. Assim, você pode trazer sua biblioteca, capítulos, categorias e progresso de leitura para o computador, conforme os dados presentes no backup.

Também é possível **exportar backups nesse formato**, facilitando a continuidade entre os dois aplicativos. Recomendamos guardar uma cópia do backup original antes de restaurá-lo. Veja os [detalhes de compatibilidade](desktop/docs/COMPATIBILIDADE-ORIGINAL.md).

## Compilar a partir do código

**Requisitos:** Git, Node.js 24 e npm.

```bash
git clone https://github.com/GuilhermeLourenceto/reader-desktop.git
cd reader-desktop/desktop
npm ci
npm start
```

Para gerar instaladores, execute no sistema correspondente:

```bash
npm run dist:win    # Windows
npm run dist:linux  # Linux
```

Os arquivos gerados ficam em `desktop/release/`. Não é necessário instalar o Android SDK.

**Validação:** confira os [resultados do GitHub Actions](https://github.com/GuilhermeLourenceto/reader-desktop/actions) e execute os testes localmente antes de distribuir uma compilação. A aprovação do código não certifica automaticamente os instaladores.

Para navegar pelos guias, veja o [índice da documentação](desktop/docs/README.md).

Para desenvolvedores: [como começar](desktop/docs/DEVELOPMENT.md) · [arquitetura](desktop/docs/ARCHITECTURE.md) · [histórico de versões](desktop/CHANGELOG.md) · [como contribuir](CONTRIBUTING.md).

## Contribua

Sugestões, traduções, relatórios de problemas e contribuições de código são bem-vindos. Use as [issues](https://github.com/GuilhermeLourenceto/reader-desktop/issues) ou confira o [guia de contribuição](CONTRIBUTING.md).

## Créditos e origem

Um agradecimento especial à **equipe e aos contribuidores do [LNReader](https://github.com/LNReader/lnreader)**, cujo trabalho de código aberto tornou este projeto possível.

O Reader Desktop reutiliza componentes do LNReader, incluindo partes do motor de extensões, formatos de backup, temas e recursos de leitura. Os arquivos de origem e seus créditos são preservados em [`desktop/vendor/lnreader/`](desktop/vendor/lnreader/).

**O Reader Desktop é um projeto independente, não oficial e sem associação direta com a equipe do LNReader.** Seu desenvolvimento e distribuição não representam o projeto original.

Licença: [MIT](LICENSE).

---

<p align="center"><strong>Boas leituras!</strong></p>
