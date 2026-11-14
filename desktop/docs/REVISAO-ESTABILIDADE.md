# Revisão de estabilidade do desktop — 28/10/2026

> **Registro histórico.** Esta auditoria documenta correções e medições feitas
> em 28/10/2026, não a cobertura da `main` em 13/11/2026. Em especial, a
> referência ao limite de 512 MiB abaixo descreve o caminho antigo de backup
> em memória; o fluxo principal atual usa ZIP64 com streaming em
> `src/zipStreaming.cjs` e limites específicos de metadados e entradas.

Escopo: código do port desktop, ponte Electron, persistência, backups, leitura,
downloads, fontes, paginação e os módulos originais usados nesses caminhos.
As correções desta revisão se concentram em funcionamento e estabilidade.

## Problemas confirmados e corrigidos

| Área | Problema | Correção |
| --- | --- | --- |
| Memória e gravação | O JSON continha todos os downloads em base64 e era regravado ao salvar progresso. O carregamento também copiava esses dados para o renderer. | Arquivos separados em `content/`, referenciados por hash; metadados continuam no JSON. Migração automática do formato anterior. Capas locais são carregadas sob demanda pelo protocolo interno. |
| Progresso | Cada evento de rolagem percorria os capítulos e agendava gravação. | Atualizações agrupadas a cada 200 ms; alterações insignificantes são ignoradas; o progresso pendente é descarregado ao trocar de capítulo, sair da leitura e fechar. |
| Recuperação | JSON truncado impedia a abertura e não havia recuperação automática. | Gravação temporária sincronizada, substituição atômica e `.bak`. Na abertura, tentativa da biblioteca, cópia anterior e temporário válido. Arquivo inválido é preservado. Sem cópia válida, a aplicação informa a falha e preserva os dados. |
| Integridade | Cache danificado podia ser tratado como arquivo válido. | Verificação do hash; uma nova leitura online pode substituir o conteúdo danificado. Referências atuais e cópias de recuperação são preservadas na limpeza de arquivos órfãos. |
| Backups | Compactação e descompactação bloqueavam o processo principal; o limite de descompactação era separado por ZIP interno. | Processamento em worker, limite total de 512 MB descompactados e 100 mil entradas, validação dos registros antes da substituição e verificação de tamanho antes da exportação. |
| Backup com cache incompleto | Arquivo ausente ou corrompido podia impedir proteger o restante da biblioteca. | Exporta os demais dados, informa quantos arquivos faltaram e corrige os indicadores de download no backup. |
| Rede | `AbortSignal` era ignorado; HEAD podia ser reconstruído com corpo; redirecionamento inválido podia escapar do tratamento de erros. | Cancelamento real, HEAD sem corpo, tratamento de URL/redirecionamentos e descarte de buffers após falha. |
| Concorrência de rede | Não havia limite compartilhado entre as extensões. | Até oito requisições ativas e fila limitada; cancelamento de itens ativos e pendentes; prazo de espera e de resposta. |
| Fontes | Objetos no lugar de nomes, gêneros ou filtros podiam quebrar a renderização. Quantidades inválidas de páginas podiam gerar alocações excessivas. | Validação na entrada dos dados, limites e mensagens de erro. Chamadas assíncronas a métodos das fontes têm prazo. |
| Repositórios | Um índice retornando objeto ou HTTP inválido podia interromper o carregamento dos outros índices. | Validação individual, isolamento de falhas, descarte de metadados inválidos e carregamento limitado a três repositórios simultâneos. |
| Inicialização offline | Fontes sem código disparavam downloads automáticos, mantendo o app ocupado durante falhas de rede. | Inicialização usa os bundles disponíveis; fontes ausentes são informadas para reinstalação, preservando acesso à biblioteca. |
| Desinstalação | A limpeza original por prefixo podia remover cache de outra fonte com ID semelhante. | Preservação das chaves de outras fontes e remoção dos arquivos personalizados da fonte desinstalada. |
| Operações concorrentes | Restauração/exclusão durante downloads podia criar arquivos e metadados inconsistentes. Controles concorrentes podiam liberar `busy` antes do término de todas as operações. | Bloqueio das operações incompatíveis, contagem de tarefas ativas e revalidação antes de inserir uma obra já aberta. |
| Leitura e imagens | Imagens relativas eram resolvidas pela URL interna da interface ou pela raiz incorreta do site; capítulo curto podia ser marcado lido antes de carregar imagens. | Resolução em relação ao capítulo, preservação da URL original de imagens baixadas e proteção contra a marcação antecipada. Downloads com imagens incompletas podem ser retomados pelas ações de download pendente. |
| Fechamento | A fila de rede podia continuar trabalhando enquanto o renderer encerrava. | Cancelamento das requisições, interrupção da fila de downloads, breve espera para concluir alterações pendentes e salvamento antes de fechar. |
| Instâncias | Duas instâncias instaladas podiam escrever na mesma biblioteca. | Instância única na versão instalada; uma segunda abertura traz a janela existente para frente. |

