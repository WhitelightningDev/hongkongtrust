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
        } catch (_) {
          payload = null;
        }
      }
    }

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

    // Guard against missing required fields
    const required = ['trust_number','trust_name','owner_name','owner_id','signer_name','signer_id','list_of_property','witness_name','witness_id','place_of_signature','date_sign'];
    const missing = required.filter(k => !payload[k] || (typeof payload[k] === 'string' && payload[k].trim() === ''));
    if (missing.length) {
      this.state = 'error';
      this.message = 'Missing required fields: ' + missing.join(', ');
      console.error('Sale & Cede missing fields:', missing, 'Payload:', payload);
      return;
    }

    this.state = 'working';
    try {
      this.result = await firstValueFrom(
        this.http.post(`${this.API_BASE}/api/agreements/sale-cede/generate`, payload)
      );

      // Cleanup local flags
      localStorage.removeItem('saleCedeFlow');
      localStorage.removeItem('saleCedeAgreementPayload');

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

    // Property/rights list
    const list_of_property = cedeCtx.list_of_property || cedeCtx.claim_details || '';

    // Witness and signature details
    const witness_name = (cedeCtx.witness_name ?? '').toString();
    const witness_id   = (cedeCtx.witness_id   ?? '').toString();
    const place_of_signature = (cedeCtx.place_of_signature ?? '').toString();

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

    // Settlor and email
    const settlor_id = cedeCtx.settlor_id || trustData.settlor_id || trustData.settlorId || '';
    const client_email = (
      cedeCtx.client_email ||
      trustData.email ||
      trustData.trustEmail ||
      trustData.applicant_email ||
      trustData.settlor_email ||
      (trustData.applicant && trustData.applicant.email) ||
      (trustData.settlor && trustData.settlor.email) ||
      ''
    );

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
    };

    console.log('[Success] Built payload for /agreements/sale-cede/generate:', payload);
    return payload;
  }
}