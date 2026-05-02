/**
 * CFDI (Comprobante Fiscal Digital por Internet) — Mexican fiscal invoice helper.
 *
 * Stripe does NOT issue CFDIs. We delegate to Facturapi (https://facturapi.io)
 * which handles the SAT (Servicio de Administración Tributaria) integration.
 *
 * Required tenant fiscal data: rfc, razonSocial, regimenFiscal (default 601 General
 * de Personas Morales), usoCfdi (default G03 Gastos en general).
 *
 * Set FACTURAPI_KEY in env to enable real CFDI issuance. Without it, this
 * module returns `{ error: 'CFDI not configured' }` and the caller continues
 * gracefully (CFDI is best-effort, not blocking).
 */

import type { Tenant, Invoice } from '@shared/schema';

export interface CfdiResult {
  ok: true;
  cfdiId: string;
  pdfUrl: string;
  xmlUrl: string;
}
export interface CfdiError {
  ok: false;
  error: string;
}

const FACTURAPI_KEY = process.env.FACTURAPI_KEY;
const FACTURAPI_URL = 'https://www.facturapi.io/v2/invoices';

/**
 * Create a CFDI for a paid Stripe invoice.
 *
 * @returns Either { ok:true, cfdiId, pdfUrl, xmlUrl } or { ok:false, error }
 */
export async function createCFDI(
  tenant: Pick<Tenant, 'rfc' | 'razonSocial' | 'regimenFiscal' | 'usoCfdi' | 'name'>,
  invoice: Pick<Invoice, 'amountMxnCents' | 'stripeInvoiceId' | 'periodStart' | 'periodEnd'>,
): Promise<CfdiResult | CfdiError> {
  if (!FACTURAPI_KEY) return { ok: false, error: 'CFDI not configured' };
  if (!tenant.rfc || !tenant.razonSocial) {
    return { ok: false, error: 'Tenant fiscal data missing — captura RFC y razón social en Configuración → Datos fiscales.' };
  }

  const totalMxn = (invoice.amountMxnCents || 0) / 100;
  if (totalMxn <= 0) return { ok: false, error: 'Invoice amount is zero or negative' };

  const body = {
    customer: {
      legal_name: tenant.razonSocial,
      tax_id: tenant.rfc,
      tax_system: tenant.regimenFiscal || '601',
      address: { country: 'MEX' },
    },
    items: [{
      quantity: 1,
      product: {
        description: `Suscripción MARCALL — ${tenant.name}`,
        product_key: '81111500', // SAT key for cloud software services
        price: totalMxn,
        taxes: [{ type: 'IVA', rate: 0.16 }],
      },
    }],
    use: tenant.usoCfdi || 'G03',
    payment_form: '04', // Tarjeta de crédito (most Stripe charges)
    payment_method: 'PUE', // Pago en una sola exhibición
    folio_number: invoice.stripeInvoiceId || undefined,
    series: 'MK',
  };

  try {
    const resp = await fetch(FACTURAPI_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FACTURAPI_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const text = await resp.text();
      return { ok: false, error: `Facturapi ${resp.status}: ${text.slice(0, 300)}` };
    }
    const data: any = await resp.json();
    const cfdiId = data?.id || data?._id || '';
    return {
      ok: true,
      cfdiId,
      pdfUrl: `https://www.facturapi.io/v2/invoices/${cfdiId}/pdf`,
      xmlUrl: `https://www.facturapi.io/v2/invoices/${cfdiId}/xml`,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'CFDI request failed' };
  }
}

export const cfdiConfigured = !!FACTURAPI_KEY;
