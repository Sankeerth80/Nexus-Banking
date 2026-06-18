import { validatePassword } from './password-policy';

describe('Password Policy Validation', () => {
  it('should pass for a strong password', () => {
    const result = validatePassword('Strong@1234');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail for a password less than 8 characters', () => {
    const result = validatePassword('S@1234');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      'Password must be at least 8 characters long.',
    );
  });

  it('should fail if password does not contain an uppercase letter', () => {
    const result = validatePassword('strong@1234');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      'Password must contain at least one uppercase letter.',
    );
  });

  it('should fail if password does not contain a lowercase letter', () => {
    const result = validatePassword('STRONG@1234');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      'Password must contain at least one lowercase letter.',
    );
  });

  it('should fail if password does not contain a number', () => {
    const result = validatePassword('Strong@pass');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      'Password must contain at least one number.',
    );
  });

  it('should fail if password does not contain a special character', () => {
    const result = validatePassword('Strong1234');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      'Password must contain at least one special character.',
    );
  });
});
