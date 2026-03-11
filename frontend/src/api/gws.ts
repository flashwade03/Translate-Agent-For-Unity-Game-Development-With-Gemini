import { api } from './client'

export interface GwsAuthStatus {
  authenticated: boolean
  cliInstalled: boolean
  message?: string
}

export function fetchGwsAuthStatus() {
  return api<GwsAuthStatus>('GET', '/api/gws/auth-status')
}
