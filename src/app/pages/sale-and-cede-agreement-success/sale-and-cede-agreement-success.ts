import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../interceptors/auth.service';

type Method = 'card' | 'xrp';

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

  // handy for UI if you want to show them
  method: Method = 'card';
  amountZar = 500;
  amountCents = 50000;

  private readonly API_BASE = 'https://hongkongbackend.onrender.com';

  constructor(private http: HttpClient, private authService: AuthService) {}

  async ngOnInit() {
    this.state = 'init';

    const qs = new URLSearchParams(window.location.search);
    const sid = qs.get('sid') || undefined;

    // read any stored payment context early
    const storedPaymentMethod = (localStorage.getItem('paymentMethod') || '').toString().trim() as Method | '';
    const storedPaymentAmount = Number(localStorage.getItem('paymentAmount') || '0');

    let payload: any | null = null;

    // 1) Try fetch session by sid (best across redirects)
    if (sid) {
      try {
        const session: any = await firstValueFrom(
          this.http.get(`${this.API_BASE}/api/cede/session/${sid}`)
        );
        const ctx = session?.context || {};
        const cedeCtx = ctx?.sale_cede_context || null;
        if (cedeCtx) {
          payload = this.buildPayloadFromContext(cedeCtx, ctx);
        }
      } catch (err) {
        console.warn('Could not fetch session by sid; will try localStorage fallback.', err);
      }
    }

    // 2) Fallback to standard localStorage payload
    if (!payload) {
      const lsJson = localStorage.getItem('saleCedeAgreementPayload');
      if (lsJson) {
        try { payload = this.buildPayloadFromContext(JSON.parse(lsJson), null); } catch { payload = null; }
      }
    }

    // 2b) XRP-specific fallback if needed
    if (!payload) {
      const lsJsonXrp = localStorage.getItem('saleCedeAgreementPayloadXrp');
      if (lsJsonXrp) {
        try { payload = this.buildPayloadFromContext(JSON.parse(lsJsonXrp), null); } catch { payload = null; }
      }
    }

    // 3) Merge in the original form snapshot to fill gaps
    if (payload) {
      try {
        const formJson = localStorage.getItem('saleCedeAgreementForm');
        if (formJson) this.mergeFormSnapshotIntoPayload(payload, JSON.parse(formJson));
      } catch (e) {
        console.warn('Could not merge form snapshot:', e);
      }
    }

    // 4) Single, consolidated hydration for payment fields (card & XRP)
    this.hydratePaymentFields(payload, storedPaymentMethod, storedPaymentAmount);

    if (!payload) {
      this.state = 'error';
      this.message = 'No agreement data found. Please start again.';
      return;
    }

    // Attach optional gateway ids (card flow)
    const txId = qs.get('txId') || qs.get('transactionId') || qs.get('id') || undefined;
    if (txId) {
      payload.payment_tx_id = txId;
      payload.payment_gateway = 'yoco';
    }

    // Guard: required fields
    const required = [
      'trust_number','trust_name','owner_name','owner_id',
      'signer_name','signer_id','list_of_property',
      'place_of_signature','date_sign'
    ];
    const missing = required.filter(k => !payload[k] || (typeof payload[k] === 'string' && payload[k].trim() === ''));
    if (missing.length) {
      this.state = 'error';
      this.message = 'Missing required fields: ' + missing.join(', ');
      console.error('Sale & Cede missing fields:', missing, 'Payload:', payload);
      return;
    }

    // Update UI helpers (optional)
    this.method = (payload.payment_method === 'xrp' ? 'xrp' : 'card');
    this.amountCents = Number(payload.payment_amount_cents) || 50000;
    this.amountZar = Math.round(this.amountCents / 100);

    console.log('Payload before posting:', payload);

    this.state = 'working';
    try {
      const headers = { Authorization: `Bearer ${this.authService.getToken()}` };
      this.result = await firstValueFrom(
        this.http.post(`${this.API_BASE}/api/agreements/sale-cede/generate`, payload, { headers })
      );

      // Cleanup local flags
      localStorage.removeItem('saleCedeFlow');
      localStorage.removeItem('saleCedeAgreementPayload');
      localStorage.removeItem('saleCedeAgreementPayloadXrp');
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

  // --- helpers ---------------------------------------------------------------

  private mergeFormSnapshotIntoPayload(payload: any, form: any) {
    // Only fill if missing, prefer existing payload values
    payload.trust_number       = payload.trust_number       || form.trustNumber || '';
    payload.owner_name         = payload.owner_name         || form.owner?.name || '';
    payload.owner_id           = payload.owner_id           || form.owner?.id   || '';
    payload.signer_name        = payload.signer_name        || form.signer?.name|| '';
    payload.signer_id          = payload.signer_id          || form.signer?.id  || '';

    // Ensure list_of_property is a STRING (join array if needed)
    const coerceList = (arrLike: any) => {
      const arr = Array.isArray(arrLike) ? arrLike : (arrLike ? [arrLike] : []);
      return arr.map((s: any) => String(s).trim()).filter(Boolean).join('; ');
    };

    if (!payload.list_of_property) {
      payload.list_of_property = form.list_of_property_text?.toString().trim()
        || coerceList(form.propertyList);
    }

    // Latest values from form override if present
    if (form.list_of_property_text && String(form.list_of_property_text).trim()) {
      payload.list_of_property = String(form.list_of_property_text).trim();
    } else if (form.propertyList) {
      payload.list_of_property = coerceList(form.propertyList);
    }
    if (form.signaturePlace) payload.place_of_signature = String(form.signaturePlace).trim() || payload.place_of_signature;

    // Fill settlor/email if missing
    if (!payload.settlor_id && form.settlorId) payload.settlor_id = String(form.settlorId).trim();
    if (!payload.client_email && form.clientEmail) payload.client_email = String(form.clientEmail).trim();
  }

  /** Normalize/ensure payment fields once (for both card and XRP) */
  private hydratePaymentFields(payload: any | null, storedMethod: Method | '', storedAmountCents: number) {
    if (!payload) return;

    // Pull XRP mirror if present in localStorage
    try {
      const lsX = localStorage.getItem('saleCedeAgreementPayloadXrp');
      if (lsX) {
        const x = JSON.parse(lsX);
        payload.xrp_amount  = payload.xrp_amount  ?? x?.xrp_amount  ?? null;
        payload.xrp_tx_hash = payload.xrp_tx_hash ?? x?.xrp_tx_hash ?? '';
        payload.xrp_address = payload.xrp_address ?? x?.xrp_address ?? '';
      }
    } catch { /* no-op */ }

    // payment_method
    let method: Method | '' = (payload.payment_method || '').toString().trim().toLowerCase() as Method | '';
    if (!method && (payload.xrp_tx_hash || payload.xrp_amount)) method = 'xrp';
    if (!method && storedMethod) method = storedMethod;
    payload.payment_method = method || 'card';

    // amounts
    let cents = Number(payload.payment_amount_cents);
    let zar = Number(payload.payment_amount);
    if (!Number.isFinite(cents) || cents <= 0) {
      if (Number.isFinite(zar) && zar > 0) cents = Math.round(zar * 100);
      else if (Number.isFinite(storedAmountCents) && storedAmountCents > 0) cents = storedAmountCents;
      else cents = 50000; // default
    }
    payload.payment_amount_cents = cents;
    payload.payment_amount = Math.round(cents / 100);
  }

  /**
   * Build EXACT payload expected by backend/DB:
   *  trust_number, trust_name, trust_date, owner_name, owner_id, signer_name,
   *  signer_id, list_of_property, place_of_signature,
   *  date_sign, created_at, settlor_id, client_email, payment_* and optional XRP fields.
   */
  private buildPayloadFromContext(cedeCtx: any, fullCtx: any | null): any {
    const trustData = fullCtx?.trust_data || {};

    const now = new Date();
    const nowISO = now.toISOString();
    const today = nowISO.slice(0, 10);

    // Trust basics
    const trust_number = cedeCtx.trust_number || trustData.trust_number || trustData.trustNumber || '';
    const trust_name   = cedeCtx.trust_name   || trustData.trust_name   || trustData.trustName   || '';

    // Owner (seller)
    let owner_name = cedeCtx.owner_name || trustData.owner_name || '';
    let owner_id   = cedeCtx.owner_id   || trustData.owner_id   || '';
    if ((!owner_name || !owner_id) && trustData.settlor) {
      owner_name = owner_name || trustData.settlor.name || trustData.settlor.full_name || '';
      owner_id   = owner_id   || trustData.settlor.id   || trustData.settlor.passport || trustData.settlor.id_or_passport || '';
    }
    const owner_email = cedeCtx.owner_email || trustData.owner_email || trustData.email || '';

    // Signer (trust)
    let signer_name = cedeCtx.signer_name || trustData.signer_name || '';
    let signer_id   = cedeCtx.signer_id   || trustData.signer_id   || '';
    if ((!signer_name || !signer_id) && Array.isArray(trustData.trustees) && trustData.trustees.length) {
      const t0 = trustData.trustees[0];
      signer_name = signer_name || t0?.name || t0?.full_name || '';
      signer_id   = signer_id   || t0?.id   || t0?.passport   || t0?.id_or_passport || '';
    }
    const signer_email = cedeCtx.signer_email || trustData.signer_email || trustData.trustee2_email || '';

    // Property / rights
    const coerceList = (v: any) => Array.isArray(v) ? v.map((s: any) => String(s).trim()).filter(Boolean).join('; ') : String(v || '').trim();
    let list_of_property = '';
    if (typeof cedeCtx.list_of_property === 'string' && cedeCtx.list_of_property.trim()) list_of_property = cedeCtx.list_of_property.trim();
    else if (Array.isArray(cedeCtx.list_of_property)) list_of_property = coerceList(cedeCtx.list_of_property);
    else if (typeof cedeCtx.list_of_property_text === 'string' && cedeCtx.list_of_property_text.trim()) list_of_property = cedeCtx.list_of_property_text.trim();
    else if (Array.isArray(cedeCtx.propertyList)) list_of_property = coerceList(cedeCtx.propertyList);
    else if (cedeCtx.claim_details) list_of_property = String(cedeCtx.claim_details).trim();

    const property_address = cedeCtx.property_address || trustData.property_address || trustData.Property_Address || '';

    // Witness/signing
    const place_of_signature = (cedeCtx.place_of_signature ?? trustData.place_of_signature ?? '').toString().trim();

    // Dates
    const establishment_date_1 = trustData.establishment_date_1 || '';
    const establishment_date_2 = trustData.establishment_date_2 || '';
    const date_sign = (cedeCtx.date_sign || today).toString().trim();
    const signature_date = cedeCtx.signature_date || null;
    const created_at = cedeCtx.created_at || nowISO;

    // Settlor/email
    const settlor_id = (cedeCtx.settlor_id || trustData.settlor_id || trustData.settlorId || '').toString().trim();
    const client_email = (
      cedeCtx.client_email ||
      trustData.email ||
      trustData.trustEmail ||
      trustData.applicant_email ||
      trustData.settlor_email ||
      (trustData.applicant && trustData.applicant.email) ||
      (trustData.settlor && trustData.settlor.email) ||
      ''
    ).toString().trim();

    // Optional XRP passthrough
    const xrp_amount  = cedeCtx.xrp_amount  ?? fullCtx?.xrp_amount  ?? fullCtx?.trust_data?.xrp_amount  ?? null;
    const xrp_tx_hash = cedeCtx.xrp_tx_hash ?? fullCtx?.xrp_tx_hash ?? fullCtx?.trust_data?.xrp_tx_hash ?? '';
    const xrp_address = cedeCtx.xrp_address ?? fullCtx?.xrp_address ?? fullCtx?.trust_data?.xrp_address ?? '';

    // Payment (raw; final hydration happens in hydratePaymentFields)
    const payment_method = (cedeCtx.payment_method || fullCtx?.payment_method || fullCtx?.trust_data?.payment_method || '').toString().trim();
    const payment_amount_cents = (
      cedeCtx.payment_amount_cents ??
      fullCtx?.payment_amount_cents ??
      fullCtx?.trust_data?.payment_amount_cents ??
      null
    );
    const payment_amount = (
      cedeCtx.payment_amount ??
      fullCtx?.payment_amount ??
      fullCtx?.trust_data?.payment_amount ??
      null
    );

    const payload = {
      trust_number,
      trust_name,
      establishment_date_1,
      establishment_date_2,
      owner_name,
      owner_id,
      owner_email,
      signer_name,
      signer_id,
      signer_email,
      place_of_signature,
      date_sign,
      signature_date,
      list_of_property,
      property_address,
      settlor_id,
      client_email,
      payment_method,
      payment_amount,
      payment_amount_cents,
      ...(xrp_amount  ? { xrp_amount } : {}),
      ...(xrp_tx_hash ? { xrp_tx_hash } : {}),
      ...(xrp_address ? { xrp_address } : {}),
    };

    console.log('[Success] Built payload for /agreements/sale-cede/generate:', payload);
    return payload;
  }
}