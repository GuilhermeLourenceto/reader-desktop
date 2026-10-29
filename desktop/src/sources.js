import {
  installSource as installOriginal,
  loadPlugin,
  reloadInstalledPlugins,
  uninstallSource as uninstallPlugin,
} from './sourceClient';
import { INSTALLED_PLUGINS_KEY } from '../../src/plugins/constants';
import { withSourceDeadline, validatePluginMetadata } from './sourceGuards.cjs';

export async function installDesktopPlugin(metadata) {
  validatePluginMetadata(metadata);
  const installed = await withSourceDeadline(() => installOriginal(metadata));
  if (
    !installed ||
    installed.id !== metadata.id ||
    typeof installed.parseNovel !== 'function' ||
    typeof installed.parseChapter !== 'function'
  )
    throw new Error(
      'Esta extensão é inválida ou não corresponde à fonte solicitada.',
    );
  if (
    typeof installed.version !== 'string' ||
    typeof installed.name !== 'string' ||
    typeof installed.site !== 'string'
  )
    throw new Error('A extensão retornou nome, versão ou endereço inválido.');
  return installed;
}

export async function initializeDesktopPlugins() {
  const plugins = JSON.parse(
    localStorage.getItem(INSTALLED_PLUGINS_KEY) || '[]',
  );
  let index = 0;
  const missing = [];
  const worker = async () => {
    while (index < plugins.length) {
      const plugin = plugins[index++];
      try {
        validatePluginMetadata(plugin);
        if (
          !(await window.desktop.file(
            'exists',
            `Plugins/${plugin.id}/index.js`,
          ))
        )
          missing.push(plugin.name);
      } catch (error) {
        window.dispatchEvent(
          new CustomEvent('notice', {
            detail: `${plugin?.name || 'Fonte'}: ${error.message}`,
          }),
        );
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(3, plugins.length) }, worker),
  );
  if (missing.length)
    window.dispatchEvent(
      new CustomEvent('notice', {
        detail: `Fontes sem código disponível: ${missing.join(
          ', ',
        )}. Reinstale-as em Fontes. A biblioteca continua disponível offline.`,
      }),
    );
}

export async function uninstallDesktopPlugin(plugin) {
  const prefix = `plugin_db:${plugin.id}`;
  const owned = key =>
    key.startsWith(prefix + '_DB_') ||
    key === prefix + '_LocalStorage' ||
    key === prefix + '_SessionStorage';
  const collateral = Object.fromEntries(
    Object.entries(localStorage).filter(
      ([key]) => key.startsWith(prefix) && !owned(key),
    ),
  );
  try {
    await uninstallPlugin(plugin);
  } finally {
    for (const [key, value] of Object.entries(collateral))
      localStorage.setItem(key, value);
  }
  for (const filename of ['custom.js', 'custom.css']) {
    const name = `Plugins/${plugin.id}/${filename}`;
    if (await window.desktop.file('exists', name))
      await window.desktop.file('remove', name);
  }
}

export async function fetchDesktopPlugins() {
  const repositories = JSON.parse(localStorage.getItem('repositories') || '[]');
  const results = new Array(repositories.length);
  let index = 0;
  const worker = async () => {
    while (index < repositories.length) {
      const position = index++;
      try {
        const response = await fetch(repositories[position]);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const plugins = await response.json();
        if (!Array.isArray(plugins) || plugins.length > 20000)
          throw new Error('O índice do repositório não é uma lista válida.');
        results[position] = plugins.filter(plugin => {
          try {
            validatePluginMetadata(plugin);
            return true;
          } catch {
            return false;
          }
        });
        if (results[position].length !== plugins.length)
          throw new Error(
            'Algumas fontes tinham metadados inválidos e foram ignoradas.',
          );
      } catch (error) {
        window.dispatchEvent(
          new CustomEvent('notice', {
            detail: `${repositories[position]}: ${error.message}`,
          }),
        );
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(3, repositories.length) }, worker),
  );
  return [
    ...new Map(
      results.flatMap(items => items || []).map(plugin => [plugin.id, plugin]),
    ).values(),
  ];
}

export { reloadInstalledPlugins };
