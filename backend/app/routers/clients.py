# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, status
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.database import get_db
from app.auth import get_current_user_id
from app import models, schemas

router = APIRouter(
    prefix="/clients",
    tags=["Clients"]
)

@router.post("", response_model=schemas.ClientResponse, status_code=status.HTTP_201_CREATED)
async def create_client(
    client_in: schemas.ClientCreate,
    current_user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Create a new client for the current authenticated user.
    """
    # Robust check: Ensure User record exists in public.users to avoid FK constraint issues
    user = db.query(models.User).filter(models.User.id == current_user_id).first()
    if not user:
        # Create user record dynamically if it was not auto-synced yet
        user = models.User(
            id=current_user_id,
            name="Freelancer",
            gst_number=None,
            bank_details=None
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # Instantiate the client
    client = models.Client(
        user_id=current_user_id,
        name=client_in.name,
        email=client_in.email,
        phone=client_in.phone,
        gst_number=client_in.gst_number,
        address=client_in.address
    )
    
    db.add(client)
    db.commit()
    db.refresh(client)
    return client

@router.get("", response_model=List[schemas.ClientResponse])
async def get_clients(
    current_user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Retrieve all clients belonging to the current authenticated user.
    """
    clients = db.query(models.Client).filter(models.Client.user_id == current_user_id).all()
    return clients

@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    client_id: UUID,
    current_user_id: UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    Delete a client belonging to the authenticated user.
    """
    client = db.query(models.Client).filter(
        models.Client.id == client_id,
        models.Client.user_id == current_user_id
    ).first()
    
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client not found or does not belong to the authenticated user"
        )
        
    db.delete(client)
    db.commit()
    return
