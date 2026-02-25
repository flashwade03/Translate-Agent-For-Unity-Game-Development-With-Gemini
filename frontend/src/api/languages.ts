import { api } from './client'
import type { ProjectLanguage, LanguageDeleteResult } from '../types'

export function fetchProjectLanguages(projectId: string) {
  return api<ProjectLanguage[]>('GET', `/api/projects/${projectId}/languages`)
}

export function addProjectLanguage(projectId: string, code: string, label: string) {
  return api<ProjectLanguage>('POST', `/api/projects/${projectId}/languages`, { code, label })
}

export function deleteProjectLanguage(projectId: string, code: string) {
  return api<LanguageDeleteResult>('DELETE', `/api/projects/${projectId}/languages/${encodeURIComponent(code)}`)
}
