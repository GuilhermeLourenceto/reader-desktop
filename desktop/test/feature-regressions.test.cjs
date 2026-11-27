// Exercise production orchestration with deterministic dependencies, not live sites.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { transformSync } = require('esbuild');
const { t, setLocale, languages, messages } = require('../src/i18n.cjs');
const { userMessageForError } = require('../src/domain/userFacingError.cjs');
const fixtures = {
  '../../i18n.cjs': { t },
  '../../domain/userFacingError.cjs': { userMessageForError },
  '../../sourceRuntime': { errorText: e => e.message || String(e) },
  '../../sourceClient': { loadPlugin: async () => ({}), fetchChapter: async () => '' },
  '../../sourceGuards.cjs': { withSourceDeadline: fn => fn(), validateFilters: x => x || {} },
  '../../state/libraryState': { fileKey: (b, c) => 'Novels/' + b.pluginId + '/' + b.id + '/' + c.id + '/index.html' },
};
function loadFeature(file, overrides = {}, globals = {}) {
  const input = fs.readFileSync(path.join(__dirname, '../src/features', file), 'utf8');
  const { code } = transformSync(input, { format: 'cjs', loader: 'js', target: 'node22' });
  const module = { exports: {} };
  const deps = { ...fixtures, ...overrides };
  const requireMock = name => {
    if (!Object.hasOwn(deps, name)) throw Error('Unmocked import: ' + name);
    return deps[name];
  };
  new Function('module', 'exports', 'require', 'window', 'DOMParser', 'fetch', 'requestAnimationFrame', code)(
    module, module.exports, requireMock, globals.window, globals.DOMParser, globals.fetch, globals.requestAnimationFrame,
  );
  return module.exports;
}
const diag = () => ({ report: async () => {} });
const ref = current => ({ current });

test('batch error is handled in all ten locales and releases download lock', async () => {
  const book = { id: 1, inLibrary: true, chapters: [{ id: 10 }] };
  for (const [locale] of languages) {
    setLocale(locale);
    let notice, report;
    const downloading = ref(false);
    const { libraryAction } = loadFeature('library/libraryActions.js', {}, {
      window: { desktop: { diagnostics: { report: async data => { report = data; } } } },
    }).createLibraryActions({
      current: ref({ novels: [book] }), update: () => {}, downloading,
      cancelDownload: ref(false), setNotice: value => { notice = value; },
      downloadChapters: async () => { throw Error('ENOSPC: private path'); },
    });
    await libraryAction('download', [1]);
    assert.equal(notice, t('Não há espaço suficiente para concluir a operação.'));
    assert.equal(report.code, 'RDR-DOWNLOAD-FAILED');
    assert.equal(downloading.current, false);
  }
  setLocale('en');
});

test('only selected library books are changed; duplicate ids do not duplicate work', async () => {
  const current = ref({ novels: [
    { id: 1, inLibrary: true, chapters: [{ id: 10, unread: false, progress: 100, bookmark: true, isDownloaded: true }] },
    { id: 2, inLibrary: false, chapters: [{ id: 20, unread: false, progress: 90 }] },
  ] });
  const old = current.current.novels[1];
  const { libraryAction } = loadFeature('library/libraryActions.js', {}, {
    window: { confirm: () => true },
  }).createLibraryActions({ current, update: state => { current.current = state; } });
  await libraryAction('reset', [1, 1, 2]);
  assert.equal(current.current.novels[0].chapters[0].progress, 0);
  assert.equal(current.current.novels[0].chapters[0].isDownloaded, true);
  assert.equal(current.current.novels[0].chapters[0].bookmark, true);
  assert.equal(current.current.novels[1], old);
});

