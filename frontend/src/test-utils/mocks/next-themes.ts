import { vi } from 'vitest';

export function mockUseTheme() {
  vi.mock('next-themes', () => ({
    useTheme: () => ({
      resolvedTheme: 'dark',
      setTheme: vi.fn(),
      theme: 'dark',
    }),
    ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  }));
}
