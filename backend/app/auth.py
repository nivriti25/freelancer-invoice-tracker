# pyrefly: ignore [missing-import]
from fastapi import Header, HTTPException, status
from typing import Optional
from uuid import UUID
import base64
import json

def decode_token_payload(token: str) -> dict:
    """
    Safely decode JWT payload without checking signature.
    Useful for client-side verified tokens in development/testing.
    """
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return {}
        payload = parts[1]
        payload += "=" * ((4 - len(payload) % 4) % 4)
        decoded = base64.urlsafe_b64decode(payload).decode("utf-8")
        return json.loads(decoded)
    except Exception:
        return {}

async def get_current_user_id(
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None, alias="X-User-ID")
) -> UUID:
    """
    Dependency to resolve the current user's UUID.
    First checks Authorization Bearer token (Supabase JWT),
    then falls back to X-User-ID header for dev/testing.
    """
    user_id_str = None

    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:]
        payload = decode_token_payload(token)
        user_id_str = payload.get("sub")

    if not user_id_str and x_user_id:
        user_id_str = x_user_id

    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials are required (Authorization header or X-User-ID header)"
        )

    try:
        return UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid User ID format"
        )