test('partial deletion keeps successfully deleted chapter flags in sync and cancellation is harmless', async () => {
  const patches = [], calls = [];
  let confirmed = false, confirmation;
  setLocale('en');
  const { deleteDownloads } = loadFeature('downloads/downloadActions.js', {}, {
    window: {
      confirm: text => { confirmation = text; return confirmed; },
      desktop: { file: async (action, key) => { calls.push(key); if (key.endsWith('/2')) throw Error('disk error'); }, diagnostics: diag() },
    },
  }).createDownloadActions({ downloading: ref(false), changeChapterRows: (...args) => patches.push(args), setNotice: () => {} });
  const book = { id: 9, pluginId: 'fixture' };
  await deleteDownloads(book, [1, 1, 2]);
  assert.equal(calls.length, 0);
  assert.equal(confirmation, t('Apagar os arquivos baixados destes capítulos? Eles continuarão na lista e poderão ser baixados novamente.'));
  confirmed = true;
  await assert.rejects(deleteDownloads(book, [1, 1, 2]), /disk error/);
  assert.deepEqual(calls, ['Novels/fixture/9/1', 'Novels/fixture/9/2']);
  assert.deepEqual(patches, [[9, [1], { isDownloaded: false, desktopAssetsCached: false }]]);
});

test('empty download selection and queue collision are localized', async () => {
  for (const [locale] of languages) {
    setLocale(locale);
    let notice;
    const downloading = ref(false);
    const { downloadChapters, startDownloads } = loadFeature('downloads/downloadActions.js', {}, {}).createDownloadActions({
      downloading, cancelDownload: ref(false), setNotice: value => { notice = value; }, setDownloadProgress: () => {},
    });
    await downloadChapters({ chapters: [] }, []);
    assert.equal(notice, t('Nenhum capítulo pendente de download nesta seleção.'));
    downloading.current = true;
    await startDownloads({ chapters: [] }, []);
    assert.equal(notice, t('Já há um download em andamento. Aguarde ou pare a fila atual.'));
  }
  setLocale('en');
});

test('individual source retry reloads initial filters and retains login eligibility independent of locale', async () => {
  let filters = 0, request = 0, pageError, results;
  const browseSession = ref(null);
  const { useSourceBrowse } = loadFeature('sources/useSourceBrowse.js', {
    react: { useCallback: fn => fn, useEffect: () => {} },
    '../../sourceClient': { loadPlugin: async () => { filters++; if (filters === 1) throw Error('403 Cloudflare'); return { filters: {} }; } },
    '../../sourceRuntime': { errorText: e => e.message, fetchSourcePage: async () => { request++; return [{ path: '/novel' }]; } },
  }, { window: { desktop: { diagnostics: diag() } }, requestAnimationFrame: () => {} });
  setLocale('ja');
  const noop = () => {};
  const api = useSourceBrowse({
    browseSession, mainRef: ref(null), browseMarker: ref(null), results: [],
    setLoadingMore: noop, setPageError: x => { pageError = x; }, setHasMore: noop,
    setResults: x => { results = x; }, setSource: noop, setNovelQuery: noop, setView: noop,
    setSourceOptions: noop, setSourceFilters: noop,
  });
  await api.browse('fixture', 'query');
  assert.equal(pageError.needsLogin, true);
  assert.equal(pageError.message, t(userMessageForError(Error('403 Cloudflare'))));
  assert.equal(request, 0);
  await api.loadMore();
  assert.equal(filters, 2);
  assert.equal(request, 1);
  assert.equal(browseSession.current.page, 1);
  assert.deepEqual(results, [{ path: '/novel' }]);
  setLocale('en');
});

test('literal translations in orchestration and exact safe errors exist in every locale', () => {
  for (const file of ['downloads/downloadActions.js','library/libraryActions.js','updates/refreshActions.js','reader/novelPagingActions.js','sources/useSourceBrowse.js']) {
    const source = fs.readFileSync(path.join(__dirname, '../src/features', file), 'utf8');
    for (const [, key] of source.matchAll(/\btranslateMessage\(\s*'([^']+)'/g))
      for (const [locale] of languages) assert.ok(messages[key]?.[locale], key + ' @ ' + locale);
  }
  const errors = fs.readFileSync(path.join(__dirname, '../src/domain/userFacingError.cjs'), 'utf8');
  for (const [, key] of errors.matchAll(/^\s*'([^']+)',?$/gm))
    for (const [locale] of languages) assert.ok(messages[key]?.[locale], key + ' @ ' + locale);
});
