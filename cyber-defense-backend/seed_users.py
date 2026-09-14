"""Seed admin, blue team, and red team users into the database."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "app"))

import bcrypt
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from core.config import get_settings
from database.db import Base

settings = get_settings()
engine = create_engine(settings.database_url.replace("postgresql://", "postgresql://"))

USERS = [
    {"email": "nikhilprajapati1411@gmail.com", "username": "admin", "password": "Admin123", "role": "admin"},
    {"email": "nikhil141107@gmail.com", "username": "blueteam", "password": "Admin123", "role": "blue"},
    {"email": "112215139@cse.iiitp.ac.in", "username": "redteam", "password": "Admin123", "role": "red"},
]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def seed():
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        for u in USERS:
            existing = session.execute(
                text("SELECT id FROM users WHERE email = :email"), {"email": u["email"]}
            ).fetchone()
            if existing:
                print(f"  User {u['email']} already exists (id={existing[0]}), skipping.")
                continue
            session.execute(
                text(
                    "INSERT INTO users (username, email, password_hash, role) "
                    "VALUES (:username, :email, :password_hash, :role)"
                ),
                {
                    "username": u["username"],
                    "email": u["email"],
                    "password_hash": hash_password(u["password"]),
                    "role": u["role"],
                },
            )
            session.commit()
            print(f"  Created user: {u['email']} (role={u['role']})")
    print("Seeding complete.")


if __name__ == "__main__":
    seed()
