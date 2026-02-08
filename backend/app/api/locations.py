from __future__ import annotations

from datetime import datetime
import uuid
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import require_admin, require_user
from app.api.root_access import ensure_root_exists, get_accessible_root_ids, require_root_access
from app.db.session import get_db
from app.models.device import Device
from app.models.location import Location
from app.models.user import User

router = APIRouter(tags=["locations"])


class RootResponse(BaseModel):
    id: UUID
    name: str
    notes: str | None
    created_at: datetime


class CreateRootRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=255)
    notes: str | None = None


class UpdateRootRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=255)
    notes: str | None = None


class LocationSummary(BaseModel):
    id: UUID
    name: str
    parent_id: UUID | None
    root_id: UUID
    notes: str | None
    created_at: datetime
    device_count: int = 0


class LocationTreeNode(BaseModel):
    id: UUID
    name: str
    parent_id: UUID | None
    root_id: UUID
    notes: str | None
    created_at: datetime
    device_count: int = 0
    children: list["LocationTreeNode"] = Field(default_factory=list)


LocationTreeNode.model_rebuild()


class CreateLocationRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=255)
    root_id: UUID
    parent_id: UUID | None = None
    notes: str | None = None


class UpdateLocationRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=255)
    parent_id: UUID | None = None
    notes: str | None = None


def _validate_parent_for_root(db: Session, root_id: UUID, parent_id: UUID) -> Location:
    parent = db.get(Location, parent_id)
    if parent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent location not found")
    if parent.root_id != root_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Parent location must belong to the same root",
        )
    return parent


def _creates_cycle(db: Session, location_id: UUID, new_parent_id: UUID | None) -> bool:
    current_parent = new_parent_id
    while current_parent is not None:
        if current_parent == location_id:
            return True
        current_parent = db.scalar(select(Location.parent_id).where(Location.id == current_parent).limit(1))
    return False


def _build_tree(locations: list[Location], root_id: UUID, device_counts: dict[UUID, int]) -> LocationTreeNode:
    nodes = {
        location.id: LocationTreeNode(
            id=location.id,
            name=location.name,
            parent_id=location.parent_id,
            root_id=location.root_id,
            notes=location.notes,
            created_at=location.created_at,
            device_count=device_counts.get(location.id, 0),
            children=[],
        )
        for location in locations
    }

    for location in locations:
        if location.id == root_id:
            continue
        if location.parent_id is None:
            continue
        parent = nodes.get(location.parent_id)
        if parent is not None:
            parent.children.append(nodes[location.id])

    def sort_children(node: LocationTreeNode) -> None:
        node.children.sort(key=lambda child: child.name.lower())
        for child in node.children:
            sort_children(child)

    root_node = nodes.get(root_id)
    if root_node is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Root tree not found")

    sort_children(root_node)
    return root_node


def _to_root_response(root: Location) -> RootResponse:
    return RootResponse(id=root.id, name=root.name, notes=root.notes, created_at=root.created_at)


@router.get("/roots", response_model=list[RootResponse])
def list_roots(current_user: User = Depends(require_user), db: Session = Depends(get_db)) -> list[RootResponse]:
    accessible_root_ids = get_accessible_root_ids(db, current_user)
    if not accessible_root_ids:
        return []

    roots = db.scalars(select(Location).where(Location.id.in_(accessible_root_ids))).all()
    return [_to_root_response(root) for root in sorted(roots, key=lambda item: item.name.lower())]


@router.post("/roots", response_model=RootResponse, status_code=status.HTTP_201_CREATED)
def create_root(
    payload: CreateRootRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> RootResponse:
    root_id = uuid.uuid4()
    root = Location(
        id=root_id,
        name=payload.name,
        parent_id=None,
        root_id=root_id,
        notes=payload.notes,
    )
    db.add(root)
    db.commit()
    db.refresh(root)
    return _to_root_response(root)


@router.patch("/roots/{root_id}", response_model=RootResponse)
def update_root(
    root_id: UUID,
    payload: UpdateRootRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> RootResponse:
    root = ensure_root_exists(db, root_id)
    if payload.name is not None:
        root.name = payload.name
    if "notes" in payload.model_fields_set:
        root.notes = payload.notes

    db.add(root)
    db.commit()
    db.refresh(root)
    return _to_root_response(root)


@router.delete("/roots/{root_id}")
def delete_root(
    root_id: UUID,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    root = ensure_root_exists(db, root_id)
    db.delete(root)
    db.commit()
    return {"status": "ok"}


@router.get("/locations/tree", response_model=LocationTreeNode)
def locations_tree(
    root_id: UUID = Query(...),
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
) -> LocationTreeNode:
    require_root_access(db, current_user, root_id)
    ensure_root_exists(db, root_id)

    locations = db.scalars(select(Location).where(Location.root_id == root_id)).all()
    if not locations:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Root tree not found")

    counts = db.execute(
        select(Device.space_id, func.count(Device.id))
        .where(Device.root_id == root_id)
        .group_by(Device.space_id)
    ).all()
    device_counts = {space_id: count for space_id, count in counts}

    return _build_tree(locations, root_id, device_counts)


@router.post("/locations", response_model=LocationSummary, status_code=status.HTTP_201_CREATED)
def create_location(
    payload: CreateLocationRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> LocationSummary:
    ensure_root_exists(db, payload.root_id)

    parent_id = payload.parent_id or payload.root_id
    _validate_parent_for_root(db, payload.root_id, parent_id)

    location = Location(
        name=payload.name,
        root_id=payload.root_id,
        parent_id=parent_id,
        notes=payload.notes,
    )
    db.add(location)
    db.commit()
    db.refresh(location)

    return LocationSummary(
        id=location.id,
        name=location.name,
        parent_id=location.parent_id,
        root_id=location.root_id,
        notes=location.notes,
        created_at=location.created_at,
        device_count=0,
    )


@router.patch("/locations/{location_id}", response_model=LocationSummary)
def update_location(
    location_id: UUID,
    payload: UpdateLocationRequest,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> LocationSummary:
    location = db.get(Location, location_id)
    if location is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

    if payload.name is not None:
        location.name = payload.name

    if "notes" in payload.model_fields_set:
        location.notes = payload.notes

    if "parent_id" in payload.model_fields_set:
        if location.id == location.root_id and payload.parent_id is not None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Root location cannot have a parent",
            )
        if location.id != location.root_id and payload.parent_id is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Non-root location must have a parent",
            )
        if payload.parent_id == location.id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Location cannot be parent of itself",
            )

        if payload.parent_id is not None:
            _validate_parent_for_root(db, location.root_id, payload.parent_id)
            if _creates_cycle(db, location.id, payload.parent_id):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Location parent would create a cycle",
                )
            location.parent_id = payload.parent_id

    db.add(location)
    db.commit()
    db.refresh(location)

    return LocationSummary(
        id=location.id,
        name=location.name,
        parent_id=location.parent_id,
        root_id=location.root_id,
        notes=location.notes,
        created_at=location.created_at,
        device_count=0,
    )
