import Icon from '../../components/Icon';
import GlobalSearch from './GlobalSearch';
import SourceFilters from './SourceFilters';
import { fetchSourcePage } from '../../sourceRuntime';
import { sourceLanguageOptions, matchesSourceLanguage, matchesSourceSearch } from '../../domain/sourceLanguages.cjs';
import { fetchDesktopPlugins as fetchPlugins, installDesktopPlugin as installPlugin, uninstallDesktopPlugin as uninstallPlugin } from '../../sources';
import { INSTALLED_PLUGINS_KEY } from '../../../vendor/lnreader/src/plugins/constants';

// Presentation of the existing Sources and source-browsing screens.
// Side effects and state transitions still come from the original App props.
export default function SourceViews({
  view,
  installed,
  available,
  setAvailable,
  sourceMode,
  setSourceMode,
  sourceLanguage,
  setSourceLanguage,
  sourceQuery,
  setSourceQuery,
  repo,
  setRepo,
  state,
  current,
  update,
  run,
  busy,
  cards,
  downloading,
  setNotice,
  browse,
  source,
  novelQuery,
  setNovelQuery,
  sourceOptions,
  setSourceOptions,
  sourceFilters,
  filtersVisible,
  setFiltersVisible,
  results,
  browseMarker,
  loadingMore,
  pageError,
  loadMore,
  hasMore,
}) {
  const languages = sourceLanguageOptions(installed, available);
  const visibleSource = plugin =>
    matchesSourceLanguage(plugin, sourceLanguage) &&
    matchesSourceSearch(plugin, sourceQuery);
  return (
    <>
{view === 'sources' && (
          <>
            <header>
              <h2>Fontes</h2>
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => setAvailable(await fetchPlugins()))
                }
              >
                Carregar repositórios
              </button>
            </header>
            <div className="source-mode-tabs">
              <button
                aria-pressed={sourceMode === 'search'}
                onClick={() => setSourceMode('search')}
              >
                Buscar obras em todas as fontes
              </button>
              <button
                aria-pressed={sourceMode === 'sources'}
                onClick={() => setSourceMode('sources')}
              >
                Gerenciar fontes
              </button>
            </div>
            {sourceMode === 'search' && (
              <div className="source-language-row">
                <label htmlFor="global-source-language">
                  Idioma das fontes
                </label>
                <select
                  id="global-source-language"
                  value={sourceLanguage}
                  onChange={(event) => setSourceLanguage(event.target.value)}
                >
                  <option value="all">Todos os idiomas</option>
                  {languages.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {sourceMode === 'search' ? (
              <GlobalSearch
                key={sourceLanguage}
                plugins={installed.filter((plugin) =>
                  matchesSourceLanguage(plugin, sourceLanguage),
                )}
                fetchPage={fetchSourcePage}
                cards={cards}
              />
            ) : (
              <>
                <div className="source-language-row">
                  <input
                    aria-label="Pesquisar fontes"
                    placeholder="Pesquisar fontes por nome ou idioma"
                    value={sourceQuery}
                    onChange={(e) => setSourceQuery(e.target.value)}
                  />
                  <label htmlFor="source-language">Idioma</label>
                  <select
                    id="source-language"
                    value={sourceLanguage}
                    onChange={(e) => setSourceLanguage(e.target.value)}
                  >
                    <option value="all">Todos os idiomas</option>
                    {languages.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    run(async () => {
                      const url = new URL(repo);
                      if (!['http:', 'https:'].includes(url.protocol))
                        throw new Error(
                          'Use uma URL HTTP/HTTPS para o índice JSON.',
                        );
                      const repos = [
                        ...new Set([...state.repositories, url.href]),
                      ];
                      localStorage.setItem(
                        'repositories',
                        JSON.stringify(repos),
                      );
                      update({ ...current.current, repositories: repos });
                      setRepo('');
                      setAvailable(await fetchPlugins());
                    });
                  }}
                >
                  <label htmlFor="source-repository-url">URL do índice JSON do repositório original</label>
                  <div className="row">
                    <input
                      id="source-repository-url"
                      type="url"
                      required
                      value={repo}
                      onChange={(e) => setRepo(e.target.value)}
                      placeholder="https://…/plugins.json"
                    />
                    <button disabled={busy}>Adicionar</button>
                  </div>
                </form>
                {state.repositories.map((url) => (
                  <div className="row repository" key={url}>
                    <span>{url}</span>
                    <button
                      disabled={busy}
                      onClick={() => {
                        const repos = state.repositories.filter(
                          (r) => r !== url,
                        );
                        localStorage.setItem(
                          'repositories',
                          JSON.stringify(repos),
                        );
                        update({ ...current.current, repositories: repos });
                      }}
                    >
                      Remover
                    </button>
                  </div>
                ))}
                <h3 className="section-heading">
                  Instaladas <span>{installed.length}</span>
                </h3>
                {installed.length === 0 && <p>Nenhuma fonte instalada.</p>}
                {installed.filter(visibleSource).map((plugin) => (
                  <div className="source" key={plugin.id}>
                    <div className="source-icon">
                      {plugin.iconUrl ? (
                        <img src={plugin.iconUrl} alt="" loading="lazy" />
                      ) : (
                        <Icon name="sources" />
                      )}
                    </div>
                    <div>
                      <strong>{plugin.name}</strong>
                      <small>
                        {plugin.lang} · {plugin.version}
                      </small>
                    </div>
                    <div className="row">
                      <button
                        disabled={busy}
                        onClick={() => run(() => browse(plugin.id))}
                      >
                        Abrir
                      </button>
                      <button
                        disabled={busy}
                        title="Abrir uma janela segura para autenticação nesta fonte"
                        onClick={() =>
                          run(async () => {
                            await window.desktop.sourceLogin(plugin.id);
                            setNotice(
                              'Janela fechada. Se a verificação foi concluída, abra a fonte novamente.',
                            );
                          })
                        }
                      >
                        Entrar
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            if (downloading.current)
                              throw new Error(
                                'Aguarde ou pare a fila de downloads antes de desinstalar fontes.',
                              );
                            await uninstallPlugin(plugin);
                            localStorage.setItem(
                              INSTALLED_PLUGINS_KEY,
                              JSON.stringify(
                                installed.filter((p) => p.id !== plugin.id),
                              ),
                            );
                            update({ ...current.current });
                          })
                        }
                      >
                        Desinstalar
                      </button>
                    </div>
                  </div>
                ))}
                <h3 className="section-heading">
                  Disponíveis <span>{available.length}</span>
                </h3>
                {available.filter(visibleSource).map((plugin) => (
                  <div className="source" key={plugin.id}>
                    <div className="source-icon">
                      {plugin.iconUrl ? (
                        <img src={plugin.iconUrl} alt="" loading="lazy" />
                      ) : (
                        <Icon name="sources" />
                      )}
                    </div>
                    <div>
                      <strong>{plugin.name}</strong>
                      <small>
                        {plugin.lang} · {plugin.version}
                      </small>
                    </div>
                    <button
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          if (downloading.current)
                            throw new Error(
                              'Aguarde ou pare a fila de downloads antes de instalar ou atualizar fontes.',
                            );
                          const loaded = await installPlugin(plugin);
                          if (!loaded)
                            throw new Error(
                              'Não foi possível carregar esta fonte.',
                            );
                          localStorage.setItem(
                            INSTALLED_PLUGINS_KEY,
                            JSON.stringify([
                              ...installed.filter((p) => p.id !== plugin.id),
                              {
                                ...plugin,
                                version: loaded.version,
                                site: loaded.site,
                                name: loaded.name,
                                hasUpdate: false,
                                hasSettings: Boolean(loaded.pluginSettings),
                              },
                            ]),
                          );
                          update({ ...current.current });
                        })
                      }
                    >
                      {installed.some((p) => p.id === plugin.id)
                        ? 'Atualizar'
                        : 'Instalar'}
                    </button>
                  </div>
                ))}
              </>
            )}
          </>
        )}
        {view === 'browse' && (
          <>
            <header>
              <h2>{installed.find((p) => p.id === source)?.name || source}</h2>
              <form
                className="row"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() => browse(source, novelQuery, sourceOptions));
                }}
              >
                <input
                  aria-label="Buscar obras"
                  placeholder="Buscar obras"
                  value={novelQuery}
                  onChange={(e) => setNovelQuery(e.target.value)}
                />
                <button disabled={busy}>Buscar</button>
              </form>
            </header>
            <div className="row source-toolbar">
              <button
                disabled={busy}
                title="Abra o site da fonte para login ou verificação de segurança e tente novamente ao fechar"
                onClick={() =>
                  run(async () => {
                    await window.desktop.sourceLogin(source);
                    await browse(
                      source,
                      browseSession.current?.term || '',
                      browseSession.current?.options || sourceOptions,
                    );
                  })
                }
              >
                Abrir site / login
              </button>
              <button
                disabled={busy}
                aria-pressed={!sourceOptions.showLatestNovels}
                onClick={() =>
                  run(() =>
                    browse(source, '', {
                      ...sourceOptions,
                      showLatestNovels: false,
                    }),
                  )
                }
              >
                Populares
              </button>
              <button
                disabled={busy}
                aria-pressed={sourceOptions.showLatestNovels}
                onClick={() =>
                  run(() =>
                    browse(source, '', {
                      ...sourceOptions,
                      showLatestNovels: true,
                    }),
                  )
                }
              >
                Recentes
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  run(() =>
                    browse(
                      source,
                      browseSession.current?.term || '',
                      browseSession.current?.options,
                    ),
                  )
                }
              >
                Atualizar lista
              </button>
              {Object.keys(sourceFilters).length > 0 && (
                <button
                  aria-expanded={filtersVisible}
                  onClick={() => setFiltersVisible(!filtersVisible)}
                >
                  Filtros da fonte
                </button>
              )}
            </div>
            {filtersVisible && (
              <div className="source-filter-panel">
                <SourceFilters
                  schema={sourceFilters}
                  values={sourceOptions.filters}
                  onChange={(filters) =>
                    setSourceOptions({ ...sourceOptions, filters })
                  }
                />
                <div className="row">
                  <button
                    disabled={busy}
                    onClick={() => {
                      setFiltersVisible(false);
                      run(() => browse(source, '', sourceOptions));
                    }}
                  >
                    Aplicar filtros
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      setFiltersVisible(false);
                      run(() =>
                        browse(source, '', {
                          ...sourceOptions,
                          filters: structuredClone(sourceFilters),
                        }),
                      );
                    }}
                  >
                    Limpar filtros
                  </button>
                </div>
              </div>
            )}
            {cards(results, source)}
            <div
              className="pagination-status"
              ref={browseMarker}
              aria-live="polite"
              aria-busy={loadingMore}
            >
              {loadingMore && (
                <div className="loading-more" role="status">
                  <span className="spinner" aria-hidden="true" />
                  Carregando mais novels…
                </div>
              )}
              {pageError && (
                <div className="pagination-error">
                  <p>Não foi possível carregar mais novels: {pageError.message}</p>
                  <button
                    disabled={busy || loadingMore}
                    onClick={() => void loadMore()}
                  >
                    Tentar novamente
                  </button>
                  {pageError.needsLogin && (
                    <button
                      disabled={busy || loadingMore}
                      onClick={() =>
                        run(async () => {
                          await window.desktop.sourceLogin(source);
                          await browse(
                            source,
                            browseSession.current?.term || '',
                            browseSession.current?.options || sourceOptions,
                          );
                        })
                      }
                    >
                      Verificar acesso no site
                    </button>
                  )}
                </div>
              )}
              {!loadingMore && !pageError && !hasMore && (
                <p>
                  {results.length
                    ? 'Você chegou ao fim dos resultados.'
                    : 'Nenhuma novel encontrada.'}
                </p>
              )}
            </div>
          </>
        )}
    </>
  );
}
