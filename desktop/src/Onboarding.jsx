import React, { useState } from 'react';
import { appThemes } from './appThemes';
import { languages, t as translateMessage } from './i18n.cjs';
import { resolveAppearance } from './appearance.cjs';

const translations = {
  'pt-BR': ['PRIMEIRO ACESSO','Boas-vindas','Prepare o Reader Desktop antes de começar a leitura.','Idioma da interface','Você poderá alterar o idioma nas configurações.','PERSONALIZAÇÃO','Escolha um tema','As cores escolhidas serão usadas em todo o aplicativo.','Aparência','Sistema','Claro','Escuro','Paletas de cores','9 paletas disponíveis','Preto puro (OLED)','Usar preto puro no modo escuro.','PROTEJA SUA BIBLIOTECA','Configure seus backups','Selecione a pasta de destino e como deseja criar cópias automáticas.','Pasta dos backups','Os backups automáticos serão armazenados neste local.','Nenhuma pasta selecionada','Escolher pasta','Backup automático','Frequência','Desativado','A cada inicialização','A cada 6 horas','A cada 12 horas','Diariamente','A cada 2 dias','Semanalmente','Incluir capítulos baixados','Preserva o conteúdo offline, mas aumenta o backup.','Já possui um backup?','Restaurar backup existente','A cópia será verificada quando o aplicativo abrir e, se necessário, enquanto estiver em uso.','Selecione uma pasta para habilitar o backup automático ou escolha Desativado.','Voltar','Próximo','Concluir','Etapa {step} de 3','Backup desativado: você pode escolher a pasta mais tarde em Configurações.','Falha ao concluir a configuração.','Pasta selecionada','Seleção de pasta cancelada.'],
  en: ['FIRST LAUNCH','Welcome','Set up Reader Desktop before you begin reading.','Interface language','You can change the language later in Settings.','PERSONALIZATION','Choose a theme','Your chosen colors will apply throughout the app.','Appearance','System','Light','Dark','Color palettes','9 available palettes','Pure black (OLED)','Use pure black in dark mode.','PROTECT YOUR LIBRARY','Set up backups','Select a destination folder and how often to create automatic backups.','Backup folder','Automatic backups will be stored here.','No folder selected','Choose folder','Automatic backup','Frequency','Disabled','On every launch','Every 6 hours','Every 12 hours','Daily','Every 2 days','Weekly','Include downloaded chapters','Preserves offline content, but increases backup size.','Already have a backup?','Restore existing backup','Backups are checked on launch and, if necessary, while the app is open.','Choose a folder to enable automatic backups, or select Disabled.','Back','Next','Finish','Step {step} of 3','Automatic backups are disabled. You can choose a folder later in Settings.','Could not finish setup.','Selected folder','Folder selection cancelled.'],
  es: ['PRIMER INICIO','Bienvenido','Configura Reader Desktop antes de empezar a leer.','Idioma de la interfaz','Puedes cambiar el idioma más adelante.','PERSONALIZACIÓN','Elige un tema','Los colores se aplicarán a toda la aplicación.','Apariencia','Sistema','Claro','Oscuro','Paletas de colores','9 paletas disponibles','Negro puro (OLED)','Usar negro puro en modo oscuro.','PROTEGE TU BIBLIOTECA','Configura las copias','Selecciona una carpeta y la frecuencia de las copias automáticas.','Carpeta de copias','Aquí se guardarán las copias automáticas.','Ninguna carpeta seleccionada','Elegir carpeta','Copia automática','Frecuencia','Desactivado','Al iniciar','Cada 6 horas','Cada 12 horas','Diariamente','Cada 2 días','Semanalmente','Incluir capítulos descargados','Conserva el contenido sin conexión, pero ocupa más.','¿Ya tienes una copia?','Restaurar copia','La comprobación se realiza al abrir y mientras la app está activa.','Elige una carpeta o desactiva las copias automáticas.','Volver','Siguiente','Terminar','Paso {step} de 3','Puedes elegir una carpeta más tarde en Ajustes.','No se pudo terminar la configuración.','Carpeta seleccionada','Selección cancelada.'],
  fr: ['PREMIER DÉMARRAGE','Bienvenue','Configurez Reader Desktop avant de commencer.','Langue de l’interface','Vous pourrez modifier la langue plus tard.','PERSONNALISATION','Choisir un thème','Les couleurs s’appliquent à toute l’application.','Apparence','Système','Clair','Sombre','Palettes de couleurs','9 palettes disponibles','Noir pur (OLED)','Fond noir pur en mode sombre.','PROTÉGER LA BIBLIOTHÈQUE','Configurer les sauvegardes','Choisissez un dossier et la fréquence des sauvegardes.','Dossier des sauvegardes','Les sauvegardes automatiques seront ici.','Aucun dossier sélectionné','Choisir un dossier','Sauvegarde automatique','Fréquence','Désactivée','À chaque lancement','Toutes les 6 heures','Toutes les 12 heures','Chaque jour','Tous les 2 jours','Chaque semaine','Inclure les chapitres téléchargés','Préserve les contenus hors ligne, mais augmente la taille.','Une sauvegarde existante ?','Restaurer une sauvegarde','Vérification au lancement et pendant l’utilisation.','Choisissez un dossier ou désactivez les sauvegardes.','Retour','Suivant','Terminer','Étape {step} sur 3','Vous pourrez choisir un dossier plus tard.','Impossible de terminer la configuration.','Dossier sélectionné','Sélection annulée.'],
  de: ['ERSTER START','Willkommen','Richten Sie Reader Desktop vor dem Lesen ein.','Sprache','Die Sprache kann später geändert werden.','PERSONALISIERUNG','Design auswählen','Die Farben gelten für die gesamte Anwendung.','Darstellung','System','Hell','Dunkel','Farbpaletten','9 verfügbare Paletten','Reines Schwarz (OLED)','Reines Schwarz im Dunkelmodus verwenden.','BIBLIOTHEK SCHÜTZEN','Backups einrichten','Wählen Sie Ordner und Sicherungsintervall.','Backup-Ordner','Automatische Sicherungen werden hier gespeichert.','Kein Ordner ausgewählt','Ordner wählen','Automatische Sicherung','Häufigkeit','Deaktiviert','Bei jedem Start','Alle 6 Stunden','Alle 12 Stunden','Täglich','Alle 2 Tage','Wöchentlich','Heruntergeladene Kapitel einschließen','Bewahrt Offline-Inhalte, vergrößert aber das Backup.','Backup vorhanden?','Backup wiederherstellen','Prüfung beim Start und während die App geöffnet ist.','Wählen Sie einen Ordner oder deaktivieren Sie Backups.','Zurück','Weiter','Fertig','Schritt {step} von 3','Ein Ordner kann später ausgewählt werden.','Einrichtung konnte nicht abgeschlossen werden.','Gewählter Ordner','Auswahl abgebrochen.'],
  it: ['PRIMO AVVIO','Benvenuto','Configura Reader Desktop prima di leggere.','Lingua dell’interfaccia','Puoi cambiare la lingua nelle impostazioni.','PERSONALIZZAZIONE','Scegli un tema','I colori scelti saranno applicati a tutta l’app.','Aspetto','Sistema','Chiaro','Scuro','Tavolozze','9 tavolozze disponibili','Nero puro (OLED)','Usa il nero puro nella modalità scura.','PROTEGGI LA BIBLIOTECA','Configura i backup','Seleziona cartella e frequenza dei backup automatici.','Cartella dei backup','I backup automatici verranno salvati qui.','Nessuna cartella selezionata','Scegli cartella','Backup automatico','Frequenza','Disattivato','Ad ogni avvio','Ogni 6 ore','Ogni 12 ore','Ogni giorno','Ogni 2 giorni','Ogni settimana','Includi i capitoli scaricati','Mantiene i contenuti offline ma aumenta le dimensioni.','Hai già un backup?','Ripristina backup','Controllo all’avvio e mentre l’app è aperta.','Scegli una cartella oppure disattiva i backup.','Indietro','Avanti','Completa','Passo {step} di 3','Potrai scegliere una cartella nelle impostazioni.','Impossibile terminare la configurazione.','Cartella selezionata','Selezione annullata.'],
  ru: ['ПЕРВЫЙ ЗАПУСК','Добро пожаловать','Настройте Reader Desktop перед чтением.','Язык интерфейса','Язык можно изменить в настройках.','ОФОРМЛЕНИЕ','Выберите тему','Цвета применяются ко всему приложению.','Внешний вид','Система','Светлая','Тёмная','Цветовые палитры','9 палитр','Чёрный (OLED)','Использовать чёрный фон в тёмном режиме.','ЗАЩИТИТЕ БИБЛИОТЕКУ','Настройка копий','Выберите папку и частоту резервирования.','Папка резервных копий','Здесь сохраняются автоматические копии.','Папка не выбрана','Выбрать папку','Автоматическое резервирование','Частота','Отключено','При каждом запуске','Каждые 6 часов','Каждые 12 часов','Ежедневно','Каждые 2 дня','Еженедельно','Включить скачанные главы','Сохраняет офлайн-данные, увеличивая размер копии.','Уже есть копия?','Восстановить копию','Проверка при запуске и во время работы.','Выберите папку или отключите резервирование.','Назад','Далее','Готово','Шаг {step} из 3','Папку можно выбрать позже в настройках.','Не удалось завершить настройку.','Выбранная папка','Выбор отменён.'],
  ja: ['初回起動','ようこそ','読書を始める前に Reader Desktop を設定しましょう。','表示言語','言語は後から変更できます。','外観の設定','テーマを選択','選んだ色はアプリ全体に反映されます。','外観','システム','ライト','ダーク','カラーパレット','9 種類のテーマ','完全な黒 (OLED)','ダークモードを黒背景にします。','ライブラリを保護','バックアップの設定','保存先フォルダーと頻度を選択してください。','バックアップ先','自動バックアップはここに保存されます。','フォルダー未選択','フォルダーを選択','自動バックアップ','頻度','無効','起動ごと','6 時間ごと','12 時間ごと','毎日','2 日ごと','毎週','ダウンロード済みの章を含める','オフラインの章を保存しますが容量が増えます。','バックアップがありますか？','バックアップを復元','起動時とアプリ実行中に必要性を確認します。','フォルダーを選ぶか、自動バックアップを無効にしてください。','戻る','次へ','完了','ステップ {step}/3','後から設定でフォルダーを選択できます。','設定を完了できませんでした。','選択したフォルダー','キャンセルされました。'],
  ko: ['첫 실행','환영합니다','읽기 전에 Reader Desktop을 설정하세요.','인터페이스 언어','나중에 설정에서 언어를 변경할 수 있습니다.','테마 설정','테마 선택','선택한 색상이 앱 전체에 적용됩니다.','화면 모양','시스템','라이트','다크','색상 팔레트','9개 팔레트','완전한 검정 (OLED)','다크 모드에서 검은 배경을 사용합니다.','라이브러리 보호','백업 설정','저장 폴더와 자동 백업 주기를 선택하세요.','백업 폴더','자동 백업이 이 폴더에 저장됩니다.','폴더 미선택','폴더 선택','자동 백업','주기','끄기','실행할 때마다','6시간마다','12시간마다','매일','2일마다','매주','다운로드한 챕터 포함','오프라인 내용을 보존하지만 용량이 증가합니다.','기존 백업이 있나요?','백업 복원','앱 시작 시와 사용 중 백업 필요 여부를 확인합니다.','폴더를 선택하거나 자동 백업을 끄세요.','뒤로','다음','완료','{step}/3 단계','나중에 설정에서 폴더를 선택할 수 있습니다.','설정을 완료하지 못했습니다.','선택된 폴더','취소되었습니다.'],
  'zh-CN': ['首次启动','欢迎使用','阅读前先设置 Reader Desktop。','界面语言','以后可在设置中更改语言。','个性化','选择主题','所选配色将应用于整个应用。','外观','跟随系统','浅色','深色','配色方案','9 种配色','纯黑 (OLED)','深色模式使用纯黑背景。','保护书库','设置备份','选择保存目录和自动备份频率。','备份文件夹','自动备份将保存到此文件夹。','未选择文件夹','选择文件夹','自动备份','频率','关闭','每次启动','每 6 小时','每 12 小时','每天','每 2 天','每周','包含已下载章节','保留离线内容，但备份文件更大。','已有备份？','恢复备份','启动时及程序运行期间检查是否需要备份。','选择文件夹或关闭自动备份。','返回','下一步','完成','第 {step} 步，共 3 步','以后可在设置中选择文件夹。','无法完成设置。','所选文件夹','已取消选择。'],
};
const labels=['tag1','welcome','welcomeDesc','interfaceLang','languageNote','tag2','themeTitle','themeDesc','appearance','system','light','dark','palettes','nine','oled','oledDesc','tag3','backupTitle','backupDesc','backupDirectory','backupDirectoryDesc','noFolder','chooseFolder','autoBackup','frequency','off','launch','h6','h12','h24','h48','h168','includeDownloads','includeDesc','restoreExisting','restoreBackup','backupTip','folderRequired','back','next','finish','step','backupOffNote','finishError','folderSelected','cancelled'];
const freqOptions = ['off','launch','6','12','24','48','168'];
const freqKeys = [25,26,27,28,29,30,31];

