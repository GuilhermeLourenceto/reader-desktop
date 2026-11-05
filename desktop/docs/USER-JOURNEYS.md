# Jornadas de usuário do LNReader Desktop

Pesquisa e matriz de testes em 05/11/2026, baseada em relatos do LNReader Android e de outros leitores. Os relatos **não comprovam** que o Desktop tenha os mesmos bugs: eles fornecem situações realistas para testar preventivamente.

## De onde vêm as jornadas

| Leitor / relato | Comportamento a proteger |
| --- | --- |
| [LNReader #2074](https://github.com/lnreader/lnreader/issues/2074) | Atualização global não deve baixar novamente capítulos lidos sem necessidade |
| [LNReader #2082](https://github.com/lnreader/lnreader/issues/2082) | Restauração interrompida não deve ficar silenciosamente bloqueada |
| [LNReader #2068](https://github.com/lnreader/lnreader/issues/2068) | Migração de uma obra entre fontes sem perder dados |
| [Mihon #2574](https://github.com/mihonapp/mihon/issues/2574) | Após restaurar backup, capítulos já baixados devem continuar reconhecidos |
| [Mihon #705](https://github.com/mihonapp/mihon/issues/705) | Muitos capítulos baixados não devem tornar a fila e o leitor extremamente lentos |
| [Mihon #4199](https://github.com/mihonapp/mihon/issues/4199) | Leitura deve preferir os arquivos já baixados em vez de fazer novas requisições |
| [Readest #4838](https://github.com/readest/readest/issues/4838) | A retomada de leitura não deve voltar ao início nem sobrescrever progresso correto |
| [Suwayomi #2236](https://github.com/Suwayomi/Suwayomi-Server/issues/2236) | Restauração e navegação de bibliotecas grandes não devem esgotar memória |
| [Kavita #4859](https://github.com/Kareadita/Kavita/issues/4859) | Troca de obra não deve herdar configurações de leitura inadequadas |

## Suíte automatizada: 12 jornadas

A entrada é `desktop/test/user-journeys.cjs`. Executar com a aplicação compilada:

```sh
cd desktop
npm ci
npm run setup
npm run build
npm run test:journeys
```

Cada cenário usa um perfil temporário e, quando necessário, uma fonte sintética local. O executor cria `desktop/.tmp/user-journeys-results.json` com PASS/FAIL, duração e issues relacionadas.

| Jornada | Teste Electron | O que cobre |
| --- | --- | --- |
| Biblioteca e descoberta | `library-search-smoke.cjs` | Buscar, filtrar, categorias e busca global |
| Adicionar e interagir com obra | `book-actions-smoke.cjs` | Detalhes, download, favoritos e leitor |
| Atualização e duplicatas | `updates-smoke.cjs` | Atualização com falha parcial e preservação |
| Preferências e modo anônimo | `settings-smoke.cjs` | Configurações e seus controles |
| Ordem dos capítulos | `chapter-order-smoke.cjs` | Direção crescente/decrescente e próximo/anterior |
| Rede lenta e operações simultâneas | `stability-smoke.cjs` | Download em andamento, restauração cancelada, erros de rede |
| Recuperação da interface | `recovery-smoke.cjs` | Reação a falhas de renderização |
| Fechar ao salvar | `close-smoke.cjs` | Encerramento durante gravação |
| Fonte inválida | `isolation-smoke.cjs` | Isolamento de falhas da extensão |
| Leitura e fontes presas | `version01-smoke.cjs` | Paginação, temas e cancelamento |
| **Progresso retomado** | `reader-rules-smoke.cjs` | Restaurar 50% de posição inicial, limiar de 97%, retry e preservar arquivo baixado após atualizar |
| **Biblioteca enorme** | `huge-library-ui-smoke.cjs` | 10.000 obras e 200.000 capítulos, virtualização e métricas de memória |

As duas últimas jornadas foram incluídas no executor em 05/11/2026; seus scripts de teste já existiam no repositório. A GitHub Actions executa o agrupamento no Windows e executa vários testes gráficos separados também no Linux.

## Lacunas importantes: não interpretar como PASS

1. **Backup real Android → Desktop → restauração em nova instalação:** os testes unitários do formato ZIP e uma restauração cancelada são úteis, mas falta uma jornada UI integral com backup realista, fechando e reabrindo o aplicativo; conferir biblioteca, progresso, categorias, fontes e bytes dos downloads.
2. **Offline após reiniciar e com fonte inacessível:** testar capítulo já baixado sem rede, antes e depois de reiniciar; nenhuma chamada à fonte deve ser necessária para ler o arquivo local.
3. **Retomada após encerramento verdadeiro:** o teste de progresso atual inicia com 50% gravado, mas não fecha e reabre para medir persistência de um deslocamento novo.
4. **Backup/reindexação volumosos:** restaurar milhares de obras e arquivos em disco, medindo pico de RAM, duração e recuperação após interrupção. A jornada de 10 mil itens testa navegação/virtualização, não uma restauração gigantesca.
5. **Fontes reais e login/Cloudflare:** fixtures locais não comprovam acesso a serviços externos. Fazer testes manuais por fonte e SO, sem usar credenciais pessoais nos artefatos.
6. **Migração entre fontes:** validar nomes distintos, capítulos equivalentes e ausentes, marcadores, capítulos lidos, downloads e rollback quando a migração falhar.
7. **Leitor por obra/perfil:** verificar que preferências do leitor não vazem para outra obra, especialmente após importação de backup ou mudança de tema.

## Critérios para considerar uma jornada aprovada

- Comportamento observado no Electron real, com assertions sobre UI e estado persistido.
- Falhas trazem etapa reproduzível e logs úteis; screenshots são auxiliares, não substituem assertions.
- Nenhum dado da biblioteca pessoal ou site externo é alterado durante a suíte automatizada.
- Resultado `PASS` na CI significa apenas a cobertura dos testes, **não** compatibilidade universal de plugins ou validação visual manual no hardware final.

Para diagnosticar localmente, execute `npm run test:journeys` no Windows. No Linux, use uma sessão gráfica; no CI Linux, testes Electron individuais são executados com Xvfb.
