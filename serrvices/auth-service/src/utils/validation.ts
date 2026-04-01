import { createHash } from 'crypto';

export function isAdult(dateOfBirth: string): boolean {
  const [dayStr, monthStr, yearStr] = dateOfBirth.split('/');
  const day = Number(dayStr);
  const month = Number(monthStr);
  const year = Number(yearStr);
  if (
    Number.isNaN(day) ||
    Number.isNaN(month) ||
    Number.isNaN(year) ||
    day < 1 ||
    day > 31 ||
    month < 1 ||
    month > 12
  ) {
    return false;
  }
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  const today = new Date();
  const age =
    today.getFullYear() -
    parsed.getFullYear() -
    (today.getMonth() < parsed.getMonth() ||
    (today.getMonth() === parsed.getMonth() && today.getDate() < parsed.getDate())
      ? 1
      : 0);
  return age >= 18;
}

export function hashOtp(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function isStrongPassword(password: string): boolean {
  if (password.length < 10) {
    return false;
  }
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /\d/.test(password);
  return hasLetter && hasNumber;
}

export default {
  isAdult,
  hashOtp,
  isStrongPassword,
};
