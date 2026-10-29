# Histórico de versões

## 0.2.0 — 29/10/2026

- Backup ZIP mais rápido: arquivos binários são processados diretamente, sem conversões intermediárias para base64; ZIPs internos e capas não são recomprimidos.
- Restauração grava os arquivos diretamente no armazenamento verificado por hash, mantendo os limites, a validação dos caminhos e a compatibilidade com os formatos anteriores.
- Nova aba Atualizações: obras agrupadas por data, busca, filtro de não lidos, progresso da verificação, avisos por fonte e ações de leitura e download.
- Ícone de Atualizações com duas setas circulares.
- Leitor preserva o conteúdo da página ao atualizar o progresso, evitando reconstruções do texto durante a rolagem; barras começam recolhidas e se ocultam por tempo.
- Testes de volume com 7.000 obras e 143.980 capítulos, falhas de rede simuladas e validação de um ZIP real do LNReader.

Na comparação local de três execuções por versão, as medianas foram:

| Cenário                                                    | Antes   | 0.2.0   |
| ---------------------------------------------------------- | ------- | ------- |
| Exportação com 7.000 obras e 64 MiB de arquivos            | 4,14 s  | 2,33 s  |
| Restauração desse backup                                   | 2,31 s  | 2,08 s  |
| Pico de memória do processo de benchmark, incluindo worker | 697 MiB | 616 MiB |

Resultados dependem do computador e do conteúdo. Os arquivos aleatórios do teste têm pouca compressibilidade; capítulos HTML podem ter comportamento diferente. O formato ZIP continua sendo o mesmo, com CRC e verificação dos dados mantidos.

Limitações conhecidas: limite de 512 MiB para backups, consumo elevado de memória em bibliotecas extremas e fontes que exigem Cloudflare/login interativo. Aplicativo e instalador ainda não possuem assinatura digital confiável; o Controle Inteligente de Aplicativos do Windows pode impedir a execução. O repositório continua privado e a versão é experimental.

## 0.1.0

- Port inicial para Windows, biblioteca, fontes, leitura, downloads e backups compatíveis com LNReader.
