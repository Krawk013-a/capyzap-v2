-- Add key backup columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS encrypted_private_key TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS key_backup_salt TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS public_key TEXT;