export default function Onboarding({ settings, onChange, onChooseFolder, onRestore, onFinish }) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const lang = settings.desktopInterfaceLanguage || 'en';
  const words = translations[lang] || translations.en;
  const t = key => words[labels.indexOf(key)] || translations.en[labels.indexOf(key)] || key;
  const appearance = settings.desktopTheme || 'dark';
  const mode = appearance === 'oled' ? 'dark' : appearance;
  const oled = appearance === 'oled';
  const isDark = resolveAppearance(appearance, window.matchMedia('(prefers-color-scheme: dark)').matches).dark;
  const frequency = String(settings.desktopBackupFrequency ?? '24');
  const folder = String(settings.desktopBackupDirectory || '');
  const update = changes => { setError(''); onChange(changes); };
  const chooseFolder = async () => {
    setError('');
    try {
      const selected = await onChooseFolder();
      if (selected) update({ desktopBackupDirectory: selected });
    } catch (err) {
      setError(err.message || String(err));
    }
  };
  const next = async () => {
    if (working) return;
    if (step < 2) { setStep(step + 1); setError(''); return; }
    if (frequency !== 'off' && !folder) { setError(t('folderRequired')); return; }
    setWorking(true);
    try { await onFinish(); }
    catch (err) { setError(err?.message || t('finishError')); }
    finally { setWorking(false); }
  };
  return (
    <div className="first-run" data-step={step + 1}>
      <div className="first-run-wizard">
        <div className="first-run-top">
          <div className="first-run-brand"><img src="logo.png" alt="" /><strong>Reader Desktop</strong></div>
          <div className="first-run-steps" aria-label={t('step').replace('{step}',String(step+1))}>
            {[0,1,2].map((index) => <React.Fragment key={index}>{index>0 && <span className="first-run-connector"/>}<span className={`first-run-dot ${index===step?'current':index<step?'done':''}`}>{index<step?'✓':index+1}</span></React.Fragment>)}
          </div>
        </div>
        <div className="first-run-stage" key={step}>
          {step===0 && <div className="first-run-welcome">
            <img className="first-run-hero" src="logo.png" alt="" />
            <h1>{t('welcome')}</h1>
            <p>{t('welcomeDesc')}</p>
            <div className="first-run-language"><label htmlFor="first-run-language">{t('interfaceLang')}</label><select id="first-run-language" value={lang} onChange={e=>update({desktopInterfaceLanguage:e.target.value})}>{languages.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select><small>{t('languageNote')}</small></div>
          </div>}
          {step===1 && <div className="first-run-panel-wrap">
            <div className="first-run-heading"><span>{t('tag2')}</span><h1>{t('themeTitle')}</h1><p>{t('themeDesc')}</p></div>
            <div className="first-run-panel">
              <div className="first-run-mode-title"><div><strong>{t('appearance')}</strong></div><div className="first-run-mode" role="radiogroup" aria-label={t('appearance')}>{[['system',t('system')],['light',t('light')],['dark',t('dark')]].map(([value,label])=><button key={value} type="button" role="radio" aria-checked={mode===value} onClick={()=>update({desktopTheme:value})}>{mode===value && <span aria-hidden="true">✓</span>}{label}</button>)}</div></div>
              <div className="first-run-rule" />
              <div className="first-run-palettes-label"><strong>{t('palettes')}</strong><small>{t('nine')}</small></div>
              <div className="first-run-theme-grid">{appThemes.map(theme=>{const colors=isDark?theme.dark:theme.light;const selected=(settings.desktopPalette||'default')===theme.id;return <button type="button" className="first-run-theme" key={theme.id} aria-pressed={selected} onClick={()=>update({desktopPalette:theme.id})}><span className="first-run-theme-preview" style={{'--p-bg':colors.background,'--p-primary':colors.primary,'--p-primary-on':colors.onPrimary,'--p-surface':colors.surfaceVariant,'--p-text':colors.onSurface,'--p-muted':colors.outlineVariant}}><i className="first-run-preview-toolbar"/><i className="first-run-preview-block"/><i className="first-run-preview-line"/><i className="first-run-preview-line shorter"/><i className="first-run-preview-nav"/>{selected && <span className="first-run-selected">✓</span>}</span><span className="first-run-theme-name">{translateMessage(theme.name, {}, lang)}</span></button>})}</div>
              <div className="first-run-rule" />
              <button className="first-run-switch-row" type="button" role="switch" aria-checked={oled} onClick={()=>update({desktopTheme:oled?'dark':'oled'})}><span><strong>{t('oled')}</strong><small>{t('oledDesc')}</small></span><span className={'first-run-toggle'+(oled?' checked':'')}><i/></span></button>
            </div>
          </div>}
          {step===2 && <div className="first-run-panel-wrap first-run-backups">
            <div className="first-run-heading"><span>{t('tag3')}</span><h1>{t('backupTitle')}</h1><p>{t('backupDesc')}</p></div>
            <div className="first-run-panel first-run-backup-box">
              <h2>{t('backupDirectory')}</h2><p>{t('backupDirectoryDesc')}</p>
              <div className="first-run-folder"><div title={folder} className={'first-run-folder-value'+(folder?' chosen':'')}>{folder || t('noFolder')}</div><button type="button" onClick={chooseFolder}>{t('chooseFolder')}</button></div>
              {folder && <small className="first-run-folder-note">{t('folderSelected')}</small>}
            </div>
            <div className="first-run-panel first-run-backup-box">
              <h2>{t('autoBackup')}</h2><label htmlFor="first-run-frequency">{t('frequency')}</label>
              <select id="first-run-frequency" value={frequency} onChange={e=>update({desktopBackupFrequency:e.target.value})}>{freqOptions.map((value,index)=><option value={value} key={value}>{words[freqKeys[index]]}</option>)}</select>
              <p className="first-run-hint">{t('backupTip')}</p>
            </div>
            <label className="first-run-extras"><input type="checkbox" checked={settings.desktopBackupIncludeDownloads!==false} onChange={e=>update({desktopBackupIncludeDownloads:e.target.checked})}/><span><strong>{t('includeDownloads')}</strong><small>{t('includeDesc')}</small></span></label>
            <div className="first-run-restore"><span>{t('restoreExisting')}</span><button type="button" onClick={onRestore}>{t('restoreBackup')}</button></div>
            {frequency==='off' && !folder && <p className="first-run-hint">{t('backupOffNote')}</p>}
          </div>}
        </div>
        {error && <p className="first-run-error" role="alert">{error}</p>}
        <div className="first-run-bottom"><span className="first-run-step-label">{t('step').replace('{step}',String(step+1))}</span><div className="first-run-actions">{step>0 && <button type="button" className="first-run-secondary" onClick={()=>{setStep(step-1);setError('')}}>{t('back')}</button>}<button type="button" className="first-run-primary" disabled={working} onClick={next}>{step===2?t('finish'):t('next')}</button></div></div>
      </div>
    </div>
  );
}