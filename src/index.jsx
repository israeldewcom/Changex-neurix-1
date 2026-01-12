// src/index.js - Enhanced entry point

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { ReactQueryDevtools } from 'react-query/devtools';
import { HelmetProvider } from 'react-helmet-async';
import { ErrorBoundary } from 'react-error-boundary';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { AnalyticsProvider } from './contexts/AnalyticsContext';
import { PerformanceProvider } from './contexts/PerformanceContext';
import App from './App';
import './styles/index.css';
import './styles/animations.css';
import './styles/theme.css';
import './styles/responsive.css';

// Performance monitoring
if (process.env.NODE_ENV === 'production') {
  import('./utils/performance').then(({ initPerformanceMonitoring }) => {
    initPerformanceMonitoring();
  });
}

// Initialize query client with enhanced options
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
      retry: (failureCount, error) => {
        if (error?.response?.status === 404) return false;
        return failureCount < 3;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: true,
    },
    mutations: {
      retry: 2,
    },
  },
});

// Enhanced error boundary fallback
function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div className="error-boundary">
      <div className="error-content">
        <div className="error-icon">⚠️</div>
        <h1>Something went wrong</h1>
        <p className="error-message">{error.message}</p>
        <div className="error-actions">
          <button 
            onClick={resetErrorBoundary}
            className="btn-primary"
          >
            Try again
          </button>
          <button 
            onClick={() => window.location.reload()}
            className="btn-secondary"
          >
            Reload page
          </button>
          <button 
            onClick={() => window.location.href = '/'}
            className="btn-outline"
          >
            Go to homepage
          </button>
        </div>
        <details className="error-details">
          <summary>Error details</summary>
          <pre>{error.stack}</pre>
        </details>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <PerformanceProvider>
              <ThemeProvider>
                <AuthProvider>
                  <WebSocketProvider>
                    <NotificationProvider>
                      <AnalyticsProvider>
                        <App />
                      </AnalyticsProvider>
                    </NotificationProvider>
                  </WebSocketProvider>
                </AuthProvider>
              </ThemeProvider>
            </PerformanceProvider>
          </BrowserRouter>
          <ReactQueryDevtools 
            initialIsOpen={false}
            position="bottom-right"
          />
        </QueryClientProvider>
      </HelmetProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
