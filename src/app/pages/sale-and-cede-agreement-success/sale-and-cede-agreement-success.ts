import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

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
        const API_BASE = 'https://hongkongbackend.onrender.com';
        const session: any = await this.http.get(`${API_BASE}/api/cede/session/${sid}`).toPromise();
        const ctx = session?.context || {};
        const cedeCtx = ctx?.sale_cede_context || null;
        if (cedeCtx) {
          payload = { ...cedeCtx };
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
          payload = JSON.parse(lsJson);
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
      const API_BASE = 'https://hongkongbackend.onrender.com';
      this.result = await this.http.post(
        `${API_BASE}/agreements/sale-cede/generate`,
        payload
      ).toPromise();

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
}