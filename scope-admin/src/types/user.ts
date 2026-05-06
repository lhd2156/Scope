export type UserStatus = 'active' | 'banned' | 'disabled' | 'pending';
export type UserRole = 'admin' | 'moderator' | 'user';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  role?: UserRole | string;
  roles?: string[];
  status?: UserStatus | string;
  created_at?: string;
  createdAt?: string;
  lastActiveAt?: string;
  stats?: {
    spots?: number;
    trips?: number;
    friends?: number;
  };
}

export interface AuthResponse {
  accessToken?: string;
  access_token?: string;
  token?: string;
  refreshToken?: string;
  refresh_token?: string;
  user?: UserProfile;
}

export interface UserListResponse {
  data: UserProfile[];
  total: number;
  page: number;
  pageSize: number;
}
