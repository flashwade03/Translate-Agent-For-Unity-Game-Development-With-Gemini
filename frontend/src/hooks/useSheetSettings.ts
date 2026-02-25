import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchSheetSettings, updateSheetSettings } from '../api/config'
import { QUERY_KEYS } from '../lib/constants'
import type { SheetSettings } from '../types'

export function useSheetSettings(projectId: string, sheetName: string) {
  return useQuery({
    queryKey: QUERY_KEYS.sheetSettings(projectId, sheetName),
    queryFn: () => fetchSheetSettings(projectId, sheetName),
    enabled: !!projectId && !!sheetName,
  })
}

export function useUpdateSheetSettings(projectId: string, sheetName: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (settings: SheetSettings) => updateSheetSettings(projectId, sheetName, settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sheetSettings(projectId, sheetName) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sheetData(projectId, sheetName) })
    },
  })
}
