async function withSourceDeadline(task, timeoutMs = 45000) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(task),
      new Promise((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                'A extensão não concluiu a operação a tempo. Tente novamente ou atualize a fonte.',
              ),
            ),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
function validatePluginMetadata(plugin) {
  if (
    !plugin ||
    typeof plugin.id !== 'string' ||
    !/^[\w.-]+$/.test(plugin.id) ||
    ['.', '..', '__proto__', 'constructor', 'prototype'].includes(plugin.id) ||
    typeof plugin.name !== 'string' ||
    typeof plugin.url !== 'string'
  )
    throw new Error('Metadados inválidos de uma fonte no repositório.');
  if (!['http:', 'https:'].includes(new URL(plugin.url).protocol))
    throw new Error('URL inválida de uma fonte.');
  for (const key of ['lang', 'version', 'site', 'iconUrl'])
    if (plugin[key] != null && typeof plugin[key] !== 'string')
      throw new Error(`Metadado inválido da fonte: ${key}.`);
  return plugin;
}
function validateFilters(schema) {
  if (!schema) return {};
  if (typeof schema !== 'object' || Array.isArray(schema))
    throw new Error('A fonte retornou filtros inválidos.');
  const filters = {};
  for (const [key, field] of Object.entries(schema)) {
    if (
      !field ||
      !['Text', 'Picker', 'Checkbox', 'Switch', 'XCheckbox'].includes(
        field.type,
      )
    )
      continue;
    if (field.label != null && typeof field.label !== 'string')
      throw new Error('A fonte retornou um nome de filtro inválido.');
    const next = { ...field };
    if (['Picker', 'Checkbox', 'XCheckbox'].includes(field.type)) {
      if (
        !Array.isArray(field.options) ||
        field.options.some(
          option =>
            !option ||
            typeof option.label !== 'string' ||
            typeof option.value !== 'string',
        )
      )
        throw new Error('A fonte retornou opções de filtro inválidas.');
    }
    if (field.type === 'Checkbox')
      next.value = Array.isArray(field.value) ? field.value : [];
    if (field.type === 'XCheckbox')
      next.value = {
        include: Array.isArray(field.value?.include) ? field.value.include : [],
        exclude: Array.isArray(field.value?.exclude) ? field.value.exclude : [],
      };
    filters[key] = next;
  }
  return filters;
}
module.exports = {
  withSourceDeadline,
  validatePluginMetadata,
  validateFilters,
};
