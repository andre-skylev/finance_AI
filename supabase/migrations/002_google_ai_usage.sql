-- Tabela para controle de uso do Google Document AI
CREATE TABLE IF NOT EXISTS public.google_ai_usage (
  date DATE PRIMARY KEY,
  count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.google_ai_usage ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
-- (Permitir acesso apenas por server-side com service_role)
CREATE POLICY "Allow full access for service_role"
ON public.google_ai_usage
FOR ALL
USING (true)
WITH CHECK (true);

-- Função para resetar o contador (opcional, para testes)
CREATE OR REPLACE FUNCTION reset_google_ai_usage()
RETURNS void AS $$
BEGIN
  DELETE FROM public.google_ai_usage;
END;
$$ LANGUAGE plpgsql;

-- Comentários
COMMENT ON TABLE public.google_ai_usage IS 'Registra o número de chamadas diárias à API do Google Document AI para controle de custos.';
COMMENT ON COLUMN public.google_ai_usage.date IS 'Data do registro de uso.';
COMMENT ON COLUMN public.google_ai_usage.count IS 'Número de chamadas realizadas no dia.';
COMMENT ON COLUMN public.google_ai_usage.updated_at IS 'Última atualização do contador no dia.';
