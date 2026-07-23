/** Password strength for register + profile change. */

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 200;

export function isStrongPassword(password: string): boolean {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return false;
  }
  if (!/[A-Z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
}

export const STRONG_PASSWORD_HINT =
  `At least ${PASSWORD_MIN_LENGTH} characters, with an uppercase letter, a number, and a special character`;
