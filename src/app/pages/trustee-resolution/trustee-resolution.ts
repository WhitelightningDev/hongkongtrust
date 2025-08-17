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
  isLoading = false;

  constructor(private http: HttpClient, private router: Router) {}

  generateResolution() {
    this.successMessage = '';
    this.errorMessage = '';
    this.isLoading = true;

    if (!this.trustNumber || !this.userName) {
      this.errorMessage = 'Please enter both trust number and your full name.';
      this.isLoading = false;
      return;
    }

    const trustUrl = `https://hongkongbackend.onrender.com/trusts/${encodeURIComponent(this.trustNumber)}?user_id=lookup`;

    this.http.get<any>(trustUrl).subscribe({
      next: (trust) => {
        if (trust.full_name?.trim() !== this.userName.trim()) {
          this.errorMessage = 'Trust with the provided trust number and user name not found.';
          this.isLoading = false;
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
        } = trust;

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

        this.http.post('https://hongkongbackend.onrender.com/generate-resolution', resolutionPayload, {
          responseType: 'blob'
        }).subscribe({
          next: (blob: Blob) => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Trustee_Resolution.docx';
            a.click();
            window.URL.revokeObjectURL(url);

            this.successMessage = 'The resolution was generated and downloaded successfully.';
            this.trustNumber = '';
            this.userName = '';
            this.trustData = null;
            this.isLoading = false;
          },
          error: (err) => {
            console.error(err);
            this.errorMessage = 'An error occurred while generating the resolution.';
            this.isLoading = false;
          }
        });
      },
      error: (err) => {
        console.error(err);
        this.errorMessage = 'Failed to retrieve trust data.';
        this.isLoading = false;
      }
    });
  }

    goBackToHome(): void {
    this.router.navigate(['/']);
  }
}
