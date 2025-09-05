export type Role = 'owner' | 'manager' | 'server' | 'kitchen';

export type Permission =
  | 'menu.read'
  | 'menu.write'
  | 'order.read'
  | 'order.write'
  | 'notification.read'
  | 'notification.write'
  | 'audit.read';

const ROLE_PERMS: Record<Role, Permission[]> = {
  owner: [
    'menu.read', 'menu.write',
    'order.read', 'order.write',
    'notification.read', 'notification.write',
    'audit.read',
  ],
  manager: [
    'menu.read', 'menu.write',
    'order.read', 'order.write',
    'notification.read', 'notification.write',
    'audit.read',
  ],
  server: [
    'menu.read',
    'order.read', 'order.write',
    'notification.read'
  ],
  kitchen: [
    'menu.read',
    'order.read', 'order.write',
    'notification.read'
  ],
};

export function can(role: Role | null | undefined, permission: Permission) {
  if (!role) return false;
  return ROLE_PERMS[role].includes(permission);
}

