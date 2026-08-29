# 🧾 Freelancer Invoice Tracker

A modern, full-stack, multi-tenant invoicing and payment tracking application tailored for freelancers. Built with a fast **FastAPI** backend and a responsive **React (Vite) + Tailwind CSS** frontend, the app manages client directories, generates professional PDFs, automates email delivery, handles online payment collection, and automatically flags overdue invoices.

---

## 🌟 Key Features

*   **📊 Interactive Dashboard & Analytics**: Visualize monthly earnings, payment trends, pending collection, and invoices status breakdown (Draft, Sent, Paid, Overdue) using interactive charts built with Recharts.
*   **🔑 Multi-Tenant Authentication**: Secure user login, signup, and session persistence powered by **Supabase Auth**.
*   **👥 Client Directory**: Manage client profiles, contact information, billing addresses, and tax identifiers (GST number).
*   **📝 Comprehensive Invoice Builder**: Create detailed multi-item invoices with auto-calculating subtotals, custom tax rates (GST), and totals.
*   **📄 Professional PDF Generation**: Generate clean, print-ready, professional PDF invoices dynamically using ReportLab in the backend.
*   **✉️ Email Automation**: Automatic delivery of invoice emails with the generated PDF attached directly to the client via **Resend API**.
*   **💳 Razorpay Integration**: Collect online payments seamlessly. Supports a smart **Mock Mode** for local development without active credentials, and full production mode.
*   **⏰ Automated Overdue Reminders**: Includes a cron-ready background worker script that integrates with **GitHub Actions Workflow** to automatically track due dates, mark late invoices as `Overdue`, and dispatch payment reminder emails.

---

## 🛠️ Tech Stack

### Frontend
*   **Core**: React 19, JavaScript (ES6+), Vite
*   **Styling**: Tailwind CSS v4, Lucide React (Icons)
*   **Charts**: Recharts
*   **State & Routing**: React Router Dom v7, React Context API
*   **Client SDK**: `@supabase/supabase-js`

### Backend
*   **Framework**: FastAPI (Python 3.10+)
*   **Web Server**: Uvicorn
*   **Database ORM**: SQLAlchemy
*   **PDF Generation**: ReportLab
*   **Email Client**: Resend Python SDK
*   **Payment Gateway**: Razorpay SDK

### Database & Hosting
*   **Database**: PostgreSQL (Hosted on Supabase)
*   **Auth**: Supabase Auth

### Automation
*   **Cron Jobs**: GitHub Actions (`cron.yml` workflow executing once daily)

---

## 📂 Project Structure

```text
freelancer-invoice-tracker/
├── .github/
│   └── workflows/
│       └── cron.yml         # Daily runner script for overdue reminders
├── backend/
│   ├── app/
│   │   ├── app/routers/     # API Router endpoints (clients, invoices, payments)
│   │   ├── app/utils/       # Helper utilities (PDF builder, Email template sender)
│   │   ├── auth.py          # Supabase JWT decoder and User dependency
│   │   ├── config.py        # Environment variables parser settings
│   │   ├── database.py      # SQLAlchemy engine and connection pool session maker
│   │   ├── main.py          # FastAPI application initialization & DB schema updates
│   │   ├── models.py        # SQLAlchemy relational database tables mapping
│   │   └── schemas.py       # Pydantic validation schemas
│   ├── check_overdue.py     # Script to identify overdue invoices and email clients
│   ├── requirements.txt     # Python backend dependencies
│   └── .env.template        # Template for backend secrets and configuration
└── frontend/
    ├── src/
    │   ├── components/      # UI components (Auth, Forms, Landing, Settings)
    │   ├── context/         # React Authentication Context
    │   ├── App.jsx          # App Router and main Dashboard views layout
    │   ├── index.css        # Tailwind styling entries
    │   └── supabaseClient.js# Supabase Client connection initialization
    ├── package.json         # Frontend packages and scripts
    └── .env                 # Frontend local variables setup
```

---

## 🚀 Getting Started

### 📋 Prerequisites
Make sure you have the following installed:
*   [Node.js](https://nodejs.org/) (v18+)
*   [Python](https://www.python.org/) (v3.10+)
*   A [Supabase](https://supabase.com/) Account (for Database and Auth)
*   A [Resend](https://resend.com/) Account (for email automation)
*   A [Razorpay](https://razorpay.com/) Account (optional for testing real payments)

---

### 1. Database & Auth Setup (Supabase)

1.  Create a new project on **Supabase**.
2.  In the Supabase dashboard, go to **Authentication** settings and enable the **Email/Password** provider.
3.  Ensure the SQL schema is present. The backend will automatically apply basic database migrations for Razorpay payments on startup (`ALTER TABLE public.invoices` and `CREATE TABLE public.payments`). The primary schema structures (`profiles`, `clients`, `invoices`, `invoice_items`) are managed based on the models defined in [models.py](backend/app/models.py).
    > [!NOTE]
    > The application leverages a shared `profiles` table linked to Supabase Auth (`auth.users`).

---

### 2. Backend Installation & Run

1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Create and activate a virtual environment:
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```
3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
4.  Configure environment variables:
    ```bash
    cp .env.template .env
    ```
    Open `.env` and fill in your keys:
    *   `DATABASE_URL`: Your Supabase connection string (Postgres transaction pooler or session mode).
    *   `SUPABASE_URL` / `SUPABASE_KEY`: Supabase project URL and anon public key.
    *   `RESEND_API_KEY`: API key from your Resend dashboard.
    *   `EMAIL_FROM`: The sender email address authorized in Resend (e.g., `Invoicer <onboarding@resend.dev>`).
    *   `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`: Razorpay credentials. If left as `rzp_test_placeholder` or empty, the API automatically runs in **Mock Mode**, allowing you to test billing without hitches.
5.  Start the FastAPI backend server:
    ```bash
    uvicorn app.main:app --reload --reload-include "*.env" --port 8000
    ```
    The API documentation will be available at [http://localhost:8000/docs](http://localhost:8000/docs).

---

### 3. Frontend Installation & Run

1.  Navigate to the frontend directory:
    ```bash
    cd ../frontend
    ```
2.  Install packages:
    ```bash
    npm install
    ```
3.  Verify or create `.env` file containing:
    ```env
    VITE_SUPABASE_URL=your_supabase_project_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    VITE_API_URL=http://localhost:8000/api/v1
    ```
4.  Run the development server:
    ```bash
    npm run dev
    ```
    The website will run locally at [http://localhost:5173](http://localhost:5173).

---

## 💳 Payment Processing modes

*   **Mock Mode (Development)**:
    If `RAZORPAY_KEY_ID` contains `"placeholder"` or is omitted from the backend env:
    - Backend generates safe mock transaction IDs.
    - Payments can be approved directly in the dashboard UI with dummy credentials.
    - No external API calls are made to Razorpay.
*   **Production/Test Mode**:
    - Enter valid credentials from your Razorpay console.
    - Generates active payment orders and triggers the standard Razorpay checkout modal.

---

## ⏰ Overdue Reminders Cron (GitHub Actions)

A daily scheduler is configured under `.github/workflows/cron.yml`. 
*   It triggers every day at `00:00 UTC`.
*   It queries all invoices marked as `Sent` whose `due_date` has passed.
*   It sends out automated HTML reminder emails to the corresponding clients, attaching the invoice PDF.
*   It updates the invoice status to `Overdue` in the database.

To customize variables for production execution, store your secrets (`DATABASE_URL`, `RESEND_API_KEY`, etc.) as **Repository Secrets** in your GitHub repository configuration settings.
