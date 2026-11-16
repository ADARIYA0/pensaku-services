export interface RegisterRequestBody {
  name?: string;
  namaLengkap?: string;
  email: string;
  password?: string;
  kataSandi?: string;
  confirmPassword?: string;
  konfirmasiKataSandi?: string;
  agreeTerms?: boolean;
}

export interface LoginRequestBody {
  email: string;
  password?: string;
  kataSandi?: string;
  rememberMe?: boolean;
}

export interface RefreshTokenRequestBody {
  refreshToken: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface AuthResponseData {
  user: UserResponse;
  tokens: AuthTokens;
}

export interface JwtTokenPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}
