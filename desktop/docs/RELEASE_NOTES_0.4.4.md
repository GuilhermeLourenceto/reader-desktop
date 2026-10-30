## Melhorias de desempenho

- **Biblioteca virtualizada:** quando a lista filtrada tem mais de 100 obras, o Desktop monta só os cartões próximos da área visível. As obras continuam disponíveis no mesmo lugar; rolagem, busca, categorias e seleção funcionam sem paginação manual.
- **Menos trabalho a cada interação:** filtragem da biblioteca e contagem por categoria são memorizadas, evitando percorrer todos os capítulos a cada clique de seleção. A consulta de seleção por cartão usa um conjunto em vez de procurar toda a lista.
- **Visual preservado:** capas, tamanhos, temas, badges, menus de contexto e atalhos usam os mesmos componentes; o grid pequeno permanece inalterado.

## Verificação

- Testes unitários de cálculo de colunas e janelas virtuais em Windows e Linux.
- Teste Electron com 10.000 obras e 200.000 capítulos em Windows e Ubuntu 24.04: exige que o DOM permaneça limitado, valida rolagem até a última obra, retorno ao topo, busca pela última obra e retorno da aba Atualizações.
- Mantidos os testes de fontes, leitor, persistência, backups e jornada do usuário.

## Limitações

Esta otimização reduz especialmente o custo de elementos HTML, imagens e componentes React da biblioteca; **não remove os metadados das obras da RAM**. O ganho total de memória depende da biblioteca e do computador. O histórico e listas de capítulos muito grandes continuam candidatos a melhorias adicionais. As medições antigas do renderer (antes da virtualização) não devem ser apresentadas como resultado da versão 0.4.4.

A versão continua **beta**: algumas fontes exigem login/Cloudflare, os backups permanecem limitados a 512 MiB e os binários não têm assinatura digital. O Linux ainda requer validação manual em sessões X11/Wayland reais.

**Recomendação:** mantenha uma cópia do backup antes de atualizar.
