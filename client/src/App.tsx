import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AppRouter } from './router/AppRouter';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { useEffect } from 'react';
import { useUIStore } from './stores/uiStore';
import { useSocket } from './hooks/useSocket';
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: (count, err: unknown) => { const s = (err as { response?: { status: number } })?.response?.status; if (s === 401 || s === 403 || s === 404) return false; return count < 2; } } },
});
function AppContent() { useSocket(); return <AppRouter />; }
function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useUIStore();
  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark'); }, [theme]);
  return <>{children}</>;
}
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <ThemeProvider><AppContent /></ThemeProvider>
      </ErrorBoundary>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
