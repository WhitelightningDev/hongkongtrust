import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-lease-agreement',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './lease-agreement.html',
  styleUrls: ['./lease-agreement.css']
})
export class LeaseAgreement {
  formData: any = {};
  loading: boolean = false;
  trustDataRetrieved: boolean = false;

  constructor(private http: HttpClient, private router: Router) {}

  async generateLeaseAgreement() {
    try {
      const {
        trust_name,
        settlor_name,
        settlor_id,
        trustee2_name,
        trustee1_name,
        trustee1_id,
        trust_number,
        Property_Address,
        establishment_date_1,
        establishment_date_2
      } = this.formData;

      const payload = {
        trust_name,
        owner_name: settlor_name,
        owner_id: settlor_id,
        signer_name: trustee2_name,
        witness_name: trustee1_name,
        witness_id: trustee1_id,
        trust_number,
        Property_Address,
        establishment_date_1,
        establishment_date_2
      };

      const blob = await this.http.post('https://hongkongbackend.onrender.com/generate-lease-agreement', payload, { responseType: 'blob' }).toPromise();
      if (!blob) throw new Error('No blob received from server');
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'HK_Lease_Agreement.docx';
      a.click();
    } catch (err) {
      console.error('Error generating document', err);
    }
  }

  async fetchTrustData() {
    if (!this.formData.trust_number || !this.formData.settlor_id) {
      console.error('Both trust_number and settlor_id must be provided');
      return;
    }
    this.loading = true;
    this.trustDataRetrieved = false;
    try {
      const encodedTrustNumber = encodeURIComponent(this.formData.trust_number);
      const response = await this.http.get<any>(`https://hongkongbackend.onrender.com/trusts/${encodedTrustNumber}?user_id=${this.formData.settlor_id}`).toPromise();
      this.formData = { ...this.formData, ...response };
      this.trustDataRetrieved = true;
    } catch (error) {
      console.error('Error fetching trust data', error);
    } finally {
      this.loading = false;
    }
  }

  resetForm() {
    this.formData = {};
    this.loading = false;
    this.trustDataRetrieved = false;
  }


  goBackToHome(): void {
    this.router.navigate(['/']);
  }
}
