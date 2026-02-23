import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { triggerJob, pollJob } from '../api/translation'
import { QUERY_KEYS } from '../lib/constants'
import type { TranslationJob, JobType } from '../types'

export function useTranslation(projectId: string, sheetName: string) {
  const queryClient = useQueryClient()
  const [activeJob, setActiveJob] = useState<TranslationJob | null>(null)

  const { data: polledJob } = useQuery({
    queryKey: QUERY_KEYS.job(activeJob?.jobId ?? ''),
    queryFn: () => pollJob(activeJob!.jobId),
    enabled: !!activeJob && activeJob.status !== 'completed' && activeJob.status !== 'failed',
    refetchInterval: 1500,
  })

  // Sync polled result back
  const currentJob = polledJob ?? activeJob

  // When job completes, invalidate sheet data
  if (currentJob?.status === 'completed' && activeJob?.status !== 'completed') {
    setActiveJob(currentJob)
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sheetData(projectId, sheetName) })
  }
  if (currentJob?.status === 'failed' && activeJob?.status !== 'failed') {
    setActiveJob(currentJob)
  }

  const trigger = useCallback(
    async (type: JobType) => {
      const job = await triggerJob(projectId, sheetName, type)
      setActiveJob(job)
    },
    [projectId, sheetName],
  )

  const dismiss = useCallback(() => setActiveJob(null), [])

  return {
    job: currentJob,
    isRunning: !!currentJob && currentJob.status !== 'completed' && currentJob.status !== 'failed',
    trigger,
    dismiss,
  }
}
