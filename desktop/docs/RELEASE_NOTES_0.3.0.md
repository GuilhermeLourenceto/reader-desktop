# LNReader Desktop v0.3.0 — Beta

Esta é uma versão **experimental para Windows**. O projeto Desktop passa a ocupar a branch principal (`main`) e não precisa do Android para compilar.

### Novidades
- Interface e biblioteca mais organizadas, com histórico, categorias, busca, filtros e aba de atualizações.
- Downloads de capítulos para leitura offline, marcadores, progresso e backups ZIP no formato LNReader.
- Melhor isolamento das fontes e sessões de login, recuperação de erros e autenticação interativa quando necessário.
- Estrutura independente em `desktop/`, documentação ampliada e módulos da interface separados.
- Validação automatizada do instalador Windows, 45 testes unitários e 10 jornadas de usuário.

### Instalação
Baixe o arquivo `LNReader Desktop Setup 0.3.0.exe` nos anexos desta Release e execute no Windows 10/11. O instalador ainda **não é assinado digitalmente**.

### Limitações conhecidas
- Algumas fontes podem falhar, exigir login ou apresentar bloqueio Cloudflare; a compatibilidade não é garantida.
- A versão Linux ainda exige validação com usuários reais.
- Segurança: há um alerta de vulnerabilidade alta de dependências e a proteção contra DNS rebinding ainda precisa ser reforçada.
- Antes de restaurar um backup pessoal, mantenha uma cópia de segurança. Esta versão não é estável nem oficial do LNReader Android.

O código Android anterior permanece recuperável no histórico do repositório. A branch `seguranca-e-estabilidade` também foi preservada.
