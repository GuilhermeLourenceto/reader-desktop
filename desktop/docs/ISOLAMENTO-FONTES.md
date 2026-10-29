# Isolamento de fontes na versão 0.1.0

Cada fonte carregada executa em um Web Worker dedicado. O `pluginManager`, os
pacotes e os auxiliares originais executam dentro dele; a thread do React recebe
somente os dados e proxies dos métodos. A abertura do app verifica os arquivos
instalados sem executar todos os plugins.

## Funcionamento

- `sourceClient.js` administra os workers e o protocolo de chamadas.
- `plugin-worker.js` carrega o runtime original e executa os métodos da fonte.
- `workerAdapters.js` adapta arquivos, cache e HTTP ao canal de mensagens.
- Até seis workers são mantidos; um worker ocioso pode ser encerrado para dar
  lugar a outra fonte. Não é criado um worker para cada item do catálogo.
- Inicialização/descrição têm prazo de 12 segundos. Métodos de fonte têm prazo
  de 45 segundos. Ao excedê-lo, o worker é terminado e as chamadas pendentes
  recebem erro; a próxima tentativa cria um worker novo.
- O botão **Cancelar operação**, durante uma operação de fonte, interrompe os
  workers ativos. Fila de downloads também é interrompida quando necessário.
- HTTP continua no `RequestPool` do processo principal: oito conexões ativas,
  fila limitada, prazo de resposta e limite de 20 MB. Encerrar um worker cancela
  suas requisições pendentes.
- A ponte só permite arquivos em `Plugins/<id da fonte>/`, cache próprio e HTTP.
  Há limites de operações simultâneas e de mensagens por segundo.
- A interface não permite avaliação dinâmica de JavaScript. A exceção necessária
  ao SDK original fica restrita à resposta do script do worker. Essa política
  bloqueia conexões diretas e criação de workers adicionais pela extensão.
- Cada fonte aceita no máximo 32 chamadas pendentes. Falhas de inicialização ou
  instalação descartam o worker para permitir uma nova tentativa limpa.
- Instalação e desinstalação usam worker novo. Assim é possível remover uma
  extensão problemática e reinstalar um bundle sem reutilizar uma instância presa.

## Validação

`test/version01-smoke.cjs` instala no perfil temporário uma fonte cujo código
executa `while(true)`. O teste verifica que JavaScript da interface e a animação
do spinner continuam ativos, interrompe a fonte pelo botão e volta à leitura
em cache. Os testes existentes cobrem cache, instalação, busca, paginação,
HTTP, downloads e backups. A Central Novel também foi validada no novo runtime.

## Limites

Web Workers separam a execução JavaScript, mas não são processos do sistema
com memória independente. Não há garantia de contenção de esgotamento de memória
provocado por código hostil. Fontes que dependem de DOM, login interativo ou
WebView continuam exigindo adaptação. Bloqueios de sites e erros de DNS/TLS não
são resolvidos desativando a proteção da conexão.

A janela instalada mantém sandbox e isolamento de contexto. Neste ambiente de
QA, os testes ocultos precisaram de TEMP/TMP dentro do projeto e `--no-sandbox`
exclusivamente no comando de teste. Essa exceção não é adicionada ao aplicativo
nem ao instalador.
