import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchGlossary,
  addGlossaryEntry,
  updateGlossaryEntry,
  deleteGlossaryEntry,
} from '../api/config'
import { QUERY_KEYS } from '../lib/constants'
import type { GlossaryEntry } from '../types'

export function useGlossary(projectId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.glossary(projectId),
    queryFn: () => fetchGlossary(projectId),
    enabled: !!projectId,
  })
}

export function useAddGlossaryEntry(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (entry: Omit<GlossaryEntry, 'id'>) => addGlossaryEntry(projectId, entry),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.glossary(projectId) })
    },
  })
}

export function useUpdateGlossaryEntry(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ entryId, data }: { entryId: string; data: Partial<GlossaryEntry> }) =>
      updateGlossaryEntry(projectId, entryId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.glossary(projectId) })
    },
  })
}

export function useDeleteGlossaryEntry(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (entryId: string) => deleteGlossaryEntry(projectId, entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.glossary(projectId) })
    },
  })
}
