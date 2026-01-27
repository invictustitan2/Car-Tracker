import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { TrackerProvider } from './context/TrackerContext';

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

export function renderWithProviders(ui, { ...options } = {}) {
  const testQueryClient = createTestQueryClient();
  const Wrapper = ({ children }) => (
    <QueryClientProvider client={testQueryClient}>
      <TrackerProvider>
        {children}
      </TrackerProvider>
    </QueryClientProvider>
  );
  return render(ui, { wrapper: Wrapper, ...options });
}

// eslint-disable-next-line react-refresh/only-export-components
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';

