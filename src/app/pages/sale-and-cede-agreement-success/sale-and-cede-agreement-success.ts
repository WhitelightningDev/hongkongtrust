import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-sale-and-cede-agreement-success',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './sale-and-cede-agreement-success.html',
  styleUrls: ['./sale-and-cede-agreement-success.css'],
})
export class SaleAndCedeAgreementSuccessComponent implements OnInit {
  state: 'init' | 'working' | 'done' | 'error' = 'init';
  message = '';
  result: any;

  private readonly API_BASE = 'https://hongkongbackend.onrender.com';

  constructor(private http: HttpClient) {}

  async ngOnInit() {
    this.state = 'init';

    // Prefer fetching by session id from backend; fallback to localStorage
    const qs = new URLSearchParams(window.location.search);
    const sid = qs.get('sid') || undefined;

    const storedPaymentMethod = localStorage.getItem('paymentMethod') || '';
    const storedPaymentAmount = Number(localStorage.getItem('paymentAmount') || '0');

    let payload: any | null = null;

    // 1) Try server session fetch first (most reliable across redirects)
    if (sid) {
      try {
        const session: any = await firstValueFrom(
          this.http.get(`${this.API_BASE}/api/cede/session/${sid}`)
        );
        const ctx = session?.context || {};
        const cedeCtx = ctx?.sale_cede_context || null;
        if (cedeCtx) {
          payload = this.buildPayloadFromContext(cedeCtx, ctx);
          if (!payload.payment_method && storedPaymentMethod) {
            payload.payment_method = storedPaymentMethod;
          }
          if (!payload.payment_amount_cents && storedPaymentAmount) {
            payload.payment_amount_cents = storedPaymentAmount;
            payload.payment_amount = Math.round(storedPaymentAmount / 100);
          }
        }
      } catch (err) {
        console.warn('Could not fetch session by sid; will try localStorage fallback.', err);
      }
    }

    // 2) Fallback to localStorage (we store this on the payment-start page)
    if (!payload) {
      const lsJson = localStorage.getItem('saleCedeAgreementPayload');
      if (lsJson) {
        try {
          const lsPayload = JSON.parse(lsJson);
          payload = this.buildPayloadFromContext(lsPayload, null);
          if (!payload.payment_method && storedPaymentMethod) {
            payload.payment_method = storedPaymentMethod;
          }
          if (!payload.payment_amount_cents && storedPaymentAmount) {
            payload.payment_amount_cents = storedPaymentAmount;
            payload.payment_amount = Math.round(storedPaymentAmount / 100);
          }
        } catch (_) {
          payload = null;
        }
      }
    }

    // Merge in the original form snapshot (what the user entered) to fill any gaps
    if (payload) {
      try {
        const formJson = localStorage.getItem('saleCedeAgreementForm');
        if (formJson) {
          const form = JSON.parse(formJson);
          // Only fill if missing, prefer existing payload values
          payload.trust_number       = payload.trust_number       || form.trustNumber || '';
          payload.owner_name         = payload.owner_name         || form.owner?.name || '';
          payload.owner_id           = payload.owner_id           || form.owner?.id   || '';
          payload.signer_name        = payload.signer_name        || form.signer?.name|| '';
          payload.signer_id          = payload.signer_id          || form.signer?.id  || '';
          // Ensure list_of_property is a STRING (join array if needed)
          if (!payload.list_of_property) {
            const arr = Array.isArray(form.propertyList)
              ? form.propertyList
              : (form.propertyList ? [form.propertyList] : []);
            payload.list_of_property = arr.map((s: any) => String(s).trim()).filter(Boolean).join('; ');
          }
          payload.place_of_signature = payload.place_of_signature || (form.signaturePlace || '').toString().trim();
          payload.witness_name       = payload.witness_name       || (form.witnessName   || '').toString().trim();
          payload.witness_id         = payload.witness_id         || (form.witnessId     || '').toString().trim();
          // Fill settlor_id if missing
          payload.settlor_id         = payload.settlor_id         || (form.settlorId     || '').toString().trim();
          // Fill client_email if missing
          payload.client_email       = payload.client_email       || (form.clientEmail   || '').toString().trim();

          // Always preserve these from form snapshot if present
          if (form.propertyList || form.list_of_property_text) {
            if (form.list_of_property_text && form.list_of_property_text.toString().trim()) {
              payload.list_of_property = form.list_of_property_text.toString().trim();
            } else if (form.propertyList) {
              const arr = Array.isArray(form.propertyList)
                ? form.propertyList
                : (form.propertyList ? [form.propertyList] : []);
              payload.list_of_property = arr.map((s: any) => String(s).trim()).filter(Boolean).join('; ');
            }
          }
          if (form.signaturePlace && form.signaturePlace.toString().trim()) {
            payload.place_of_signature = form.signaturePlace.toString().trim();
          }
          if (form.witnessName && form.witnessName.toString().trim()) {
            payload.witness_name = form.witnessName.toString().trim();
          }
          if (form.witnessId && form.witnessId.toString().trim()) {
            payload.witness_id = form.witnessId.toString().trim();
          }

          // Overwrite list_of_property, witness_name, witness_id, place_of_signature always with latest from form snapshot if present
          if (form.list_of_property_text && form.list_of_property_text.toString().trim()) {
            payload.list_of_property = form.list_of_property_text.toString().trim();
          } else if (form.propertyList) {
            const arr = Array.isArray(form.propertyList)
              ? form.propertyList
              : (form.propertyList ? [form.propertyList] : []);
            payload.list_of_property = arr.map((s: any) => String(s).trim()).filter(Boolean).join('; ');
          }
          if (form.signaturePlace && form.signaturePlace.toString().trim()) {
            payload.place_of_signature = form.signaturePlace.toString().trim();
          }
          if (form.witnessName && form.witnessName.toString().trim()) {
            payload.witness_name = form.witnessName.toString().trim();
          }
          if (form.witnessId && form.witnessId.toString().trim()) {
            payload.witness_id = form.witnessId.toString().trim();
          }
        }
      } catch (e) {
        console.warn('Could not merge form snapshot:', e);
      }
    }

    // Debug logs after merging form snapshot
    console.log('Payload after merging form snapshot:', {
      list_of_property: payload?.list_of_property,
      place_of_signature: payload?.place_of_signature,
      witness_name: payload?.witness_name,
      witness_id: payload?.witness_id,
    });

    // Fallback: enrich payment fields from localStorage if missing
    try {
      if (payload && (!payload.payment_method || !payload.payment_amount_cents)) {
        const lsMethod = (localStorage.getItem('paymentMethod') || '').toString();
        const lsAmountCents = Number(localStorage.getItem('paymentAmount') || '0');
        if (!payload.payment_method && lsMethod) payload.payment_method = lsMethod;
        if (!payload.payment_amount_cents && lsAmountCents) {
          payload.payment_amount_cents = lsAmountCents;
          payload.payment_amount = Math.round(lsAmountCents / 100);
        }
      }
    } catch { /* no-op */ }

    if (!payload) {
      this.state = 'error';
      this.message = 'No agreement data found. Please start again.';
      return;
    }

    // Optional: attach gateway transaction id from query params
    const txId = qs.get('txId') || qs.get('transactionId') || qs.get('id') || undefined;
    if (txId) {
      payload.payment_tx_id = txId;
      payload.payment_gateway = 'yoco';
    }

    // Before required fields check, ensure payment fields are always populated by falling back to localStorage if missing
    try {
      if (payload) {
        const lsMethod = (localStorage.getItem('paymentMethod') || '').toString();
        const lsAmountCents = Number(localStorage.getItem('paymentAmount') || '0');
        if (!payload.payment_method && lsMethod) payload.payment_method = lsMethod;
        if ((!payload.payment_amount_cents || payload.payment_amount_cents === 0) && lsAmountCents) {
          payload.payment_amount_cents = lsAmountCents;
          payload.payment_amount = Math.round(lsAmountCents / 100);
        }
      }
    } catch { /* no-op */ }

    // Guard against missing required fields
    const required = ['trust_number','trust_name','owner_name','owner_id','signer_name','signer_id','list_of_property','witness_name','witness_id','place_of_signature','date_sign'];
    const missing = required.filter(k => !payload[k] || (typeof payload[k] === 'string' && payload[k].trim() === ''));
    if (missing.length) {
      this.state = 'error';
      this.message = 'Missing required fields: ' + missing.join(', ');
      console.error('Sale & Cede missing fields:', missing, 'Payload:', payload);
      return;
    }

    console.log('Payload before posting:', payload);

    this.state = 'working';
    try {
      this.result = await firstValueFrom(
        this.http.post(`${this.API_BASE}/api/agreements/sale-cede/generate`, payload)
      );

      // Cleanup local flags
      localStorage.removeItem('saleCedeFlow');
      localStorage.removeItem('saleCedeAgreementPayload');
      localStorage.removeItem('saleCedeAgreementForm');

      this.state = 'done';
      this.message = 'Agreement generated and emailed successfully.';
      console.log('Agreement result:', this.result);
    } catch (e: any) {
      console.error('Generate failed:', e);
      this.state = 'error';
      this.message = e?.error?.detail || e?.message || 'Failed to generate the agreement.';
    }
  }

