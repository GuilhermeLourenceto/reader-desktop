# Como contribuir para o LNReader Desktop

Obrigado pelo interesse em melhorar o leitor. Esta adaptação é **experimental**,
não é uma distribuição oficial do LNReader Android. A versão Windows é a mais
testada; o suporte Linux continua em desenvolvimento.

## Antes de alterar o código

1. Abra uma issue para bugs reproduzíveis ou mudanças maiores, evitando
   duplicações. Para correções pequenas, descreva o problema no pull request.
2. Crie uma branch de trabalho a partir da `main` e envie pull requests
   para ela. A branch `seguranca-e-estabilidade` é uma referência anterior;
   o Android original continua disponível no histórico Git.
3. Leia [a arquitetura](desktop/docs/ARCHITECTURE.md) e
   [os testes conhecidos](desktop/docs/COMPATIBILIDADE-SEGURANCA.md).
4. Não adicione dados pessoais, backups reais, cookies, credenciais, tokens,
   arquivos `.env` ou binários de compilação ao Git.

## Ambiente de desenvolvimento

Requisitos: Node.js 24, npm e Windows 10/11 para os testes Electron do Windows.

```sh
cd desktop
npm ci
npm run setup
npm run build
npm run check
npm run test:smoke
npm run test:pagination
npm run test:reader
```

A compilação não depende de Android SDK, Expo ou React Native. Há testes
específicos de integração e cenários de usuário em `desktop/test/`, executados
pelo [CI](.github/workflows/desktop.yml).

## Organização das alterações

- Coloque código Electron/React em `desktop/src/`, testes em
  `desktop/test/` e documentos em `desktop/docs/`.
- Evite ampliar ainda mais `src/renderer.jsx`; prefira componentes e
  funções com responsabilidade bem delimitada.
- `desktop/vendor/lnreader/` contém código e recursos originais, com licença
  e procedência. **Não** formate ou edite silenciosamente o snapshot:
  alterações nessa pasta exigem justificativa, diff isolado e testes de
  compatibilidade com plugins e backups.
- Execute `npm run format:check` nos módulos com cobertura de formatação
  incremental. `npm run format` formata o código próprio: revise as diferenças
  antes de enviar commits para evitar mudanças cosméticas desnecessárias.

## Pull requests

Explique o problema resolvido, os arquivos afetados, como testou, riscos de
compatibilidade, capturas de tela (se houver mudança visual) e eventuais
limitações. Não marque testes como concluídos se não foram executados.
Não altere diretamente a branch padrão sem revisão; prefira pull requests.

## Questões de segurança

Não publique prova de conceito, tokens, cookies ou dados de sessão em uma
issue. Leia [SECURITY.md](SECURITY.md) antes de relatar vulnerabilidades.
