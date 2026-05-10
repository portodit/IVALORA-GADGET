const https = require('https');

const projectRef = 'mreqldvlkkedcgyxcaon';
const accessToken = 'sbp_a5efdc6576dfb6b60d76e1e9f0ef47cdda2a36c4';

const query = `
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_settings' AND column_name='footer_text') THEN
        ALTER TABLE public.invoice_settings ADD COLUMN footer_text TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_settings' AND column_name='terms_json') THEN
        ALTER TABLE public.invoice_settings ADD COLUMN terms_json JSONB;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_settings' AND column_name='number_prefix') THEN
        ALTER TABLE public.invoice_settings ADD COLUMN number_prefix TEXT DEFAULT 'INV';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_settings' AND column_name='number_format') THEN
        ALTER TABLE public.invoice_settings ADD COLUMN number_format TEXT DEFAULT 'branch_code';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_settings' AND column_name='custom_code') THEN
        ALTER TABLE public.invoice_settings ADD COLUMN custom_code TEXT DEFAULT '';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_settings' AND column_name='sequence_reset') THEN
        ALTER TABLE public.invoice_settings ADD COLUMN sequence_reset TEXT DEFAULT 'monthly';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_settings' AND column_name='sequence_start') THEN
        ALTER TABLE public.invoice_settings ADD COLUMN sequence_start INTEGER DEFAULT 1;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_settings' AND column_name='use_date_reset') THEN
        ALTER TABLE public.invoice_settings ADD COLUMN use_date_reset BOOLEAN DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_settings' AND column_name='default_due_days') THEN
        ALTER TABLE public.invoice_settings ADD COLUMN default_due_days INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_settings' AND column_name='font_title_size') THEN
        ALTER TABLE public.invoice_settings ADD COLUMN font_title_size INTEGER DEFAULT 42;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_settings' AND column_name='font_invoice_id_size') THEN
        ALTER TABLE public.invoice_settings ADD COLUMN font_invoice_id_size INTEGER DEFAULT 24;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_settings' AND column_name='font_company_name_size') THEN
        ALTER TABLE public.invoice_settings ADD COLUMN font_company_name_size INTEGER DEFAULT 32;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_settings' AND column_name='font_branch_info_size') THEN
        ALTER TABLE public.invoice_settings ADD COLUMN font_branch_info_size INTEGER DEFAULT 11;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_settings' AND column_name='font_transaction_code_size') THEN
        ALTER TABLE public.invoice_settings ADD COLUMN font_transaction_code_size INTEGER DEFAULT 20;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_settings' AND column_name='font_address_size') THEN
        ALTER TABLE public.invoice_settings ADD COLUMN font_address_size INTEGER DEFAULT 11;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_settings' AND column_name='font_served_by_size') THEN
        ALTER TABLE public.invoice_settings ADD COLUMN font_served_by_size INTEGER DEFAULT 11;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_settings' AND column_name='font_terms_size') THEN
        ALTER TABLE public.invoice_settings ADD COLUMN font_terms_size INTEGER DEFAULT 11;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_settings' AND column_name='signature_url') THEN
        ALTER TABLE public.invoice_settings ADD COLUMN signature_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_settings' AND column_name='signature_type') THEN
        ALTER TABLE public.invoice_settings ADD COLUMN signature_type TEXT DEFAULT 'system';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_settings' AND column_name='wa_template') THEN
        ALTER TABLE public.invoice_settings ADD COLUMN wa_template TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_settings' AND column_name='pdf_name_format') THEN
        ALTER TABLE public.invoice_settings ADD COLUMN pdf_name_format TEXT DEFAULT '{customer}_{date}';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_settings' AND column_name='additional_notes') THEN
        ALTER TABLE public.invoice_settings ADD COLUMN additional_notes TEXT[];
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_settings' AND column_name='logo_type') THEN
        ALTER TABLE public.invoice_settings ADD COLUMN logo_type TEXT DEFAULT 'icon';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_settings' AND column_name='font_family') THEN
        ALTER TABLE public.invoice_settings ADD COLUMN font_family TEXT DEFAULT 'Poppins';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_settings' AND column_name='stamp_text') THEN
        ALTER TABLE public.invoice_settings ADD COLUMN stamp_text TEXT DEFAULT 'IVALORA GADGET';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_settings' AND column_name='stamp_sub_text') THEN
        ALTER TABLE public.invoice_settings ADD COLUMN stamp_sub_text TEXT DEFAULT 'INDONESIA';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_settings' AND column_name='document_link_base') THEN
        ALTER TABLE public.invoice_settings ADD COLUMN document_link_base TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_settings' AND column_name='header_tagline') THEN
        ALTER TABLE public.invoice_settings ADD COLUMN header_tagline TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='invoice_settings' AND column_name='header_tagline_align') THEN
        ALTER TABLE public.invoice_settings ADD COLUMN header_tagline_align TEXT DEFAULT 'center';
    END IF;
END $$;
NOTIFY pgrst, 'reload schema';
`;

const postData = JSON.stringify({ query });

const options = {
  hostname: 'api.supabase.com',
  port: 443,
  path: `/v1/projects/${projectRef}/database/query`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (d) => body += d);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', body);
  });
});

req.on('error', (e) => {
  console.error('Error:', e);
});

req.write(postData);
req.end();
