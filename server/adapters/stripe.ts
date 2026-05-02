import Stripe from 'stripe';
import { INTEGRATION_MODE } from './index';

export interface CheckoutOpts {
  planSlug: string;
  customerEmail: string;
  customerId?: string | null; // existing Stripe customer (preferred over email)
  tenantId: number;
  successUrl: string;
  cancelUrl: string;
  enableOxxo?: boolean;
  trialDays?: number;
  allowPromotionCodes?: boolean;
}

export interface IStripeClient {
  createCustomer(email: string, name: string, metadata?: Record<string, string>): Promise<{ customerId: string }>;
  createCheckoutSession(opts: CheckoutOpts): Promise<{ url: string; sessionId: string }>;
  createBillingPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }>;
  retrieveSubscription(subId: string): Promise<any>;
  retrieveInvoice(invId: string): Promise<any>;
  recordUsage(subItemId: string, qty: number): Promise<void>;
  raw(): Stripe | null;
}

export const PRICE_BY_PLAN: Record<string, string | undefined> = {
  inicia: process.env.STRIPE_PRICE_INICIA,
  crece: process.env.STRIPE_PRICE_CRECE,
  empresa: process.env.STRIPE_PRICE_EMPRESA,
  agencia: process.env.STRIPE_PRICE_AGENCIA,
};

export function priceIdToPlanSlug(priceId: string | null | undefined): string | null {
  if (!priceId) return null;
  for (const [slug, pid] of Object.entries(PRICE_BY_PLAN)) {
    if (pid && pid === priceId) return slug;
  }
  return null;
}

export class MockStripeClient implements IStripeClient {
  async createCustomer(email: string) { return { customerId: `cus_mock_${Date.now()}` }; }
  async createCheckoutSession(opts: CheckoutOpts) {
    const u = new URL(opts.successUrl);
    u.searchParams.set('mock_session', '1');
    u.searchParams.set('plan', opts.planSlug);
    u.searchParams.set('tenant_id', String(opts.tenantId));
    return { url: u.toString(), sessionId: `cs_mock_${Date.now()}` };
  }
  async createBillingPortalSession(_cid: string, returnUrl: string) {
    return { url: returnUrl + '?mock_portal=1' };
  }
  async retrieveSubscription() { return null; }
  async retrieveInvoice() { return null; }
  async recordUsage() { return; }
  raw() { return null; }
}

export class LiveStripeClient implements IStripeClient {
  private stripe: Stripe;
  constructor(secret: string) {
    this.stripe = new Stripe(secret, { apiVersion: '2025-02-24.acacia' as any });
  }
  raw() { return this.stripe; }
  async createCustomer(email: string, name: string, metadata?: Record<string, string>) {
    const c = await this.stripe.customers.create({ email, name, metadata });
    return { customerId: c.id };
  }
  async createCheckoutSession(opts: CheckoutOpts) {
    const price = PRICE_BY_PLAN[opts.planSlug];
    if (!price) throw new Error(`No STRIPE_PRICE_* env var configured for plan "${opts.planSlug}"`);
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      success_url: opts.successUrl,
      cancel_url: opts.cancelUrl,
      currency: 'mxn',
      payment_method_types: opts.enableOxxo ? ['card', 'oxxo'] : ['card'],
      allow_promotion_codes: opts.allowPromotionCodes !== false,
      subscription_data: {
        trial_period_days: opts.trialDays ?? 0,
        metadata: { tenant_id: String(opts.tenantId), plan: opts.planSlug },
      },
      metadata: { tenant_id: String(opts.tenantId), plan: opts.planSlug },
    };
    if (opts.customerId) {
      params.customer = opts.customerId;
    } else {
      params.customer_email = opts.customerEmail;
    }
    const session = await this.stripe.checkout.sessions.create(params);
    return { url: session.url || '', sessionId: session.id };
  }
  async createBillingPortalSession(customerId: string, returnUrl: string) {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return { url: session.url };
  }
  async retrieveSubscription(subId: string) {
    return await this.stripe.subscriptions.retrieve(subId);
  }
  async retrieveInvoice(invId: string) {
    return await this.stripe.invoices.retrieve(invId);
  }
  async recordUsage() { return; }
}

const secret = process.env.STRIPE_SECRET_KEY;
export const stripeClient: IStripeClient =
  INTEGRATION_MODE === 'live' && secret
    ? new LiveStripeClient(secret)
    : new MockStripeClient();

export const stripeMode = INTEGRATION_MODE === 'live' && secret ? 'live' : 'mock';

// Returns true if any required STRIPE_PRICE_* is missing (admin warning).
export function missingStripePriceIds(): string[] {
  const missing: string[] = [];
  for (const [slug, pid] of Object.entries(PRICE_BY_PLAN)) {
    if (!pid) missing.push(slug);
  }
  return missing;
}
