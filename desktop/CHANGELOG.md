# Histórico de versões

## 0.4.5 Beta — biblioteca desktop, filtros, seleção e temas

- Categorias no painel de filtro; removidas as abas redundantes da biblioteca.
- Busca por autor/título, filtros de estado, ordenação e limpeza de filtros.
- Seleção de livros com botão direito, Ctrl/Cmd+clique, Shift+clique, Ctrl/Cmd+A, Esc e Ctrl/Cmd+F para pesquisa, incluindo obras fora da janela virtualizada.
- Menus e filtros seguem os dez idiomas, paletas e temas; correções em contadores traduzidos.
- Regressões automatizadas em Windows/Linux para 10 mil livros, filtros combinados, tradução, nove paletas e layout em tamanhos diferentes, além de persistência das configurações.

Consulte [as notas de v0.4.5](docs/RELEASE_NOTES_0.4.5.md). Versão beta; a 0.4.4 permanece disponível.


## 0.4.4 Beta — Biblioteca leve no Windows e Linux

- Virtualização dos cartões da biblioteca para coleções com mais de 100 obras: mantém no DOM apenas a área visível e uma margem de três linhas.
- Melhorias no processamento de filtros, categorias e seleção, sem remover funcionalidades existentes.
- Testes automatizados em Windows e Linux para rolagem completa, pesquisa, mudança de aba e integridade com 10.000 obras e 200.000 capítulos.
- Sem alterações no formato de backups, nos arquivos do SDK Android ou na biblioteca armazenada. O uso de memória dos metadados ainda existe.

Consulte [as notas de v0.4.4](docs/RELEASE_NOTES_0.4.4.md). Versão beta, sem assinatura digital.


## 0.4.3 Beta — Windows e Linux

- Primeira distribuição experimental para Linux x64, em AppImage e DEB, junto do instalador Windows.
- Correção do gerador de ícones e auditoria de caminhos externos: a compilação Desktop usa somente os recursos em `desktop/`, sem remover o SDK original versionado.
- Ordem exata das obras preservada na exportação e restauração de backups v2 do Desktop (propriedade opcional `desktopNovelOrder` em `Version.json`). Backups antigos continuam compatíveis.
- Testes automatizados Windows/Linux de bibliotecas com 18 mil obras e 473 mil capítulos, backups de até 475,70 MiB e interface com 10 mil obras.
- Novos testes de inspeção dos pacotes Linux e de portabilidade independente do Android.

**Limitações:** a versão Linux ainda carece de validação manual de AppImage e DEB em sessão gráfica real, especialmente Linux Mint/Wayland; os testes automatizados usam Ubuntu e Xvfb. O consumo de memória é alto em bibliotecas extremas. O limite de 512 MiB para backups permanece. Distribuições sem dependências FUSE podem precisar de ajustes para executar AppImage. Beta sem assinatura digital.


## 0.4.2 Beta

- Nova opção para **restaurar as configurações padrão** de aparência, biblioteca e leitor, mediante confirmação. Livros, fontes, downloads, progresso e histórico são preservados.
- A roda do mouse passa a rolar as listas de obras mesmo quando o cursor está nas laterais da janela, fora da coluna central.
- Testes automatizados para restauração de preferências e rolagem do catálogo.

Versão beta para Windows 10/11 x64. Fontes externas podem exigir login e apresentar bloqueios dos sites.


## 0.4.1 Beta

- Corrigida a falha que bloqueava as fontes na verificação DNS, mesmo quando o domínio tinha endereço público válido.
- Verificação de DNS realizada na própria sessão usada pela fonte, sem interferir nas sessões de outras fontes.
- Mantido o bloqueio de endereços locais e privados e a checagem de redirecionamentos.
- Melhorada a verificação de compatibilidade de fontes.

Versão experimental para Windows 10/11 x64. Algumas fontes exigem autenticação ou podem ser bloqueadas pelo site.


## 0.4.0 Beta

- Destaque uniforme na linha inteira do capítulo ao passar o mouse, incluindo seleção e ações.
- Tela cheia para leitura com menos distrações.
- Busca global de obras em destaque na aba Fontes.
- Filtro por idioma nas fontes instaladas, no catálogo e na busca global.
- Interface em português, inglês, espanhol, francês, alemão, italiano, russo, japonês, coreano e chinês simplificado, com troca imediata e preferência salva.
- Datas, contadores, avisos e confirmações adaptados ao idioma escolhido.
- Ajuste de avanço da leitura com valor inicial de 50% e controle centralizado.
- Correções na conexão das fontes e proteção contra redirecionamentos para endereços privados, permitindo respostas DNS públicas válidas.

Versão experimental para Windows 10/11 x64. Algumas fontes podem exigir login ou apresentar bloqueios. O aplicativo ainda não possui assinatura digital confiável e pode ser bloqueado pelo Windows.

## 0.3.0 Beta — 29/10/2026

- O LNReader Desktop passa a ser o conteúdo principal da branch `main`; a versão Android anterior permanece no histórico Git.
- Projeto Desktop independente dentro de `desktop/`, com cópia versionada do motor de extensões, temas, arquivos de backup e recursos necessários.
- Melhoria de segurança e estabilidade das fontes: sessões/cookies isolados, autenticação interativa e recuperação de erros de rede.
- Melhorias na biblioteca, atualizações, leitor, downloads offline, progresso e backups compatíveis com LNReader.
- Interface dividida em módulos menores, documentação de contribuição, configurações de formatação e novos testes automatizados.
- Windows: compilação e instalador verificados em GitHub Actions (45 testes unitários e 10 jornadas de usuário aprovadas).

**Limitações:** algumas fontes ainda falham ou exigem desafios de autenticação; Linux não foi validado em uso real. Instalador sem assinatura digital. Há uma vulnerabilidade alta reportada pelo `npm audit` e a proteção contra DNS rebinding ainda precisa ser reforçada. Lançamento experimental, não estável.

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
