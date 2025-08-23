'use client'

import { Progress } from "@/components/ui/progress"
import { Loader2, CheckCircle } from "lucide-react"
import { useLanguage } from '@/contexts/LanguageContext'

interface StatusEvent {
  message: string
  progress: number
}

interface UploadStatusProps {
  events: StatusEvent[]
  progress: number
}

export function UploadStatus({ events, progress }: UploadStatusProps) {
  const { t } = useLanguage()
  
  return (
    <div className="w-full max-w-md rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
      <h3 className="mb-4 text-lg font-semibold">{t('uploadStatus.processingTitle')}</h3>
      <Progress value={progress} className="mb-4" />
      <div className="max-h-48 space-y-2 overflow-y-auto text-sm text-muted-foreground">
        {events.filter(Boolean).map((event, index) => (
          <div key={index} className="flex items-center">
            <span className="mr-2">
              {event.progress < 100 ? (
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
            </span>
            <p>{event.message}</p>
          </div>
        ))}
      </div>
      {progress < 100 && (
        <p className="mt-4 text-xs text-center text-muted-foreground">
          {t('uploadStatus.pleaseWait')}
        </p>
      )}
    </div>
  )
}
