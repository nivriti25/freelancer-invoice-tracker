# pyrefly: ignore [missing-import]
from fastapi import FastAPI, Depends
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
# pyrefly: ignore [missing-import]
from sqlalchemy import text
from app.database import get_db
from app.routers.clients import router as clients_router
from app.routers.invoices import router as invoices_router

app = FastAPI(
    title="Freelancer Invoicing API",
    description="API backend for the Freelancer Invoicing App",
    version="1.0.0"
)

# Configure CORS middleware
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(clients_router, prefix="/api/v1")
app.include_router(invoices_router, prefix="/api/v1")

@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    """
    Basic health check endpoint to verify backend and database connection status.
    """
    db_status = "unhealthy"
    try:
        # Try a quick query to test database connection
        db.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "database": db_status,
        "message": "Freelancer Invoicing API is running"
    }

@app.get("/")
async def root():
    """
    Root endpoint redirecting or welcoming users.
    """
    return {
        "message": "Welcome to the Freelancer Invoicing API. Visit /docs for the API documentation."
    }
