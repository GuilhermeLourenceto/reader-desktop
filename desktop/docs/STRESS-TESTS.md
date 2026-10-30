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

---

## Rodada multiplataforma — 30/10/2026 (branch Linux, sem instaladores)

GitHub Actions, Windows `windows-latest` e Ubuntu 24.04 x64; Node.js 24.
Todas as bibliotecas, os binários de teste e os perfis Electron foram
sintéticos, gerados em diretórios temporários isolados. **Não foram usados
dados pessoais, nem foram publicados instaladores ou releases.**

### Cenário extremo: muitas obras + backup volumoso

| Medição | Ubuntu 24.04 | Windows |
| --- | ---: | ---: |
| Resultado de todos os testes | **PASS** | **PASS** |
| Obras / capítulos | 18.000 / 473.174 | 18.000 / 473.174 |
| Arquivos binários conferidos por SHA-256 | 464 | 464 |
| Conteúdo binário / biblioteca JSON | 323 MiB / 65,44 MiB | igual |
| ZIP exportado | 331,06 MiB | 331,06 MiB |
| Exportação pelo worker | 4,50 s | 13,34 s |
| Importação 1 / importação 2 | 7,71 / 7,32 s | 12,39 / 12,18 s |
| Pico de RSS do processo Node (incluindo workers) | 2.683,9 MiB | 1.849,8 MiB |

Além das contagens, os testes verificam a ordem de **todas** as obras,
amostras de progresso e marcadores, categorias, dados de cada arquivo
importado e persistência da biblioteca. Também corrompem os metadados
intencionalmente para validar a recuperação via `.bak`.

**Defeito encontrado e corrigido na branch:** na primeira execução, a
restauração alterava a ordem das obras porque os membros
`NovelAndChapters/*.json` eram percorridos na ordem do ZIP. O backup
v2 passou a incluir uma propriedade **opcional** `desktopNovelOrder` no
`Version.json` já existente. Backups v2 antigos sem a propriedade
continuam sendo aceitos, e propriedades inválidas são rejeitadas. Não
foram alterados os arquivos do SDK original. Ainda falta conferir a
exportação nova em uma instalação Android real, pois o teste comprova a
compatibilidade do parser Desktop, não toda a cadeia Android.

### Cenário próximo ao limite de backup

| Medição | Ubuntu 24.04 | Windows |
| --- | ---: | ---: |
| Resultado | **PASS** | **PASS** |
| Biblioteca | 6.000 obras / 92.985 capítulos | igual |
| Conteúdo binário e ZIP | 474 MiB / 475,70 MiB | igual |
| Arquivos conferidos por SHA-256 | 374 | 374 |
| Exportação | 5,72 s | 10,53 s |
| Importação 1 / importação 2 | 6,25 / 5,33 s | 8,99 / 8,66 s |
| Pico de RSS do processo Node | 2.343,6 MiB | 1.732,7 MiB |

Os dois sistemas recusaram um ZIP esparso de 513 MiB com a biblioteca
original intacta. O limite atual de 512 MiB foi **mantido**: esta rodada
não comprova suporte a arquivos de 1 GiB ou mais.

### Interface Electron: biblioteca muito grande

Teste real de navegação no renderer com **10.000 obras e 200.000
capítulos**, incluindo alternância Biblioteca → Atualizações →
Biblioteca e leitura dos metadados persistidos. **PASS** nos dois
sistemas.

| Medição | Ubuntu 24.04 + Xvfb | Windows |
| --- | ---: | ---: |
| Biblioteca inicial renderizada | 6,61 s | 6,62 s |
| Navegação e validações completas | 10,83 s | 12,31 s |
| Working set aproximado do renderer | 1.514 MiB | 1.657 MiB |

O renderer ainda monta todos os cartões da biblioteca, o que explica o
alto consumo. **Virtualização/paginação de cartões é uma otimização
recomendada antes de garantir desempenho em computadores com pouca RAM.**
Os testes gráficos Linux foram executados com Xvfb e
`--no-sandbox` no runner; isso não certifica abertura normal sob
X11/Wayland, nem login/cookies de fontes reais.

### Reproduzir apenas os testes, sem empacotar

```sh
cd desktop
npm ci
npm run build
node test/heavy-backup-stress.cjs --profile=extreme
node test/heavy-backup-stress.cjs --profile=near-limit
```

Para a interface, instale o runtime do Electron com `npm run setup`,
então execute `npx electron test/huge-library-ui-smoke.cjs
--visual-preview` no Windows ou o comando equivalente com
`xvfb-run -a ... --no-sandbox` em um runner Linux isolado.

Workflows: `.github/workflows/giant-library-stress.yml` e
`.github/workflows/near-limit-backup-stress.yml`. Ambos geram apenas
código de teste transitório em `dist/`; **não produzem EXE, AppImage,
DEB ou releases**. O diretório de dados do aplicativo real não é
acessado pelos testes.
