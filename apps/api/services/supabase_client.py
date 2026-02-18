import os
from supabase import create_client, Client

# Initialize Supabase client
# Expects SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or ANON_KEY) in env
# For server-side operations (writing to DB without user token), usually SERVICE_ROLE_KEY is needed
# if Row Level Security (RLS) policies block anon.
# Use SERVICE_ROLE_KEY for the worker.

url: str = os.environ.get("SUPABASE_URL", "")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

_supabase: Client = None

def get_supabase_client() -> Client:
    global _supabase
    if _supabase is None:
        if not url or not key:
            print("Warning: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. persistence will fail.")
            # Return None or raise? Letting it return None and handling calls might be safer
            # creating a dummy client or raising error
            return None
        _supabase = create_client(url, key)
    return _supabase
