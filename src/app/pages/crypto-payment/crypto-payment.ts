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

  priceZAR: number = 7000; // Default non-member price
  xrpAmount: number = 0;
  paymentAddress = 'r3SUiiY7MsRviezVoHmuM5Y8doLj1UxeQb';

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

      this.priceZAR = this.isMember && this.memberNumberValid ? 1500 : 7000;
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
  trustData.has_paid = 'xrp';
  trustData.payment_amount_xrp = parseFloat(this.xrpAmount.toFixed(4));
  trustData.payment_amount_cents = Math.round(this.priceZAR * 100);

  sessionStorage.setItem('paymentAmount', trustData.payment_amount_cents.toString());
  sessionStorage.setItem('paymentMethod', 'xrp');
  sessionStorage.setItem('trustFormData', JSON.stringify(trustData));
  this.router.navigate(['/crypto-success']);
}
}
