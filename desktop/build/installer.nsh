!macro customCheckAppRunning
  !insertmacro IS_POWERSHELL_AVAILABLE
  ${Do}
    !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
    ${If} $R0 != 0
      ${ExitDo}
    ${EndIf}
    ${If} ${Silent}
      SetErrorLevel 2
      Quit
    ${EndIf}
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "Feche o LNReader Desktop antes de continuar. Se não houver janela aberta, finalize LNReader Desktop no Gerenciador de Tarefas." /SD IDCANCEL IDRETRY +2
    Quit
  ${Loop}
!macroend
