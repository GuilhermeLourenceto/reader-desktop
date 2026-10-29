# Testes de volume e falhas de conexão

Executados em 29/10/2026 no Windows, com dados sintéticos e perfil separado.
Nenhuma biblioteca pessoal foi usada ou modificada. Não houve alteração no aplicativo nesta rodada.

## Resultados

| Cenário                                                                               | Resultado                                                                                                                       |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Biblioteca com 7.000 obras e 143.980 capítulos, incluindo uma obra de 4.000 capítulos | Abriu em 2,44 s no ambiente de teste                                                                                            |
| Navegar para Atualizações / voltar à Biblioteca                                       | 0,31 s / 1,09 s                                                                                                                 |
| Gravar / carregar e validar os metadados                                              | 0,18 s / 0,17 s                                                                                                                 |
| Exportar 7.000 obras e 64 MiB de arquivos aleatórios                                  | 3,70 s; ZIP de 67,95 MiB                                                                                                        |
| Restaurar esse ZIP                                                                    | 2,30 s; contagens, progresso, marcadores e conteúdo dos 64 arquivos conferidos                                                  |
| Arquivo de entrada maior que 512 MiB                                                  | Rejeitado pelo limite previsto                                                                                                  |
| Três ciclos de queda/retorno: 60 conexões interrompidas e 61 conexões bem-sucedidas   | Recuperou; fila sem entradas e sem requisições ativas ao concluir                                                               |
| HTTP 503, tempo excedido e cancelamento                                               | Tratados; nova requisição funcionou depois                                                                                      |
| Teste existente de estabilidade                                                       | Passou: fonte ausente, repositórios inválidos, cancelamento HTTP, conflito entre restauração/download e fechamento com gravação |

## Memória e limites da conclusão

O processo Node, incluindo o worker do backup, atingiu aproximadamente 678 MiB
de RSS durante o teste de exportação/restauração.
Na interface com 7.000 obras, o processo da página atingiu aproximadamente
1.000 MiB de working set e 943 MiB de memória privada. Esses números têm métodos
de medição diferentes e não devem ser comparados diretamente.

A interface atualmente monta todos os cartões da biblioteca. O consumo com
milhares de obras merece otimização, por exemplo limitando os cartões montados
simultaneamente. O teste não demonstra vazamento de memória, nem o descarta em
sessões longas.

Tempos locais não são garantias para outros computadores. Electron foi executado
com GPU desativada e visualização de teste fora da tela. As conexões usaram o
Electron net real contra um servidor HTTP local; não houve alteração no Wi-Fi.
Isso não reproduz DNS, TLS, Cloudflare ou todas as falhas dos sites reais.
Não foi testado o backup de 1,4 GB citado na issue original: o formato atual do
desktop limita backups a 512 MiB. O teste não é uma certificação de todos os
tamanhos abaixo desse limite.

## Repetir

### Comparação do backup na versão 0.2.0

Três execuções alternadas do código anterior e do código otimizado, no mesmo
ambiente e com a mesma quantidade de dados sintéticos, produziram as medianas:
exportação 4,138 s → 2,327 s (44% menos tempo); restauração 2,311 s → 2,076 s
(10% menos tempo); pico de RSS 697,4 MiB → 616,1 MiB (12% menor).
A validação conferiu o conteúdo dos 64 arquivos, contagens, progresso e marcadores.
O ZIP real do LNReader também foi restaurado e reexportado sem perda de dados.
Não extrapolar esses ganhos para todos os tamanhos e tipos de arquivo.

### Comandos

Na pasta desktop, após `npm run build`:

```powershell
node test/load-benchmark.cjs
$env:TEMP = Join-Path $PWD '.tmp'
$env:TMP = $env:TEMP
node node_modules/electron/cli.js test/load-network-smoke.cjs --visual-preview --no-sandbox
```

`--no-sandbox` é exclusivo deste teste. A configuração normal do aplicativo
continua usando a proteção do Electron.
Os testes deixam os metadados sintéticos e medições em `.tmp`, ignorada pelo Git;
os arquivos de conteúdo e o ZIP gerados pelo benchmark são removidos ao concluir.
