interface ResetTokenEntry {
  email: string;
  expiresAt: Date;
}

const store = new Map<string, ResetTokenEntry>();

export const resetTokenStore = {
  set(token: string, email: string, ttlMs = 3600000) {
    store.set(token, { email, expiresAt: new Date(Date.now() + ttlMs) });
  },

  get(token: string): ResetTokenEntry | undefined {
    const entry = store.get(token);
    if (!entry) return undefined;
    if (entry.expiresAt < new Date()) {
      store.delete(token);
      return undefined;
    }
    return entry;
  },

  delete(token: string) {
    store.delete(token);
  },
};
