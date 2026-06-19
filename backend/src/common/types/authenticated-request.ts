import { EmployeeRole } from '@prisma/client';
import type { Request } from 'express';

export type CustomerRole = 'CUSTOMER';
export type AuthenticatedRole = EmployeeRole | CustomerRole;

export type AuthenticatedUser = {
  userId: string;
  email: string;
  role: AuthenticatedRole;
  sessionId?: string;
  deviceFingerprint?: string;
};

export type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

export type CookieRequest = Request & {
  cookies: Record<string, string | undefined>;
};

export type RouteAwareRequest = Request & {
  route?: {
    path?: string | RegExp | Array<string | RegExp>;
  };
};

export type UploadedBankingFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

export function assertEmployeeRole(role: AuthenticatedRole): EmployeeRole {
  if (role === 'CUSTOMER') {
    throw new Error('Employee role is required for this operation.');
  }

  return role;
}
