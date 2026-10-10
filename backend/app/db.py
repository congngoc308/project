from collections.abc import Iterator
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Numeric, create_engine, func
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from app.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

# Số lượng theo đơn vị cơ sở (g / ml / cái) và tiền (VND).
Qty = Numeric(14, 3)
Money = Numeric(16, 2)
UnitCost = Numeric(14, 4)


class Base(DeclarativeBase):
    type_annotation_map = {Decimal: Qty, datetime: DateTime(timezone=True)}


class IdMixin:
    id: Mapped[int] = mapped_column(primary_key=True)
    # Giờ thật của máy chủ lúc ghi dòng; giờ nghiệp vụ (có thể là giờ demo) nằm ở các cột riêng.
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
