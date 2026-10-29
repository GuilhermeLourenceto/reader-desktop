# Instalador Windows 0.1.0

A detecção prioriza o caminho da instalação com PowerShell/CIM. Se esse recurso não estiver disponível, verifica o nome do executável apenas na sessão do usuário atual; uma cópia com o mesmo nome em outra pasta ou sessão não deve bloquear a instalação.

O reparo experimental do desinstalador 2.1.5 foi removido após falhar no computador do usuário. A instalação antiga e seus registros foram removidos com autorização, mantendo a biblioteca em Roaming, o backup ZIP e o código.

O instalador usa o fluxo padrão do electron-builder. O teste `test/installer-smoke.ps1` confirma que uma cópia com o mesmo nome fora da pasta de destino não bloqueia a instalação, que o aplicativo instalado em execução bloqueia a substituição e que os arquivos antigos permanecem intactos.
