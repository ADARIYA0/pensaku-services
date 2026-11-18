import * as v from 'valibot';

export const linkAccountSchema = {
  body: v.pipe(
    v.object({
      email: v.optional(
        v.pipe(
          v.string('Email must be a string.'),
          v.trim(),
          v.minLength(3, 'Email must be at least 3 characters.')
        )
      ),
      nrp: v.optional(
        v.pipe(
          v.string('NRP must be a string.'),
          v.trim(),
          v.regex(/^\d{10}$/, 'NRP must be exactly 10 numeric digits.')
        )
      ),
      password: v.pipe(
        v.string('Password is required.'),
        v.minLength(1, 'Password cannot be empty.'),
        v.maxLength(128, 'Password cannot exceed 128 characters.')
      ),
      userEmail: v.optional(v.pipe(v.string(), v.trim())),
    }),
    v.check(
      (data) => Boolean(data.email || data.nrp),
      'Either campus email (NetID) or NRP is required to link ETHOL account.'
    )
  ),
};

export const unlinkAccountSchema = {
  body: v.pipe(
    v.object({
      email: v.optional(v.pipe(v.string(), v.trim())),
      nrp: v.optional(v.pipe(v.string(), v.trim())),
    }),
    v.check(
      (data) => Boolean(data.email || data.nrp),
      'Either campus email or NRP is required to unlink ETHOL account.'
    )
  ),
};

export const syncDataSchema = {
  body: v.pipe(
    v.object({
      email: v.optional(v.pipe(v.string(), v.trim())),
      nrp: v.optional(v.pipe(v.string(), v.trim())),
      tahun: v.optional(v.pipe(v.number(), v.integer(), v.minValue(2000))),
      semester: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2))),
    }),
    v.check(
      (data) => Boolean(data.email || data.nrp),
      'Either campus email or NRP is required to sync ETHOL data.'
    )
  ),
};

export const studentQuerySchema = {
  query: v.pipe(
    v.object({
      email: v.optional(v.pipe(v.string(), v.trim())),
      nrp: v.optional(v.pipe(v.string(), v.trim())),
      refresh: v.optional(v.pipe(v.string(), v.trim())),
    }),
    v.check(
      (data) => Boolean(data.email || data.nrp),
      'Query parameter "email" or "nrp" is required.'
    )
  ),
};

export const nrpQuerySchema = studentQuerySchema;

export const coursesQuerySchema = {
  query: v.pipe(
    v.object({
      email: v.optional(v.pipe(v.string(), v.trim())),
      nrp: v.optional(v.pipe(v.string(), v.trim())),
      refresh: v.optional(v.pipe(v.string(), v.trim())),
      tahun: v.optional(
        v.pipe(v.string(), v.regex(/^\d{4}$/, 'Tahun must be a 4-digit year.'), v.transform(Number))
      ),
      semester: v.optional(
        v.pipe(v.string(), v.regex(/^[1-2]$/, 'Semester must be 1 or 2.'), v.transform(Number))
      ),
    }),
    v.check(
      (data) => Boolean(data.email || data.nrp),
      'Query parameter "email" or "nrp" is required.'
    )
  ),
};

export const attendanceQuerySchema = {
  query: v.pipe(
    v.object({
      email: v.optional(v.pipe(v.string(), v.trim())),
      nrp: v.optional(v.pipe(v.string(), v.trim())),
      refresh: v.optional(v.pipe(v.string(), v.trim())),
      courseId: v.optional(
        v.pipe(v.string(), v.regex(/^\d+$/, 'courseId must be a numeric ID.'), v.transform(Number))
      ),
    }),
    v.check(
      (data) => Boolean(data.email || data.nrp),
      'Query parameter "email" or "nrp" is required.'
    )
  ),
};
