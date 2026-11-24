# Repositório Reader Desktop

A branch padrão `main` contém o Reader Desktop.

- `desktop/src/`: inicialização Electron e módulos de baixo nível.
- `desktop/src/features/`: funcionalidades de biblioteca, leitor, fontes e interface.
- `desktop/src/components/`: componentes reutilizáveis.
- `desktop/src/domain/`: regras de negócio compartilhadas.
- `desktop/src/state/`: estado, serialização e preferências.
- `desktop/src/infrastructure/`: política de rede, diagnósticos e atalhos.
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
```

Para gerar instaladores, execute no sistema correspondente:

```sh
npm run dist:win    # Windows
npm run dist:linux  # Linux
```

O Linux utiliza `npm run dist:linux` no Linux e ainda requer
validação em computador real. O CI inclui um job de compilação com apenas `desktop/` presente no checkout.
A aprovação depende da execução real dos jobs, não apenas de sua configuração.

Não envie diretórios `node_modules`, `dist`, `release`, `.tmp`,
dados pessoais, cookies, backups ou credenciais. Instaladores são
distribuídos por artefatos ou releases, não por commits.

## Atualizar os módulos do LNReader

Os módulos originais necessários já estão versionados em
`desktop/vendor/lnreader/`. Para atualizá-los manualmente, coloque os
arquivos originais correspondentes em `desktop/.tmp/lnreader-original/`
(dentro da própria pasta Desktop, que é ignorada pelo Git). Só depois,
a partir de `desktop/`, execute:

```sh
node scripts/sync-original-sdk.cjs
```

O importador recusa caminhos externos, links simbólicos e snapshots
incompletos antes de copiar qualquer arquivo. Ele **não apaga** módulos
originais. Revise o diff em `vendor/lnreader/`, a licença e
`origin.json` e execute toda a suíte. Esse procedimento opcional
não faz parte do build nem busca arquivos fora de `desktop/`.
O Desktop não é uma distribuição oficial do LNReader Android.

## Colaboração

Envie pull requests para `main`. O empacotamento Windows e Linux está configurado no projeto.
Leia [CONTRIBUTING.md](../../CONTRIBUTING.md) e
[ARCHITECTURE.md](ARCHITECTURE.md) antes de alterar o motor de plugins.
