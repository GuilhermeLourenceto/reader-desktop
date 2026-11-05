# LNReader Desktop

Adaptação independente e experimental do LNReader para **Windows e Linux**.
Utiliza extensões e backups no formato do LNReader Android, com código
específico para computador.

![Tela de detalhes](./desktop/docs/screenshots/desktop-novel.png)

![Biblioteca](./desktop/docs/screenshots/desktop-library.png)

## Recursos

Biblioteca, busca global de obras, filtro de fontes por idioma, tela cheia, restauração das configurações padrão, rolagem das listas mesmo com o mouse nas laterais, progresso de leitura, capítulos offline,
downloads, temas, histórico, marcadores e exportação/restauração de backups.
A interface está disponível em português, inglês, espanhol, francês, alemão, italiano, russo, japonês, coreano e chinês simplificado. Escolha em **Mais → Configurações → Geral → Idioma da interface**. O filtro de idioma das fontes também funciona na busca global; o conteúdo das obras permanece no idioma original.

O suporte a fontes pode variar conforme autenticação e bloqueios dos sites.

![Leitura Desktop](./desktop/docs/screenshots/desktop-reader.png)

## Estado do projeto

**Última versão publicada: 0.4.5 Beta** — [Baixar instaladores para Windows e Linux](https://github.com/GuilhermeLourenceto/lnreader-desktop/releases/tag/v0.4.5) · [Novidades](desktop/docs/RELEASE_NOTES_0.4.5.md).
A `main` inclui alterações posteriores à versão publicada; para obter essas melhorias, compile o código mais recente.
O projeto ainda é experimental; algumas extensões podem exigir login, apresentar bloqueios ou falhar.
A compilação do Desktop, seus testes e as jornadas automatizadas são verificados
pelo [GitHub Actions](https://github.com/GuilhermeLourenceto/lnreader-desktop/actions/workflows/desktop.yml).
O funcionamento de fontes externas e do Linux ainda depende de validação.

## Compilar

### Windows — clonar e gerar o instalador de uma vez (PowerShell)

Pré-requisitos: **Git** e **Node.js 24** com npm instalados. Abra o **PowerShell**
na pasta em que deseja baixar o projeto e cole o bloco inteiro abaixo.
Funciona também no Windows PowerShell 5.1 (não depende de `&&`).

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

O instalador **.exe** será criado em
`lnreader-desktop/desktop/release/` (a pasta `release` fica **dentro** de
`desktop/`). `dist/` contém os arquivos intermediários de compilação; não
é o instalador. A execução não apaga outras pastas, porém o `git clone`
falhará caso já exista uma pasta `lnreader-desktop` no local.

Para **recompilar depois**, sem clonar novamente, entre em
`lnreader-desktop/desktop` e execute:

```powershell
npm.cmd ci
npm.cmd run setup
npm.cmd run dist:win
```

### Executar o código sem criar instalador

Requer Node.js 24 e npm. **Todo o projeto está em `desktop/`**:

```sh
cd desktop
npm ci
npm run setup
npm start
```

Para baixar a versão de teste, consulte as [Releases](https://github.com/GuilhermeLourenceto/lnreader-desktop/releases).
Para gerar instalador Windows, use `npm run dist:win`.
O Linux permanece experimental (`npm run dist:linux` no Linux).

Consulte [a documentação do Desktop](desktop/README.md),
[a compatibilidade e segurança](desktop/docs/COMPATIBILIDADE-SEGURANCA.md)
e [as orientações de GitHub](desktop/docs/GITHUB.md).

## Origem e licença

O SDK de plugins, formatos de backup, temas e fontes originais está
copiado com sua procedência em [`desktop/vendor/lnreader/`](desktop/vendor/lnreader/).
A [licença MIT](LICENSE) foi preservada. Este port não é oficial do
LNReader Android; o código Android anterior permanece acessível no
[histórico Git](https://github.com/GuilhermeLourenceto/lnreader-desktop/tree/418dc37be052eb941b3f6ee73042cefb8d207bc8),
mas não faz parte da árvore atual da `main`.

## Contribuir e comunicar problemas

- [Guia para contribuir](CONTRIBUTING.md)
- [Arquitetura do Desktop](desktop/docs/ARCHITECTURE.md)
- [Política de segurança](SECURITY.md)
- [Histórico de versões](desktop/CHANGELOG.md)

Para bugs, use os formulários de issues e inclua passos para reproduzir o
problema, retirando cookies, credenciais e dados pessoais dos logs.
