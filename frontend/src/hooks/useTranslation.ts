import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { triggerJob, pollJob } from '../api/translation'
import { QUERY_KEYS } from '../lib/constants'
import type { TranslationJob, JobType } from '../types'

const USE_MOCK = import.meta.env.VITE_MOCK_API !== 'false'

function getWsUrl(jobId: string): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}/ws/jobs/${jobId}`
}

export function useTranslation(projectId: string, sheetName: string) {
  const queryClient = useQueryClient()
  const [activeJob, setActiveJob] = useState<TranslationJob | null>(null)
  const [wsJob, setWsJob] = useState<TranslationJob | null>(null)
  const [wsFailed, setWsFailed] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  const jobIsActive =
    !!activeJob && activeJob.status !== 'completed' && activeJob.status !== 'failed'

  // --- WebSocket connection (real API only) ---
  useEffect(() => {
    if (USE_MOCK || !jobIsActive || !activeJob) return

    const ws = new WebSocket(getWsUrl(activeJob.jobId))
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        const updated: TranslationJob = {
          jobId: data.jobId,
          projectId: activeJob.projectId,
          sheetName: activeJob.sheetName,
          type: activeJob.type,
          status: data.status,
          progress: data.progress ?? 0,
          totalKeys: data.totalKeys ?? activeJob.totalKeys,
          processedKeys: data.processedKeys ?? 0,
          error: data.error ?? undefined,
          createdAt: activeJob.createdAt,
        }
        setWsJob(updated)
      } catch {
        // Ignore malformed messages
      }
    }

    ws.onerror = () => {
      setWsFailed(true)
    }

    ws.onclose = () => {
      wsRef.current = null
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [jobIsActive, activeJob?.jobId])  // eslint-disable-line react-hooks/exhaustive-deps

  // --- Polling fallback (mock mode OR WebSocket failure) ---
  const usePoll = USE_MOCK || wsFailed
  const { data: polledJob, isError: pollError } = useQuery({
    queryKey: QUERY_KEYS.job(activeJob?.jobId ?? ''),
    queryFn: () => pollJob(activeJob!.jobId),
    enabled: usePoll && jobIsActive,
    refetchInterval: 1500,
    retry: 1,
  })

  // If polling fails (e.g., 404 after server restart), clear the stale job
  useEffect(() => {
    if (pollError && activeJob) {
      setActiveJob(null)
      setWsJob(null)
    }
  }, [pollError, activeJob])

  // Determine current job state: prefer WS data, fallback to polled, then activeJob
  const currentJob = (!USE_MOCK && !wsFailed && wsJob) ? wsJob : (polledJob ?? activeJob)

  // When job completes, invalidate sheet data and clean up WS
  if (currentJob?.status === 'completed' && activeJob?.status !== 'completed') {
    setActiveJob(currentJob)
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sheetData(projectId, sheetName) })
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.jobHistory(projectId) })
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }
  if (currentJob?.status === 'failed' && activeJob?.status !== 'failed') {
    setActiveJob(currentJob)
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }

  const trigger = useCallback(
    async (type: JobType) => {
      setWsJob(null)
      setWsFailed(false)
      const job = await triggerJob(projectId, sheetName, type)
      setActiveJob(job)
    },
    [projectId, sheetName],
  )

  const dismiss = useCallback(() => {
    setActiveJob(null)
    setWsJob(null)
    setWsFailed(false)
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  return {
    job: currentJob,
    isRunning: !!currentJob && currentJob.status !== 'completed' && currentJob.status !== 'failed',
    trigger,
    dismiss,
  }
}
