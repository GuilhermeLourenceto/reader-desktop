# Publicar o código no GitHub

## Pasta correta

Use a raiz que contém `README.md`, `package.json`, `assets/`, `src/` e `desktop/`.
Não publique apenas `desktop/`: o build reutiliza o código e os recursos do
LNReader Android nas pastas vizinhas. Preserve `LICENSE` e a atribuição ao projeto
original. Este é um port independente, experimental, versão 0.1.0.

## Estrutura do desktop

- `src/`: aplicativo, ponte Electron, fontes e persistência.
- `build/`: ícone oficial convertido e configuração do instalador; deve entrar no Git.
- `test/`: testes automatizados e verificações Electron.
- `tools/`: ferramentas de diagnóstico para desenvolvimento.
- `docs/`: decisões, compatibilidade e limitações conhecidas.
- `package-lock.json`: dependências reproduzíveis; deve entrar no Git.
- `dist/`, `release/`, `.tmp/`, `node_modules/`: arquivos gerados e locais; ignorados.

## O que não enviar

Use Git, respeitando os arquivos `.gitignore`, em vez de arrastar a pasta inteira
para o navegador. Não envie `.env`, perfis do Electron, bibliotecas pessoais,
backups ZIP, logs ou capturas de testes. O `.gitignore` protege arquivos novos;
arquivos que já tenham sido adicionados ao Git precisam ser retirados do índice
antes do envio. Confira a lista de arquivos preparados para o commit.

Instaladores `.exe` devem ser anexados a uma Release, e não incluídos no histórico
do código. O instalador atual solicita administrador automaticamente. Não há
certificado de assinatura digital de distribuição.

## Compilação e testes

Com Node.js 24, execute dentro de `desktop/`:

```sh
npm ci
npm run setup
npm run build
npm test
npm run test:smoke
npm run dist:win
```

O instalador fica em `desktop/release/`. O workflow
`.github/workflows/desktop.yml` faz o build do Windows e disponibiliza artefatos.
Os testes de aplicativo e o harness NSIS não substituem uma instalação,
atualização e desinstalação reais numa máquina Windows de teste.

Antes de publicar, confira as alterações e mantenha os recursos originais sob a
licença MIT. Esta preparação não cria repositório, commit, Release nem envia
arquivos automaticamente.
