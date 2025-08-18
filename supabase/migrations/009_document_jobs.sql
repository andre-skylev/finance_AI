-- Queue de processamento de documentos (background jobs simples)
-- Data: 2025-08-18

CREATE TABLE IF NOT EXISTS public.document_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  filename TEXT NOT NULL,
  mimetype TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  file_base64 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued', -- queued | processing | completed | failed
  error TEXT,
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

-- Atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_document_jobs_updated ON public.document_jobs;
CREATE TRIGGER trg_document_jobs_updated
BEFORE UPDATE ON public.document_jobs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.document_jobs IS 'Fila simples de processamento de PDFs para background/external worker com polling no UI';
