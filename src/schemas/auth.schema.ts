import * as v from 'valibot';

export const registerSchema = {
  body: v.pipe(
    v.object({
      name: v.optional(
        v.pipe(
          v.string('Name must be a string.'),
          v.trim(),
          v.minLength(2, 'Name must be at least 2 characters long.'),
          v.maxLength(100, 'Name cannot exceed 100 characters.')
        )
      ),
      namaLengkap: v.optional(
        v.pipe(
          v.string('Nama lengkap must be a string.'),
          v.trim(),
          v.minLength(2, 'Nama lengkap must be at least 2 characters long.'),
          v.maxLength(100, 'Nama lengkap cannot exceed 100 characters.')
        )
      ),
      email: v.pipe(
        v.string('Email is required.'),
        v.trim(),
        v.email('Please provide a valid email address.')
      ),
      password: v.optional(
        v.pipe(
          v.string('Password must be a string.'),
          v.minLength(8, 'Password must be at least 8 characters long.'),
          v.maxLength(128, 'Password cannot exceed 128 characters.')
        )
      ),
      kataSandi: v.optional(
        v.pipe(
          v.string('Kata sandi must be a string.'),
          v.minLength(8, 'Kata sandi must be at least 8 characters long.'),
          v.maxLength(128, 'Kata sandi cannot exceed 128 characters.')
        )
      ),
      confirmPassword: v.optional(v.string()),
      konfirmasiKataSandi: v.optional(v.string()),
      agreeTerms: v.optional(v.boolean()),
    }),
    v.check(
      (data) => Boolean(data.name || data.namaLengkap),
      'Full Name (namaLengkap or name) is required.'
    ),
    v.check(
      (data) => Boolean(data.password || data.kataSandi),
      'Password (kataSandi or password) is required.'
    ),
    v.check(
      (data) => (data.password || data.kataSandi) === (data.confirmPassword || data.konfirmasiKataSandi),
      'Password confirmation does not match password.'
    ),
    v.check(
      (data) => data.agreeTerms !== false,
      'You must agree to the Terms of Service and Privacy Policy.'
    )
  ),
};

export const loginSchema = {
  body: v.pipe(
    v.object({
      email: v.pipe(
        v.string('Email is required.'),
        v.trim(),
        v.email('Please provide a valid email address.')
      ),
      password: v.optional(
        v.pipe(
          v.string('Password must be a string.'),
          v.minLength(1, 'Password cannot be empty.')
        )
      ),
      kataSandi: v.optional(
        v.pipe(
          v.string('Kata sandi must be a string.'),
          v.minLength(1, 'Kata sandi cannot be empty.')
        )
      ),
      rememberMe: v.optional(v.boolean()),
    }),
    v.check(
      (data) => Boolean(data.password || data.kataSandi),
      'Password (kataSandi or password) is required.'
    )
  ),
};

export const refreshTokenSchema = {
  body: v.object({
    refreshToken: v.pipe(
      v.string('Refresh token is required.'),
      v.trim(),
      v.minLength(10, 'Invalid refresh token length.')
    ),
  }),
};
