const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createAutoBackupManager } = require('../src/autoBackup.cjs');

test('automatic backups require completed onboarding, a folder, and changes', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reader-auto-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  let time = Date.parse('2026-11-05T10:00:00Z');
  let calls=0;
  let state = {settings:{desktopOnboardingCompleted:false,desktopBackupFrequency:'24',desktopBackupDirectory:dir},files:{},novels:[]};
  const manager=createAutoBackupManager({dataDirectory:dir,contentDirectory:dir,getState:()=>state,now:()=>time,exportBackup:async ({filename})=>{calls++;fs.writeFileSync(filename,'backup');}});
  assert.equal(await manager.check({launch:true}), false);
  state={...state,settings:{...state.settings,desktopOnboardingCompleted:true}};
  assert.equal(await manager.check({launch:true}), true);
  assert.equal(await manager.check(),false);
  time+=25*3600000;
  state={...state,novels:[{id:1}]};
  assert.equal(await manager.check(),true);
  assert.equal(calls,2);
  state={...state,settings:{...state.settings,desktopBackupFrequency:'off'}};
  assert.equal(await manager.check({launch:true}),false);
});

test('every launch skips unchanged data and retention never removes manual files', async t => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'reader-auto-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  fs.writeFileSync(path.join(dir,'manual.zip'),'manual');
  let state={settings:{desktopOnboardingCompleted:true,desktopBackupFrequency:'launch',desktopBackupDirectory:dir,desktopBackupIncludeDownloads:false},files:{'Novels/a/1/1/index.html':'secret','Covers/1':'cover'},novels:[]};
  let timestamp=Date.parse('2026-11-01T00:00:00Z');
  let included;
  for(let i=0;i<7;i++) {
    state={...state,settings:{...state.settings,number:i}};
    const manager=createAutoBackupManager({dataDirectory:dir,contentDirectory:dir,getState:()=>state,now:()=>timestamp,exportBackup:async ({filename,state:backup})=>{included=Object.keys(backup.files);fs.writeFileSync(filename,'zip');}});
    assert.equal(await manager.check({launch:true}),true);
    assert.equal(await manager.check({launch:true}),false);
    timestamp+=86400000;
  }
  assert.deepEqual(included,['Covers/1']);
  assert.equal(fs.readdirSync(dir).filter(name=>name.startsWith('ReaderDesktop-auto-')).length,5);
  assert.equal(fs.readFileSync(path.join(dir,'manual.zip'),'utf8'),'manual');
});