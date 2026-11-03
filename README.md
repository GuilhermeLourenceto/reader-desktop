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
