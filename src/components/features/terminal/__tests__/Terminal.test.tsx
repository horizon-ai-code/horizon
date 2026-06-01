import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Terminal from '@/components/features/terminal/Terminal';

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'dark' }),
}));

const mountTerminal = async (props: Record<string, unknown> = {}) => {
  const result = render(
    <Terminal
      isTerminalCollapsed={false}
      setIsTerminalCollapsed={vi.fn()}
      terminalEndRef={{ current: null }}
      appState="idle"
      {...props}
    />
  );
  await act(async () => {
    await new Promise((r) => requestAnimationFrame(r));
  });
  return result;
};

describe('Terminal', () => {
  it('renders terminal header', async () => {
    await mountTerminal();
    expect(screen.getByText('Terminal')).toBeInTheDocument();
  });

  it('shows collapsed icon when expanded', async () => {
    await mountTerminal();
    expect(screen.getByTitle('Collapse Terminal')).toBeInTheDocument();
  });

  it('renders command entries', async () => {
    await mountTerminal({
      terminalEntries: [{ id: '1', type: 'command', text: 'Refactor this code' }],
    });
    expect(screen.getByText('Refactor this code')).toBeInTheDocument();
  });

  it('renders log entries', async () => {
    await mountTerminal({
      terminalEntries: [
        { id: '1', type: 'log', text: '[Planner]: Analyzing', icon: 'Cpu', colorClass: 'text-blue-400' },
      ],
    });
    expect(screen.getByText('[Planner]: Analyzing')).toBeInTheDocument();
  });

  it('renders error entries', async () => {
    await mountTerminal({
      terminalEntries: [{ id: '1', type: 'error', text: 'Something went wrong' }],
    });
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Execution Error')).toBeInTheDocument();
  });

  it('shows BUSY badge when appState is waiting', async () => {
    await mountTerminal({ appState: 'waiting' });
    expect(screen.getByText('BUSY')).toBeInTheDocument();
  });

  it('shows ANALYZING badge when appState is analyzing', async () => {
    await mountTerminal({ appState: 'analyzing' });
    expect(screen.getByText('ANALYZING')).toBeInTheDocument();
  });

  it('toggles collapse on header click', async () => {
    const setIsTerminalCollapsed = vi.fn();
    await mountTerminal({ setIsTerminalCollapsed });
    const header = screen.getByRole('button', { name: /collapse terminal/i });
    await userEvent.click(header);
    expect(setIsTerminalCollapsed).toHaveBeenCalledWith(true);
  });

  it('has keyboard accessible collapsible header', async () => {
    const setIsTerminalCollapsed = vi.fn();
    await mountTerminal({ setIsTerminalCollapsed });
    const header = screen.getByRole('button', { name: /collapse terminal/i });
    header.focus();
    await userEvent.keyboard('{Enter}');
    expect(setIsTerminalCollapsed).toHaveBeenCalledWith(true);
  });

  it('hides terminal body when collapsed', async () => {
    await mountTerminal({ isTerminalCollapsed: true });
    expect(screen.queryByText(/Horizon AI/)).not.toBeInTheDocument();
  });

  it('shows Horizon boilerplate text when expanded', async () => {
    await mountTerminal();
    expect(screen.getByText(/Horizon AI/)).toBeInTheDocument();
  });

  it('renders mixed entries correctly', async () => {
    await mountTerminal({
      terminalEntries: [
        { id: '1', type: 'command', text: 'cmd1' },
        { id: '2', type: 'log', text: '[Planner]: log1', icon: 'Cpu', colorClass: 'text-blue-400' },
        { id: '3', type: 'error', text: 'err1' },
      ],
    });
    expect(screen.getByText('cmd1')).toBeInTheDocument();
    expect(screen.getByText('[Planner]: log1')).toBeInTheDocument();
    expect(screen.getByText('err1')).toBeInTheDocument();
  });
});
