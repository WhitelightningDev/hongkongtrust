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
   * Merge the cede context with any missing fields from server `trust_data` if available.
   * Ensures required merge fields exist and adds defensive defaults.
   */
  private buildPayloadFromContext(cedeCtx: any, fullCtx: any | null): any {
    const trustData = fullCtx?.trust_data || {};

    const merged: any = {
      ...cedeCtx,
    };

    // Fill in trust_name/number if missing using trust_data
    if (!merged.trust_number) merged.trust_number = trustData.trust_number || trustData.trustNumber || '';
    if (!merged.trust_name) merged.trust_name = trustData.trust_name || trustData.trustName || '';

    // date_sign default (yyyy-mm-dd)
    if (!merged.date_sign) merged.date_sign = new Date().toISOString().slice(0, 10);

    // Ensure required witness/signature fields exist (empty strings if not provided)
    merged.witness_name = merged.witness_name ?? '';
    merged.witness_id = merged.witness_id ?? '';
    merged.place_of_signature = merged.place_of_signature ?? '';

    // settlor id fallback from trust_data if available
    if (!merged.settlor_id) {
      merged.settlor_id = trustData.settlor_id || trustData.settlorId || '';
    }

    // Ensure client_email is present so backend can email the client
    // Prefer any email already in the cede context, else derive from trustData
    const derivedEmail = (
      merged.client_email ||
      trustData.email ||
      trustData.trustEmail ||
      trustData.applicant_email ||
      trustData.settlor_email ||
      (trustData.applicant && trustData.applicant.email) ||
      (trustData.settlor && trustData.settlor.email) ||
      ''
    );
    merged.client_email = derivedEmail;

    console.log('[Success] Using client_email for Sale & Cede:', derivedEmail);

    return merged;
  }
}