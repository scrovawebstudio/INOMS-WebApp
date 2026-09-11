-- =========================================================================
-- INOMS (Integrated Inward & Outward Management System)
-- Supabase Cloud Database Production Schema
-- =========================================================================

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ORGANIZATIONS (Multi-Tenant Master Registry)
CREATE TABLE IF NOT EXISTS public.organizations (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    owner_mobile VARCHAR(50),
    owner_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    secret_key TEXT,
    pin VARCHAR(50),
    pin_hash TEXT,
    pin_salt TEXT,
    subscription_plan VARCHAR(100) DEFAULT 'trial',
    subscription_start_date VARCHAR(50),
    subscription_end_date VARCHAR(50),
    trial_days INTEGER DEFAULT 7,
    is_trial INTEGER DEFAULT 0,
    features_json JSONB DEFAULT '{}'::jsonb,
    data_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. TENANT COMPANY CONFIGURATIONS
CREATE TABLE IF NOT EXISTS public.tenant_configs (
    tenant_id VARCHAR(100) PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    gstin VARCHAR(50),
    upi_id VARCHAR(100),
    config_json JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 3. USERS & TECHNICIANS
CREATE TABLE IF NOT EXISTS public.users (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(100),
    mobile VARCHAR(50),
    email VARCHAR(255),
    role VARCHAR(50) DEFAULT 'Technician',
    status VARCHAR(50) DEFAULT 'Active',
    is_deactivated INTEGER DEFAULT 0,
    pin_hash TEXT,
    pin_salt TEXT,
    permissions_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 4. CLIENTS / CUSTOMERS
CREATE TABLE IF NOT EXISTS public.clients (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'Walk-in',
    mobile VARCHAR(50),
    phone VARCHAR(50),
    email VARCHAR(255),
    contact_person VARCHAR(255),
    address TEXT,
    state VARCHAR(100) DEFAULT 'Maharashtra',
    city VARCHAR(100),
    gstin VARCHAR(50),
    opening_balance NUMERIC(15,2) DEFAULT 0.00,
    outstanding_balance NUMERIC(15,2) DEFAULT 0.00,
    notes TEXT,
    data_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 5. REPAIR JOBS (Inwards & Outwards Tracking)
CREATE TABLE IF NOT EXISTS public.jobs (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id VARCHAR(100),
    client_name VARCHAR(255),
    client_mobile VARCHAR(50),
    date VARCHAR(50),
    in_date VARCHAR(50),
    out_date VARCHAR(50),
    equipment VARCHAR(100),
    product_name VARCHAR(255),
    product_model VARCHAR(255),
    serial_no VARCHAR(100),
    ram_hdd VARCHAR(255),
    problems JSONB DEFAULT '[]'::jsonb,
    problem_description TEXT,
    components_checklist JSONB DEFAULT '{}'::jsonb,
    estimate_amount NUMERIC(15,2) DEFAULT 0.00,
    advance_amount NUMERIC(15,2) DEFAULT 0.00,
    final_bill_amount NUMERIC(15,2) DEFAULT 0.00,
    advance_payment_mode VARCHAR(50),
    assigned_technician VARCHAR(255),
    status VARCHAR(50) DEFAULT 'Received',
    payment_status VARCHAR(50) DEFAULT 'Unpaid',
    repair_outcome VARCHAR(50),
    rack_location VARCHAR(100),
    repair_type VARCHAR(50) DEFAULT 'Internal',
    service_partner_name VARCHAR(255),
    remarks TEXT,
    data_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 6. INVOICES & BILLING
CREATE TABLE IF NOT EXISTS public.invoices (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    invoice_no VARCHAR(100),
    date VARCHAR(50),
    time VARCHAR(50),
    client_id VARCHAR(100),
    client_name VARCHAR(255),
    client_mobile VARCHAR(50),
    client_address TEXT,
    client_gstin VARCHAR(50),
    linked_job_id VARCHAR(100),
    subtotal NUMERIC(15,2) DEFAULT 0.00,
    discount NUMERIC(15,2) DEFAULT 0.00,
    tax NUMERIC(15,2) DEFAULT 0.00,
    total NUMERIC(15,2) DEFAULT 0.00,
    paid_amount NUMERIC(15,2) DEFAULT 0.00,
    balance_due NUMERIC(15,2) DEFAULT 0.00,
    payment_mode VARCHAR(50),
    status VARCHAR(50) DEFAULT 'Unpaid',
    items JSONB DEFAULT '[]'::jsonb,
    data_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 7. PAYMENTS & RECEIPTS
CREATE TABLE IF NOT EXISTS public.payments (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    date VARCHAR(50),
    client_id VARCHAR(100),
    client_name VARCHAR(255),
    amount NUMERIC(15,2) DEFAULT 0.00,
    mode VARCHAR(50) DEFAULT 'Cash',
    ref_no VARCHAR(100),
    invoice_id VARCHAR(100),
    linked_job_id VARCHAR(100),
    remarks TEXT,
    data_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 8. INVENTORY PRODUCTS & SPARE PARTS
CREATE TABLE IF NOT EXISTS public.products (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    code VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    cost_price NUMERIC(15,2) DEFAULT 0.00,
    selling_price NUMERIC(15,2) DEFAULT 0.00,
    stock_quantity NUMERIC(15,2) DEFAULT 0.00,
    min_stock_alert NUMERIC(15,2) DEFAULT 0.00,
    unit VARCHAR(50) DEFAULT 'pcs',
    location VARCHAR(100),
    data_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 9. WORKSHOP EXPENSES
CREATE TABLE IF NOT EXISTS public.expenses (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    category VARCHAR(100),
    amount NUMERIC(15,2) DEFAULT 0.00,
    payment_mode VARCHAR(50),
    description TEXT,
    paid_to VARCHAR(255),
    date VARCHAR(50),
    recorded_by VARCHAR(255),
    data_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 10. METADATA: CATEGORIES, RACKS, EQUIPMENTS, PROBLEMS
CREATE TABLE IF NOT EXISTS public.categories (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) DEFAULT 'Job',
    data_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.racks (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    capacity VARCHAR(50),
    location VARCHAR(255),
    data_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.equipments (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    data_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE TABLE IF NOT EXISTS public.problems (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    standard_cost NUMERIC(15,2) DEFAULT 0.00,
    data_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 11. SYSTEM SETTINGS & KEY-VALUE STORE
CREATE TABLE IF NOT EXISTS public.system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 12. AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id VARCHAR(100),
    user_name VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100),
    details_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW())
);

-- =========================================================================
-- INDEXES FOR FAST QUERYING
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_jobs_tenant ON public.jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_clients_tenant ON public.clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON public.invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_tenant ON public.payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON public.products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant ON public.expenses(tenant_id);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.racks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow anon and auth read access" ON public.%I;', tbl);
        EXECUTE format('CREATE POLICY "Allow anon and auth read access" ON public.%I FOR SELECT USING (true);', tbl);

        EXECUTE format('DROP POLICY IF EXISTS "Allow anon and auth write access" ON public.%I;', tbl);
        EXECUTE format('CREATE POLICY "Allow anon and auth write access" ON public.%I FOR ALL USING (true) WITH CHECK (true);', tbl);
    END LOOP;
END $$;

-- Enable Realtime
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.organizations;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.jobs;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
        ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
    EXCEPTION
        WHEN OTHERS THEN
            NULL;
    END;
END $$;

-- Seeds
INSERT INTO public.organizations (
    id, name, code, owner_mobile, owner_name, status, secret_key, pin, subscription_plan, trial_days, is_trial
) VALUES (
    'org-admin', 'Master System Admin', 'ADMIN-00', '8149862034', 'Master System Admin', 'active', '', '', 'lifetime', 0, 0
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organizations (
    id, name, code, owner_mobile, owner_name, status, secret_key, pin, subscription_plan, trial_days, is_trial
) VALUES (
    'org-default', 'Supertech Diagnostics', 'STD-01', '+91 98765 43210', 'Rahul Sharma', 'active', '', '', 'pro_annual', 0, 0
) ON CONFLICT (id) DO NOTHING;
