## Novidades

- **Primeira versão beta para Linux x64:** pacotes **AppImage** (portátil) e **DEB** (Ubuntu, Linux Mint e derivados), além do instalador Windows 10/11 x64.
- **Desktop independente do Android:** corrigido o gerador de ícones e reforçados os testes que impedem referências a arquivos fora de `desktop/`. O SDK original necessário permanece versionado em `desktop/vendor/lnreader/`.
- **Backups com ordem preservada:** exportações v2 do Desktop incluem um campo opcional de ordem no `Version.json`; restaurações passam a reproduzir a sequência original de obras. Backups v2 antigos continuam aceitos; o limite de 512 MiB permanece.

## Testes automatizados

- Windows e Ubuntu 24.04: compilação isolada, testes de portabilidade, biblioteca com **18.000 obras e 473.174 capítulos**, backup de 331 MiB, exportação e duas importações com integridade verificada.
- Backup de **475,70 MiB** testado em ambos os sistemas, incluindo rejeição acima de 512 MiB.
- Interface Electron com **10.000 obras e 200.000 capítulos**, incluindo navegação e persistência.
- A publicação da v0.4.3 só ocorre após os testes obrigatórios e a geração/inspeção dos pacotes de ambos os sistemas concluírem com sucesso no GitHub Actions.

## Limitações conhecidas

Esta é uma **versão beta**, não uma versão estável. O Linux ainda precisa de validação manual de instalação e execução em sessões X11/Wayland reais, especialmente no Linux Mint, além de testes com fontes e backups Android reais. Os testes gráficos Linux automatizados usam Xvfb e não comprovam todos esses cenários.

Bibliotecas extremas ainda consomem muita memória (renderização sem virtualização); algumas fontes externas podem exigir login ou sofrer bloqueio de sites. AppImage pode precisar de compatibilidade com FUSE em algumas distribuições. Os binários não têm assinatura digital. Os backups seguem limitados a 512 MiB; a proteção contra DNS rebinding também não está demonstrada como definitiva.

**Atualização:** recomenda-se fazer backup dos seus dados antes de migrar e testar primeiro com uma cópia do backup Android.
