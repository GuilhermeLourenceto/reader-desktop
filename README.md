<p align="center">
  <img src="./desktop/build/icon-256.png" width="112" alt="Ícone do Reader Desktop: um livro aberto" />
</p>

<h1 align="center">Reader Desktop</h1>

<p align="center">
  <strong>Suas light novels e web novels em uma experiência feita para o computador.</strong>
</p>

<p align="center">
  Leitor de novels para <strong>Windows e Linux</strong>, construído com Electron e React,
  fortemente baseado no <strong>LNReader para Android</strong>.
</p>

<p align="center">
  <a href="https://github.com/GuilhermeLourenceto/lnreader-desktop/releases"><img src="https://img.shields.io/badge/Release-0.4.5%20Beta-6479be?style=flat-square" alt="Última release publicada: 0.4.5 Beta" /></a>
  <a href="https://github.com/GuilhermeLourenceto/lnreader-desktop/actions/workflows/desktop.yml"><img src="https://github.com/GuilhermeLourenceto/lnreader-desktop/actions/workflows/desktop.yml/badge.svg" alt="Status de compilação e testes" /></a>
  <img src="https://img.shields.io/badge/Windows%20%7C%20Linux-Desktop-2b3448?style=flat-square" alt="Windows e Linux" />
</p>

<p align="center">
  <a href="#o-projeto">O projeto</a> ·
  <a href="#funcionalidades">Funcionalidades</a> ·
  <a href="#compatibilidade-com-o-lnreader">Backups e LNReader</a> ·
  <a href="#organização-do-repositório">Estrutura</a> ·
  <a href="#compilar-no-windows">Compilar</a>
</p>

---

## O projeto

O **Reader Desktop** é um leitor de **light novels, web novels e outras histórias publicadas em capítulos**, desenvolvido para quem prefere ler e organizar suas obras no PC.

