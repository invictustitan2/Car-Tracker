import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppErrorBoundary from './AppErrorBoundary.jsx';

// Component that throws an error when shouldThrow is true
function ThrowError({ shouldThrow }) {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
}

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    // Clean up any rendered components
    cleanup();
    vi.clearAllMocks();
  });
  it('should render children when there is no error', () => {
    render(
      <AppErrorBoundary>
        <div>Test content</div>
      </AppErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('should render error UI when child throws', () => {
    // Suppress console.error for this test
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => { });

    render(
      <AppErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AppErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText(/encountered an unexpected error/)).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('should display reload button', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => { });

    render(
      <AppErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AppErrorBoundary>
    );

    const reloadButton = screen.getByRole('button', { name: /reload app/i });
    expect(reloadButton).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('should display clear data button', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => { });

    render(
      <AppErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AppErrorBoundary>
    );

    const clearButton = screen.getByRole('button', { name: /clear local data/i });
    expect(clearButton).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('should call window.location.reload when reload button is clicked', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => { });

    // Mock location.reload using Object.defineProperty with getter/setter
    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, reload: reloadMock }
    });

    const user = userEvent.setup();

    render(
      <AppErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AppErrorBoundary>
    );

    const reloadButton = screen.getByRole('button', { name: /reload app/i });
    await user.click(reloadButton);

    expect(reloadMock).toHaveBeenCalledTimes(1);

    consoleError.mockRestore();
  });

  it('should clear localStorage and reload when clear data button is clicked after confirmation', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => { });
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, reload: reloadMock }
    });

    const user = userEvent.setup();

    // Set some localStorage data
    localStorage.setItem('test-key', 'test-value');
    expect(localStorage.getItem('test-key')).toBe('test-value');

    render(
      <AppErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AppErrorBoundary>
    );

    const clearButton = screen.getByRole('button', { name: /clear local data/i });
    await user.click(clearButton);

    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('test-key')).toBeNull();
    expect(reloadMock).toHaveBeenCalledTimes(1);

    confirmMock.mockRestore();
    consoleError.mockRestore();
  });

  it('should not clear data if user cancels confirmation', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => { });
    const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, reload: reloadMock }
    });

    const user = userEvent.setup();

    localStorage.setItem('test-key', 'test-value');

    render(
      <AppErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AppErrorBoundary>
    );

    const clearButton = screen.getByRole('button', { name: /clear local data/i });
    await user.click(clearButton);

    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('test-key')).toBe('test-value');
    expect(reloadMock).not.toHaveBeenCalled();

    // Cleanup
    localStorage.removeItem('test-key');

    confirmMock.mockRestore();
    consoleError.mockRestore();
  });

  it('should log error to console', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => { });

    render(
      <AppErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AppErrorBoundary>
    );

    expect(consoleError).toHaveBeenCalled();
    const errorCall = consoleError.mock.calls.find(call =>
      call[0] && call[0].includes('React Error Boundary')
    );
    expect(errorCall).toBeTruthy();

    consoleError.mockRestore();
  });

  it('should not render error UI for non-error children', () => {
    render(
      <AppErrorBoundary>
        <ThrowError shouldThrow={false} />
      </AppErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('should display error icon', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => { });

    const { container } = render(
      <AppErrorBoundary>
        <ThrowError shouldThrow={true} />
      </AppErrorBoundary>
    );

    // lucide-react AlertTriangle renders as an svg
    const errorIcon = container.querySelector('svg');
    expect(errorIcon).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('should handle multiple child errors', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => { });

    const { container } = render(
      <AppErrorBoundary>
        <div>
          <ThrowError shouldThrow={true} />
          <div>This should not render</div>
        </div>
      </AppErrorBoundary>
    );

    expect(container.textContent).toContain('Something went wrong');
    expect(screen.queryByText('This should not render')).not.toBeInTheDocument();

    consoleError.mockRestore();
  });
});
