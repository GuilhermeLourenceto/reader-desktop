# Compatibilidade e isolamento das fontes

> **Origem histórica:** avaliação da antiga branch `seguranca-e-estabilidade` em
> 29/10/2026. A implementação atual é mantida na `main`. Os resultados de
> fontes externas abaixo representam aquela data, não uma certificação atual.
>
> **Código de referência:** `src/infrastructure/networkPolicy.cjs`,
> `src/request.cjs`, `src/sourceClient.js`, `src/main.cjs`.

## Objetivo

Reduzir bloqueios desnecessários de fontes legítimas sem voltar ao modelo anterior, no qual fontes tinham uma sessão HTTP compartilhada.

## Referência de segurança: LNReader Android

**Meta definida pelo mantenedor:** oferecer um nível prático de segurança comparável ao LNReader Android, privilegiando a compatibilidade com as fontes originais. Isso não equivale a copiar literalmente suas permissões ou remover proteções necessárias ao Electron.

No LNReader Android, o `src/plugins/pluginManager.ts` avalia as extensões JavaScript com `Function('require', 'module', ...)`, usando um `require` controlado; o isolamento nativo do Android protege o **aplicativo** em relação a outros aplicativos, mas não cria automaticamente um processo isolado por extensão. Portanto, a comparação precisa considerar as diferenças de plataforma.

**Política para o Desktop:**
- Preferir ajustes de compatibilidade a novos bloqueios, desde que não exponham os dados de outras fontes, a biblioteca pessoal ou o sistema operacional.
- Preservar sandbox do Electron, `contextIsolation`, Node.js desabilitado no conteúdo remoto, IPC validado e execução das fontes separada da interface.
- Permitir sites públicos, CDNs e provedores legítimos de login; compartilhar cookies apenas entre a janela de login e as requisições **da mesma fonte**.
- Não desativar TLS, não permitir acesso arbitrário ao disco ou rede local, nem executar extensões sem fronteira de confiança no processo principal.
- Se uma medida de segurança quebrar uma fonte legítima, ajustar a regra específica e adicionar teste de regressão; não liberar indiscriminadamente todas as fontes.

**Critério de aceite:** compatibilidade com extensões oficiais em patamar semelhante ao Android, sem regressões verificadas de leitura e com controles desktop proporcionais. Não afirmar que a segurança é idêntica: as superfícies de ataque de Android e Electron são diferentes.

### Ajustes de compatibilidade

- Requisições associadas a uma fonte usam a **mesma sessão persistente de cookies** da janela de login dessa fonte.
- Se a extensão não definir um User-Agent, a ponte HTTP utiliza o **User-Agent dessa sessão**. Um User-Agent explícito da extensão continua tendo prioridade.
- Tempo limite HTTP aumentado moderadamente de **30 para 38 segundos**. O limite de execução das operações da fonte continua em **45 segundos**.
- A janela interativa permite até **três janelas secundárias de autenticação** para provedores externos HTTPS e para o próprio site original, incluindo `about:blank` inicial que scripts de login podem usar. Janelas secundárias não têm Node.js, preload ou permissões do aplicativo e são fechadas junto com o login.
- A autenticação ocorre somente após uma ação do usuário. A interface oferece uma opção para verificar o acesso quando a fonte comunica HTTP 403/Cloudflare e tenta carregar novamente depois de fechar a janela.

### Proteções mantidas

- Fontes executam em **Web Workers**, sem DOM do aplicativo nem acesso direto ao Node.js.
- Acesso de arquivo de cada fonte limitado à pasta `Plugins/<id>/`; IPC sob validação.
- Janela principal permanece sandboxed; janelas de login e secundárias também.
- Cookies e autenticação segregados por fonte; uma fonte não recebe automaticamente os cookies das outras.
- Em builds distribuídos, endereços locais/privados explícitos são bloqueados para extensões. O destino de redirecionamentos também é validado. A ponte executa checagens de resolução DNS e recusa endereços resolvidos para redes privadas, quando o resolver da sessão está disponível.
- Limites de tamanho de respostas, requisições simultâneas e cancelamento preservados.
- Nada de desativar TLS, executar código de fontes no processo principal ou remover verificações de origem.

### Limitações conhecidas

1. **Situação atual:** `validateNetworkDns()` consulta e valida endereços resolvidos antes da chamada privilegiada; portanto a antiga lacuna de *somente verificar IP explícito* foi corrigida. Isso não elimina automaticamente todos os riscos de mudança de DNS entre verificação e conexão (*rebinding/TOCTOU*); manter testes de DNS, redirecionamentos e sessões reais por fonte.
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

## Verificações pendentes na `main`

Testar login real em fontes com desafio no Windows e Linux, persistência de cookies após reiniciar, exclusão de dados de sessão ao remover uma extensão, redirecionamentos e falhas DNS reais. A análise histórica desta branch já foi incorporada à `main`; não há merge pendente dessa branch. A falta de jobs de CI executados na revisão de 13/11/2026 impede afirmar que essa matriz foi revalidada.
