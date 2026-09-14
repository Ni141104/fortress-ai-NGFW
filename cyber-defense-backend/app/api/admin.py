"""Administrator-only user provisioning."""

from fastapi import APIRouter, Depends, HTTPException

from api.deps import get_current_user
from core.security import hash_password
from database.db import get_store
from schemas.auth import AdminUserCreateRequest, UserOut

router = APIRouter(prefix="/admin", tags=["admin"])
ADMIN_EMAIL = "nikhilprajapati1411@gmail.com"


async def get_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin" and user.get("email", "").lower() != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Administrator access required")
    return user


@router.get("/users", response_model=list[UserOut])
async def list_users(_: dict = Depends(get_admin)):
    return await get_store().list_users()


@router.post("/users", response_model=UserOut, status_code=201)
async def create_user(body: AdminUserCreateRequest, _: dict = Depends(get_admin)):
    store = get_store()
    if await store.get_user_by_email(body.email):
        raise HTTPException(status_code=409, detail="Email already registered")
    username = body.email.split("@", 1)[0][:64]
    if await store.get_user_by_username(username):
        username = f"{username}_{body.role}"
    user = await store.create_user(username, body.email, hash_password(body.password), body.role)
    return UserOut(**user)