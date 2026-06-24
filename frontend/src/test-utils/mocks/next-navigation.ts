import { vi } from 'vitest';

export function mockUseRouter() {
  vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    useParams: () => ({}),
    usePathname: () => '/',
  }));
}
