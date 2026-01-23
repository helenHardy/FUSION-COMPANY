-- Migration to add bank details to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS account_number TEXT;

-- Update the update_profile_data function to support these new fields if needed
-- Actually, we'll likely use a new RPC or update the profile via Supabase client directly 
-- but let's ensure the trigger for profile creation from auth metadata handles this.
