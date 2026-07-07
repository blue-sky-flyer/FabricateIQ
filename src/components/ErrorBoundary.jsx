import React from 'react';
import { logError } from '../services/logger.js';

/**
 * Catches render-time crashes anywhere in the tree, reports them via logError,
 * and shows a minimal fallback instead of a blank white screen.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { crashed: false };
  }

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error, info) {
    logError('react.render', error, { componentStack: info?.componentStack });
  }

  render() {
    if (this.state.crashed) {
      return (
        <div className="error-fallback" style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>Something went wrong.</h2>
          <p>The error has been logged. Please reload the page and try again.</p>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}
