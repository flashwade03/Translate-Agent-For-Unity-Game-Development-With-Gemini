import { api, apiUpload } from './client'
import type { SheetData, CsvUploadResult } from '../types'

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

export function addLanguage(
  projectId: string,
  sheetName: string,
  code: string,
  label: string,
) {
  return api<{ ok: boolean; code: string; label: string }>(
    'POST',
    `/api/projects/${projectId}/sheets/${encodeURIComponent(sheetName)}/languages`,
    { code, label },
  )
}

export function deleteLanguage(
  projectId: string,
  sheetName: string,
  code: string,
) {
  return api<{ ok: boolean; deletedTranslations: number }>(
    'DELETE',
    `/api/projects/${projectId}/sheets/${encodeURIComponent(sheetName)}/languages/${encodeURIComponent(code)}`,
  )
}

export function addSheetRow(projectId: string, sheetName: string, key: string) {
  return api<{ ok: boolean; key: string }>(
    'POST',
    `/api/projects/${projectId}/sheets/${encodeURIComponent(sheetName)}/rows`,
    { key },
  )
}

export function createSheet(projectId: string, name: string) {
  return api<{ ok: boolean; name: string }>(
    'POST',
    `/api/projects/${projectId}/sheets`,
    { name },
  )
}

export function deleteSheet(projectId: string, sheetName: string) {
  return api<{ ok: boolean; deletedKeys: number }>(
    'DELETE',
    `/api/projects/${projectId}/sheets/${encodeURIComponent(sheetName)}`,
  )
}

export function deleteRows(projectId: string, sheetName: string, keys: string[]) {
  return api<{ ok: boolean; deletedCount: number }>(
    'DELETE',
    `/api/projects/${projectId}/sheets/${encodeURIComponent(sheetName)}/rows`,
    { keys },
  )
}

export function exportCsvUrl(projectId: string, sheetName: string) {
  return `/api/projects/${projectId}/sheets/${encodeURIComponent(sheetName)}/export`
}

export function uploadCsv(projectId: string, sheetName: string, file: File) {
  return apiUpload<CsvUploadResult>(
    `/api/projects/${projectId}/sheets/${encodeURIComponent(sheetName)}/upload`,
    file,
  )
}
