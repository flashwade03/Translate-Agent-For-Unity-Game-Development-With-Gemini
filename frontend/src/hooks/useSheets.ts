import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchSheetNames, fetchSheetData, createSheet, deleteSheet, addSheetRow, deleteRows } from '../api/sheets'
import { QUERY_KEYS } from '../lib/constants'

export function useSheetNames(projectId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.sheets(projectId),
    queryFn: () => fetchSheetNames(projectId),
    enabled: !!projectId,
  })
}

export function useSheetData(projectId: string, sheetName: string) {
  return useQuery({
    queryKey: QUERY_KEYS.sheetData(projectId, sheetName),
    queryFn: () => fetchSheetData(projectId, sheetName),
    enabled: !!projectId && !!sheetName,
  })
}

export function useCreateSheet(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createSheet(projectId, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.sheets(projectId) })
    },
  })
}

export function useDeleteSheet(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sheetName: string) => deleteSheet(projectId, sheetName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.sheets(projectId) })
    },
  })
}

export function useAddRow(projectId: string, sheetName: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (key: string) => addSheetRow(projectId, sheetName, key),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.sheetData(projectId, sheetName) })
    },
  })
}

export function useDeleteRows(projectId: string, sheetName: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (keys: string[]) => deleteRows(projectId, sheetName, keys),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.sheetData(projectId, sheetName) })
    },
  })
}
