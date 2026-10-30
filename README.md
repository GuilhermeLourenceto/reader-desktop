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

## Compilar

Requer Node.js 24 e npm. **Todo o projeto está em `desktop/`**:

```sh
cd desktop
npm ci
npm run setup
npm start
```

Para gerar instalador Windows, use `npm run dist:win`.
O Linux permanece experimental (`npm run dist:linux` no Linux).

Consulte [a documentação do Desktop](desktop/README.md),
[a compatibilidade e segurança](desktop/docs/COMPATIBILIDADE-SEGURANCA.md)
e [as orientações de GitHub](desktop/docs/GITHUB.md).

## Origem e licença

O SDK de plugins, formatos de backup, temas e fontes originais está
copiado com sua procedência em [`desktop/vendor/lnreader/`](desktop/vendor/lnreader/).
A [licença MIT](LICENSE) foi preservada. Este port não é oficial do
LNReader Android; a versão Android e seu histórico continuam na branch `main`.
