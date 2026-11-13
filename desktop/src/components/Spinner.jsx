import React from 'react';

export default function Spinner({ label = 'Carregando', small = false }) {
  return (
    <span
      className={small ? 'spinner spinner-small' : 'spinner'}
      role="status"
      aria-label={label}
    />
  );
}
