import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App.jsx';
import { renderWithProviders as render } from './test-utils.jsx';

const THEME_KEY = 'ups-tracker-theme';

describe('App shell', () => {
  beforeEach(() => {
    window.localStorage.removeItem(THEME_KEY);
    document.documentElement.classList.remove('dark');
  });

  it('renders the main tracker shell and applies initial theme', () => {
    render(<App />);

    // Sanity check: main header/title from PackageCarTracker is present
    expect(screen.getByText(/UPS Package Car Tracker/i)).toBeInTheDocument();

    const html = document.documentElement;
    const storedTheme = window.localStorage.getItem(THEME_KEY);

    expect(storedTheme === 'dark' || storedTheme === 'light').toBe(true);
    if (storedTheme === 'dark') {
      expect(html.classList.contains('dark')).toBe(true);
    } else {
      expect(html.classList.contains('dark')).toBe(false);
    }
  });

  it('toggles theme when the header theme button is clicked', () => {
    render(<App />);

    const initialTheme = window.localStorage.getItem(THEME_KEY) || 'light';
    const html = document.documentElement;

    // There may be multiple theme buttons (e.g. multiple headers); click the first
    const toggleButtons = screen.getAllByRole('button', { name: /switch to dark mode|switch to light mode/i });
    fireEvent.click(toggleButtons[0]);

    const newTheme = window.localStorage.getItem(THEME_KEY) || 'light';
    expect(newTheme).not.toBe(initialTheme);

    if (newTheme === 'dark') {
      expect(html.classList.contains('dark')).toBe(true);
    } else {
      expect(html.classList.contains('dark')).toBe(false);
    }
  });
});