  /**
   * Build EXACT payload expected by backend/DB:
   *  trust_number, trust_name, trust_date, owner_name, owner_id, signer_name,
   *  signer_id, list_of_property, witness_name, witness_id, place_of_signature,
   *  date_sign, created_at, and settlor_id (for merge). Also ensure client_email.
   */
  private buildPayloadFromContext(cedeCtx: any, fullCtx: any | null): any {
    const trustData = fullCtx?.trust_data || {};

    const now = new Date();
    const nowISO = now.toISOString();
    const today = nowISO.slice(0, 10);

    // Trust basics
    const trust_number = cedeCtx.trust_number || trustData.trust_number || trustData.trustNumber || '';
    const trust_name   = cedeCtx.trust_name   || trustData.trust_name   || trustData.trustName   || '';

    // Derive owner (seller): prefer explicit cedeCtx; else from trustData.settlor
    let owner_name = cedeCtx.owner_name || trustData.owner_name || '';
    let owner_id   = cedeCtx.owner_id   || trustData.owner_id   || '';
    if ((!owner_name || !owner_id) && trustData.settlor) {
      owner_name = owner_name || trustData.settlor.name || trustData.settlor.full_name || '';
      owner_id   = owner_id   || trustData.settlor.id   || trustData.settlor.passport || trustData.settlor.id_or_passport || '';
    }

    // Derive signer (on behalf of trust): prefer explicit cedeCtx; else first trustee
    let signer_name = cedeCtx.signer_name || trustData.signer_name || '';
    let signer_id   = cedeCtx.signer_id   || trustData.signer_id   || '';
    if ((!signer_name || !signer_id) && Array.isArray(trustData.trustees) && trustData.trustees.length) {
      const t0 = trustData.trustees[0];
      signer_name = signer_name || t0?.name || t0?.full_name || '';
      signer_id   = signer_id   || t0?.id   || t0?.passport   || t0?.id_or_passport || '';
    }

    // Property/rights list (prefer explicit string; accept array and join)
    let list_of_property: string = '';
    if (typeof cedeCtx.list_of_property === 'string' && cedeCtx.list_of_property.trim()) {
      list_of_property = cedeCtx.list_of_property.trim();
    } else if (Array.isArray(cedeCtx.list_of_property)) {
      list_of_property = cedeCtx.list_of_property.map((s: any) => String(s).trim()).filter(Boolean).join('; ');
    } else if (typeof cedeCtx.list_of_property_text === 'string' && cedeCtx.list_of_property_text.trim()) {
      list_of_property = cedeCtx.list_of_property_text.toString().trim();
    } else if (Array.isArray(cedeCtx.propertyList)) {
      list_of_property = cedeCtx.propertyList.map((s: any) => String(s).trim()).filter(Boolean).join('; ');
    } else if (cedeCtx.claim_details) {
      list_of_property = String(cedeCtx.claim_details).trim();
    }

    // If list_of_property is empty and list_of_property_text is present and non-empty, override
    if ((!list_of_property || list_of_property.trim() === '') && typeof cedeCtx.list_of_property_text === 'string' && cedeCtx.list_of_property_text.trim()) {
      list_of_property = cedeCtx.list_of_property_text.trim();
    }

    // Witness and signature details (normalize to strings and trim)
    const witness_name = (cedeCtx.witness_name ?? trustData.witness_name ?? '').toString().trim();
    const witness_id   = (cedeCtx.witness_id   ?? trustData.witness_id   ?? '').toString().trim();
    const place_of_signature = (cedeCtx.place_of_signature ?? trustData.place_of_signature ?? '').toString().trim();

    // Dates
    const trust_date = (
      cedeCtx.trust_date ||
      trustData.establishment_date_2 ||
      trustData.establishment_date_1 ||
      trustData.trust_date ||
      today
    );
    const date_sign  = cedeCtx.date_sign || today;
    const created_at = cedeCtx.created_at || nowISO;

    // Settlor and email (ensure trimmed strings)
    const settlor_id = (cedeCtx.settlor_id || trustData.settlor_id || trustData.settlorId || '').toString().trim();
    const client_email = (
      (cedeCtx.client_email || trustData.email || trustData.trustEmail || trustData.applicant_email || trustData.settlor_email || (trustData.applicant && trustData.applicant.email) || (trustData.settlor && trustData.settlor.email) || '')
    ).toString().trim();

    // Payment fields (normalize) with fallback to localStorage if missing
    let ctxPaymentMethod = (cedeCtx.payment_method || fullCtx?.payment_method || fullCtx?.trust_data?.payment_method || '').toString().trim();
    let ctxAmountCentsRaw = (
      cedeCtx.payment_amount_cents ??
      fullCtx?.payment_amount_cents ??
      fullCtx?.trust_data?.payment_amount_cents ??
      null
    );
    let ctxAmountZarRaw = (
      cedeCtx.payment_amount ??
      fullCtx?.payment_amount ??
      fullCtx?.trust_data?.payment_amount ??
      null
    );

    // Fallbacks from localStorage if missing
    if (!ctxPaymentMethod) {
      try {
        ctxPaymentMethod = (localStorage.getItem('paymentMethod') || '').toString().trim();
      } catch { ctxPaymentMethod = ''; }
    }
    if ((!ctxAmountCentsRaw || ctxAmountCentsRaw === 0) && typeof window !== 'undefined') {
      try {
        const lsAmountCents = Number(localStorage.getItem('paymentAmount') || '0');
        if (lsAmountCents) ctxAmountCentsRaw = lsAmountCents;
      } catch { /* no-op */ }
    }
    // If payment_amount still missing, derive from cents
    let payment_amount_cents = Number.isFinite(Number(ctxAmountCentsRaw)) ? Number(ctxAmountCentsRaw) : (Number(ctxAmountZarRaw) * 100 || 0);
    let payment_amount = payment_amount_cents ? Math.round(payment_amount_cents / 100) : (Number(ctxAmountZarRaw) || 0);
    let payment_method = ctxPaymentMethod || '';

    // Final payload
    const payload = {
      trust_number,
      trust_name,
      trust_date,
      owner_name,
      owner_id,
      signer_name,
      signer_id,
      list_of_property,
      witness_name,
      witness_id,
      place_of_signature,
      date_sign,
      created_at,
      // extra for DOCX merge only
      settlor_id,
      client_email,
      payment_method,
      payment_amount,
      payment_amount_cents,
    };

    console.log('[Success] Built payload for /agreements/sale-cede/generate:', payload);
    return payload;
  }
}