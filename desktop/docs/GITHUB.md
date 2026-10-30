# Repositório LNReader Desktop

Nesta branch existe apenas o código necessário ao Desktop; a `main`
preserva o Android original.

- `desktop/src/`: interface Electron, rede, leitor e backups.
- `desktop/vendor/lnreader/`: módulos originais versionados para plugins,
  temas e formato de backups. Licença e procedência em `origin.json`.
- `desktop/test/`: testes e simuladores de utilização.
- `desktop/scripts/`: verificação de isolamento e sincronização opcional.
- `desktop/docs/`: documentação e capturas.
- `desktop/build/`: recursos do instalador.
- `.github/workflows/desktop.yml`: testes e compilação do Desktop.

## Compilar

Com Node.js 24, dentro de `desktop/`:

```sh
npm ci
npm run setup
npm run build
npm test
npm run test:smoke
npm run test:reader
npm run dist:win
```

O Linux utiliza `npm run dist:linux` no Linux e ainda requer
validação em computador real. O CI verifica a compilação com apenas
`desktop/` presente no checkout.

Não envie diretórios `node_modules`, `dist`, `release`, `.tmp`,
dados pessoais, cookies, backups ou credenciais. Instaladores são
distribuídos por artefatos ou releases, não por commits.

## Atualizar os módulos do LNReader

Obtenha um checkout **separado** do LNReader Android. A partir de
`desktop/` execute:

```sh
node scripts/sync-original-sdk.cjs --from=/caminho/para/clone-android
```

Revise o diff em `vendor/lnreader/`, a licença e `origin.json` e
execute toda a suíte. A sincronização não ocorre durante o build.
O Desktop não é uma distribuição oficial do LNReader Android.
