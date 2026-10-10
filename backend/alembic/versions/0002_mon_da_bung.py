"""mon da bung

Thêm bước "Đã bưng" sau "Hoàn tất": phục vụ xác nhận đã mang món ra bàn. Không tác động kho.
Món hoàn tất từ trước khi có bước này coi như đã bưng lúc hoàn tất, để danh sách chờ bưng chỉ gồm món mới.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-10 21:00:00
"""
from alembic import op
import sqlalchemy as sa


revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('order_items', sa.Column('served_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('order_items', sa.Column('served_by', sa.Integer(), nullable=True))
    op.create_foreign_key('order_items_served_by_fkey', 'order_items', 'users', ['served_by'], ['id'])
    op.execute("UPDATE order_items SET served_at = done_at WHERE status = 'done' AND done_at IS NOT NULL")


def downgrade() -> None:
    op.drop_constraint('order_items_served_by_fkey', 'order_items', type_='foreignkey')
    op.drop_column('order_items', 'served_by')
    op.drop_column('order_items', 'served_at')
