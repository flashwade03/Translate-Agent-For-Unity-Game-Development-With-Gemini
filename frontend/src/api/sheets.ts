import { api } from './client'
import type { SheetData } from '../types'

export function fetchSheetNames(projectId: string) {
  return api<string[]>('GET', `/api/projects/${projectId}/sheets`)
}

export function fetchSheetData(projectId: string, sheetName: string) {
  return api<SheetData>('GET', `/api/projects/${projectId}/sheets/${encodeURIComponent(sheetName)}`)
}

export function updateSheetRows(
  projectId: string,
  sheetName: string,
  updates: { key: string; langCode: string; value: string }[],
) {
  return api<{ ok: boolean }>(
    'PUT',
    `/api/projects/${projectId}/sheets/${encodeURIComponent(sheetName)}/rows`,
    updates,
  )
}
