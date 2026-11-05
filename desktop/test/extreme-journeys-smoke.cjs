// 18 independent adversarial journeys (10 real Electron UI, 8 backup/storage).
// All profiles and files are disposable. No external accounts or sites.
const {app}=require('electron');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const assert=require('node:assert/strict');
const {Worker}=require('node:worker_threads');
const {randomBytes}=require('node:crypto');
const {emptyState,parseBackup}=require('../dist/backup.cjs');
const {DiskFiles}=require('../src/storage.cjs');
const {createAutoBackupManager}=require('../src/autoBackup.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'reader-journey30-'));
const results=[];
const names=['Órbita 🪐','雪の物語','Café em São Paulo','Alpha 123','آخر قصة'];
const initial=emptyState();
initial.settings={desktopOnboardingCompleted:false,desktopInterfaceLanguage:'en',desktopTheme:'dark',desktopPalette:'default',desktopBackupFrequency:'off'};
initial.novels=names.map((name,i)=>({id:i+1,pluginId:'fixture',name,path:'/book/'+i,inLibrary:true,chapters:[{id:i+11,novelId:i+1,name:'Chapter 1',path:'/chapter/'+i,unread:true,progress:0,isDownloaded:true}]}));
initial.categories=[{id:1,name:'Lendo',novelIds:[1,2]},{id:2,name:'Favoritos',novelIds:[4,5]}];
for(const book of initial.novels)initial.files['Novels/fixture/'+book.id+'/'+book.chapters[0].id+'/index.html']=Buffer.from('<h2>CONTEÚDO OFFLINE</h2><p>Texto salvo sem conexão.</p>'.repeat(90)).toString('base64');
fs.writeFileSync(path.join(root,'library.json'),JSON.stringify(initial));
app.setPath('userData',root);app.commandLine.appendSwitch('disable-gpu');
let win,done=false;
const timeout=setTimeout(()=>finish(1,'180 second timeout'),180000);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function finish(code,reason){
 if(done)return;done=true;clearTimeout(timeout);
 if(reason)console.error(reason);
 const summary={total:results.length,pass:results.filter(x=>x.status==='PASS').length,fail:results.filter(x=>x.status==='FAIL').length};
 console.log('EXTREME JOURNEYS SUMMARY '+JSON.stringify(summary));
 try{const out=path.join(__dirname,'../.tmp');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'extreme-journeys-results.json'),JSON.stringify(results,null,2))}catch(e){console.warn(e.message)}
 if(win&&!win.isDestroyed())win.destroy();
 try{fs.rmSync(root,{recursive:true,force:true})}catch(e){console.warn(e.message)}
 app.exit(code);
}
async function journey(name,fn){
 const at=Date.now();
 try{await fn();const x={scenario:name,status:'PASS',seconds:(Date.now()-at)/1000};results.push(x);console.log('EXTREME JOURNEY RESULT '+JSON.stringify(x))}
 catch(e){const x={scenario:name,status:'FAIL',seconds:(Date.now()-at)/1000,error:e.stack||String(e)};results.push(x);console.error('EXTREME JOURNEY RESULT '+JSON.stringify(x))}
}
function fixture(frequency='launch'){
 const dir=fs.mkdtempSync(path.join(root,'case-')),folder=path.join(dir,'archives');fs.mkdirSync(folder);
 let time=Date.parse('2026-10-01T00:00:00Z'),count=0,failing=false,pending;
 const state={...emptyState(),settings:{desktopOnboardingCompleted:true,desktopBackupFrequency:frequency,desktopBackupDirectory:folder,desktopBackupIncludeDownloads:true}};
 const exportBackup=async({filename})=>{count++;if(pending)await pending;if(failing){fs.writeFileSync(filename+'.tmp','partial');throw Error('disk full')}fs.writeFileSync(filename,'valid-'+count)};
 return{dir,folder,state,get count(){return count},change(n){state.settings.marker=n},move(h){time+=h*3600000},fail(v){failing=v},hold(v){pending=v},make(){return createAutoBackupManager({dataDirectory:dir,getState:()=>state,contentDirectory:dir,exportBackup,now:()=>time})},autos(){return fs.readdirSync(folder).filter(x=>/^ReaderDesktop-auto-.*\.zip$/.test(x)).sort()}};
}
function workerJob(data){return new Promise((resolve,reject)=>{
 const worker=new Worker(path.join(__dirname,'../dist/backup-worker.cjs'),{workerData:data});
 let ended=false;const finish=(error,result)=>{if(ended)return;ended=true;if(error)reject(error);else resolve(result)};
 worker.on('message',m=>m.ok?finish(null,m.result??m.restored):finish(Error(m.message)));
 worker.on('error',finish);worker.on('exit',c=>{if(!ended)finish(Error('Worker exited '+c))});
});}
app.on('browser-window-created',(_event,window)=>{
 if(win)return;win=window;win.webContents.setBackgroundThrottling(false);
 win.webContents.once('did-finish-load',async()=>{
  const js=code=>win.webContents.executeJavaScript(code,true);
  const wait=async(code,limit=10000)=>{const end=Date.now()+limit;while(Date.now()<end){if(await js(code))return;await sleep(50)}throw Error('Timed out: '+code)};
  const click=name=>js('(()=>{const el=[...document.querySelectorAll("button")].find(b=>(b.getAttribute("aria-label")||b.textContent.trim())==='+JSON.stringify(name)+');if(!el)throw Error("Missing button");el.click();return true})()');
  const select=(selector,value)=>js('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');if(!e)throw Error("Missing select");e.value='+JSON.stringify(value)+';e.dispatchEvent(new Event("change",{bubbles:true}));return true})()');
  const input=(selector,value)=>js('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');if(!e)throw Error("Missing input");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,'+JSON.stringify(value)+');e.dispatchEvent(new Event("input",{bubbles:true}));return true})()');
  const nav=async(label,view)=>{await click(label);await wait('!!document.querySelector(".app.view-'+view+'")')};
  try{
   await journey('13. Primeiro acesso interrompido continua em inglês',async()=>{
    await wait('document.querySelector(".first-run")?.dataset.step==="1"');
    assert.equal(await js('document.documentElement.lang'),'en');
    assert.equal(await js('document.querySelector("#first-run-language").value'),'en');
   });
   await journey('14. Japonês nas três etapas, português e backup desligado sem pasta',async()=>{
    await select('#first-run-language','ja');
    await wait('document.querySelector(".first-run h1")?.textContent==="ようこそ"');
    await js('document.querySelector(".first-run-primary").click()');
    await wait('document.querySelector(".first-run")?.dataset.step==="2"');
    assert.equal(await js('document.querySelector(".first-run h1").textContent'),'テーマを選択');
    await js('document.querySelector(".first-run-primary").click()');
    await wait('document.querySelector(".first-run")?.dataset.step==="3"');
    assert.equal(await js('document.querySelector(".first-run h1").textContent'),'バックアップの設定');
    await js('document.querySelector(".first-run-secondary").click()');
    await wait('document.querySelector(".first-run")?.dataset.step==="2"');
    await js('document.querySelector(".first-run-secondary").click()');
    await wait('document.querySelector(".first-run")?.dataset.step==="1"');
    await select('#first-run-language','pt-BR');
    await wait('document.documentElement.lang==="pt-BR"');
    await js('document.querySelector(".first-run-primary").click()');
    await wait('document.querySelector(".first-run")?.dataset.step==="2"');
    await js('document.querySelector(".first-run-primary").click()');
    await wait('document.querySelector(".first-run")?.dataset.step==="3"');
    await select('#first-run-frequency','off');
    await js('document.querySelector(".first-run-primary").click()');
    await wait('!!document.querySelector(".app.view-library") && document.querySelectorAll(".book").length===5',15000);
    assert.equal((await js('window.desktop.load({metadataOnly:true})')).settings.desktopOnboardingCompleted,true);
   });
   await journey('15. Redimensionar para 480, 800 e 1365 px sem transbordamento',async()=>{
    for(const [w,h] of [[480,720],[800,600],[1365,900]]){
     win.setSize(w,h);await sleep(150);
     assert.equal(await js('document.documentElement.scrollWidth<=innerWidth'),true,'overflow at '+w);
    }
   });
   await journey('16. Cinquenta alternâncias entre cinco áreas sem perder obras',async()=>{
    for(let i=0;i<10;i++)for(const [label,view] of [['Atualizações','updates'],['Histórico','history'],['Fontes','sources'],['Mais','settings'],['Biblioteca','library']])await nav(label,view);
    assert.equal(await js('document.querySelectorAll(".book").length'),5);
   });
   await journey('17. Buscar japonês, emoji, acento e árabe e limpar',async()=>{
    for(const [term,expected] of [['雪','雪の物語'],['🪐','Órbita 🪐'],['CAFÉ','Café em São Paulo'],['آخر','آخر قصة']]){
     await input('input[aria-label="Pesquisar na biblioteca"]',term);
     await wait('document.querySelectorAll(".book").length===1');
     assert.equal(await js('document.querySelector(".book strong").textContent'),expected);
    }
    await input('input[aria-label="Pesquisar na biblioteca"]','');await wait('document.querySelectorAll(".book").length===5');
   });
   await journey('18. Duas categorias com contagens exatas e limpeza de filtros',async()=>{
    await click('Filtrar biblioteca');await wait('!!document.querySelector("#library-category")');
    for(const [v,n] of [['1',2],['2',2],['',5]]){await select('#library-category',v);await wait('document.querySelectorAll(".book").length==='+n)}
    await click('Filtrar biblioteca');
   });
   await journey('19. Ctrl+F, Ctrl+A e Escape sem seleção presa',async()=>{
    await js('document.body.focus();document.dispatchEvent(new KeyboardEvent("keydown",{key:"f",ctrlKey:true,bubbles:true,cancelable:true}))');
    await wait('document.activeElement?.getAttribute("aria-label")==="Pesquisar na biblioteca"');
    await js('document.activeElement.blur();document.dispatchEvent(new KeyboardEvent("keydown",{key:"a",ctrlKey:true,bubbles:true,cancelable:true}))');
    await wait('document.querySelector(".library-selection")?.dataset.selectedCount==="5"');
    await js('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))');
    await wait('document.querySelector(".library-selection")?.dataset.selectedCount==="0"');
   });
   await journey('20. Frequências off/6/12/24/48/168/launch persistem',async()=>{
    await nav('Mais','settings');await click('Backups');await wait('!!document.querySelector("select[aria-label=Frequência]")');
    for(const freq of ['launch','6','12','24','48','168','off']){
     await select('select[aria-label="Frequência"]',freq);
     await wait('window.desktop.load({metadataOnly:true}).then(s=>s.settings.desktopBackupFrequency==='+JSON.stringify(freq)+')',5000);
    }
   });
   await journey('21. Nove paletas e OLED preto preservam aparência',async()=>{
    await nav('Biblioteca','library');await nav('Mais','settings');await click('Configurações');await click('Aparência');
    await wait('document.querySelectorAll(".palette-swatch").length===9');
    for(let i=0;i<9;i++){await js('document.querySelectorAll(".palette-swatch")['+i+'].click()');await wait('document.querySelectorAll(".palette-swatch")['+i+'].getAttribute("aria-pressed")==="true"')}
    await select('select[aria-label="Tema do aplicativo"]','oled');
    await wait('document.documentElement.dataset.appTheme==="oled"');
    assert.equal(await js('getComputedStyle(document.documentElement).backgroundColor'),'rgb(0, 0, 0)');
    await select('select[aria-label="Tema do aplicativo"]','dark');await wait('document.documentElement.dataset.appTheme==="dark"');
   });
   await journey('22. Capítulo offline abre sem fonte instalada e retorna',async()=>{
    await nav('Biblioteca','library');await js('document.querySelector(".book").click()');
    await wait('!!document.querySelector(".novel-hero")');await js('document.querySelector(".chapter-open").click()');
    await wait('!!document.querySelector(".reader-view")',14000);
    await wait('document.querySelector(".reader-scroll")?.textContent.includes("CONTEÚDO OFFLINE")');
    await click('Voltar aos capítulos');await wait('!!document.querySelector(".novel-hero")');
   });
   await journey('23. Backup desligado ou sem pasta não cria arquivos',async()=>{
    const f=fixture('off');f.change(1);assert.equal(await f.make().check({launch:true}),false);
    f.state.settings.desktopBackupFrequency='24';f.state.settings.desktopBackupDirectory='';
    assert.equal(await f.make().check({launch:true}),false);assert.equal(f.autos().length,0);
   });
   await journey('24. Abertura idêntica não gera backup repetido',async()=>{
    const f=fixture();assert.equal(await f.make().check({launch:true}),true);
    assert.equal(await f.make().check({launch:true}),false);f.change(2);
    assert.equal(await f.make().check({launch:true}),true);assert.equal(f.count,2);
   });
   await journey('25. Intervalos 6/12/24/48/168 horas verificam fronteiras',async()=>{
    for(const h of [6,12,24,48,168]){const f=fixture(String(h));assert.equal(await f.make().check({launch:true}),true);
     f.change(h);f.move(h-0.01);assert.equal(await f.make().check(),false);f.move(0.01);
     assert.equal(await f.make().check(),true);assert.equal(f.count,2);}
   });
   await journey('26. Cinquenta verificações simultâneas exportam uma vez',async()=>{
    const f=fixture('24');let release;f.hold(new Promise(r=>release=r));const m=f.make();
    const first=m.check({launch:true});const concurrent=await Promise.all(Array.from({length:49},()=>m.check({launch:true})));
    assert.ok(concurrent.every(x=>x===false));release();assert.equal(await first,true);assert.equal(f.count,1);
   });
   await journey('27. Vinte autos mantêm cinco; cem manuais não são apagados',async()=>{
    const f=fixture();const manuals=Array.from({length:100},(_,i)=>'Manual_'+i+'.zip');
    for(const name of manuals)fs.writeFileSync(path.join(f.folder,name),name);
    let oldest;for(let i=0;i<20;i++){f.change(i);assert.equal(await f.make().check({launch:true}),true);if(i===0)oldest=f.autos()[0];f.move(1)}
    assert.equal(f.autos().length,5);assert.equal(fs.existsSync(path.join(f.folder,oldest)),false);
    for(const name of manuals)assert.equal(fs.readFileSync(path.join(f.folder,name),'utf8'),name);
    assert.equal(fs.readdirSync(f.folder).filter(x=>x.endsWith('.zip')).length,105);
   });
   await journey('28. Arquivo manual com nome reservado fica intacto',async()=>{
    const f=fixture(),manual='ReaderDesktop-auto-2000-01-01T00-00-00-000Z.zip';
    fs.writeFileSync(path.join(f.folder,manual),'manually owned');
    for(let i=0;i<8;i++){f.change(i);assert.equal(await f.make().check({launch:true}),true);f.move(1)}
    assert.equal(fs.readFileSync(path.join(f.folder,manual),'utf8'),'manually owned');
    assert.equal(JSON.parse(fs.readFileSync(path.join(f.dir,'automatic-backup-status.json'))).managed[f.folder].length,5);
   });
   await journey('29. Falha no sexto backup preserva cinco e permite tentar de novo',async()=>{
    const f=fixture();for(let i=0;i<5;i++){f.change(i);assert.equal(await f.make().check({launch:true}),true);f.move(1)}
    const old=f.autos();f.change(6);f.fail(true);assert.equal(await f.make().check({launch:true}),false);
    assert.deepEqual(f.autos(),old);assert.equal(fs.readdirSync(f.folder).some(x=>x.endsWith('.tmp')),false);
    f.fail(false);assert.equal(await f.make().check({launch:true}),true);
    assert.equal(f.autos().length,5);assert.equal(fs.existsSync(path.join(f.folder,old[0])),false);
   });
   await journey('30. ZIP real de 12 MiB restaura bytes, Unicode e progresso',async()=>{
    const f=fixture('off'),storage=new DiskFiles(path.join(f.dir,'content')),bytes=randomBytes(12*1024*1024);
    const html='<h2>雪 🪐 Café</h2><p>Conteúdo offline íntegro.</p>',s=emptyState();
    s.novels=[{id:1,pluginId:'fixture',name:'雪 🪐 Café',inLibrary:true,chapters:[{id:11,novelId:1,name:'Capítulo 1',path:'/11',progress:83,isDownloaded:true}]}];
    s.files={'Covers/1':storage.write(bytes),'Novels/fixture/1/11/index.html':storage.write(Buffer.from(html))};
    const filename=path.join(f.folder,'Manual gigante.zip');
    const result=await workerJob({action:'export',state:s,filename,contentDirectory:storage.directory});
    assert.equal(result.missingCount,0);assert.ok(fs.statSync(filename).size>10*1024*1024);
    const parsed=parseBackup(fs.readFileSync(filename)).state;
    assert.equal(parsed.novels[0].name,'雪 🪐 Café');assert.equal(parsed.novels[0].chapters[0].progress,83);
    assert.deepEqual(Buffer.from(parsed.files['Covers/1'],'base64'),bytes);
    assert.equal(Buffer.from(parsed.files['Novels/fixture/1/11/index.html'],'base64').toString(),html);
    assert.throws(()=>parseBackup(Buffer.from('not a zip')),Error);
   });
   assert.equal(results.length,18);
   finish(results.some(x=>x.status==='FAIL')?1:0);
  }catch(e){console.error(e);finish(1,e.stack||String(e))}
 });
});
require('../dist/main.cjs');
