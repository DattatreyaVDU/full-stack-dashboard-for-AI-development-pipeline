// Re-export everything from AuthContext so existing imports continue to work
export { useAuth, AuthProvider } from './AuthContext';
export type { AuthUser, GithubProfile } from './AuthContext';
