# Política de segurança — LNReader Desktop

O projeto ainda é **experimental**. Não há compromisso de suporte a versões
antigas e o instalador Windows não possui assinatura digital de distribuição.

## Como reportar

Se o recurso **Report a vulnerability** estiver habilitado em **Security** no
GitHub, use o relatório privado de segurança do repositório. Caso não esteja
disponível, evite publicar detalhes exploráveis, tokens, cookies ou dados
pessoais em uma issue pública. Solicite primeiro um canal privado de contato
com os responsáveis pelo repositório.

Ao reportar, descreva a versão, o sistema operacional, os passos de reprodução,
o impacto e se a falha depende de uma extensão de terceiros. Remova qualquer
informação sensível de logs e capturas.

## Limites de confiança

Extensões executam JavaScript de terceiros em Web Workers, com pontes
controladas para rede e arquivos, mas workers **não são uma sandbox de
processo do sistema operacional**. Instale apenas extensões confiáveis.
Backups podem conter conteúdo e metadados pessoais; mantenha cópias de
segurança antes de importar arquivos desconhecidos.

A documentação de revisão técnica está em
[desktop/docs/COMPATIBILIDADE-SEGURANCA.md](desktop/docs/COMPATIBILIDADE-SEGURANCA.md).
