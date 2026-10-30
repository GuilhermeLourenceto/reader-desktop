## LNReader Desktop 0.4.5 Beta — biblioteca mais prática

### Interface e seleção no PC
- Categorias acessíveis dentro do **mesmo painel** de filtros, sem abas redundantes.
- Filtros por categoria e estado (todas, não lidas, baixadas), busca por título/autor, ordenação original, A–Z, Z–A e por quantidade de capítulos.
- Caixa de seleção removida das capas. Seleção via clique direito; suporte a **Ctrl/Cmd+clique**, **Shift+clique**, **Ctrl/Cmd+A**, **Esc** e **Ctrl/Cmd+F** na biblioteca.
- **Selecionar todos** inclui obras correspondentes ao filtro, mesmo as não renderizadas pela biblioteca virtualizada.
- Ao alterar os critérios, uma seleção oculta é limpa para evitar ações em lote acidentais. Os temas claro/escuro e as nove paletas continuam aplicados a menus e controles.

### Tradução e consistência
- Novos menus, filtros, ordenação e mensagens de seleção traduzidos para os dez idiomas suportados.
- Corrigidas frases dinâmicas de posição de capítulo e contagens que antes ficavam parcialmente em português.
- Nomes de obras e categorias personalizadas são preservados, sem tradução de conteúdo do usuário.

### Testes automatizados
- **Windows e Ubuntu:** filtros e ordenação sobre 10.000 obras e 200.000 capítulos, interseção de categoria com itens baixados (500 obras), seleção em massa e limite de cartões renderizados.
- **Windows e Linux:** testes reais da interface em dez idiomas, menus e categorias personalizadas; temas, paletas e casos de navegação.
- **Layout:** testes adicionais com janelas de 800, 1024 e 1440 px, incluindo detecção de sobreposição e rolagem horizontal inesperada.
- **Configurações:** tema/paleta, capas, controles do leitor, persistência após recarregar, modo anônimo e restauração dos padrões sem apagar a biblioteca.
- Testes de leitura, fontes, backup e empacotamento permanecem obrigatórios. A publicação desta release ocorre somente depois de todos os jobs obrigatórios concluírem com sucesso na `main`.

### Limitações
Versão **beta**, sem assinatura digital. O Linux ainda requer testes de instalação manual em sessões reais do Linux Mint/X11/Wayland. Bibliotecas extremas ainda mantêm metadados na RAM; a virtualização reduz principalmente componentes da interface. Fontes externas podem exigir autenticação ou ser bloqueadas por sites. Backups têm limite de 512 MiB.

Recomendamos manter um backup antes de atualizar. A v0.4.4 continua disponível.
