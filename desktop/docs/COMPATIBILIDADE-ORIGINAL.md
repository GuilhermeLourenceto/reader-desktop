# Revisão das regras do Android — 28/10/2026

> **Registro histórico.** Os arquivos `src/screens/...` citados na tabela são
> referências do projeto LNReader Android naquela comparação; não devem ser
> confundidos com a estrutura atual do Desktop. As regras do Desktop estão
> organizadas em `src/domain/`, `src/features/` e `src/state/`.
> Consulte [a arquitetura atual](ARCHITECTURE.md) e o [guia de desenvolvimento](DEVELOPMENT.md).

Esta revisão cobre fontes, pesquisa, páginas de capítulos, atualização e leitura.
O desktop continua experimental e não tem paridade com todos os serviços Android.

| Regra original e referência                                                                                          | Adaptação desktop                                                                                                                                            |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/screens/BrowseSourceScreen/useBrowseSource.ts`: chamar `popularNovels` com opções, filtros e `showLatestNovels` | Opções mantidas por sessão; controles Populares/Recentes e filtros Text, Picker, Switch, Checkbox e XCheckbox                                                |
| Mesmo arquivo: serializar páginas e ignorar respostas de buscas antigas                                              | Uma página pendente por sessão, identificação por sessão e descarte de respostas anteriores                                                                  |
| Mesmo arquivo: falha não significa fim e não deve pular a página                                                     | Erro inclusive na primeira página oferece Tentar novamente; número avança somente após sucesso                                                               |
| Mesmo arquivo: apenas resposta vazia significa fim                                                                   | Páginas repetidas são deduplicadas e pausadas com explicação, sem anunciar fim; é possível continuar manualmente à próxima página                            |
| `src/services/plugin/fetch.ts`: normalizar scanlators em obras e páginas                                             | O desktop importa diretamente `fetchNovel`, `fetchPage` e `fetchChapter` originais                                                                           |
| `src/database/queries/NovelQueries.ts`: abrir detalhes não adiciona à biblioteca                                     | A obra é armazenada como prévia; o botão Adicionar à biblioteca é explícito                                                                                  |
| `src/database/queries/ChapterQueries.ts`: upsert por caminho preservando estado local                                | `mergeChapters` atualiza metadados, página e posição; preserva ID, progresso, lido, marcador e download; ordena por página e posição                         |
| `src/services/updates/LibraryUpdateQueries.ts`: atualizar os capítulos das páginas conhecidas                        | Atualiza a lista inicial e reconsulta páginas já presentes; falhas parciais são informadas                                                                   |
| `src/screens/reader/hooks/useChapter.ts`: leitura offline com fallback para a fonte                                  | Leitura local primeiro; arquivo ausente, ilegível ou vazio tenta a fonte; falha de gravação não impede exibir texto válido                                   |
| Mesmo arquivo: não manter falhas como conteúdo e permitir refetch                                                    | Capítulos vazios ou somente script são rejeitados; Tentar capítulo novamente e Atualizar capítulo; cache anterior só é substituído depois de resposta válida |
| Mesmo arquivo: guardar histórico separadamente da conclusão                                                          | `readTime` é registrado ao abrir; `unread` muda apenas a partir de 97%                                                                                       |
| Mesmo arquivo: escala nativa de progresso 0–100                                                                      | Restauração, atualização e novos backups usam percentuais; frações antigas marcadas como tal são convertidas ao exportar                                     |
| Mesmo arquivo: buscar página vizinha ao atravessar limite de capítulos                                               | Botões anterior/próximo consultam a página ausente; falha não avança e pode ser repetida; páginas já armazenadas funcionam offline                           |
| `src/hooks/persisted/usePlugins.ts`: registrar a versão que de fato foi instalada                                    | Metadados da instalação usam versão, nome e site retornados pelo bundle                                                                                      |
| `src/utils/error.ts`: recuperar mensagem e causas                                                                    | Reaproveitamento direto no desktop, inclusive para erros de fonte e tentativas de recuperação                                                                |

## Verificação

O botão Continuar leitura também segue
`src/screens/novel/components/Info/ReadButton.tsx`: prefere o último capítulo
visitado e usa o primeiro não lido apenas quando não há histórico.

- Testes unitários: reconciliação de capítulos, deduplicação, ordenação, preservação
  de estado, conteúdo inválido, retomada, escala e limite de 97%, além dos ZIPs.
- `npm run test:pagination`: rolagem, indicador, posição, duplicados, falha de
  primeira página, repetição da página que falhou, pesquisa antiga, recentes e filtros.
- `npm run test:reader`: restauração em 50%, leitura offline, marcação em 97%,
  falha na página vizinha, capítulo vazio, recuperação e atualização com estado preservado.
- `npm run test:smoke`: instalação real pelo motor, leitor, HTML sanitizado,
  persistência, offline e backup/restauração em dados temporários.
- Central Novel real: listagem, detalhes e capítulo abertos depois das adaptações.

## Limites e diferenças mantidos

- A filtragem de HTML é mais restrita que a WebView original: scripts, estilos
  arbitrários, objetos e navegação não são liberados no renderer desktop.
- Bibliotecas antigas do desktop sem unidade de progresso identificada recebem
  indicação de fração apenas quando o valor está estritamente entre 0 e 1.
  Valores sem identificação podem ser ambíguos; backups novos identificam a unidade.
- A atualização informa falhas parciais e não baixa antecipadamente todas as páginas
  novas: elas são buscadas ao navegar ou ao escolher Carregar mais capítulos.
- Prefetch de capítulos, exclusão de scanlators, rastreadores,
  tarefas com app fechado, nuvem, TTS e login/Cloudflare interativo seguem pendentes.
- O armazenamento desktop continua JSON, sem executar as consultas Drizzle/SQLite
  do Android. As regras equivalentes são verificadas por testes independentes.
