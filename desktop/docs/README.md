# Documentação do Reader Desktop

Este índice reúne os guias de uso, desenvolvimento e validação do Reader Desktop. A versão declarada no código é **0.4.6 Beta**. Consulte o [histórico de versões](../CHANGELOG.md).

## Para quem quer usar o aplicativo

- [README do projeto](../../README.md): visão geral, recursos e como encontrar os instaladores quando disponíveis.
- [Manual Desktop](../README.md): biblioteca, fontes, downloads, backups e configurações.
- [Leitor](LEITOR.md): navegação, atalhos, páginas horizontais, progresso e barras.
- [Linux](CONTINUAR-NO-LINUX.md): executar, empacotar e validar AppImage/DEB.
- [Fontes e segurança](TESTES-FONTES.md): como interpretar problemas de login, DNS e Cloudflare.

## Para quem quer contribuir

- [Guia de contribuição](../../CONTRIBUTING.md): proposta de mudanças, privacidade e pull requests.
- [Desenvolvimento](DEVELOPMENT.md): ambiente, comandos, estrutura e testes.
- [Arquitetura](ARCHITECTURE.md): dependências, componentes, estado e fluxo de backup.
- [Isolamento de fontes](ISOLAMENTO-FONTES.md): Workers e fronteira de execução.
- [Compatibilidade e segurança](COMPATIBILIDADE-SEGURANCA.md): contexto das sessões e política de rede; resultados históricos marcados.
- [Jornadas de usuário](USER-JOURNEYS.md): cenários automatizados e lacunas de teste.
- [Repositório e SDK original](GITHUB.md): sincronização opcional do snapshot.

## Histórico e medições (não certificam a `main` atual)

- [Registro de estabilidade de 28/10/2026](REVISAO-ESTABILIDADE.md).
- [Testes de estresse de outubro de 2026](STRESS-TESTS.md).
- [Comparação com o LNReader Android de 28/10/2026](COMPATIBILIDADE-ORIGINAL.md).
- [Histórico do instalador Windows 0.2.0](INSTALADOR-WINDOWS.md).
- [Histórico de versões](../CHANGELOG.md).

## Como interpretar o estado dos testes

Os workflows em `.github/workflows/` definem o que **deveria** ser executado; a aprovação depende da conclusão real dos jobs. Verifique os [resultados no GitHub Actions](https://github.com/GuilhermeLourenceto/reader-desktop/actions) e rode `cd desktop && npm run check && npm run build` em um ambiente controlado.

O formato principal de backup atualmente usa `src/zipStreaming.cjs` com ZIP64. Os registros antigos de 512 MiB descrevem o caminho legado de processamento em memória (`src/backup.cjs`), não um limite geral do aplicativo. Dados de usuários e credenciais não devem ser incluídos em testes públicos.
