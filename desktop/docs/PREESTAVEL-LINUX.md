# Reader Desktop — validação pré-estável para Linux

**Data:** 14/11/2026

**Código:** Reader Desktop 0.4.5 Beta, branch `main` (rodada de pré-estabilização).

**Ambiente principal:** Debian 13, KDE Plasma/Wayland com Xwayland, Linux x86-64, Node.js 20.19.2 e npm 9.2.0.

## Resultado

**Candidata a pré-estável no ambiente testado**, ainda não uma release `Stable`. A suíte de testes, os instaladores e os backups passaram nas verificações abaixo. Isso não certifica todos os ambientes Linux nem substitui testes com arquivos pessoais reais.

| Verificação | Resultado |
| --- | --- |
| `npm run test:all` | Aprovado: build, lint, formatação, 215 testes unitários aprovados, 1 opcional ignorado, jornadas de UI no Electron e diagnósticos |
| `npm run dist:linux` | Aprovado: `.AppImage` amd64 e `.deb` amd64 produzidos |
| AppImage executado diretamente | Aprovado com `--disable-gpu`, KDE/Wayland e perfil temporário: processo iniciou, permaneceu ativo e criou `library.json` |
| `.deb` | Estrutura, dependências e entrada `.desktop` verificadas. Execução bem-sucedida após extração isolada com `--disable-gpu`. Simulação `apt-get -s install` sem conflitos; instalação com `dpkg` não efetuada |
| Worker de backup dentro do ASAR | Aprovado em `test/packaged-backup-smoke.cjs`, sem carregar código-fonte externo do worker |
| Backup de 530 MiB | Aprovado: exportação/importação de um capítulo offline maior que 512 MiB, por streaming (10/10 casos da suíte ZIP com teste pesado ativado) |
| Backup sintético quase no limite | Aprovado em 21,5 s: 6.000 obras, 92.985 capítulos, 474 MiB de conteúdo e 374 arquivos, ZIP de 476,11 MiB |
| Backup quase no limite: segurança | Duas importações, hashes SHA-256 de todos os arquivos, ordem e progresso conferidos; metadados deliberadamente danificados recuperados do backup |
| Erros e diagnósticos | Mensagens curtas, exportação `.txt`, ocultação de dados privados e alinhamento em 800/1280 px, testados no Electron |
| Interface | Biblioteca, capítulos, leitura, busca, histórico, configurações, fontes e operações de recuperação em resoluções compactas/largas |

O teste sintético quase no limite observou **408,3 MiB de pico de RSS no processo Node principal**, sem incluir necessariamente todos os processos filhos, a interface ou a memória de GPU. Não é uma medição de consumo total do aplicativo.

As capturas da interface foram produzidas por testes Electron com conteúdo fictício e estão em [Capturas no README](../README.md#capturas-de-tela).

## Como reproduzir

Na pasta `desktop`:

```bash
npm ci
npm run setup
npm run test:all
npm run dist:linux
READER_LARGE_BACKUP_TEST=1 node --test test/zip-streaming.test.cjs
node test/heavy-backup-stress.cjs --profile=near-limit
```

Para os testes Electron, execute em uma sessão gráfica X11/Xwayland acessível. No ambiente testado, a sessão KDE Wayland disponibilizou o Xwayland `DISPLAY=:1`; não é uma configuração universal e não deve ser fixada em scripts do projeto.

## Limitações antes de considerar `Stable`

- **Instalação e remoção reais do novo `.deb`:** nesta rodada o pacote foi extraído e executado, mas não instalado com privilégios de administrador.
- **Distribuições e servidores gráficos:** testar outras versões do Debian, Ubuntu/Fedora, X11 e ambientes com Wayland sem a mesma configuração. As inicializações dos binários empacotados usaram `--disable-gpu`; aceleração gráfica nativa em GPUs/driver diferentes ainda não foi validada.
- **Backups Android reais:** aumentar a coleção de testes com arquivos efetivamente exportados por versões diferentes do LNReader Android, removendo dados privados e mantendo os originais intactos.
- **Uso prolongado:** observar sessões contínuas e relatos de usuários, principalmente downloads, fontes de terceiros, atualizações e restaurações após interrupções.
- **Distribuição:** os binários locais não estão assinados; sucesso local não implica aprovação de CI nem validação de uma release pública.

**Critério sugerido para promover a `Stable`:** realizar instalação limpa e upgrade do `.deb`, confirmar AppImage em outra distribuição, importar backups Android reais de versões distintas, verificar logs/privacidade e manter um ciclo de uso real sem regressões críticas de perda de dados.
