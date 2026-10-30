import React from 'react';
import { errorText } from './sourceRuntime';

export default class DesktopErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
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
        </div>
      );
    return this.props.children;
  }
}
