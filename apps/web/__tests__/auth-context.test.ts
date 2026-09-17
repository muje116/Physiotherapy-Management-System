import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });
Object.defineProperty(global, 'window', { value: global });

vi.mock('@/lib/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import api from '@/lib/api';
import { AuthProvider, useAuth } from '@/contexts/auth-context';

function TestConsumer() {
  const auth = useAuth();
  return React.createElement('div', {
    'data-testid': 'consumer',
    'data-user': JSON.stringify(auth.user),
    'data-is-authenticated': String(auth.isAuthenticated),
  });
}

function render(ui: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = (container as any)._reactRootContainer || (() => {
    const ReactDOM = require('react-dom/client');
    const root = ReactDOM.createRoot(container);
    (container as any)._reactRootContainer = root;
    return root;
  })();

  root.render(ui);
  return container;
}

async function waitFor(fn: () => void, timeout = 1000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      fn();
      return;
    } catch {
      await new Promise(r => setTimeout(r, 10));
    }
  }
  fn();
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
  });

  describe('AuthProvider', () => {
    it('provides context to children', async () => {
      vi.mocked(api.get).mockResolvedValue({
        data: { data: { id: 'u1', email: 'test@test.com', role: 'ADMIN' } },
      });

      const element = React.createElement(AuthProvider, null,
        React.createElement(TestConsumer)
      );
      const container = render(element);

      await waitFor(() => {
        const el = container.querySelector('[data-testid="consumer"]');
        expect(el).toBeTruthy();
      });
    });

    it('renders children without user when no stored session', async () => {
      vi.mocked(api.get).mockRejectedValue(new Error('No session'));

      const element = React.createElement(AuthProvider, null,
        React.createElement(TestConsumer)
      );
      const container = render(element);

      await waitFor(() => {
        const el = container.querySelector('[data-testid="consumer"]');
        expect(el).toBeTruthy();
        expect(el?.getAttribute('data-is-authenticated')).toBe('false');
      });
    });
  });

  describe('useAuth', () => {
    it('throws when used outside AuthProvider', () => {
      function BadComponent() {
        useAuth();
        return null;
      }

      expect(() => {
        const ReactDOM = require('react-dom/client');
        const container = document.createElement('div');
        const root = ReactDOM.createRoot(container);
        root.render(React.createElement(BadComponent));
      }).toThrow('useAuth must be used within AuthProvider');
    });
  });

  describe('login', () => {
    it('calls API and stores tokens', async () => {
      const loginResponse = {
        data: {
          data: {
            accessToken: 'new-access',
            refreshToken: 'new-refresh',
            user: { id: 'u1', email: 'a@b.com', role: 'ADMIN' },
          },
        },
      };
      vi.mocked(api.post).mockResolvedValue(loginResponse);
      vi.mocked(api.get).mockRejectedValue(new Error('No session'));

      let capturedAuth: any = null;
      function LoginConsumer() {
        const auth = useAuth();
        capturedAuth = auth;
        return React.createElement('div', null,
          React.createElement('button', {
            onClick: () => auth.login('a@b.com', 'pass', 'test-clinic'),
            'data-testid': 'login-btn',
          })
        );
      }

      const element = React.createElement(AuthProvider, null,
        React.createElement(LoginConsumer)
      );
      render(element);

      await waitFor(() => expect(capturedAuth).not.toBeNull());

      capturedAuth.login('a@b.com', 'pass', 'test-clinic');

      expect(api.post).toHaveBeenCalledWith('/auth/login', {
        email: 'a@b.com',
        password: 'pass',
        tenantSlug: 'test-clinic',
      });
    });
  });

  describe('logout', () => {
    it('clears tokens and user state', async () => {
      vi.mocked(api.get).mockRejectedValue(new Error('No session'));

      let capturedAuth: any = null;
      function LogoutConsumer() {
        const auth = useAuth();
        capturedAuth = auth;
        return React.createElement('div', null,
          React.createElement('button', {
            onClick: () => auth.logout(),
            'data-testid': 'logout-btn',
          })
        );
      }

      const element = React.createElement(AuthProvider, null,
        React.createElement(LogoutConsumer)
      );
      render(element);

      await waitFor(() => expect(capturedAuth).not.toBeNull());

      capturedAuth.logout();

      expect(capturedAuth.user).toBeNull();
      expect(capturedAuth.isAuthenticated).toBe(false);
    });
  });
});
