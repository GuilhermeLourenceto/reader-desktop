# Contribuindo para o Reader Desktop

O Reader Desktop é um projeto independente do LNReader Android. Contribuições de código, documentação, testes, acessibilidade e traduções são bem-vindas.

## Comece por aqui

1. Consulte as [issues](https://github.com/GuilhermeLourenceto/lnreader-desktop/issues) para evitar trabalho duplicado. Para mudanças grandes, discuta o desenho antes do pull request.
2. Leia o [guia de desenvolvimento](desktop/docs/DEVELOPMENT.md) e a [arquitetura](desktop/docs/ARCHITECTURE.md).
3. Crie sua branch de trabalho a partir de `main` em seu fork; envie um **pull request para `main`**. Não é necessário criar ou depender das branches históricas do proprietário.
4. Mantenha mudanças pequenas e focadas, preferencialmente com teste de regressão.

## Instalação e verificações

Requisitos: Git, **Node.js 24** e npm. No Windows e no Linux, use:

```bash
cd desktop
npm ci
npm run setup
npm run build
npm run check
```

Para iniciar: `npm start`. Os testes gráficos e de integração estão em `desktop/test/`; consulte os comandos por área no guia de desenvolvimento. Android SDK, Expo e React Native **não são necessários**.

## Organização do código

- `desktop/src/features/`: biblioteca, leitor, fontes, downloads, histórico, atualizações, configurações e primeiro acesso.
- `desktop/src/components/`: componentes reutilizáveis.
- `desktop/src/domain/`: cálculos e regras de negócio compartilhadas.
- `desktop/src/state/`: hidratação/serialização do estado da interface.
- `desktop/src/infrastructure/`: política de rede e diagnósticos.
- `desktop/src/main.cjs` e `desktop/src/preload.cjs`: acesso privilegiado e ponte IPC.
- `desktop/vendor/lnreader/`: código original e arquivos com procedência; **não modificar silenciosamente**.
- `desktop/test/`: testes unitários e jornadas Electron.

Não acrescente uma nova responsabilidade grande ao `renderer.jsx`. Separe módulos sem alterar regras, formatos de backup ou contratos públicos na mesma mudança.

## Enviando o pull request

Informe o problema resolvido, quais áreas foram afetadas, o risco de regressão e **os comandos realmente executados**. Adicione captura de tela para alterações visuais; para bugs, descreva passos de reprodução sem dados pessoais.

**Segurança e privacidade:** não envie `.env`, cookies, tokens, credenciais, backups reais, arquivos de usuário, caminhos privados ou logs sem revisão. Para vulnerabilidades, siga [SECURITY.md](SECURITY.md), em vez de publicar detalhes sensíveis numa issue.

Se a CI falhar antes de executar os comandos, registre isso no PR; não presuma que o código está aprovado nem que a falha ocorreu por sua alteração.
