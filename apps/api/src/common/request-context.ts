export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  deviceId?: string;
}
