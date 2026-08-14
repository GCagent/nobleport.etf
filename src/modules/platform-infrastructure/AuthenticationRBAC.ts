/**
 * Module 49 — Authentication & RBAC
 * Role-based access (municipal, GC, inspector, investor, admin) with audit logging
 */

export type Role = 'ADMIN' | 'MUNICIPAL' | 'GENERAL_CONTRACTOR' | 'INSPECTOR' | 'INVESTOR' | 'SUBCONTRACTOR' | 'AUDITOR' | 'AI_SYSTEM';

export interface User {
  userId: string;
  walletAddress: string;
  ensName: string | null;
  roles: Role[];
  permissions: Permission[];
  authMethod: 'SIWE' | 'OIDC' | 'API_KEY' | 'ZKSBT';
  lastLoginAt: number | null;
  createdAt: number;
  active: boolean;
  mfaEnabled: boolean;
}

export interface Permission {
  resource: string;
  actions: ('CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXECUTE')[];
  conditions?: Record<string, unknown>;
}

export interface AuthEvent {
  eventId: string;
  userId: string;
  eventType: 'LOGIN' | 'LOGOUT' | 'ACCESS_GRANTED' | 'ACCESS_DENIED' | 'ROLE_CHANGED' | 'MFA_CHALLENGE';
  resource: string | null;
  action: string | null;
  success: boolean;
  ipAddress: string;
  userAgent: string;
  timestamp: number;
  details: string;
}

export interface SessionToken {
  token: string;
  userId: string;
  roles: Role[];
  issuedAt: number;
  expiresAt: number;
  refreshable: boolean;
}

// Role-based permission matrix
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    { resource: '*', actions: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXECUTE'] },
  ],
  MUNICIPAL: [
    { resource: 'permits', actions: ['CREATE', 'READ', 'UPDATE'] },
    { resource: 'inspections', actions: ['READ'] },
    { resource: 'transparency-portal', actions: ['READ'] },
  ],
  GENERAL_CONTRACTOR: [
    { resource: 'permits', actions: ['CREATE', 'READ'] },
    { resource: 'escrow', actions: ['READ'] },
    { resource: 'daily-logs', actions: ['CREATE', 'READ'] },
    { resource: 'rfis', actions: ['CREATE', 'READ', 'UPDATE'] },
    { resource: 'subcontractors', actions: ['READ'] },
    { resource: 'safety-checklists', actions: ['CREATE', 'READ'] },
  ],
  INSPECTOR: [
    { resource: 'permits', actions: ['READ'] },
    { resource: 'inspections', actions: ['CREATE', 'READ', 'UPDATE'] },
    { resource: 'safety-checklists', actions: ['READ'] },
  ],
  INVESTOR: [
    { resource: 'portfolio', actions: ['READ'] },
    { resource: 'distributions', actions: ['READ'] },
    { resource: 'properties', actions: ['READ'] },
    { resource: 'secondary-market', actions: ['CREATE', 'READ'] },
  ],
  SUBCONTRACTOR: [
    { resource: 'permits', actions: ['READ'] },
    { resource: 'escrow', actions: ['READ'] },
    { resource: 'daily-logs', actions: ['CREATE', 'READ'] },
  ],
  AUDITOR: [
    { resource: '*', actions: ['READ'] },
    { resource: 'audit-bundles', actions: ['CREATE', 'READ'] },
  ],
  AI_SYSTEM: [
    { resource: 'permits', actions: ['READ'] },
    { resource: 'compliance', actions: ['READ', 'EXECUTE'] },
    { resource: 'ai-audit-log', actions: ['CREATE', 'READ'] },
  ],
};

export class AuthenticationRBAC {
  private users = new Map<string, User>();
  private auditLog: AuthEvent[] = [];
  private sessions = new Map<string, SessionToken>();
  private userCounter = 0;
  private eventCounter = 0;

