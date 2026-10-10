from datetime import date, timedelta

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app import clock, domain as d
from app.auth.security import require
from app.db import get_db
from app.models import User
from app.services import dashboard, reports

router = APIRouter(tags=["Dashboard & báo cáo"])
manager = require(d.MANAGER)


def _dates(date_from: date | None, date_to: date | None, default_days: int = 7) -> tuple[date, date]:
    today = clock.business_date(clock.now())
    end = date_to or today
    start = date_from or end - timedelta(days=default_days - 1)
    return start, end


@router.get("/dashboard")
def get_dashboard(day: date | None = None, db: Session = Depends(get_db), _: User = Depends(manager)):
    data = dashboard.build(db, day)
    db.commit()
    return data


@router.get("/dashboard/trend")
def get_trend(days: int = 30, db: Session = Depends(get_db), _: User = Depends(manager)):
    return dashboard.trend(db, clock.business_date(clock.now()), days)


@router.get("/reports/avt")
def avt(date_from: date | None = None, date_to: date | None = None, location: str | None = None,
        ingredient_id: int | None = None, shift_id: int | None = None, by_shift: bool = False,
        db: Session = Depends(get_db), _: User = Depends(manager)):
    start, end = _dates(date_from, date_to)
    return reports.avt(db, start, end, location, ingredient_id, shift_id, by_shift)


@router.get("/reports/avt.xlsx")
def avt_xlsx(date_from: date | None = None, date_to: date | None = None, location: str | None = None,
             ingredient_id: int | None = None, shift_id: int | None = None, by_shift: bool = False,
             db: Session = Depends(get_db), _: User = Depends(manager)):
    start, end = _dates(date_from, date_to)
    data = reports.avt_excel(reports.avt(db, start, end, location, ingredient_id, shift_id, by_shift))
    name = f"AvT_{start:%Y%m%d}_{end:%Y%m%d}.xlsx"
    return Response(data, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f'attachment; filename="{name}"'})


@router.get("/reports/waste")
def waste_report(date_from: date | None = None, date_to: date | None = None, db: Session = Depends(get_db),
                 _: User = Depends(manager)):
    return reports.waste_report(db, *_dates(date_from, date_to, 30))


@router.get("/reports/shifts")
def shift_report(date_from: date | None = None, date_to: date | None = None, db: Session = Depends(get_db),
                 _: User = Depends(manager)):
    return reports.shift_report(db, *_dates(date_from, date_to, 14))


@router.get("/reports/counts")
def count_history(date_from: date | None = None, date_to: date | None = None, db: Session = Depends(get_db),
                  _: User = Depends(manager)):
    return reports.count_history(db, *_dates(date_from, date_to, 14))


@router.get("/reports/receipts")
def receipt_history(date_from: date | None = None, date_to: date | None = None, db: Session = Depends(get_db),
                    _: User = Depends(manager)):
    return reports.receipt_history(db, *_dates(date_from, date_to, 30))


@router.get("/reports/sales")
def sales(date_from: date | None = None, date_to: date | None = None, db: Session = Depends(get_db),
          _: User = Depends(manager)):
    return reports.sales_report(db, *_dates(date_from, date_to, 14))


@router.get("/audit")
def audit_log(entity: str | None = None, actor_id: int | None = None, action: str | None = None,
              db: Session = Depends(get_db), _: User = Depends(manager)):
    return reports.audit_list(db, entity, actor_id, action)


@router.get("/txns")
def txns(ingredient_id: int | None = None, location: str | None = None, txn_type: str | None = None,
         shift_id: int | None = None, db: Session = Depends(get_db), _: User = Depends(manager)):
    return reports.txn_list(db, ingredient_id, location, txn_type, shift_id)
