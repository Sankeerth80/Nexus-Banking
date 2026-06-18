import { SetMetadata } from '@nestjs/common';
import { EmployeeRole } from '@prisma/client';

export type UserRole = EmployeeRole | 'CUSTOMER';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
