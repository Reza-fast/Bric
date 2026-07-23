/** Shared password strength rules for register + profile change. */

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 200;

export type PasswordRequirementKey = "length" | "upper" | "number" | "special";

export function passwordRequirements(password: string): Record<PasswordRequirementKey, boolean> {
  return {
    length: password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH,
    upper: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

export function isStrongPassword(password: string): boolean {
  const r = passwordRequirements(password);
  return r.length && r.upper && r.number && r.special;
}
