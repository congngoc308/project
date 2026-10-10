import os

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://qlb:qlb@localhost:5451/qlb_test")
os.environ["RUN_JOBS"] = "false"
os.environ["DEMO_MODE"] = "true"

from datetime import datetime  # noqa: E402

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app import clock  # noqa: E402
from app.auth.security import COOKIE, make_token  # noqa: E402
from app.db import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from seed.base import seed_reference  # noqa: E402

BACKEND = os.path.dirname(os.path.dirname(__file__))
START = datetime(2026, 10, 9, 6, 30, tzinfo=clock.VN)


@pytest.fixture(scope="session", autouse=True)
def schema():
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE; CREATE SCHEMA public;"))
    cfg = Config(os.path.join(BACKEND, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(BACKEND, "alembic"))
    command.upgrade(cfg, "head")
    yield


@pytest.fixture()
def ref():
    """Dữ liệu sạch cho mỗi test + đồng hồ cố định ở 06:30 ngày 09/10/2026."""
    with engine.begin() as conn:
        tables = conn.execute(text(
            "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> 'alembic_version'"
        )).scalars().all()
        conn.execute(text(f"TRUNCATE {', '.join(tables)} RESTART IDENTITY CASCADE"))
        conn.execute(text("ALTER SEQUENCE kitchen_seq RESTART WITH 1"))
    clock.set_fixed(START)
    with SessionLocal() as db:
        data = seed_reference(db, fast_hash=True)
        db.commit()
        ids = {k: v.id for k, v in data.items()}
    yield ids
    clock.set_fixed(None)


@pytest.fixture()
def db(ref):
    with SessionLocal() as s:
        yield s


class Api:
    """TestClient đăng nhập sẵn bằng một tài khoản; báo lỗi rõ khi status không như mong đợi."""

    def __init__(self, client: TestClient, user_id: int):
        self.c = client
        self.user_id = user_id

    def _call(self, method, url, expect, **kw):
        from app.models import User

        with SessionLocal() as s:
            token = make_token(s.get(User, self.user_id))
        self.c.cookies.set(COOKIE, token)
        r = self.c.request(method, "/api" + url, **kw)
        if expect is not None:
            assert r.status_code == expect, f"{method} {url} -> {r.status_code}: {r.text}"
        return r

    def get(self, url, expect=200, **kw):
        r = self._call("GET", url, expect, **kw)
        return r.json() if r.headers.get("content-type", "").startswith("application/json") else r

    def post(self, url, json=None, expect=200):
        return self._call("POST", url, expect, json=json).json()

    def put(self, url, json=None, expect=200):
        return self._call("PUT", url, expect, json=json).json()

    def patch(self, url, json=None, expect=200):
        return self._call("PATCH", url, expect, json=json).json()


@pytest.fixture()
def client(ref):
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def as_user(client, ref):
    def make(username: str) -> Api:
        return Api(client, ref[username])

    return make
