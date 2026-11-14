# Suporte e validação do Reader Desktop no Linux

> Documento de trabalho atualizado para a `main` em 13/11/2026. A antiga
> branch `linux/prepare-packaging-and-tests` foi usada na preparação inicial;
> as referências àquela branch eram históricas e não descrevem mais o fluxo principal.

## Estado atual

- O código do Desktop usa Electron, React e Node.js 24; não exige Android SDK.
- O empacotamento Linux já está configurado no `desktop/package.json`: `.AppImage` e `.deb` para x64.
- O workflow principal `.github/workflows/desktop.yml` possui matriz **Windows e Ubuntu 24.04** para testes, build e empacotamento.
- O workflow `.github/workflows/linux-preparation.yml` é adicional e experimental. Seu gatilho por alteração do marcador é restrito à antiga branch Linux; também declara `workflow_dispatch`.
- O workflow de portabilidade `.github/workflows/desktop-portability-checks.yml` tem execução manual, além de seu gatilho de push na antiga branch Linux.
- A existência desses workflows **não confirma aprovação**: em 13/11/2026 a `main` apresentava falhas de inicialização de jobs em poucos segundos, sem passos de teste. Confira o [histórico de execuções](https://github.com/GuilhermeLourenceto/lnreader-desktop/actions) antes de confiar em artefatos.

## Rodar localmente

Instale Git, Node.js 24, npm e bibliotecas necessárias ao Electron no Linux. Em uma sessão gráfica:

```bash
git clone https://github.com/GuilhermeLourenceto/lnreader-desktop.git
cd lnreader-desktop/desktop
npm ci
npm run setup
npm run build
npm run check
npm start
```

Para verificar os testes de interface em uma sessão gráfica, execute:

```bash
npm run test:smoke
npm run test:pagination
npm run test:reader
npm run test:visual
```

Em CI isolado sem sessão gráfica, alguns testes Electron usam Xvfb e `--no-sandbox` **somente no comando de teste**. Essa opção não deve ser aplicada ao aplicativo distribuído. Consulte os jobs reais em `.github/workflows/desktop.yml` para a sintaxe de cada teste.

## Gerar e inspecionar pacotes

```bash
npm run dist:linux
bash scripts/verify-linux-packages.sh
```

Os arquivos são gerados em `desktop/release/`. O script inspeciona metadados e arquivos do AppImage e DEB; **não substitui a instalação e execução em uma máquina real**. Algumas distribuições precisam de componentes de compatibilidade FUSE para AppImage.

## Testes manuais ainda necessários

- [ ] Abrir o AppImage em X11 e Wayland como usuário comum.
- [ ] Instalar e desinstalar o `.deb` e conferir menu, ícone, foco e permissões.
- [ ] Reiniciar o aplicativo com biblioteca, progresso e downloads já existentes.
- [ ] Instalar uma fonte real, pesquisar, carregar capítulos e ler offline.
- [ ] Verificar login e cookies segregados por fonte sem expor credenciais.
- [ ] Importar/exportar um backup de teste do LNReader Android e validar restauração.
- [ ] Exercitar controles do leitor, atalhos F11, temas e janelas pequenas.
- [ ] Avaliar desempenho e memória em Linux Mint e Ubuntu, sem extrapolar métricas históricas.
- [ ] Confirmar que nenhuma alteração no sandbox ou em TLS foi feita para contornar problemas de teste.

## Sobre as versões anteriores

A primeira preparação Linux ocorreu antes da versão 0.4.3 e incluiu isolamento do SDK original, verificação de recursos do pacote e testes gráficos por Xvfb. Os relatórios de 29–30/10/2026 em [STRESS-TESTS.md](STRESS-TESTS.md) são registros dessas execuções e **não certificam** o código atual da `main`.

O objetivo para estabilização continua sendo CI funcional, AppImage/DEB verificados em máquinas reais e testes de restauração, fontes, leitura e persistência sem perda de dados.
