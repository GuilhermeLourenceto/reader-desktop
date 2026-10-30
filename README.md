# LNReader Desktop

Adaptação independente e experimental do LNReader para **Windows**
e preparação para **Linux**. Utiliza extensões e backups no formato
do LNReader Android, com código específico para computador.

![Tela de detalhes](./desktop/docs/screenshots/desktop-novel.png)

## Recursos

Biblioteca, pesquisa por fontes, progresso de leitura, capítulos offline,
downloads, temas, histórico, marcadores e exportação/restauração de backups.
O suporte a fontes pode variar conforme autenticação e bloqueios dos sites.

![Leitura Desktop](./desktop/docs/screenshots/desktop-reader.png)

## Estado do projeto

**Versão 0.3.0 Beta** — o Desktop é agora o projeto principal na branch `main`.
A branch [`seguranca-e-estabilidade`](https://github.com/GuilhermeLourenceto/lnreader-desktop/tree/seguranca-e-estabilidade)
continua disponível como referência de desenvolvimento. [Notas da v0.3.0](desktop/docs/RELEASE_NOTES_0.3.0.md).
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
