import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { AuthService } from '../../interceptors/auth.service';
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

  constructor(private http: HttpClient, private router: Router, private authService: AuthService) {}

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

    this.http.get<any>(trustUrl, {
      headers: { Authorization: `Bearer ${this.authService.getToken()}` }
    }).subscribe({
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

        this.http.post(
          'https://hongkongbackend.onrender.com/generate-resolution',
          resolutionPayload,
          {
            responseType: 'blob',
            observe: 'response',
            headers: { Authorization: `Bearer ${this.authService.getToken()}` }
          }
        ).subscribe({
          next: (response) => {
            const blob: Blob = response.body!;
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'Trustee_Resolution.docx';
            if (contentDisposition) {
              const match = contentDisposition.match(/filename="?([^"]+)"?/);
              if (match && match[1]) {
                filename = decodeURIComponent(match[1]);
              }
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;

            if (navigator.userAgent.toLowerCase().includes('android')) {
              const reader = new FileReader();
              reader.onloadend = () => {
                const blobUrl = reader.result as string;
                const newTab = window.open();
                if (newTab) {
                  newTab.document.write('<iframe src="' + blobUrl + '" frameborder="0" style="border:0; top:0; left:0; bottom:0; right:0; width:100%; height:100%;" allowfullscreen></iframe>');
                } else {
                  alert('Please allow popups for this site to download the document.');
                }
              };
              reader.readAsDataURL(blob);
            } else {
              a.click();
            }

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
