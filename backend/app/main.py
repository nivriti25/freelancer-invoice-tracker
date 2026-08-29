# pyrefly: ignore [missing-import]
from fastapi import FastAPI, Depends, Request
# pyrefly: ignore [missing-import]
from fastapi.responses import JSONResponse
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
# pyrefly: ignore [missing-import]
from sqlalchemy import text
from app.database import get_db
from app.routers.clients import router as clients_router
from app.routers.invoices import router as invoices_router
from app.routers.payments import router as payments_router
from app.routers.agent import router as agent_router
from app.routers import inbound_email
from app.database import SessionLocal

app = FastAPI(
    title="Freelancer Invoicing API",
    description="API backend for the Freelancer Invoicing App",
    version="1.0.0"
)

# Configure database schema migrations on startup
@app.on_event("startup")
def configure_db_schema():
    """
    Run basic schema migrations to support Razorpay payment identifiers.
    """
    db = SessionLocal()
    try:
        db.execute(text("ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR;"))
        db.execute(text("ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR;"))
        db.execute(text("ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS razorpay_signature VARCHAR;"))
        db.execute(text("ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE;"))
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS public.payments (
                id UUID PRIMARY KEY,
                invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
                user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
                razorpay_payment_id VARCHAR,
                razorpay_order_id VARCHAR,
                amount_paid NUMERIC(10, 2) NOT NULL,
                payment_method VARCHAR,
                paid_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
            );
        """))
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS public.agent_decisions (
                id UUID PRIMARY KEY,
                invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
                input_summary TEXT NOT NULL,
                classification VARCHAR,
                decided_action VARCHAR NOT NULL,
                raw_llm_output TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
            );
        """))
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS public.guardrail_overrides (
                id UUID PRIMARY KEY,
                invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
                llm_proposed_action VARCHAR NOT NULL,
                override_reason TEXT NOT NULL,
                final_action VARCHAR NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
            );
        """))
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS public.promises (
                id UUID PRIMARY KEY,
                invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
                promised_date DATE NOT NULL,
                resolved BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
            );
        """))
        db.commit()
    except Exception as e:
        print(f"Error running database schema migration: {e}")
    finally:
        db.close()

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
app.include_router(payments_router, prefix="/api/v1")
app.include_router(agent_router, prefix="/api/v1")
app.include_router(inbound_email.router)

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

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Ensure all unhandled exceptions return JSON with CORS headers.
    """
    import logging
    logging.exception("Unhandled error occurred in request: %s", request.url)
    response = JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"}
    )
    # Manually add CORS headers if Origin is present
    origin = request.headers.get("origin")
    if origin in ["http://localhost:5173", "http://127.0.0.1:5173"]:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

# Force uvicorn process reload to pick up new .env settings v5



