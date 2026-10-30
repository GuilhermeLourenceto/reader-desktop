const languages = [
  ['pt-BR', 'Português (Brasil)'],
  ['en', 'English'],
  ['es', 'Español'],
  ['fr', 'Français'],
  ['de', 'Deutsch'],
  ['it', 'Italiano'],
  ['ru', 'Русский'],
  ['ja', '日本語'],
  ['ko', '한국어'],
  ['zh-CN', '简体中文'],
];
const rows = `
Biblioteca|Library|Biblioteca|Bibliothèque|Bibliothek|Biblioteca|Библиотека|ライブラリ|서재|书库
Atualizações|Updates|Actualizaciones|Mises à jour|Aktualisierungen|Aggiornamenti|Обновления|更新|업데이트|更新
Histórico|History|Historial|Historique|Verlauf|Cronologia|История|履歴|기록|历史
Fontes|Sources|Fuentes|Sources|Quellen|Fonti|Источники|配信元|소스|书源
Mais|More|Más|Plus|Mehr|Altro|Ещё|その他|더보기|更多
Configurações|Settings|Ajustes|Paramètres|Einstellungen|Impostazioni|Настройки|設定|설정|设置
Restaurar configurações padrão|Restore default settings|Restaurar configuración predeterminada|Restaurer les paramètres par défaut|Standardeinstellungen wiederherstellen|Ripristina impostazioni predefinite|Восстановить настройки по умолчанию|設定を初期状態に戻す|기본 설정 복원|恢复默认设置
Voltar às preferências iniciais sem apagar suas obras ou fontes.|Restore initial preferences without deleting your novels or sources.|Volver a las preferencias iniciales sin borrar obras ni fuentes.|Rétablir les préférences initiales sans supprimer les romans ni les sources.|Ursprüngliche Einstellungen wiederherstellen, ohne Bücher oder Quellen zu löschen.|Ripristina le preferenze iniziali senza eliminare libri o fonti.|Вернуть исходные настройки без удаления книг или источников.|作品や配信元を削除せずに初期設定に戻します。|작품이나 소스를 삭제하지 않고 초기 설정으로 돌아갑니다.|恢复初始设置，不删除作品或书源。
Restaurar as configurações do aplicativo? Sua biblioteca, fontes, downloads, histórico e progresso serão mantidos.|Restore app settings? Your library, sources, downloads, history and reading progress will be kept.|¿Restaurar los ajustes de la aplicación? Se conservarán la biblioteca, las fuentes, las descargas, el historial y el progreso.|Restaurer les paramètres de l’application ? Votre bibliothèque, vos sources, téléchargements, historique et progression seront conservés.|App-Einstellungen zurücksetzen? Bibliothek, Quellen, Downloads, Verlauf und Lesefortschritt bleiben erhalten.|Ripristinare le impostazioni dell’app? Biblioteca, fonti, download, cronologia e progressi saranno mantenuti.|Сбросить настройки приложения? Библиотека, источники, загрузки, история и прогресс останутся без изменений.|アプリの設定を初期化しますか？ライブラリ、配信元、ダウンロード、履歴、読書の進捗は保持されます。|앱 설정을 초기화할까요? 서재, 소스, 다운로드, 기록과 읽기 진행률은 유지됩니다.|恢复应用设置？书库、书源、下载、历史记录和阅读进度将保留。
Configurações padrão restauradas.|Default settings restored.|Configuración predeterminada restaurada.|Paramètres par défaut restaurés.|Standardeinstellungen wiederhergestellt.|Impostazioni predefinite ripristinate.|Настройки по умолчанию восстановлены.|初期設定に戻しました。|기본 설정이 복원되었습니다.|已恢复默认设置。
Geral|General|General|Général|Allgemein|Generali|Общие|一般|일반|常规
Aparência|Appearance|Apariencia|Apparence|Darstellung|Aspetto|Оформление|外観|모양|外观
Leitor|Reader|Lector|Lecture|Leser|Lettore|Чтение|リーダー|뷰어|阅读器
Sobre|About|Acerca de|À propos|Über|Informazioni|О приложении|このアプリについて|앱 정보|关于
Backups|Backups|Copias de seguridad|Sauvegardes|Sicherungen|Backup|Резервные копии|バックアップ|백업|备份
Idioma da interface|Interface language|Idioma de la interfaz|Langue de l’interface|Sprache der Oberfläche|Lingua dell’interfaccia|Язык интерфейса|表示言語|인터페이스 언어|界面语言
Idioma das fontes|Source language|Idioma de las fuentes|Langue des sources|Sprache der Quellen|Lingua delle fonti|Язык источников|配信元の言語|소스 언어|书源语言
Idioma|Language|Idioma|Langue|Sprache|Lingua|Язык|言語|언어|语言
Todos os idiomas|All languages|Todos los idiomas|Toutes les langues|Alle Sprachen|Tutte le lingue|Все языки|すべての言語|모든 언어|所有语言
Aplicar|Apply|Aplicar|Appliquer|Anwenden|Applica|Применить|適用|적용|应用
Fechar|Close|Cerrar|Fermer|Schließen|Chiudi|Закрыть|閉じる|닫기|关闭
Cancelar|Cancel|Cancelar|Annuler|Abbrechen|Annulla|Отмена|キャンセル|취소|取消
Salvar|Save|Guardar|Enregistrer|Speichern|Salva|Сохранить|保存|저장|保存
Adicionar|Add|Añadir|Ajouter|Hinzufügen|Aggiungi|Добавить|追加|추가|添加
Remover|Remove|Eliminar|Retirer|Entfernen|Rimuovi|Удалить|削除|제거|移除
Abrir|Open|Abrir|Ouvrir|Öffnen|Apri|Открыть|開く|열기|打开
Baixar|Download|Descargar|Télécharger|Herunterladen|Scarica|Скачать|ダウンロード|다운로드|下载
Buscar|Search|Buscar|Rechercher|Suchen|Cerca|Найти|検索|검색|搜索
Buscar obras|Search novels|Buscar novelas|Rechercher des romans|Romane suchen|Cerca romanzi|Поиск книг|作品を検索|작품 검색|搜索作品
Gerenciar fontes|Manage sources|Gestionar fuentes|Gérer les sources|Quellen verwalten|Gestisci fonti|Управление источниками|配信元を管理|소스 관리|管理书源
Carregar repositórios|Load repositories|Cargar repositorios|Charger les dépôts|Repositorys laden|Carica repository|Загрузить репозитории|リポジトリを読み込む|저장소 불러오기|加载仓库
Repositórios|Repositories|Repositorios|Dépôts|Repositorys|Repository|Репозитории|リポジトリ|저장소|仓库
Instaladas|Installed|Instaladas|Installées|Installiert|Installate|Установленные|インストール済み|설치됨|已安装
Disponíveis|Available|Disponibles|Disponibles|Verfügbar|Disponibili|Доступные|利用可能|사용 가능|可用
Entrar|Sign in|Iniciar sesión|Se connecter|Anmelden|Accedi|Войти|ログイン|로그인|登录
Instalar|Install|Instalar|Installer|Installieren|Installa|Установить|インストール|설치|安装
Desinstalar|Uninstall|Desinstalar|Désinstaller|Deinstallieren|Disinstalla|Удалить|アンインストール|설치 제거|卸载
Atualizar|Update|Actualizar|Mettre à jour|Aktualisieren|Aggiorna|Обновить|更新|업데이트|更新
Pesquisar fontes|Search sources|Buscar fuentes|Rechercher des sources|Quellen suchen|Cerca fonti|Поиск источников|配信元を検索|소스 검색|搜索书源
Pesquisar fontes por nome ou idioma|Search sources by name or language|Buscar fuentes por nombre o idioma|Rechercher par nom ou langue|Quellen nach Name oder Sprache suchen|Cerca fonti per nome o lingua|Поиск источников по названию или языку|名前または言語で配信元を検索|이름 또는 언어로 소스 검색|按名称或语言搜索书源
Buscar obras em todas as fontes|Search all sources|Buscar en todas las fuentes|Rechercher dans toutes les sources|Alle Quellen durchsuchen|Cerca in tutte le fonti|Поиск во всех источниках|すべての配信元から検索|모든 소스에서 검색|搜索所有书源
Buscar em todas as fontes|Search all sources|Buscar en todas las fuentes|Rechercher dans toutes les sources|Alle Quellen durchsuchen|Cerca in tutte le fonti|Поиск во всех источниках|すべての配信元から検索|모든 소스에서 검색|搜索所有书源
Buscar em todas|Search all|Buscar en todas|Rechercher partout|Überall suchen|Cerca ovunque|Искать везде|すべて検索|전체 검색|全部搜索
Nome da obra|Novel title|Título de la obra|Titre du roman|Romantitel|Titolo del romanzo|Название книги|作品名|작품 제목|作品名称
Buscar obras nas|Search across|Buscar en|Rechercher dans|Suchen in|Cerca tra|Поиск по|検索対象：|검색 대상:|搜索范围：
fontes instaladas|installed sources|fuentes instaladas|sources installées|installierten Quellen|fonti installate|установленным источникам|インストール済みの配信元|설치된 소스|已安装书源
Pesquisando nas fontes…|Searching sources…|Buscando en las fuentes…|Recherche dans les sources…|Quellen werden durchsucht…|Ricerca nelle fonti…|Поиск по источникам…|配信元を検索中…|소스 검색 중…|正在搜索书源…
resultado(s)|results|resultados|résultats|Ergebnisse|risultati|результатов|件|개 결과|个结果
Carregando fonte|Loading source|Cargando fuente|Chargement de la source|Quelle wird geladen|Caricamento della fonte|Загрузка источника|配信元を読み込み中|소스 불러오는 중|正在加载书源
Aguardando fonte|Waiting for source|Esperando la fuente|En attente de la source|Warten auf Quelle|In attesa della fonte|Ожидание источника|配信元の応答待ち|소스 응답 대기 중|等待书源响应
Tentar novamente|Try again|Reintentar|Réessayer|Erneut versuchen|Riprova|Повторить|再試行|다시 시도|重试
Tentar esta fonte novamente|Retry this source|Reintentar esta fuente|Réessayer cette source|Diese Quelle erneut versuchen|Riprova questa fonte|Повторить для этого источника|この配信元で再試行|이 소스 다시 시도|重试此书源
Carregar mais desta fonte|Load more from this source|Cargar más de esta fuente|Charger plus depuis cette source|Mehr aus dieser Quelle laden|Carica altro da questa fonte|Загрузить ещё из этого источника|この配信元からさらに読み込む|이 소스에서 더 불러오기|加载此书源的更多结果
Nenhuma obra encontrada nesta fonte.|No novels found in this source.|No se encontraron obras en esta fuente.|Aucun roman trouvé dans cette source.|Keine Romane in dieser Quelle gefunden.|Nessun romanzo trovato in questa fonte.|В этом источнике книги не найдены.|この配信元に作品が見つかりません。|이 소스에서 작품을 찾을 수 없습니다.|此书源中未找到作品。
Instale ao menos uma fonte para pesquisar obras.|Install at least one source to search for novels.|Instala al menos una fuente para buscar obras.|Installez au moins une source pour rechercher des romans.|Installiere mindestens eine Quelle, um Romane zu suchen.|Installa almeno una fonte per cercare romanzi.|Установите хотя бы один источник для поиска книг.|作品を検索するには配信元をインストールしてください。|작품을 검색하려면 소스를 하나 이상 설치하세요.|请至少安装一个书源以搜索作品。
Pesquisar na biblioteca|Search library|Buscar en la biblioteca|Rechercher dans la bibliothèque|Bibliothek durchsuchen|Cerca nella biblioteca|Поиск в библиотеке|ライブラリを検索|서재 검색|搜索书库
Filtrar biblioteca|Filter library|Filtrar biblioteca|Filtrer la bibliothèque|Bibliothek filtern|Filtra biblioteca|Фильтр библиотеки|ライブラリを絞り込む|서재 필터|筛选书库
Mostrar|Show|Mostrar|Afficher|Anzeigen|Mostra|Показать|表示|표시|显示
Todas as obras|All novels|Todas las obras|Tous les romans|Alle Romane|Tutti i romanzi|Все книги|すべての作品|모든 작품|全部作品
Todas|All|Todas|Toutes|Alle|Tutte|Все|すべて|전체|全部
Todos|All|Todos|Tous|Alle|Tutti|Все|すべて|전체|全部
Com capítulos não lidos|With unread chapters|Con capítulos sin leer|Avec des chapitres non lus|Mit ungelesenen Kapiteln|Con capitoli non letti|С непрочитанными главами|未読の章がある作品|읽지 않은 장이 있는 작품|有未读章节
Com capítulos baixados|With downloaded chapters|Con capítulos descargados|Avec des chapitres téléchargés|Mit heruntergeladenen Kapiteln|Con capitoli scaricati|Со скачанными главами|ダウンロード済みの章がある作品|다운로드한 장이 있는 작품|有已下载章节
Selecionar visíveis|Select visible|Seleccionar visibles|Sélectionner les éléments affichés|Sichtbare auswählen|Seleziona visibili|Выбрать видимые|表示中の作品を選択|표시된 항목 선택|选择可见项
Baixar selecionadas|Download selected|Descargar seleccionadas|Télécharger la sélection|Auswahl herunterladen|Scarica selezionate|Скачать выбранное|選択した作品をダウンロード|선택 항목 다운로드|下载所选作品
Remover selecionadas|Remove selected|Eliminar seleccionadas|Retirer la sélection|Auswahl entfernen|Rimuovi selezionate|Удалить выбранное|選択した作品を削除|선택 항목 제거|移除所选作品
Cancelar seleção|Cancel selection|Cancelar selección|Annuler la sélection|Auswahl aufheben|Annulla selezione|Отменить выбор|選択を解除|선택 취소|取消选择
Resetar leitura|Reset reading progress|Restablecer progreso|Réinitialiser la progression|Lesefortschritt zurücksetzen|Azzera progressi di lettura|Сбросить прогресс чтения|読書の進捗をリセット|읽기 진행 초기화|重置阅读进度
Sua biblioteca está vazia|Your library is empty|Tu biblioteca está vacía|Votre bibliothèque est vide|Deine Bibliothek ist leer|La tua biblioteca è vuota|Ваша библиотека пуста|ライブラリは空です|서재가 비어 있습니다|书库为空
Explorar fontes|Browse sources|Explorar fuentes|Parcourir les sources|Quellen erkunden|Esplora fonti|Обзор источников|配信元を見る|소스 둘러보기|浏览书源
Abrir obra|Open novel|Abrir obra|Ouvrir le roman|Roman öffnen|Apri romanzo|Открыть книгу|作品を開く|작품 열기|打开作品
Selecionar obra|Select novel|Seleccionar obra|Sélectionner le roman|Roman auswählen|Seleziona romanzo|Выбрать книгу|作品を選択|작품 선택|选择作品
Remover da biblioteca|Remove from library|Quitar de la biblioteca|Retirer de la bibliothèque|Aus Bibliothek entfernen|Rimuovi dalla biblioteca|Удалить из библиотеки|ライブラリから削除|서재에서 제거|从书库移除
Adicionar à biblioteca|Add to library|Añadir a la biblioteca|Ajouter à la bibliothèque|Zur Bibliothek hinzufügen|Aggiungi alla biblioteca|Добавить в библиотеку|ライブラリに追加|서재에 추가|加入书库
Na biblioteca|In library|En la biblioteca|Dans la bibliothèque|In der Bibliothek|In biblioteca|В библиотеке|ライブラリに追加済み|서재에 있음|已加入书库
Voltar à biblioteca|Back to library|Volver a la biblioteca|Retour à la bibliothèque|Zurück zur Bibliothek|Torna alla biblioteca|Назад в библиотеку|ライブラリに戻る|서재로 돌아가기|返回书库
Continuar leitura|Continue reading|Continuar leyendo|Reprendre la lecture|Weiterlesen|Continua a leggere|Продолжить чтение|続きを読む|계속 읽기|继续阅读
Atualizar capítulos|Refresh chapters|Actualizar capítulos|Actualiser les chapitres|Kapitel aktualisieren|Aggiorna capitoli|Обновить главы|章を更新|장 새로고침|刷新章节
Baixar próximos 10|Download next 10|Descargar los siguientes 10|Télécharger les 10 suivants|Nächste 10 herunterladen|Scarica i prossimi 10|Скачать следующие 10|次の10章をダウンロード|다음 10개 다운로드|下载后续10章
Capítulos|Chapters|Capítulos|Chapitres|Kapitel|Capitoli|Главы|章|장|章节
capítulos|chapters|capítulos|chapitres|Kapitel|capitoli|глав|章|장|章
Capítulos baixados|Downloaded chapters|Capítulos descargados|Chapitres téléchargés|Heruntergeladene Kapitel|Capitoli scaricati|Скачанные главы|ダウンロード済みの章|다운로드한 장|已下载章节
Capítulos não lidos|Unread chapters|Capítulos sin leer|Chapitres non lus|Ungelesene Kapitel|Capitoli non letti|Непрочитанные главы|未読の章|읽지 않은 장|未读章节
Não lidos|Unread|Sin leer|Non lus|Ungelesen|Non letti|Непрочитанные|未読|읽지 않음|未读
Lidos|Read|Leídos|Lus|Gelesen|Letti|Прочитанные|既読|읽음|已读
Não lido|Unread|Sin leer|Non lu|Ungelesen|Non letto|Не прочитано|未読|읽지 않음|未读
Lido|Read|Leído|Lu|Gelesen|Letto|Прочитано|既読|읽음|已读
Baixados|Downloaded|Descargados|Téléchargés|Heruntergeladen|Scaricati|Скачанные|ダウンロード済み|다운로드됨|已下载
Baixado|Downloaded|Descargado|Téléchargé|Heruntergeladen|Scaricato|Скачано|ダウンロード済み|다운로드됨|已下载
Com marcador|Bookmarked|Con marcador|Avec un signet|Mit Lesezeichen|Con segnalibro|С закладкой|ブックマーク付き|북마크 있음|已添加书签
Ordenação|Sorting|Ordenación|Tri|Sortierung|Ordinamento|Сортировка|並び順|정렬|排序
Ordem da fonte|Source order|Orden de la fuente|Ordre de la source|Reihenfolge der Quelle|Ordine della fonte|Порядок источника|配信元の順序|소스 순서|书源顺序
Ordem inversa|Reverse order|Orden inverso|Ordre inverse|Umgekehrte Reihenfolge|Ordine inverso|Обратный порядок|逆順|역순|倒序
Nome / número|Name / number|Nombre / número|Nom / numéro|Name / Nummer|Nome / numero|Название / номер|名前／番号|이름 / 번호|名称／编号
Detectar automaticamente|Detect automatically|Detectar automáticamente|Détecter automatiquement|Automatisch erkennen|Rileva automaticamente|Определять автоматически|自動検出|자동 감지|自动检测
Ler desde o início|Read from the beginning|Leer desde el principio|Lire depuis le début|Von Anfang an lesen|Leggi dall’inizio|Читать с начала|最初から読む|처음부터 읽기|从头阅读
Marcar lidos|Mark as read|Marcar como leídos|Marquer comme lus|Als gelesen markieren|Segna come letti|Отметить прочитанными|既読にする|읽음으로 표시|标为已读
Marcar não lidos|Mark as unread|Marcar como no leídos|Marquer comme non lus|Als ungelesen markieren|Segna come non letti|Отметить непрочитанными|未読にする|읽지 않음으로 표시|标为未读
Marcar lido|Mark as read|Marcar como leído|Marquer comme lu|Als gelesen markieren|Segna come letto|Отметить прочитанным|既読にする|읽음으로 표시|标为已读
Marcar não lido|Mark as unread|Marcar como no leído|Marquer comme non lu|Als ungelesen markieren|Segna come non letto|Отметить непрочитанным|未読にする|읽지 않음으로 표시|标为未读
Baixar selecionados|Download selected|Descargar seleccionados|Télécharger la sélection|Auswahl herunterladen|Scarica selezionati|Скачать выбранное|選択した章をダウンロード|선택한 장 다운로드|下载所选章节
Apagar downloads|Delete downloads|Eliminar descargas|Supprimer les téléchargements|Downloads löschen|Elimina download|Удалить загрузки|ダウンロードを削除|다운로드 삭제|删除下载
Limpar seleção|Clear selection|Borrar selección|Effacer la sélection|Auswahl aufheben|Cancella selezione|Снять выделение|選択を解除|선택 해제|清除选择
Em leitura|Reading|Leyendo|Lecture en cours|Wird gelesen|In lettura|Читается|読書中|읽는 중|正在阅读
Em andamento|In progress|En curso|En cours|In Bearbeitung|In corso|В процессе|処理中|진행 중|进行中
Lançamento:|Released:|Publicación:|Publication :|Veröffentlicht:|Pubblicazione:|Опубликовано:|公開日：|공개일:|发布日期：
Remover marcador|Remove bookmark|Quitar marcador|Retirer le signet|Lesezeichen entfernen|Rimuovi segnalibro|Удалить закладку|ブックマークを削除|북마크 제거|移除书签
Adicionar marcador|Add bookmark|Añadir marcador|Ajouter un signet|Lesezeichen hinzufügen|Aggiungi segnalibro|Добавить закладку|ブックマークを追加|북마크 추가|添加书签
Apagar download|Delete download|Eliminar descarga|Supprimer le téléchargement|Download löschen|Elimina download|Удалить загрузку|ダウンロードを削除|다운로드 삭제|删除下载
Baixar capítulo|Download chapter|Descargar capítulo|Télécharger le chapitre|Kapitel herunterladen|Scarica capitolo|Скачать главу|章をダウンロード|장 다운로드|下载章节
Atualizar capítulo|Refresh chapter|Actualizar capítulo|Actualiser le chapitre|Kapitel aktualisieren|Aggiorna capitolo|Обновить главу|章を更新|장 새로고침|刷新章节
Carregando mais capítulos…|Loading more chapters…|Cargando más capítulos…|Chargement de chapitres supplémentaires…|Weitere Kapitel werden geladen…|Caricamento di altri capitoli…|Загрузка следующих глав…|さらに章を読み込み中…|장 더 불러오는 중…|正在加载更多章节…
Anterior|Previous|Anterior|Précédent|Zurück|Precedente|Назад|前へ|이전|上一章
Próximo|Next|Siguiente|Suivant|Weiter|Successivo|Далее|次へ|다음|下一章
Capítulo anterior|Previous chapter|Capítulo anterior|Chapitre précédent|Vorheriges Kapitel|Capitolo precedente|Предыдущая глава|前の章|이전 장|上一章
Próximo capítulo|Next chapter|Capítulo siguiente|Chapitre suivant|Nächstes Kapitel|Capitolo successivo|Следующая глава|次の章|다음 장|下一章
Página anterior|Previous page|Página anterior|Page précédente|Vorherige Seite|Pagina precedente|Предыдущая страница|前のページ|이전 페이지|上一页
Próxima página|Next page|Página siguiente|Page suivante|Nächste Seite|Pagina successiva|Следующая страница|次のページ|다음 페이지|下一页
Voltar aos capítulos|Back to chapters|Volver a los capítulos|Retour aux chapitres|Zurück zu den Kapiteln|Torna ai capitoli|Назад к главам|章一覧に戻る|장 목록으로 돌아가기|返回章节列表
Ajustes de leitura|Reading settings|Ajustes de lectura|Réglages de lecture|Leseeinstellungen|Impostazioni di lettura|Настройки чтения|読書設定|읽기 설정|阅读设置
Fonte de leitura|Reading font|Fuente de lectura|Police de lecture|Leseschrift|Carattere di lettura|Шрифт для чтения|読書用フォント|읽기 글꼴|阅读字体
Fonte do sistema|System font|Fuente del sistema|Police du système|Systemschrift|Carattere di sistema|Системный шрифт|システムフォント|시스템 글꼴|系统字体
Tamanho da fonte|Font size|Tamaño de fuente|Taille de police|Schriftgröße|Dimensione del carattere|Размер шрифта|文字サイズ|글꼴 크기|字号
Espaçamento entre linhas|Line spacing|Interlineado|Interligne|Zeilenabstand|Interlinea|Межстрочный интервал|行間|줄 간격|行间距
Largura do texto|Text width|Ancho del texto|Largeur du texte|Textbreite|Larghezza del testo|Ширина текста|本文の幅|본문 너비|文本宽度
Alinhamento do texto|Text alignment|Alineación del texto|Alignement du texte|Textausrichtung|Allineamento del testo|Выравнивание текста|文字の配置|텍스트 정렬|文本对齐
À esquerda|Left|Izquierda|À gauche|Linksbündig|A sinistra|По левому краю|左揃え|왼쪽|左对齐
Justificado|Justified|Justificado|Justifié|Blocksatz|Giustificato|По ширине|両端揃え|양쪽 맞춤|两端对齐
Modo de leitura|Reading mode|Modo de lectura|Mode de lecture|Lesemodus|Modalità di lettura|Режим чтения|読書モード|읽기 모드|阅读模式
Rolagem contínua|Continuous scrolling|Desplazamiento continuo|Défilement continu|Fortlaufendes Scrollen|Scorrimento continuo|Непрерывная прокрутка|連続スクロール|연속 스크롤|连续滚动
Páginas horizontais|Horizontal pages|Páginas horizontales|Pages horizontales|Horizontale Seiten|Pagine orizzontali|Горизонтальные страницы|横送り|가로 페이지|横向翻页
Avanço por página|Page scroll distance|Distancia de desplazamiento|Distance de défilement|Scrollweite pro Seite|Distanza di scorrimento|Шаг прокрутки|スクロール量|스크롤 이동 거리|翻页滚动距离
Avanço por página (rolagem)|Page scroll distance|Distancia de desplazamiento|Distance de défilement|Scrollweite pro Seite|Distanza di scorrimento|Шаг прокрутки|スクロール量|스크롤 이동 거리|翻页滚动距离
Ocultar barras durante a leitura|Hide bars while reading|Ocultar barras durante la lectura|Masquer les barres pendant la lecture|Leisten beim Lesen ausblenden|Nascondi le barre durante la lettura|Скрывать панели при чтении|読書中はバーを隠す|읽는 동안 도구 모음 숨기기|阅读时隐藏工具栏
Prévia da leitura|Reading preview|Vista previa de lectura|Aperçu de lecture|Lesevorschau|Anteprima di lettura|Предпросмотр чтения|読書プレビュー|읽기 미리보기|阅读预览
Ver em tamanho real|View at actual size|Ver a tamaño real|Voir en taille réelle|In Originalgröße anzeigen|Visualizza a dimensioni reali|Показать в реальном размере|実際のサイズで表示|실제 크기로 보기|按实际大小查看
Fechar prévia|Close preview|Cerrar vista previa|Fermer l’aperçu|Vorschau schließen|Chiudi anteprima|Закрыть предпросмотр|プレビューを閉じる|미리보기 닫기|关闭预览
Tema|Theme|Tema|Thème|Design|Tema|Тема|テーマ|테마|主题
Claro|Light|Claro|Clair|Hell|Chiaro|Светлая|ライト|밝게|浅色
Escuro|Dark|Oscuro|Sombre|Dunkel|Scuro|Тёмная|ダーク|어둡게|深色
Sistema|System|Sistema|Système|System|Sistema|Система|システム|시스템|系统
Usar tema do Windows|Use Windows theme|Usar el tema de Windows|Utiliser le thème Windows|Windows-Design verwenden|Usa il tema di Windows|Использовать тему Windows|Windowsのテーマを使う|Windows 테마 사용|使用Windows主题
Exibição|Display|Visualización|Affichage|Anzeige|Visualizzazione|Отображение|表示|표시|显示
Tamanho das capas|Cover size|Tamaño de las portadas|Taille des couvertures|Covergröße|Dimensione delle copertine|Размер обложек|表紙のサイズ|표지 크기|封面大小
Compacto|Compact|Compacto|Compact|Kompakt|Compatto|Компактный|小|작게|紧凑
Padrão|Default|Predeterminado|Par défaut|Standard|Predefinito|По умолчанию|標準|기본|默认
Grande|Large|Grande|Grand|Groß|Grande|Большой|大|크게|大
Mostrar contadores nas capas|Show badges on covers|Mostrar contadores en portadas|Afficher les compteurs sur les couvertures|Zähler auf Covern anzeigen|Mostra contatori sulle copertine|Показывать счётчики на обложках|表紙にカウンターを表示|표지에 배지 표시|在封面上显示计数
Mostrar quantidade de capítulos|Show chapter count|Mostrar cantidad de capítulos|Afficher le nombre de chapitres|Kapitelanzahl anzeigen|Mostra numero di capitoli|Показывать число глав|章数を表示|장 수 표시|显示章节数量
Texto|Text|Texto|Texte|Text|Testo|Текст|テキスト|텍스트|文本
Somente baixados|Downloaded only|Solo descargados|Téléchargés uniquement|Nur heruntergeladene|Solo scaricati|Только скачанные|ダウンロード済みのみ|다운로드한 항목만|仅已下载
Modo anônimo|Incognito mode|Modo incógnito|Mode privé|Inkognitomodus|Modalità in incognito|Режим инкогнито|シークレットモード|시크릿 모드|隐私模式
Privacidade e navegação|Privacy and navigation|Privacidad y navegación|Confidentialité et navigation|Datenschutz und Navigation|Privacy e navigazione|Конфиденциальность и навигация|プライバシーと操作|개인정보 및 탐색|隐私与导航
Voltar nas configurações|Back in settings|Volver en ajustes|Retour aux paramètres|Zurück in den Einstellungen|Indietro nelle impostazioni|Назад в настройках|設定に戻る|설정으로 돌아가기|返回设置
Exportar backup|Export backup|Exportar copia de seguridad|Exporter une sauvegarde|Sicherung exportieren|Esporta backup|Экспорт резервной копии|バックアップを書き出す|백업 내보내기|导出备份
Restaurar backup|Restore backup|Restaurar copia de seguridad|Restaurer une sauvegarde|Sicherung wiederherstellen|Ripristina backup|Восстановить резервную копию|バックアップを復元|백업 복원|恢复备份
Processando backup|Processing backup|Procesando copia de seguridad|Traitement de la sauvegarde|Sicherung wird verarbeitet|Elaborazione del backup|Обработка резервной копии|バックアップを処理中|백업 처리 중|正在处理备份
Processando backup…|Processing backup…|Procesando copia de seguridad…|Traitement de la sauvegarde…|Sicherung wird verarbeitet…|Elaborazione del backup…|Обработка резервной копии…|バックアップを処理中…|백업 처리 중…|正在处理备份…
Informações da versão|Version information|Información de la versión|Informations sur la version|Versionsinformationen|Informazioni sulla versione|Информация о версии|バージョン情報|버전 정보|版本信息
Limpar histórico|Clear history|Borrar historial|Effacer l’historique|Verlauf löschen|Cancella cronologia|Очистить историю|履歴を消去|기록 지우기|清空历史
Pesquisar histórico|Search history|Buscar historial|Rechercher dans l’historique|Verlauf durchsuchen|Cerca nella cronologia|Поиск в истории|履歴を検索|기록 검색|搜索历史
Pesquisar obra ou capítulo|Search novel or chapter|Buscar obra o capítulo|Rechercher un roman ou un chapitre|Roman oder Kapitel suchen|Cerca romanzo o capitolo|Поиск книги или главы|作品または章を検索|작품 또는 장 검색|搜索作品或章节
Nenhuma leitura no histórico|No reading history|No hay lecturas en el historial|Aucun historique de lecture|Kein Leseverlauf|Nessuna lettura nella cronologia|История чтения пуста|読書履歴はありません|읽기 기록이 없습니다|暂无阅读历史
Remover do histórico|Remove from history|Quitar del historial|Retirer de l’historique|Aus Verlauf entfernen|Rimuovi dalla cronologia|Удалить из истории|履歴から削除|기록에서 제거|从历史中移除
Atualizar biblioteca|Refresh library|Actualizar biblioteca|Actualiser la bibliothèque|Bibliothek aktualisieren|Aggiorna biblioteca|Обновить библиотеку|ライブラリを更新|서재 새로고침|刷新书库
Pesquisar atualizações|Search updates|Buscar actualizaciones|Rechercher les mises à jour|Aktualisierungen durchsuchen|Cerca aggiornamenti|Поиск обновлений|更新を検索|업데이트 검색|搜索更新
Apenas não lidos|Unread only|Solo sin leer|Non lus uniquement|Nur ungelesene|Solo non letti|Только непрочитанные|未読のみ|읽지 않은 항목만|仅未读
Última verificação:|Last checked:|Última comprobación:|Dernière vérification :|Zuletzt geprüft:|Ultimo controllo:|Последняя проверка:|最終確認：|마지막 확인:|上次检查：
Atualizando biblioteca|Refreshing library|Actualizando biblioteca|Actualisation de la bibliothèque|Bibliothek wird aktualisiert|Aggiornamento della biblioteca|Обновление библиотеки|ライブラリを更新中|서재 새로고치는 중|正在刷新书库
Verificando|Checking|Comprobando|Vérification|Wird geprüft|Verifica in corso|Проверка|確認中|확인 중|正在检查
Parar após esta obra|Stop after this novel|Detener después de esta obra|Arrêter après ce roman|Nach diesem Roman stoppen|Interrompi dopo questo romanzo|Остановить после этой книги|この作品の後で停止|이 작품 후 중지|此作品完成后停止
Ver capítulos|Show chapters|Ver capítulos|Afficher les chapitres|Kapitel anzeigen|Mostra capitoli|Показать главы|章を表示|장 보기|查看章节
Recolher|Collapse|Contraer|Réduire|Einklappen|Comprimi|Свернуть|折りたたむ|접기|收起
Mostrar mais atualizações|Show more updates|Mostrar más actualizaciones|Afficher plus de mises à jour|Weitere Aktualisierungen anzeigen|Mostra altri aggiornamenti|Показать ещё обновления|更新をさらに表示|업데이트 더 보기|显示更多更新
Mostrar mais|Show more|Mostrar más|Afficher plus|Mehr anzeigen|Mostra altro|Показать больше|もっと見る|더 보기|显示更多
Mostrar menos|Show less|Mostrar menos|Afficher moins|Weniger anzeigen|Mostra meno|Показать меньше|表示を減らす|간략히 보기|收起
Populares|Popular|Populares|Populaires|Beliebt|Popolari|Популярные|人気|인기|热门
Recentes|Latest|Recientes|Récents|Neueste|Recenti|Новые|新着|최신|最新
Atualizar lista|Refresh list|Actualizar lista|Actualiser la liste|Liste aktualisieren|Aggiorna elenco|Обновить список|一覧を更新|목록 새로고침|刷新列表
Filtros da fonte|Source filters|Filtros de la fuente|Filtres de la source|Quellenfilter|Filtri della fonte|Фильтры источника|配信元のフィルター|소스 필터|书源筛选
Aplicar filtros|Apply filters|Aplicar filtros|Appliquer les filtres|Filter anwenden|Applica filtri|Применить фильтры|フィルターを適用|필터 적용|应用筛选
Limpar filtros|Clear filters|Borrar filtros|Effacer les filtres|Filter zurücksetzen|Cancella filtri|Сбросить фильтры|フィルターを解除|필터 초기화|清除筛选
Ativado|Enabled|Activado|Activé|Aktiviert|Attivato|Включено|有効|사용|已启用
Incluir|Include|Incluir|Inclure|Einschließen|Includi|Включить|含める|포함|包含
Excluir|Exclude|Excluir|Exclure|Ausschließen|Escludi|Исключить|除外|제외|排除
Filtro de idioma das fontes|Source language filter|Filtro de idioma de fuentes|Filtre de langue des sources|Sprachfilter für Quellen|Filtro lingua delle fonti|Фильтр языка источников|配信元の言語フィルター|소스 언어 필터|书源语言筛选
Carregando LNReader…|Loading LNReader…|Cargando LNReader…|Chargement de LNReader…|LNReader wird geladen…|Caricamento di LNReader…|Загрузка LNReader…|LNReaderを読み込み中…|LNReader 불러오는 중…|正在加载LNReader…
`
  .trim()
  .split('\n')
  .map((row) => row.split('|'));
