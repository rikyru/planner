"""foto

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-03
"""
from collections.abc import Sequence

import sqlalchemy as sa
from geoalchemy2 import Geography
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = '0004'
down_revision: str | None = '0003'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_geospatial_table('photos',
    sa.Column('trip_id', sa.Uuid(), nullable=False),
    sa.Column('day_id', sa.Uuid(), nullable=True),
    sa.Column('stop_id', sa.Uuid(), nullable=True),
    sa.Column('storage_key', sa.String(length=300), nullable=False),
    sa.Column('original_filename', sa.String(length=300), nullable=False),
    sa.Column('mime_type', sa.String(length=100), nullable=False),
    sa.Column('width', sa.Integer(), nullable=True),
    sa.Column('height', sa.Integer(), nullable=True),
    sa.Column('size_bytes', sa.Integer(), nullable=False),
    sa.Column('sha256', sa.String(length=64), nullable=False),
    sa.Column('taken_at', sa.DateTime(), nullable=True),
    sa.Column('taken_at_offset', sa.String(length=10), nullable=True),
    sa.Column('location', Geography(geometry_type='POINT', srid=4326, dimension=2, spatial_index=False, from_text='ST_GeogFromText', name='geography'), nullable=True),
    sa.Column('caption', sa.Text(), nullable=True),
    sa.Column('exif', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('id', sa.Uuid(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['day_id'], ['trip_days.id'], name=op.f('fk_photos_day_id_trip_days'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['stop_id'], ['stops.id'], name=op.f('fk_photos_stop_id_stops'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['trip_id'], ['trips.id'], name=op.f('fk_photos_trip_id_trips'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_photos')),
    sa.UniqueConstraint('trip_id', 'sha256', name='uq_photos_trip_id_sha256')
    )
    op.create_geospatial_index('idx_photos_location', 'photos', ['location'], unique=False, postgresql_using='gist', postgresql_ops={})
    op.create_index(op.f('ix_photos_day_id'), 'photos', ['day_id'], unique=False)
    op.create_index(op.f('ix_photos_stop_id'), 'photos', ['stop_id'], unique=False)
    op.create_index(op.f('ix_photos_trip_id'), 'photos', ['trip_id'], unique=False)
    op.add_column('trips', sa.Column('cover_photo_id', sa.Uuid(), nullable=True))
    op.create_foreign_key(op.f('fk_trips_cover_photo_id_photos'), 'trips', 'photos', ['cover_photo_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_constraint(op.f('fk_trips_cover_photo_id_photos'), 'trips', type_='foreignkey')
    op.drop_column('trips', 'cover_photo_id')
    op.drop_index(op.f('ix_photos_trip_id'), table_name='photos')
    op.drop_index(op.f('ix_photos_stop_id'), table_name='photos')
    op.drop_index(op.f('ix_photos_day_id'), table_name='photos')
    op.drop_geospatial_index('idx_photos_location', table_name='photos', postgresql_using='gist', column_name='location')
    op.drop_geospatial_table('photos')
