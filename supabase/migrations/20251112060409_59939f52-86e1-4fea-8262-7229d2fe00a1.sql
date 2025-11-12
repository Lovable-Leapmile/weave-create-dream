-- Add updated_at column to documents table
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Drop the trigger if it exists
DROP TRIGGER IF EXISTS update_documents_updated_at ON public.documents;

-- Create trigger for automatic timestamp updates on documents table
CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();