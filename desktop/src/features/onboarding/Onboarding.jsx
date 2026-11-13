import React, { useState } from 'react';
import { appThemes } from '../../appThemes';
import { languages, t as translateMessage } from '../../i18n.cjs';
import { resolveAppearance } from '../../appearance.cjs';

import { translations, labels, freqOptions, freqKeys } from './translations';

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