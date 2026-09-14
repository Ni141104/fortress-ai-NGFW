"""Authentication endpoints: register, login, me."""

import logging

from fastapi import APIRouter, Depends, HTTPException

from api.deps import get_current_user
from core.security import create_access_token, hash_password, verify_password
from database.db import get_store
from schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserOut

logger = logging.getLogger("cyber.api.auth")
router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest):
    store = get_store()
    if await store.get_user_by_username(body.username):
        raise HTTPException(status_code=409, detail="Username already taken")
    if await store.get_user_by_email(body.email):
        raise HTTPException(status_code=409, detail="Email already registered")
    user = await store.create_user(body.username, body.email, hash_password(body.password), "blue")
    token = create_access_token(str(user["id"]))
    return TokenResponse(access_token=token, user=UserOut(**user))


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    store = get_store()
    user = await store.get_user_by_email(body.username)
    if user is None:
        user = await store.get_user_by_username(body.username)
    if user is None or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token(str(user["id"]))
    return TokenResponse(access_token=token, user=UserOut(**user))


@router.get("/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return UserOut(**user)
