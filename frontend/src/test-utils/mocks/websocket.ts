import { vi } from 'vitest';

type WsMessageHandler = (event: MessageEvent) => void;

export class MockWebSocket {
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: WsMessageHandler | null = null;
  onerror: ((e: Event) => void) | null = null;
  readyState: number = WebSocket.CONNECTING;
  sentMessages: string[] = [];
  private _handlers: Map<string, (data: unknown) => void> = new Map();

  constructor(_url: string) {
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.onopen?.();
    }, 0);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.();
  }

  receive(type: string, payload?: Record<string, unknown>) {
    const msg = new MessageEvent('message', {
      data: JSON.stringify({ type, ...payload }),
    });
    this.onmessage?.(msg);
  }

  addEventListener(_event: string, _handler: EventListener) {}

  removeEventListener(_event: string, _handler: EventListener) {}
}

export function mockWebSocket() {
  vi.stubGlobal('WebSocket', MockWebSocket);
}

export function createMockWs() {
  return new MockWebSocket('ws://localhost:8000/ws');
}