O projeto aproveita grande parte da base do [LNReader](https://github.com/LNReader/lnreader), especialmente seu **motor de extensões**, contratos de dados, formato de backups e recursos de leitura. Ao mesmo tempo, oferece uma aplicação desktop própria, adaptada ao **mouse, teclado, janelas redimensionáveis e arquivos locais**, em vez de simplesmente reproduzir uma tela de celular.

A ideia é manter uma experiência familiar para quem já usa o LNReader no Android, sem abrir mão das necessidades do Windows e do Linux: biblioteca navegável, capítulos offline, histórico, temas, atalhos e uma estrutura de código independente do ambiente Android.

> **Projeto independente e não oficial.** Reader Desktop não é uma versão oficial do LNReader nem é afiliado à sua equipe. O nome e a identidade visual do aplicativo desktop são próprios; as tecnologias e partes herdadas do LNReader são reconhecidas abaixo.

## Interface do Reader Desktop

| Biblioteca | Detalhes da obra |
| :---: | :---: |
| ![Biblioteca do Reader Desktop](./desktop/docs/screenshots/desktop-library.png) | ![Detalhes e capítulos de uma novel](./desktop/docs/screenshots/desktop-novel.png) |

<p align="center">
  <img src="./desktop/docs/screenshots/desktop-reader.png" alt="Leitor de capítulos do Reader Desktop" width="790" />
</p>

*Capturas do aplicativo desktop; pequenos detalhes podem diferir das alterações mais recentes da branch `main`.*

## Funcionalidades

- **Biblioteca e organização:** obras salvas, categorias importadas, filtros, ordenação, pesquisa, seleção de múltiplas obras e histórico de leitura.
- **Leitura confortável:** rolagem contínua ou páginas horizontais, configurações de tipografia, alinhamento, espaçamento, largura e progresso por capítulo.
- **Capítulos offline:** download e leitura de conteúdos já armazenados, com marcadores e acompanhamento de capítulos lidos.
- **Extensões de fontes:** suporte ao motor de plugins herdado do LNReader, gerenciamento de repositórios e busca por obras em diferentes fontes e idiomas.
- **Personalização:** nove paletas do aplicativo, modos claro, escuro, sistema e preto OLED, além de temas próprios do leitor.
- **Idiomas da interface:** português, inglês, espanhol, francês, alemão, italiano, russo, japonês, coreano e chinês simplificado. O idioma das obras depende de cada fonte.
- **Primeiro acesso guiado:** três etapas para idioma, aparência e backups. Uma instalação nova começa em inglês e muda o idioma das etapas assim que o usuário o escolhe.
- **Backups locais:** exportação, restauração e cópias automáticas enquanto o aplicativo estiver aberto.

Como o conteúdo depende de sites externos, algumas fontes podem exigir login, apresentar bloqueios (por exemplo, Cloudflare) ou deixar de funcionar após alterações nesses sites.

## Compatibilidade com o LNReader

Uma das prioridades é permitir que alguém saia do **LNReader Android** e continue usando sua biblioteca no **Reader Desktop**, sem precisar cadastrar tudo do zero.

| Recurso | Como funciona |
| --- | --- |
| **Importar backup do LNReader** | Lê o formato ZIP de backup do LNReader, incluindo variantes antigas suportadas pelo importador. |
| **Exportar backup compatível** | Mantém a estrutura de backup baseada no LNReader (ZIP v2), com obras, capítulos, categorias, configurações e arquivos presentes na exportação. |
| **Preservar progresso** | A importação mantém os identificadores e o progresso registrados no arquivo, respeitando as seções disponíveis. |
| **Extensões** | Reaproveita o motor de fontes; nem toda extensão Android funciona integralmente no desktop, especialmente as que dependem de WebView, login ou recursos específicos do Android. |

A importação e a exportação usam formatos compartilhados com o LNReader, **mas a compatibilidade não deve ser interpretada como garantia para todos os backups, versões ou extensões**. Na primeira migração, guarde o ZIP original e trabalhe com uma cópia.

### Backups manuais e automáticos

- **Manuais:** criados por comando do usuário; **não são excluídos pela limpeza automática**.
- **Automáticos:** podem ser desativados ou configurados para cada abertura, 6h, 12h, 24h, 48h ou semanalmente. Só são criados com pasta configurada, alterações nos dados e o aplicativo aberto.
- **Retenção:** o sistema gerencia **até cinco backups automáticos reconhecidos**. Quando um sexto é criado com sucesso, remove o mais antigo elegível; arquivos manuais ficam fora da rotação.
- **Segurança:** arquivos de propriedade incerta não são apagados automaticamente. A exportação usa o processo de backup já existente no aplicativo.

Para a estrutura do ZIP, restauração e limitações, consulte [a documentação do Desktop](desktop/README.md) e [a compatibilidade com a implementação original](desktop/docs/COMPATIBILIDADE-ORIGINAL.md).

## Baixar e instalar

**Última versão publicada:** [**v0.4.5 Beta — instaladores Windows e Linux**](https://github.com/GuilhermeLourenceto/lnreader-desktop/releases/tag/v0.4.5).

A branch `main` contém melhorias feitas depois da última release. Para testar exatamente o código mais recente, use a compilação abaixo. Os pacotes são experimentais e não possuem assinatura digital de distribuição.

## Compilar no Windows

**Pré-requisitos:** [Git](https://git-scm.com/downloads/win), [Node.js 24](https://nodejs.org/) e npm. Abra o **PowerShell** na pasta em que deseja guardar o projeto e execute o bloco completo (compatível com Windows PowerShell 5.1):

```powershell
& {
    git clone https://github.com/GuilhermeLourenceto/lnreader-desktop.git
    if ($LASTEXITCODE -ne 0) { throw "Falha ao clonar. Verifique o Git, a conexão ou se a pasta lnreader-desktop já existe." }

    Push-Location .\lnreader-desktop\desktop
    try {
        npm.cmd ci
        if ($LASTEXITCODE -ne 0) { throw "Falha ao instalar dependências (npm ci)." }

        npm.cmd run setup
        if ($LASTEXITCODE -ne 0) { throw "Falha ao preparar o Electron." }

        npm.cmd run dist:win
        if ($LASTEXITCODE -ne 0) { throw "Falha ao gerar o instalador." }

        Write-Host "Compilação concluída! Arquivos em: $((Resolve-Path .\release).Path)"
    }
    finally { Pop-Location }
}
```

O instalador **`.exe`** fica em:

```text
lnreader-desktop/
└── desktop/
    ├── dist/       # arquivos intermediários
    └── release/    # instalador Windows gerado
```

O comando clona em uma nova pasta `lnreader-desktop`; se ela já existir nesse local, o Git interromperá a clonagem, evitando sobrescrever seu código. Para **recompilar sem clonar novamente**, abra o PowerShell em `lnreader-desktop/desktop` e use:

```powershell
npm.cmd ci
npm.cmd run setup
npm.cmd run dist:win
```

### Executar sem gerar instalador

Na pasta `desktop/`:

```powershell
npm.cmd ci
npm.cmd run setup
npm.cmd start
```

### Linux

Com Git, Node.js 24, npm e as dependências do Electron disponíveis, execute no terminal:

```bash
git clone https://github.com/GuilhermeLourenceto/lnreader-desktop.git
cd lnreader-desktop/desktop
npm ci
npm run setup
npm run dist:linux
```

Os pacotes **`.AppImage` e `.deb`** são gerados em `desktop/release/`. Compile cada instalador no respectivo sistema operacional.

## Organização do repositório

A aplicação para computador vive dentro de **`desktop/`**. O código necessário do LNReader é mantido em um snapshot local em `vendor/lnreader/`: **não é preciso baixar o projeto Android nem instalar Android SDK ou React Native** para compilar o Reader Desktop.

```text
lnreader-desktop/
├── README.md                     # apresentação do projeto
├── .github/workflows/           # integração contínua
├── LICENSE
└── desktop/
    ├── src/
    │   ├── main.cjs             # processo principal Electron e IPC
    │   ├── preload.cjs          # ponte controlada para a interface
    │   ├── renderer.jsx         # coordenação da aplicação React
    │   ├── Library.jsx          # biblioteca, buscas e filtros
    │   ├── NovelDetails.jsx     # obras e capítulos
    │   ├── ReaderText.jsx       # renderização da leitura
    │   ├── Settings.jsx         # configurações
    │   ├── Onboarding.jsx       # primeiro acesso
    │   ├── pages/               # telas extraídas, como SourceViews
    │   ├── settings/            # controles reutilizáveis
    │   ├── onboarding/          # textos do primeiro acesso
    │   ├── i18n/ e locale-*     # traduções e idiomas
    │   ├── styles/              # CSS separado por áreas
    │   ├── services/            # integrações de interface
    │   ├── sourceClient.js      # comunicação com fontes
    │   ├── plugin-worker.js     # execução isolada de plugins
    │   ├── storage.cjs          # armazenamento local
    │   ├── backup.cjs           # formato e leitura dos backups ZIP
    │   ├── backup-worker.cjs    # importação/exportação em Worker
    │   └── autoBackup.cjs       # agendamento e retenção automática
    ├── vendor/lnreader/         # SDK, temas, fontes e licença originais
    ├── test/                    # testes de lógica, Electron e cenários extremos
    ├── docs/                    # arquitetura, compatibilidade e capturas
    ├── scripts/                 # ferramentas de manutenção e verificações
    ├── build/                   # geração de ícones e configuração do instalador
    ├── build.mjs                # compilação com esbuild
    ├── package.json
    ├── dist/                    # saída intermediária (gerada)
    └── release/                 # instaladores (gerada)
```

**Como essas partes se conectam:** o React cuida das telas; `preload.cjs` expõe as operações permitidas; `main.cjs` conversa com o sistema de arquivos e com o Electron. Extensões e operações pesadas de backup usam Workers para reduzir o impacto na interface. O resultado é uma aplicação desktop própria, mas com contratos de dados e componentes herdados do LNReader preservados onde necessário.

Veja os detalhes em [Arquitetura](desktop/docs/ARCHITECTURE.md), [Isolamento das fontes](desktop/docs/ISOLAMENTO-FONTES.md) e [Compatibilidade e segurança](desktop/docs/COMPATIBILIDADE-SEGURANCA.md).

## Desenvolvimento e testes

Os testes automatizados cobrem lógica, persistência, backups, interface Electron, bibliotecas grandes, idiomas, temas, fontes e jornadas de usuário. A compilação é verificada para Windows e Linux por meio do [GitHub Actions](https://github.com/GuilhermeLourenceto/lnreader-desktop/actions/workflows/desktop.yml).

Dentro de `desktop/`:

```bash
npm run build
npm run check
npm run test:journeys
```

Os testes usam perfis e dados fictícios. Eles não garantem que todos os sites de fontes externas estejam disponíveis ou que todo ambiente de hardware funcione sem problemas. Para acompanhar problemas e releases, consulte as [issues](https://github.com/GuilhermeLourenceto/lnreader-desktop/issues) e o [histórico de versões](desktop/CHANGELOG.md).

## Origem, créditos e licença

O Reader Desktop é **fortemente baseado no LNReader Android**, com reaproveitamento de seu motor de fontes, temas, contratos de backup e outros recursos relevantes. A origem, a licença e os arquivos preservados estão documentados em [`desktop/vendor/lnreader/`](desktop/vendor/lnreader/). A interface e a experiência para desktop, a integração com Electron e os recursos específicos de computador são desenvolvidos neste projeto.

O código anterior do LNReader que existia neste repositório continua acessível pelo [histórico do Git](https://github.com/GuilhermeLourenceto/lnreader-desktop/tree/418dc37be052eb941b3f6ee73042cefb8d207bc8). O endereço do repositório permanece `lnreader-desktop`; **o nome exibido do aplicativo é Reader Desktop**.

A [licença MIT](LICENSE) e os créditos da origem são mantidos. Este projeto é independente; não se apresenta como distribuição oficial do LNReader.

Para colaborar, veja o [guia de contribuição](CONTRIBUTING.md) e a [política de segurança](SECURITY.md). Em relatórios de bugs, evite incluir cookies, senhas ou dados pessoais nos registros.
