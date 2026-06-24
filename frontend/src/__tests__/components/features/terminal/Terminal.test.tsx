import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Terminal from '@/components/features/terminal/Terminal';
import { createMockTerminalEntry } from '@/test-utils/factories';

describe('Terminal', () => {
  it('renders boot header', () => {
    render(<Terminal isTerminalCollapsed={false} setIsTerminalCollapsed={() => {}} terminalEndRef={{ current: null }} appState="idle" />);
    expect(screen.getByText(/Welcome to Horizon AI/i)).toBeInTheDocument();
  });

  it('renders terminal entries', () => {
    const entries = [
      createMockTerminalEntry({ id: '1', type: 'command', text: 'run refactor' }),
      createMockTerminalEntry({ id: '2', type: 'system', text: 'System ready' }),
    ];
    render(
      <Terminal
        isTerminalCollapsed={false}
        setIsTerminalCollapsed={() => {}}
        terminalEndRef={{ current: null }}
        terminalEntries={entries}
        appState="idle"
      />
    );
    expect(screen.getByText('run refactor')).toBeInTheDocument();
  });

  it('renders collapsible header', () => {
    render(<Terminal isTerminalCollapsed={false} setIsTerminalCollapsed={() => {}} terminalEndRef={{ current: null }} appState="idle" />);
    expect(screen.getByText('Terminal')).toBeInTheDocument();
  });
});
