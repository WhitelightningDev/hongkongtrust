import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-trustee-resolution',
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './trustee-resolution.html',
  styleUrl: './trustee-resolution.css'
})
export class TrusteeResolution {
 trustNumber = '';
  userName = '';
  successMessage = '';
  errorMessage = '';
  trustData: any = null;

  constructor(private http: HttpClient, private router: Router) {}

  lookupTrust() {
    this.successMessage = '';
    this.errorMessage = '';

    const trustUrl = `https://hongkongbackend.onrender.com/trusts/${encodeURIComponent(this.trustNumber)}?user_id=lookup`;

    this.http.get<any>(trustUrl).subscribe({
      next: (trust) => {
        if (trust.full_name?.trim() !== this.userName.trim()) {
          this.errorMessage = 'Trust with the provided trust number and user name not found.';
          return;
        }

        this.trustData = trust;
        this.successMessage = 'Trust data retrieved successfully.';
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = 'Failed to retrieve trust data.';
      }
    });
  }

  generateResolution() {
    this.successMessage = '';
    this.errorMessage = '';

    if (!this.trustData) {
      this.errorMessage = 'Please look up trust data first.';
      return;
    }

    const {
      trust_name,
      trust_number,
      full_name,
      id_number,
      email,
      phone_number,
      establishment_date_1,
      establishment_date_2,
      beneficiaries,
      settlor_name,
      member_number,
      is_bullion_member,
      payment_method,
      payment_xrp_qty,
      payment_status,
      trustee1_name,
      trustee2_name,
      trustee3_name,
      trustee4_name,
      trust_email,
      trustee1_id,
      trustee2_id,
      trustee3_id,
      trustee4_id,
      payment_timestamp,
      payment_currency,
      payment_reference,
      source,
      submitted_at,
      has_paid,
      referrer_number,
      settlor_id
    } = this.trustData;

    const resolutionPayload = {
      trust_name,
      trust_number,
      full_name,
      id_number,
      email,
      phone_number,
      establishment_date_1,
      establishment_date_2,
      beneficiaries,
      settlor_name,
      member_number,
      is_bullion_member,
      payment_method,
      payment_xrp_qty,
      payment_status,
      trustee1_name,
      trustee2_name,
      trustee3_name,
      trustee4_name,
      trust_email,
      trustee1_id,
      trustee2_id,
      trustee3_id,
      trustee4_id,
      payment_timestamp,
      payment_currency,
      payment_reference,
      source,
      submitted_at,
      has_paid,
      referrer_number,
      settlor_id
    };

    this.http.post('https://hongkongbackend.onrender.com/generate-resolution', resolutionPayload).subscribe({
      next: () => {
        this.successMessage = 'The draft resolution has been emailed to you successfully.';
        this.trustNumber = '';
        this.userName = '';
        this.trustData = null;
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = 'An error occurred while generating the resolution.';
      }
    });
  }

    goBackToHome(): void {
    this.router.navigate(['/']);
  }
}
