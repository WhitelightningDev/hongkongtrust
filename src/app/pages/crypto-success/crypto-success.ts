import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-crypto-success',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './crypto-success.html',
  styleUrls: ['./crypto-success.css'],
})
export class CryptoSuccess implements OnInit {
  loading = true;
  success = false;
  errorMessage = '';

  constructor(private http: HttpClient) {}

  async ngOnInit() {
    try {
      const rawForm = JSON.parse(
        sessionStorage.getItem('trustFormData') || '{}'
      );
      const serializedFiles = JSON.parse(
        sessionStorage.getItem('trustFiles') || '[]'
      );
      const trustId = sessionStorage.getItem('trustId') || '';
      let paymentAmount = '700000'; // default fallback
      const storedAmount = sessionStorage.getItem('paymentAmount');
      const paymentMethod = 'xrp';

      if (storedAmount) {
        paymentAmount = storedAmount;
      }

      const formData = new FormData();

      // Trust details
      formData.append('trust_id', trustId);
      formData.append('full_name', rawForm.fullName || '');
      formData.append('id_number', rawForm.idNumber || '');
      formData.append('email', rawForm.email || '');
      formData.append('phone_number', rawForm.phoneNumber || '');
      formData.append('trust_email', rawForm.trustEmail || '');
      formData.append('trust_name', rawForm.trustName || '');
      formData.append('establishment_date_1', rawForm.establishmentDate || '');
      formData.append('establishment_date_2', rawForm.establishmentDate || '');
      formData.append('beneficiaries', rawForm.beneficiaries || '');
      formData.append(
        'is_bullion_member',
        rawForm.isBullionMember ? 'true' : 'false'
      );
      formData.append('member_number', rawForm.memberNumber || '');
      formData.append(
        'was_referred_by_member',
        rawForm.wasReferredByMember ? 'true' : 'false'
      );
      formData.append('referrer_number', rawForm.referrerNumber || '');

      // Settlor
      formData.append('settlor_name', rawForm.settlor?.name || '');
      formData.append('settlor_id', rawForm.settlor?.id || '');
      formData.append('settlor_email', rawForm.settlor?.email || '');

      // Trustees flattened
      formData.append('trustee1_name', rawForm.trustee1?.name || '');
      formData.append('trustee1_id', rawForm.trustee1?.id || '');
      formData.append('trustee1_email', rawForm.trustee1?.email || '');
      formData.append('trustee2_name', rawForm.trustee2?.name || '');
      formData.append('trustee2_id', rawForm.trustee2?.id || '');
      formData.append('trustee2_email', rawForm.trustee2?.email || '');
      formData.append('trustee3_name', rawForm.trustee3?.name || '');
      formData.append('trustee3_id', rawForm.trustee3?.id || '');
      formData.append('trustee3_email', rawForm.trustee3?.email || '');
      formData.append('trustee4_name', rawForm.trustee4?.name || '');
      formData.append('trustee4_id', rawForm.trustee4?.id || '');

      formData.append('owner_name', rawForm.ownerName || rawForm.trustee1?.name || '');
      formData.append('owner_id', rawForm.owner_id || rawForm.trustee1?.id || '');
      formData.append('owner_email', rawForm.owner_email || rawForm.trustee1?.email || '');
      formData.append('Property_Address', rawForm.propertyAddress || '');

      // Removed appending documents loop as per instructions

      // Payment info
      formData.append(
        'payment_amount',
        rawForm.payment_amount?.toString() || ''
      );
      formData.append('payment_xrp_qty', rawForm.payment_xrp_qty?.toString() || '');
      formData.append(
        'payment_xrp_trans_id',
        rawForm.payment_xrp_trans_id || ''
      );
      formData.append('payment_currency', 'ZAR');
      formData.append('payment_method', 'xrp');
      formData.append('has_paid', 'crypto');

      // Submit
      await this.http
        .post(
          'https://hongkongbackend.onrender.com/trusts/submit-trust',
          formData
        )
        .toPromise();

      // Clear session
      sessionStorage.removeItem('trustFormData');
      sessionStorage.removeItem('trustFiles');
      sessionStorage.removeItem('trustId');
      sessionStorage.removeItem('paymentMethod');
      sessionStorage.removeItem('paymentAmount');

      this.success = true;
    } catch (err: any) {
      this.errorMessage =
        err.message || 'Failed to submit trust after payment.';
      console.error('❌ Failed to submit trust after payment:', err);
    } finally {
      this.loading = false;
    }
  }
}