## Validação

- 33 testes automatizados de dados, arquivos, recuperação, integridade, backups,
  rede, concorrência, prazos, validação das fontes e ordem de capítulos.
- Testes Electron com perfis temporários: instalação de fonte, busca, paginação,
  respostas antigas, repetição de páginas, novas tentativas, leitura offline,
  progresso, downloads com imagens, seleção em lote, temas, capas, histórico,
  numeração, backup e restauração.
- Teste de estabilidade com servidor local: HEAD e cancelamento HTTP reais,
  fonte ausente na abertura, índices com erro, retorno inválido de fonte,
  restauração durante download, desinstalação com IDs semelhantes e fechamento
  pela janela com confirmação de persistência.
- Fixture de 2 MB: conteúdo preservado no disco; índice e metadados gravados
  ficaram abaixo de 400 bytes. É uma verificação da separação dos dados,
  não uma medição de memória de uma biblioteca real.
- Central Novel, no índice fornecido: instalação, 50 obras listadas, detalhes
  e leitura de um capítulo concluídos.
- Kiniga: instalação concluída; listagem encontrou `ERR_SSL_PROTOCOL_ERROR`.
  Better Novels: instalação concluída; listagem encontrou `ERR_NAME_NOT_RESOLVED`.
  São os resultados da conexão deste ambiente nesta execução. O app apresentou
  os erros e permitiu nova tentativa; não foi desabilitada a verificação TLS.
- Build desktop, formatação dos arquivos alterados, lint e TypeScript da raiz.
  O lint tem 30 avisos existentes. `pnpm run check` para na formatação de 21
  arquivos preexistentes da raiz; a formatação do desktop é verificada separadamente.

## Limites que permanecem

- Na versão 0.1.0, extensões executam em Web Workers dedicados. O teste com loop
  síncrono verificou que a interface responde e permite encerrar a fonte. Workers
  não equivalem a processos do sistema com memória independente; detalhes em
  `ISOLAMENTO-FONTES.md`.
- Sites podem mudar, exigir Cloudflare/login ou apresentar falhas de DNS/TLS.
  A verificação real de três fontes não comprova funcionamento de todo o catálogo.
- ZIPs ainda consomem memória no worker, dentro dos limites configurados. Não foi
  feito ensaio contínuo de várias horas nem medição de pico com bibliotecas reais
  próximas do limite de backup. Migração de um JSON legado enorme também precisa
  de memória para ler o formato antigo uma vez.
- Metadados continuam em JSON. A separação dos arquivos elimina a regravação dos
  downloads, mas não substitui um banco de dados para coleções muito grandes.
- Arquivos órfãos são limpos na abertura, respeitando as referências de recuperação;
  a liberação física de espaço pode ocorrer no próximo início do aplicativo.
- Linux e outras instalações/versões do Windows não foram validados nesta revisão.

Para recuperação manual, feche o aplicativo e mantenha a pasta `content/` junto
dos índices `library.json`, `library.json.bak` e `before-restore.json`. Backups ZIP
continuam levando os arquivos e não dependem dessa pasta externa.
