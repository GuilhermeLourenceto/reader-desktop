import { getErrorChainMessages } from '../vendor/lnreader/src/utils/error';
import { loadPlugin } from './sourceClient';
import { withSourceDeadline, validateFilters } from './sourceGuards.cjs';
import { validateSourceItems } from './domain.cjs';

export const errorText = error =>
  [...new Set(getErrorChainMessages(error))].join(' — ');

export async function fetchSourcePage(pluginId, term, page, options) {
  const plugin = await loadPlugin(pluginId);
  if (!plugin) throw new Error('Fonte não instalada. Instale-a em Fontes.');
  const method = term ? 'searchNovels' : 'popularNovels';
  if (typeof plugin[method] !== 'function')
    throw new Error(
      term
        ? 'Esta fonte não oferece pesquisa de obras.'
        : 'Esta fonte não oferece uma lista de obras populares.',
    );
  const items = await withSourceDeadline(() =>
    term
      ? plugin.searchNovels(term, page)
      : plugin.popularNovels(page, {
          showLatestNovels: options?.showLatestNovels ?? false,
          filters: options?.filters ?? validateFilters(plugin.filters),
        }),
  );
  return validateSourceItems(items);
}

