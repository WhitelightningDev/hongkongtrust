import { Component, OnInit, AfterViewInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-success',
  imports: [CommonModule],
  templateUrl: './success.html',
  styleUrls: ['./success.css']
})
export class SuccessComponent implements OnInit {

  loading = true;
  success = false;
  errorMessage = '';

  constructor(private http: HttpClient) {}

  async ngOnInit() {
    try {
      const rawForm = JSON.parse(sessionStorage.getItem('trustFormData') || '{}');
      const serializedFiles = JSON.parse(sessionStorage.getItem('trustFiles') || '[]');

      const formData = new FormData();

      formData.append('full_name', rawForm.fullName);
      formData.append('id_number', rawForm.idNumber);
      formData.append('email', rawForm.email);
      formData.append('phone_number', rawForm.phoneNumber);
      formData.append('trust_email', rawForm.trustEmail || '');
      formData.append('trust_name', rawForm.trustName);
      formData.append('establishment_date', rawForm.establishmentDate);
      formData.append('beneficiaries', rawForm.beneficiaries || '');
      formData.append('is_bullion_member', rawForm.isBullionMember ? 'true' : 'false');
      formData.append('member_number', rawForm.memberNumber || '');
      formData.append('was_referred_by_member', rawForm.wasReferredByMember ? 'true' : 'false');
      formData.append('referrer_number', rawForm.referrerNumber || '');

      formData.append('settlor_name', rawForm.settlor.name);
      formData.append('settlor_id', rawForm.settlor.id);

      const trusteesArray = [];

      if (rawForm.trustee1?.name || rawForm.trustee1?.id) {
        trusteesArray.push(rawForm.trustee1);
      }
      if (rawForm.trustee2?.name || rawForm.trustee2?.id) {
        trusteesArray.push(rawForm.trustee2);
      }
      if (rawForm.trustee3?.name || rawForm.trustee3?.id) {
        trusteesArray.push(rawForm.trustee3);
      }
      if (rawForm.trustee4?.name || rawForm.trustee4?.id) {
        trusteesArray.push(rawForm.trustee4);
      }

      formData.append('trustees', JSON.stringify(trusteesArray));

      for (const f of serializedFiles) {
        const byteArray = new Uint8Array(f.buffer);
        const blob = new Blob([byteArray], { type: f.type });
        const file = new File([blob], f.name, { type: f.type });
        formData.append('documents', file, file.name);
      }

      // Mark payment done
      formData.append('has_paid', 'true');

      await this.http.post('http://127.0.0.1:8000/trusts/submit-trust', formData).toPromise();

      sessionStorage.removeItem('trustFormData');
      sessionStorage.removeItem('trustFiles');

      this.success = true;
    } catch (err: any) {
      this.errorMessage = err.message || 'Failed to submit trust after payment.';
      console.error('❌ Failed to submit trust after payment:', err);
    } finally {
      this.loading = false;
    }
  }
}
