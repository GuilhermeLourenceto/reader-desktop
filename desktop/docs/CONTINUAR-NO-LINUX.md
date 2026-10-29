# Continuar o port no Linux

Pedido do usuário: priorizar Windows agora e concluir Linux depois, usando
esta mesma pasta de código. Não é necessário recriar o app ou reescrever as fontes.

## Estado entregue

- Port experimental Electron em `desktop/`, sem alterar o motor original
  de fontes em `src/plugins/`.
- Interface React desktop, biblioteca, busca, instalação/atualização de fontes,
  leitor, texto offline e importação/exportação ZIP dos formatos Android v1/v2.
- Código multiplataforma usa `node:path`, `app.getPath('userData')` e APIs
  Electron. Não depende de PowerShell, caminhos Windows ou módulos nativos Android.
- Instalador Windows NSIS; alvos Linux AppImage e deb configurados.
- `desktop/package-lock.json` permite instalação independente. Não copiar
  `node_modules` ou `release/win-unpacked` do Windows para Linux.
- `desktop/README.md` descreve a arquitetura e limitações conhecidas.

## Próximos passos no Linux

1. Copiar o repositório inteiro, incluindo `src/`, `desktop/`, `LICENSE` e
   `.github/`. Não copiar apenas `desktop/`: o build importa arquivos originais
   da pasta `src/` da raiz.
2. Usar Node.js 24. Na pasta `desktop`, executar `npm ci`, `npm run setup`,
   `npm run build`, `npm test` e `npm start`.
3. Executar `npm run test:smoke` em uma sessão gráfica comum. Para CI,
   `xvfb-run -a npx electron --no-sandbox test/smoke.cjs` usa sandbox desabilitado
   apenas no runner de teste. Não remover o sandbox da aplicação distribuída.
4. Conferir dependências de sistema do Electron, sandbox do Chromium,
   permissão de execução e FUSE para AppImage na distribuição escolhida.
5. Rodar `npm run dist:linux`; instalar/testar tanto `.deb` quanto `.AppImage`.
6. Validar dialogs, HTTP/cookies, persistência após reiniciar e leitura offline.
7. Testar cópias de backups Android reais v1/v2 e pelo menos algumas fontes reais.
   Os testes atuais usam arquivos e uma fonte local de teste, não validam todas
   as fontes disponíveis. Verificar imagens locais, categorias, IDs e progresso.
8. A automação `desktop.yml` executa Windows por padrão. Em `workflow_dispatch`,
   marque `include_linux` para habilitar Ubuntu. Só tornar Linux obrigatório
   depois de conferir os resultados e os instaladores.

## Pontos a manter explícitos

Este port não tem paridade completa com Android. Não há login interativo/
Cloudflare, TTS, nuvem, rastreadores, EPUB, download em lote ou tarefas com o
app fechado. Configurações Android são preservadas no backup, mas nem todas
têm efeito no desktop. O armazenamento JSON/base64 limita bibliotecas grandes.
Plugins são código de terceiros executado no renderer; confiar no repositório
continua necessário. Scripts `custom.js` e `custom.css` são preservados, sem
execução no leitor.