rows.push(
  ...require('./locale-details.cjs')
    .trim()
    .split('\n')
    .map((row) => row.split('|')),
);
rows.push(
  ...require('./locale-help.cjs')
    .trim()
    .split('\n')
    .map((row) => row.split('|')),
);
rows.push(
  ...require('./locale-errors.cjs')
    .trim()
    .split('\n')
    .map((row) => row.split('|')),
);
rows.push(
  ...require('./locale-dynamic.cjs')
    .trim()
    .split('\n')
    .map((row) => row.split('|')),
);
rows.push(
  ...require('./locale-dialogs.cjs')
    .trim()
    .split('\n')
    .map((row) => row.split('|')),
);
const messages = Object.fromEntries(
  rows.map((row) => [
    row[0],
    Object.fromEntries(languages.map(([code], index) => [code, row[index]])),
  ]),
);
for (const [key, alias] of Object.entries({
  'Resetar leitura da obra': 'Resetar leitura',
  'Marcar como lido': 'Marcar lido',
  'Marcar como não lido': 'Marcar não lido',
  'Apagar download do capítulo': 'Apagar download',
  'Apagar download da atualização': 'Apagar download',
  'Baixar atualização': 'Baixar capítulo',
  'Capítulo lido': 'Lido',
  'Carregando mais capítulos': 'Carregando mais capítulos…',
  'Tentar carregar capítulos novamente': 'Tentar novamente',
  'Tentar capítulo novamente': 'Tentar novamente',
  'Carregando LNReader': 'Carregando LNReader…',
  'Controles do leitor': 'Ajustes de leitura',
  'Prévia do leitor em tamanho real': 'Prévia da leitura',
}))
  messages[key] = { ...messages[alias], 'pt-BR': key };
module.exports = { languages, messages };
