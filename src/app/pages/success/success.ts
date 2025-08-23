import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-success',
  standalone: true,
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
      const trustId = sessionStorage.getItem('trustId') || '';
      const paymentMethod = sessionStorage.getItem('paymentMethod') || 'card';
      let paymentAmount = '700000'; // fallback in cents

      const storedAmount = sessionStorage.getItem('paymentAmount');
      if (storedAmount) {
        paymentAmount = storedAmount;
      }

      const paymentAmountZAR = (parseInt(paymentAmount, 10) / 100).toFixed(2);

      const formData = new FormData();

      // Trust details
      formData.append('trust_id', trustId);
      formData.append('full_name', rawForm.fullName || '');
      formData.append('id_number', rawForm.idNumber || '');
      formData.append('email', rawForm.email || '');
      formData.append('phone_number', rawForm.phoneNumber || '');
      formData.append('trust_email', rawForm.trustEmail || '');
      formData.append('trust_name', rawForm.trustName || '');
      formData.append('establishment_date', rawForm.establishmentDate || '');
      formData.append('beneficiaries', rawForm.beneficiaries || '');
      formData.append('is_bullion_member', rawForm.isBullionMember ? 'true' : 'false');
      formData.append('member_number', rawForm.memberNumber || '');
      formData.append('was_referred_by_member', rawForm.wasReferredByMember ? 'true' : 'false');
      formData.append('referrer_number', rawForm.referrerNumber || '');

      // Settlor
      formData.append('settlor_name', rawForm.settlor?.name || '');
      formData.append('settlor_id', rawForm.settlor?.id || '');
      formData.append('settlor_email', rawForm.settlor?.email || '');

      // Trustees with proper typing
      const trusteesArray: { name: string; id: string; email?: string }[] = [];
      [rawForm.trustee1, rawForm.trustee2, rawForm.trustee3].forEach((trustee) => {
        if (trustee?.name && trustee?.id) {
          trusteesArray.push({
            name: trustee.name,
            id: trustee.id,
            email: trustee.email || ''
          });
        }
      });
      formData.append('trustees', JSON.stringify(trusteesArray));

      formData.append('property_owner', rawForm.propertyOwner || '');
      formData.append('property_address', rawForm.propertyAddress || '');

      // Files
      for (const f of serializedFiles) {
        const byteArray = new Uint8Array(f.buffer);
        const blob = new Blob([byteArray], { type: f.type });
        const file = new File([blob], f.name, { type: f.type });
        formData.append('documents', file, file.name);
      }

      // Payment info
      formData.append('payment_amount', paymentAmountZAR); // send as ZAR
      formData.append('payment_currency', 'ZAR');
      formData.append('payment_method', paymentMethod);
      formData.append('has_paid', paymentMethod); // "card" or "eft"

      // Submit
      await this.http.post('https://hongkongbackend.onrender.com/trusts/submit-trust', formData).toPromise();

      // Clear session
      sessionStorage.removeItem('trustFormData');
      sessionStorage.removeItem('trustFiles');
      sessionStorage.removeItem('trustId');
      sessionStorage.removeItem('paymentMethod');
      sessionStorage.removeItem('paymentAmount');

      this.success = true;

    } catch (err: any) {
      this.errorMessage = err.message || 'Failed to submit trust after payment.';
      console.error('❌ Failed to submit trust after payment:', err);
    } finally {
      this.loading = false;
    }
  }
}