  async createUser(
    walletAddress: string,
    roles: Role[],
    authMethod: User['authMethod'],
    ensName?: string
  ): Promise<User> {
    const userId = `user-${++this.userCounter}`;

    // Aggregate permissions from roles
    const permissions = this.aggregatePermissions(roles);

    const user: User = {
      userId,
      walletAddress,
      ensName: ensName ?? null,
      roles,
      permissions,
      authMethod,
      lastLoginAt: null,
      createdAt: Date.now(),
      active: true,
      mfaEnabled: false,
    };

    this.users.set(userId, user);
    return user;
  }

  async authenticate(
    walletAddress: string,
    signature: string,
    ipAddress: string,
    userAgent: string
  ): Promise<SessionToken> {
    const user = Array.from(this.users.values()).find((u) => u.walletAddress === walletAddress);
    if (!user || !user.active) {
      await this.logEvent(walletAddress, 'LOGIN', null, null, false, ipAddress, userAgent, 'User not found or inactive');
      throw new Error('Authentication failed');
    }

    // In production: verify SIWE signature
    if (signature.length < 64) {
      await this.logEvent(user.userId, 'LOGIN', null, null, false, ipAddress, userAgent, 'Invalid signature');
      throw new Error('Invalid signature');
    }

    const token: SessionToken = {
      token: `session-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      userId: user.userId,
      roles: user.roles,
      issuedAt: Date.now(),
      expiresAt: Date.now() + 3600000, // 1 hour
      refreshable: true,
    };

    user.lastLoginAt = Date.now();
    this.sessions.set(token.token, token);

    await this.logEvent(user.userId, 'LOGIN', null, null, true, ipAddress, userAgent, 'Login successful');
    return token;
  }

  async authorize(
    sessionToken: string,
    resource: string,
    action: Permission['actions'][number],
    ipAddress: string = ''
  ): Promise<boolean> {
    const session = this.sessions.get(sessionToken);
    if (!session || session.expiresAt < Date.now()) {
      return false;
    }

    const user = this.users.get(session.userId);
    if (!user || !user.active) return false;

    const authorized = user.permissions.some(
      (p) => (p.resource === '*' || p.resource === resource) && p.actions.includes(action)
    );

    await this.logEvent(
      user.userId,
      authorized ? 'ACCESS_GRANTED' : 'ACCESS_DENIED',
      resource,
      action,
      authorized,
      ipAddress,
      '',
      `${action} on ${resource}: ${authorized ? 'granted' : 'denied'}`
    );

    return authorized;
  }

  async addRole(userId: string, role: Role): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error(`User ${userId} not found`);

    if (!user.roles.includes(role)) {
      user.roles.push(role);
      user.permissions = this.aggregatePermissions(user.roles);
    }

    return user;
  }

  private aggregatePermissions(roles: Role[]): Permission[] {
    const permMap = new Map<string, Set<string>>();

    for (const role of roles) {
      const rolePerms = ROLE_PERMISSIONS[role] ?? [];
      for (const perm of rolePerms) {
        const existing = permMap.get(perm.resource) ?? new Set();
        for (const action of perm.actions) existing.add(action);
        permMap.set(perm.resource, existing);
      }
    }

    return Array.from(permMap.entries()).map(([resource, actions]) => ({
      resource,
      actions: Array.from(actions) as Permission['actions'],
    }));
  }

  private async logEvent(
    userId: string,
    eventType: AuthEvent['eventType'],
    resource: string | null,
    action: string | null,
    success: boolean,
    ipAddress: string,
    userAgent: string,
    details: string
  ): Promise<void> {
    this.auditLog.push({
      eventId: `auth-${++this.eventCounter}`,
      userId, eventType, resource, action, success,
      ipAddress, userAgent, timestamp: Date.now(), details,
    });
  }

  getUser(userId: string): User | undefined { return this.users.get(userId); }
  getAuditLog(userId?: string): AuthEvent[] {
    return userId ? this.auditLog.filter((e) => e.userId === userId) : [...this.auditLog];
  }
}
