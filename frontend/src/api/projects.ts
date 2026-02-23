import { api } from './client'
import type { Project, CreateProjectPayload } from '../types'

export function fetchProjects() {
  return api<Project[]>('GET', '/api/projects')
}

export function fetchProject(projectId: string) {
  return api<Project>('GET', `/api/projects/${projectId}`)
}

export function createProject(payload: CreateProjectPayload) {
  return api<Project>('POST', '/api/projects', payload)
}
