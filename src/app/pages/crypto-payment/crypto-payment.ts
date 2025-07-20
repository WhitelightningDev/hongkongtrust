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
  loading = true;
  error: string | null = null;

  trustData: any;
  isMember: boolean = false;
  memberNumberValid: boolean = false;

  priceZAR: number = 7500; // default to non-member
  priceUSD: number = 0;
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

      this.priceZAR = this.isMember && this.memberNumberValid ? 5 : 7500;
    } else {
      this.error = 'No trust form data found. Please start your application first.';
      this.loading = false;
    }
  }

  fetchXRPPrice(): void {
    this.http.get<any>('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd')
      .subscribe({
        next: (response) => {
          this.xrpPriceUSD = response?.ripple?.usd ?? null;
          if (this.xrpPriceUSD) {
            this.calculateXRPAmount();
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

  calculateXRPAmount(): void {
    const zarToUsdRate = 18.5; // Adjust or fetch live FX rate if needed
    this.priceUSD = this.priceZAR / zarToUsdRate;
    this.xrpAmount = +(this.priceUSD / this.xrpPriceUSD!).toFixed(4);
  }

  submitTransactionId() {
  this.txIdError = null;

  if (!this.transactionId || !/^[a-fA-F0-9]{64}$/.test(this.transactionId)) {
    this.txIdError = 'Please enter a valid 64-character hexadecimal transaction ID.';
    return;
  }

  // Save the transaction ID and payment method to sessionStorage
  const trustData = JSON.parse(sessionStorage.getItem('trustFormData') || '{}');
  trustData.paymentTransactionId = this.transactionId;
  trustData.has_paid = 'xrp';  // Mark payment method as XRP

  sessionStorage.setItem('trustFormData', JSON.stringify(trustData));

  // Navigate to the success page or submit directly as needed
  this.router.navigate(['/success']);
}

}
