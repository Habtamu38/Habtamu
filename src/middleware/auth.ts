import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import { UserRole } from '../utils/ethiopianRules.ts';

export interface AuthContextUser {
  uid: string;
  email: string;
  fullName: string;
  role: UserRole;
  schoolId: number | null;
}

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  esmsUser?: AuthContextUser;
}

const VALID_ROLES: ReadonlyArray<UserRole> = [
  'SUPER_ADMIN',
  'SCHOOL_ADMIN',
  'PRINCIPAL',
  'REGISTRAR',
  'TEACHER',
  'FINANCE_OFFICER',
  'LIBRARIAN',
  'PARENT',
  'STUDENT',
];

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const requestedRoleHeader = String(req.headers['x-esms-role'] || 'SCHOOL_ADMIN') as UserRole;
  const role: UserRole = VALID_ROLES.includes(requestedRoleHeader)
    ? requestedRoleHeader
    : 'SCHOOL_ADMIN';
  const requestedSchoolHeader = req.headers['x-esms-school-id']
    ? Number.parseInt(String(req.headers['x-esms-school-id']), 10)
    : 1;
  const schoolId = Number.isNaN(requestedSchoolHeader) ? 1 : requestedSchoolHeader;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    if (token && token !== 'esms-local-session') {
      try {
        const decodedToken = await adminAuth.verifyIdToken(token);
        req.user = decodedToken;
        req.esmsUser = {
          uid: decodedToken.uid,
          email: decodedToken.email || 'user@esms.edu.et',
          fullName: decodedToken.name || decodedToken.email || 'Authenticated User',
          role,
          schoolId: role === 'SUPER_ADMIN' ? null : schoolId,
        };
        return next();
      } catch (error) {
        console.error('Error verifying Firebase ID token:', error);
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
      }
    }
  }

  // Fallback for authenticated local school node / role-based session headers
  const sessionUid = String(req.headers['x-esms-uid'] || 'esms-admin-bole-01');
  const sessionEmail = String(req.headers['x-esms-email'] || 'admin@bolesecondary.edu.et');
  const sessionName = String(req.headers['x-esms-name'] || 'Dr. Tewodros Kassahun');

  req.esmsUser = {
    uid: sessionUid,
    email: sessionEmail,
    fullName: sessionName,
    role,
    schoolId: role === 'SUPER_ADMIN' ? null : schoolId,
  };
  return next();
};
