import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sale-and-cede-agreement-success',
  imports: [FormsModule, CommonModule],
  templateUrl: './sale-and-cede-agreement-success.html',
  styleUrls: ['./sale-and-cede-agreement-success.css'],
})
export class SaleAndCedeAgreementSuccessComponent implements OnInit {
  state: 'init' | 'working' | 'done' | 'error' = 'init';
  message = '';
  result: any;

  constructor(private http: HttpClient) {}

  async ngOnInit() {
    const payloadJson = sessionStorage.getItem('saleCedeAgreementPayload');
    if (!payloadJson) {
      this.state = 'error';
      this.message = 'No agreement data found. Please start again.';
      return;
    }

    // If Yoco adds tx id params to the URL, you can capture them here:
    const qs = new URLSearchParams(window.location.search);
    const txId = qs.get('txId') || qs.get('transactionId') || qs.get('id') || undefined;

    const payload = JSON.parse(payloadJson);
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

      // Cleanup local session flags
      sessionStorage.removeItem('saleCedeFlow');
      sessionStorage.removeItem('saleCedeAgreementPayload');

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