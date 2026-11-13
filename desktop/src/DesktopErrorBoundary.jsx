import React from 'react';
import { errorText } from './sourceRuntime';

export default class DesktopErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    void window.desktop?.diagnostics?.report({
      level: 'error', code: 'UI-RENDER-CRASH', operation: 'interface',
      message: error?.message || 'Falha ao renderizar a interface.',
    })?.catch(() => {});
  }
  render() {
    if (this.state.error)
      return (
        <div className="empty" role="alert">
          <h2>Não foi possível exibir esta tela</h2>
          <p>{errorText(this.state.error)}</p>
          <button onClick={() => window.location.reload()}>
            Recarregar aplicativo
          </button>
          <button onClick={() => void window.desktop?.diagnostics?.export()?.catch(() => {})}>
            Salvar relatório de diagnóstico
          </button>
        </div>
      );
    return this.props.children;
  }
}
