export type AuthUser = {
  id: string;
  email: string | null;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthUser;
};

export type AuthProvider = {
  signIn(email: string, password: string): Promise<AuthSession>;
  refreshSession(refreshToken: string): Promise<AuthSession>;
  getUser(accessToken: string): Promise<AuthUser>;
  requestPasswordReset(email: string): Promise<void>;
  signOut(accessToken: string): Promise<void>;
};

export class AuthInputError extends Error {}

export function readBearerToken(header: string | null): string {
  if (!header) throw new AuthInputError("Missing Authorization header");
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match?.[1]) throw new AuthInputError("Invalid Authorization header");
  return match[1];
}

export function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") throw new AuthInputError("Email is required");
  const email = value.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new AuthInputError("Invalid email");
  return email;
}

export function requirePassword(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new AuthInputError("Password is required");
  }
  return value;
}

export function requireRefreshToken(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new AuthInputError("Refresh token is required");
  }
  return value;
}

export function createIdentityService(provider: AuthProvider) {
  return {
    signIn(emailValue: unknown, passwordValue: unknown) {
      return provider.signIn(normalizeEmail(emailValue), requirePassword(passwordValue));
    },

    refreshSession(refreshTokenValue: unknown) {
      return provider.refreshSession(requireRefreshToken(refreshTokenValue));
    },

    authenticate(authorization: string | null) {
      return provider.getUser(readBearerToken(authorization));
    },

    async requestPasswordReset(emailValue: unknown) {
      await provider.requestPasswordReset(normalizeEmail(emailValue));
    },

    async signOut(authorization: string | null) {
      await provider.signOut(readBearerToken(authorization));
    },
  };
}
