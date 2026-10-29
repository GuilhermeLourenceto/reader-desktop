# Compatibilidade sem perder o isolamento

Avaliação da branch `seguranca-e-estabilidade` em 29/10/2026.

## Objetivo

Reduzir bloqueios desnecessários de fontes legítimas sem voltar ao modelo anterior, no qual fontes tinham uma sessão HTTP compartilhada.

### Ajustes de compatibilidade

- Requisições associadas a uma fonte usam a **mesma sessão persistente de cookies** da janela de login dessa fonte.
- Se a extensão não definir um User-Agent, a ponte HTTP utiliza o **User-Agent dessa sessão**. Um User-Agent explícito da extensão continua tendo prioridade.
- Tempo limite HTTP aumentado moderadamente de **30 para 38 segundos**. O limite de execução das operações da fonte continua em **45 segundos**.
- A janela interativa permite até **três janelas secundárias de autenticação** para sites e provedores HTTP(S) públicos, incluindo `about:blank` inicial que scripts de login podem usar. Janelas secundárias não têm Node.js, preload ou permissões do aplicativo e são fechadas junto com o login.
- A autenticação ocorre somente após uma ação do usuário. A interface oferece uma opção para verificar o acesso quando a fonte comunica HTTP 403/Cloudflare e tenta carregar novamente depois de fechar a janela.

### Proteções mantidas

- Fontes executam em **Web Workers**, sem DOM do aplicativo nem acesso direto ao Node.js.
- Acesso de arquivo de cada fonte limitado à pasta `Plugins/<id>/`; IPC sob validação.
- Janela principal permanece sandboxed; janelas de login e secundárias também.
- Cookies e autenticação segregados por fonte; uma fonte não recebe automaticamente os cookies das outras.
- Em builds distribuídos, endereços locais/privados explícitos continuam bloqueados para extensões. O bloqueio também é aplicado aos redirecionamentos.
- Limites de tamanho de respostas, requisições simultâneas e cancelamento preservados.
- Nada de desativar TLS, executar código de fontes no processo principal ou remover verificações de origem.

### Limitações conhecidas

1. A validação de hostname protege IPs internos **explícitos**, mas exige reforço contra DNS que resolva para IP privado ou DNS rebinding.
2. Desafios Cloudflare podem rejeitar navegadores embutidos ou exigir passos que um teste sem interação humana não reproduz. **Não há promessa de bypass**, somente suporte a uma sessão real de navegador com cookies.
3. O teste de integração com servidor HTTP local valida a arquitetura de login, **não** valida acesso à Central Novel nem seu próprio Cloudflare.
4. Instabilidade transitória, DNS, TLS e HTTP 5xx do site externo não devem ser tratados automaticamente como regressões da extensão.

## Evidências de regressão

A matriz `desktop/test/source-matrix.cjs` instala e tenta navegar/ler nove fontes reais, sem acessar perfis pessoais. A cobertura de 29/10/2026 foi:

- **Novel Mania**, **Royal Road**, **NovelFull**, **Hasu Translations**, **NovelDeGlace**: leitura concluída em pelo menos uma rodada anterior.
- **Central Novel**: HTTP 403; implementação exige teste interativo de verificação no próprio computador.
- **Kiniga**: TLS do site indisponível no ambiente de CI.
- **Better Novels**: erro DNS no ambiente de CI.
- **Scribble Hub**: listagem vazia; causa inconclusiva.

**Importante:** resultados são amostras pontuais. O mesmo site pode responder de forma diferente por IP, região, horário, conta e perfil de sessão.

## Antes do lançamento público

Testar login real de Central Novel no Windows e Linux, persistência de cookies após reiniciar, restauração dos dados do usuário, URLs redirecionadas e dependências com avisos de segurança. Não fundir esta branch automaticamente.
