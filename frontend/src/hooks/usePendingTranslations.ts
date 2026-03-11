import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchPendingTranslations,
  fetchPendingCount,
  applyTranslations,
  discardPending,
  updateSheetRows,
} from '../api/sheets'
import { QUERY_KEYS } from '../lib/constants'

export function usePendingTranslations(projectId: string, sheetName: string, enabled: boolean) {
  return useQuery({
    queryKey: QUERY_KEYS.pendingTranslations(projectId, sheetName),
    queryFn: () => fetchPendingTranslations(projectId, sheetName),
    enabled,
  })
}

export function usePendingCount(projectId: string, sheetName: string, enabled: boolean) {
  return useQuery({
    queryKey: QUERY_KEYS.pendingCount(projectId, sheetName),
    queryFn: () => fetchPendingCount(projectId, sheetName),
    enabled,
  })
}

export function useApplyTranslations(projectId: string, sheetName: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => applyTranslations(projectId, sheetName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sheetData(projectId, sheetName) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingCount(projectId, sheetName) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingTranslations(projectId, sheetName) })
    },
  })
}

export function useDiscardPending(projectId: string, sheetName: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => discardPending(projectId, sheetName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingCount(projectId, sheetName) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingTranslations(projectId, sheetName) })
    },
  })
}

export function useSavePending(projectId: string, sheetName: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (updates: { key: string; langCode: string; value: string }[]) =>
      updateSheetRows(projectId, sheetName, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingCount(projectId, sheetName) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingTranslations(projectId, sheetName) })
    },
  })
}
