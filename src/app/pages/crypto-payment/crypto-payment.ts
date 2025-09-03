import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-crypto-payment',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule],
  templateUrl: './crypto-payment.html',
  styleUrls: ['./crypto-payment.css']
})
export class CryptoPayment implements OnInit {
  xrpPriceUSD: number | null = null;
  xrpPriceZAR: number | null = null;
  loading = true;
  error: string | null = null;

  trustData: any;
  isMember: boolean = false;
  memberNumberValid: boolean = false;

  priceZAR: number = 7150; // Default non-member price
  xrpAmount: number = 0;
  paymentAddress = 'rMuStHBy5N17ysmiQjUj4QQv5DTk8ovWDS';

  transactionId: string = '';
  txIdError: string | null = null;

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    this.loadTrustData();
    if (!this.error) {
      this.fetchXRPPrice();
    }
  }

  loadTrustData(): void {
    const storedData = sessionStorage.getItem('trustFormData');
    if (storedData) {
      this.trustData = JSON.parse(storedData);
      this.isMember = this.trustData.isBullionMember;
      const memberNumber: string = this.trustData.memberNumber || '';
      this.memberNumberValid = /^BB\d{6}$/i.test(memberNumber);

      this.priceZAR = this.isMember && this.memberNumberValid ? 1950 : 7150;
    } else {
      this.error = 'No trust form data found. Please start your application first.';
      this.loading = false;
    }
  }

  fetchXRPPrice(): void {
    const apiUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd,zar';
    this.http.get<any>(apiUrl).subscribe({
      next: (response) => {
        const priceData = response?.ripple;
        if (priceData?.usd && priceData?.zar) {
          this.xrpPriceUSD = priceData.usd;
          this.xrpPriceZAR = priceData.zar;
          this.xrpAmount = +(this.priceZAR / this.xrpPriceZAR!).toFixed(4);
        } else {
          this.error = 'Incomplete XRP price data received.';
        }
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Unable to fetch XRP price.';
        this.loading = false;
        console.error(err);
      }
    });
  }

 submitTransactionId(): void {
  this.txIdError = null;

  if (!this.transactionId || !/^[a-fA-F0-9]{64}$/.test(this.transactionId)) {
    this.txIdError = 'Please enter a valid 64-character hexadecimal transaction ID.';
    return;
  }

  const trustData = JSON.parse(sessionStorage.getItem('trustFormData') || '{}');

  trustData.payment_xrp_trans_id = this.transactionId;
  trustData.payment_amount = this.priceZAR;
  trustData.payment_xrp_qty = this.xrpAmount;
  trustData.payment_currency = 'ZAR';
  trustData.payment_method = 'xrp';
  trustData.has_paid = 'true'; // ✅ Corrected value for backend

  trustData.settlor_email = trustData.settlor?.email || '';
  trustData.trustee1_email = trustData.trustee1?.email || '';
  trustData.trustee2_email = trustData.trustee2?.email || '';
  trustData.trustee3_email = trustData.trustee3?.email || '';
  trustData.owner_name = trustData.ownerName || trustData.trustee1?.name || '';
  trustData.owner_id = trustData.owner_id || trustData.trustee1?.id || '';
  trustData.owner_email = trustData.owner_email || trustData.trustee1?.email || '';

  // New signer fields (prefer explicit signer_*; fallback to Trustee 2)
  trustData.signer_name = trustData.signer_name || trustData.trustee2?.name || '';
  trustData.signer_id = trustData.signer_id || trustData.trustee2?.id || '';
  trustData.signer_email = trustData.signer_email || trustData.trustee2?.email || '';

  // Map UI propertyAddress to both shapes for backend compatibility
  trustData.Property_Address = trustData.propertyAddress || trustData.Property_Address || '';
  trustData.property_address = trustData.propertyAddress || trustData.property_address || '';

  sessionStorage.setItem('trustFormData', JSON.stringify(trustData));
  this.router.navigate(['/crypto-success']);
}
}
