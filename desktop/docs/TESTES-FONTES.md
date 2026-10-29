# Matriz de compatibilidade de fontes — segurança e autenticação

Catálogo oficial de referência (v3):
https://raw.githubusercontent.com/LNReader/lnreader-plugins/plugins/v3.0.0/.dist/plugins.min.json

O catálogo fornece metadados de fontes, **não prova que seus sites estejam online**.
Fonte indisponível temporariamente não deve ser classificada como bug no port.

## Como avaliar

1. Instalar extensão a partir dos metadados oficiais.
2. Abrir populares e buscar por título.
3. Abrir detalhes e listar capítulos; paginar quando disponível.
4. Ler capítulo, salvar offline e reler sem rede.
5. Se houver login, abrir **Entrar** e conferir que cookies persistem na mesma fonte, sem aparecer em outras fontes.
6. Se o site exigir Cloudflare, registrar separadamente página de desafio, cookie obtido e resultado da leitura. Alguns sites bloqueiam navegadores incorporados mesmo com login legítimo.
7. Repetir falhas transitórias antes de concluir incompatibilidade; nunca desativar validação TLS nem aplicar bypass de CAPTCHA.

## Resultado por fonte

Registrar: fonte/ID, versão, data/hora, operação, status HTTP quando houver, mensagem, redirecionamento, necessidade de login, necessidade de Cloudflare e classificação.

Classificação:
- **Compatível**: instalar, listar, detalhar e ler confirmados.
- **Parcial**: algumas operações funcionam; outras exigem login, WebView ou recursos adicionais.
- **Indisponível**: DNS, TLS, HTTP 5xx, site fora do ar ou bloqueio de região. Repetir mais tarde.
- **Desafio/autenticação**: login, Cloudflare ou OAuth pendentes. Não marcar como falha da extensão sem verificar.
- **Incompatibilidade reproduzível**: falha repetida com site acessível, registrando o contrato de API e erro real.
- **Segurança**: operação bloqueada por política, registrar destino e verificar se a fonte é legítima.

## Cobertura do catálogo

Para o primeiro beta, amostrar:
- Fontes em português, inglês e outros idiomas.
- Sem login e com login por cookies.
- Sites com e sem desafios Cloudflare.
- Fontes com paginação, redirecionamentos, imagens e leitura offline.
- Sites online e offline temporariamente.
- Fontes que usem domínios distintos para site, CDN e autenticação.

Priorizar fontes com falhas reproduzíveis e registrar detalhes antes de criar exceção.
Nunca fazer login automaticamente, automatizar resolução de CAPTCHA, nem armazenar senhas no código ou logs.

## Estado da implementação

A branch `seguranca-e-estabilidade` introduz uma primeira versão de sessões por fonte e janela de login, além de validação de destinos HTTP. **Isso não constitui suporte verificado a Cloudflare**. É necessário testar o fluxo real da janela de autenticação, cookies, redirecionamentos e encerramento da sessão. A política de URL protege endereços explícitos; requer revisão adicional para impedir resolução DNS para rede local/rebinding, e testes em diferentes plataformas.

Os testes de unidade da política de rede não substituem os testes Electron nem o funcionamento real dos sites.
