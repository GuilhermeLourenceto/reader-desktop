import React from 'react';

export default function SourceFilters({ schema, values, onChange }) {
  return (
    <div className="source-filters">
      {Object.entries(schema).map(([key, field]) => {
        const value = values?.[key]?.value ?? field.value;
        const change = (value) =>
          onChange({
            ...(values || schema),
            [key]: { type: field.type, value },
          });
        return (
          <fieldset key={key}>
            <legend>{field.label || key}</legend>
            {field.type === 'Text' && (
              <input
                value={value || ''}
                onChange={(event) => change(event.target.value)}
              />
            )}
            {field.type === 'Picker' && (
              <select
                value={value || ''}
                onChange={(event) => change(event.target.value)}
              >
                {(field.options || []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
            {field.type === 'Switch' && (
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(event) => change(event.target.checked)}
                />
                Ativado
              </label>
            )}
            {field.type === 'Checkbox' && (
              <div className="filter-choices">
                {(field.options || []).map((option) => (
                  <label key={option.value}>
                    <input
                      type="checkbox"
                      checked={(value || []).includes(option.value)}
                      onChange={(event) =>
                        change(
                          event.target.checked
                            ? [...(value || []), option.value]
                            : (value || []).filter(
                                (item) => item !== option.value,
                              ),
                        )
                      }
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            )}
            {field.type === 'XCheckbox' && (
              <div className="filter-choices">
                {(field.options || []).map((option) => (
                  <div key={option.value}>
                    {option.label}
                    {['include', 'exclude'].map((mode) => (
                      <label key={mode}>
                        <input
                          type="checkbox"
                          checked={(value?.[mode] || []).includes(option.value)}
                          onChange={(event) =>
                            change({
                              ...(value || {}),
                              [mode]: event.target.checked
                                ? [...(value?.[mode] || []), option.value]
                                : (value?.[mode] || []).filter(
                                    (item) => item !== option.value,
                                  ),
                              [mode === 'include' ? 'exclude' : 'include']: (
                                value?.[
                                  mode === 'include' ? 'exclude' : 'include'
                                ] || []
                              ).filter((item) => item !== option.value),
                            })
                          }
                        />
                        {mode === 'include' ? 'Incluir' : 'Excluir'}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}
