import { Component, ChangeDetectionStrategy, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface Party {
  key: string;            // e.g. 'settlor', 'trustee1'
  role: 'Settlor' | 'Trustee';
  name: string;
  id: string;
  label: string;          // e.g. 'Settlor : Jan Willemse'
}

@Component({
  selector: 'app-sale-and-cede-agreement',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule],
  templateUrl: './sale-and-cede-agreement.html',
  styleUrls: ['./sale-and-cede-agreement.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaleAndCedeAgreement implements OnInit {
  @Input() settlorName!: string;
  @Input() settlorId!: string;
  @Input() trustees!: Array<{ name: string; id: string }>;

  cessionForm: FormGroup;

  parties: Party[] = [];
  ownerOptions: Party[] = [];   // Settlor + Trustees
  signerOptions: Party[] = [];  // Trustees only

  lookupLoading = false;
  trustNameLoaded: string | null = null;
  trustDateLoaded: string | null = null;
  generating = false;

  lookupRecord: any = null;

  // Payment method modal state
  showPaymentModal = false;
  pendingAgreementPayload: any = null;
  pendingAmountZAR = 500; // R500 fixed

  // Require at least N items in an array-based FormControl
  private minArrayLength(min: number) {
    return (control: any) => {
      const v = control?.value;
      if (Array.isArray(v)) {
        return v.length >= min ? null : { minArrayLength: { requiredLength: min, actualLength: v.length } };
      }
      return { minArrayLength: { requiredLength: min, actualLength: 0 } };
    };
  }

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
  ) {
    this.cessionForm = this.fb.group({
      trustNumber: ['', Validators.required],
      settlorId: ['', Validators.required],

      // NEW: dropdown selections
      owner: [null as Party | null, Validators.required],
      signer: [null as Party | null, Validators.required],

      propertyList: [[], this.minArrayLength(1)],
      signaturePlace: ['', Validators.required],
      witnessName: ['', Validators.required],
      witnessId: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    // Build parties list from inputs
    const list: Party[] = [];
    list.push({
      key: 'settlor',
      role: 'Settlor',
      name: this.settlorName,
      id: this.settlorId,
      label: `Settlor : ${this.settlorName}`,
    });

    if (Array.isArray(this.trustees)) {
      this.trustees.forEach((t, idx) => {
        list.push({
          key: `trustee${idx + 1}`,
          role: 'Trustee',
          name: t.name,
          id: t.id,
          label: `Trustee ${idx + 1} : ${t.name}`,
        });
      });
    }

    // De-duplicate if Settlor and Trustee 1 are the same person (same ID)
    const deduped = list.filter((p, i, arr) => arr.findIndex(q => q.role === p.role && q.id === p.id && q.name === p.name) === i);

    this.parties = deduped;
    this.ownerOptions = deduped; // owner can be Settlor or any Trustee
    this.signerOptions = deduped.filter(p => p.role === 'Trustee'); // signer must be a Trustee

    // Default selection logic for signer as requested:
    // - If there are exactly 2 trustees -> default to Trustee 2
    // - If there are more than 2 trustees -> default to Trustee 1
    // - If only 1 trustee -> default to that one
    const trusteesOnly = this.signerOptions;
    let defaultSigner: Party | null = null;
    if (trusteesOnly.length === 1) {
      defaultSigner = trusteesOnly[0];
    } else if (trusteesOnly.length === 2) {
      defaultSigner = trusteesOnly[1]; // Trustee 2
    } else if (trusteesOnly.length >= 3) {
      defaultSigner = trusteesOnly[0]; // Trustee 1 (can change to 3 if you prefer)
    }

    // Default owner: Settlor (sensible default, can be changed by user)
    const defaultOwner = this.ownerOptions.find(p => p.role === 'Settlor') || this.ownerOptions[0] || null;

    this.cessionForm.patchValue({
      settlorId: this.settlorId,
      owner: defaultOwner,
      signer: defaultSigner,
    });

    // Trigger lookup automatically when both trustNumber and settlorId are filled and valid
  }


  /**
   * Perform lookup to authenticate settlor/applicant and pull existing trust data.
   * Reused logic from your edit flow, adapted for this component.
   */
  async performTrustLookup(): Promise<void> {
    const tnCtrl = this.cessionForm.get('trustNumber');
    const idCtrl = this.cessionForm.get('settlorId');
    if (!tnCtrl || !idCtrl || tnCtrl.invalid || idCtrl.invalid) {
      this.cessionForm.markAllAsTouched();
      return;
    }
    const trust_number = tnCtrl.value;
    const id_or_passport = idCtrl.value;

    const API_BASE = 'https://hongkongbackend.onrender.com';
    const url = `${API_BASE}/trusts/edit-trust/lookup`;

    this.lookupLoading = true;
    try {
      const record: any = await this.http.post(url, { trust_number, id_or_passport }).toPromise();

      console.log('Trust lookup raw record:', record);

      this.lookupRecord = record;

      // Normalize trust number from lookup and patch into the form
      const lookedUpTrustNumber = record?.trust_number || record?.trustNumber || null;
      if (lookedUpTrustNumber) {
        this.cessionForm.patchValue({ trustNumber: lookedUpTrustNumber }, { emitEvent: false });
      }

      // Defensive: promote common email field to top-level for payment-session schema, if present nested
      if (!this.lookupRecord.email) {
        this.lookupRecord.email = record?.email || record?.contact_email || record?.applicant?.email || record?.settlor?.email || null;
      }

      // Example record mapping (defensive):
      // {
      //   trust_number, trust_name,
      //   settlor: { name, id },
      //   trustees: [{ name, id }, ...]
      // }

      this.trustNameLoaded = record?.trust_name ?? null;
      this.trustDateLoaded = record?.trust_date || record?.trustDate || record?.trust_created_at || null;

      // Update Settlor inputs and local model
      this.settlorName = record?.settlor?.name ?? this.settlorName;
      this.settlorId = record?.settlor?.id ?? this.settlorId;

      // Normalise trustees list
      const apiTrustees = Array.isArray(record?.trustees) ? record.trustees : [];
      this.trustees = apiTrustees
        .filter((t: any) => t && (t.name || t.full_name))
        .map((t: any, idx: number) => ({
          name: t.name ?? t.full_name ?? `Trustee ${idx + 1}`,
          id: t.id ?? t.passport ?? t.id_or_passport ?? `T-${idx + 1}`,
        }));

      // Rebuild party options with the fetched data
      this.rebuildOptions();

      // Patch form with canonical settlor id from backend
      this.cessionForm.patchValue({ settlorId: this.settlorId });

      // Optionally lock inputs after successful lookup
      tnCtrl.disable({ emitEvent: false });
      idCtrl.disable({ emitEvent: false });

      console.log('Trust lookup success:', record);
    } catch (err: any) {
      console.error('Lookup error', err);
      // Allow user to retry
      this.trustNameLoaded = null;
    } finally {
      this.lookupLoading = false;
    }
  }

  private rebuildOptions(): void {
    const list: Party[] = [];
    list.push({ key: 'settlor', role: 'Settlor', name: this.settlorName, id: this.settlorId, label: `Settlor : ${this.settlorName}` });
    this.trustees.forEach((t, idx) => list.push({ key: `trustee${idx + 1}`, role: 'Trustee', name: t.name, id: t.id, label: `Trustee ${idx + 1} : ${t.name}` }));
    const deduped = list.filter((p, i, arr) => arr.findIndex(q => q.role === p.role && q.id === p.id && q.name === p.name) === i);
    this.parties = deduped;
    this.ownerOptions = deduped;
    this.signerOptions = deduped.filter(p => p.role === 'Trustee');

    // Re-apply default selections based on new trustees count
    const trusteesOnly = this.signerOptions;
    let defaultSigner: Party | null = null;
    if (trusteesOnly.length === 1) defaultSigner = trusteesOnly[0];
    else if (trusteesOnly.length === 2) defaultSigner = trusteesOnly[1];
    else if (trusteesOnly.length >= 3) defaultSigner = trusteesOnly[0];

    const defaultOwner = this.ownerOptions.find(p => p.role === 'Settlor') || this.ownerOptions[0] || null;

    this.cessionForm.patchValue({ owner: defaultOwner, signer: defaultSigner });
  }

  // Convenience getters for template
  get owner() { return this.cessionForm.get('owner')?.value as Party | null; }
  get signer() { return this.cessionForm.get('signer')?.value as Party | null; }

  /** Add a property/right item to the list input */
  addProperty(raw: string): void {
    const value = (raw || '').trim();
    if (!value) return;
    const ctrl = this.cessionForm.get('propertyList');
    const current: string[] = Array.isArray(ctrl?.value) ? ctrl!.value : [];
    // Avoid duplicates (case-insensitive)
    if (current.some(it => it.toLowerCase() === value.toLowerCase())) {
      return;
    }
    const next = [...current, value];
    ctrl?.setValue(next);
    ctrl?.markAsDirty();
    ctrl?.markAsTouched();
    ctrl?.updateValueAndValidity();
  }

  /** Remove a property/right item by index */
  removeProperty(index: number): void {
    const ctrl = this.cessionForm.get('propertyList');
    const current: string[] = Array.isArray(ctrl?.value) ? ctrl!.value : [];
    if (index < 0 || index >= current.length) return;
    const next = current.filter((_, i) => i !== index);
    ctrl?.setValue(next);
    ctrl?.markAsDirty();
    ctrl?.updateValueAndValidity();
  }

  /** Return a clean snapshot of what the user has entered/selected in the form */
  private getFormSnapshot() {
    const v = this.cessionForm.value as any;
    const owner = v.owner as Party | null;
    const signer = v.signer as Party | null;

    return {
      trustNumber: v.trustNumber || '',
      settlorId: v.settlorId || '',
      owner: owner ? { name: owner.name, id: owner.id, role: owner.role } : null,
      signer: signer ? { name: signer.name, id: signer.id, role: signer.role } : null,
      propertyList: Array.isArray(v.propertyList) ? v.propertyList : (v.propertyList ? [v.propertyList] : []),
      signaturePlace: v.signaturePlace || '',
      witnessName: v.witnessName || '',
      witnessId: v.witnessId || '',
    };
  }

  submitForm(): void {
    if (this.cessionForm.invalid) {
      this.cessionForm.markAllAsTouched();
      return;
    }

    const v = this.cessionForm.value as {
      trustNumber: string;
      settlorId: string;
      owner: Party;
      signer: Party;
      propertyList: string[] | string;
      signaturePlace: string;
      witnessName: string;
      witnessId: string;
    };

    const propertyArr: string[] = Array.isArray(v.propertyList)
      ? v.propertyList
      : (v.propertyList ? [v.propertyList] : []);

    const nowISO = new Date().toISOString().slice(0, 10); // yyyy-mm-dd

    const formSnapshot = this.getFormSnapshot();
    console.log('[Sale & Cede] Form snapshot:', formSnapshot);

    // Resolve trust number from form or from lookup record
    const resolvedTrustNumber = (v.trustNumber && v.trustNumber.toString().trim()) || (this.lookupRecord?.trust_number || this.lookupRecord?.trustNumber) || '';
    console.log('[Sale & Cede] Resolved trust number:', resolvedTrustNumber);

    const payload = {
      trust_number: resolvedTrustNumber,
      trust_name: this.trustNameLoaded ?? '',
      trust_date: this.trustDateLoaded ?? nowISO, // prefer server lookup value; fallback to today
      owner_name: v.owner?.name ?? '',
      owner_id: v.owner?.id ?? '',
      signer_name: v.signer?.name ?? '',
      signer_id: v.signer?.id ?? '',
      list_of_property: propertyArr,
      list_of_property_text: propertyArr.join('; '),
      witness_name: v.witnessName,
      witness_id: v.witnessId,
      place_of_signature: v.signaturePlace,
      date_sign: nowISO, // signing date (today) for this agreement
      created_at: new Date().toISOString(), // include for completeness; server may override
      settlor_id: v.settlorId,
      client_email: (this.lookupRecord?.email || ''),
    };

    // Preflight validation to avoid 422 on backend
    const missing: string[] = [];
    if (!resolvedTrustNumber) missing.push('Trust Number');
    if (!payload.owner_name) missing.push('Owner');
    if (!payload.owner_id) missing.push('Owner ID');
    if (!payload.signer_name) missing.push('Signer');
    if (!payload.signer_id) missing.push('Signer ID');
    if (!propertyArr.length) missing.push('List of Property');
    if (!payload.witness_name) missing.push('Witness Name');
    if (!payload.witness_id) missing.push('Witness ID');
    if (!payload.place_of_signature) missing.push('Place of Signature');

    if (missing.length) {
      alert('Please complete the following before paying: ' + missing.join(', '));
      return;
    }

    // Stash for later (after user chooses payment method)
    localStorage.setItem('saleCedeAgreementForm', JSON.stringify(formSnapshot));
    localStorage.setItem('saleCedeAgreementPayload', JSON.stringify(payload));

    console.log('Sale & Cede Agreement Payload (pending):', payload);

    // Open payment method modal instead of starting payment immediately
    this.pendingAgreementPayload = payload;
    this.pendingAmountZAR = 500;
    this.openPaymentModal();
  }

  // Modal controls
  openPaymentModal(): void { this.showPaymentModal = true; }
  closePaymentModal(): void { this.showPaymentModal = false; }

  /** Proceed with the existing card payment flow */
  async confirmCardPayment(): Promise<void> {
    if (!this.pendingAgreementPayload) return;
    this.closePaymentModal();
    // Mark selection for downstream logic
    localStorage.setItem('paymentMethod', 'card');
    await this.confirmPaymentForSaleCede(this.pendingAgreementPayload);
  }

  /** Start XRP flow (stub). Replace with your real XRP integration. */
  async startXrpFlow(): Promise<void> {
    if (!this.pendingAgreementPayload) return;
    this.closePaymentModal();

    try {
      if (!this.lookupRecord) {
        alert('Please look up your trust first before paying.');
        return;
      }

      // Mark selection so your post-payment handler can branch
      localStorage.setItem('paymentMethod', 'xrp');
      localStorage.setItem('paymentAmount', String(this.pendingAmountZAR * 100));
      localStorage.setItem('saleCedeFlow', 'true');

      // TODO: Implement XRP payment (e.g., fetch invoice/QR from backend)
      alert('XRP payment selected. Implement your XRP flow here (e.g., show QR / address from backend).');
    } catch (e) {
      console.error('XRP flow error:', e);
      alert('Could not start XRP payment.');
    }
  }

  private getNormalizedTrustees(): Array<{ key: string; name: string; id: string }> {
    // Remove duplicates where Settlor and Trustee 1 are the same person
    const trustees = this.parties.filter(p => p.role === 'Trustee');

    // If Settlor equals Trustee 1 (by id), we still keep only Trustee 1 in array; backend can map to trustee_1
    const unique: Array<{ key: string; name: string; id: string }> = [];
    trustees.forEach(t => {
      if (!unique.some(u => u.id === t.id)) {
        unique.push({ key: t.key, name: t.name, id: t.id });
      }
    });
    return unique;
  }

  /**
   * Use the same payment API as other flows. Amount is fixed at R500.
   * On success, we redirect to the returned URL. We also stash the agreement payload
   * in localStorage so the post-payment handler can generate & email the docs.
   */
  async confirmPaymentForSaleCede(agreementPayload: any): Promise<void> {
    this.generating = true;

    console.log('Confirm Payment for Sale & Cede called with payload:', agreementPayload);

    try {
      if (!this.lookupRecord) {
        alert('Please look up your trust first before paying.');
        this.generating = false;
        return;
      }

      const amountInCents = 500 * 100; // R500

      // Store payment context for the post-payment success page (use localStorage to survive redirects)
      localStorage.setItem('paymentMethod', 'card');
      localStorage.setItem('paymentAmount', amountInCents.toString());
      localStorage.setItem('saleCedeFlow', 'true');

      const paymentInit = await this.http.post<any>(
        'https://hongkongbackend.onrender.com/api/cede/payment-session',
        {
          amount_cents: amountInCents,
          trust_data: {
            // Include the original trust application/record so backend schema requirements are satisfied
            ...(this.lookupRecord || {}),
            // Annotate the flow so backend can branch
            flow: 'sale_cede',
            // Provide a nested context specific to this agreement
            sale_cede_context: {
              ...agreementPayload,
            },
            // Also include some top-level mirrors commonly read by older code paths
            trust_number: agreementPayload.trust_number,
            trust_name: agreementPayload.trust_name,
            trust_date: agreementPayload.trust_date,
            owner_name: agreementPayload.owner_name,
            owner_id: agreementPayload.owner_id,
            signer_name: agreementPayload.signer_name,
            signer_id: agreementPayload.signer_id,
            witness_name: agreementPayload.witness_name,
            witness_id: agreementPayload.witness_id,
            place_of_signature: agreementPayload.place_of_signature,
            date_sign: agreementPayload.date_sign,
            created_at: agreementPayload.created_at,
          }
        }
      ).toPromise();

      if (!paymentInit || !paymentInit.redirectUrl) {
        throw new Error('Invalid response from backend');
      }

      // Navigate to Yoco / payment portal
      window.location.href = paymentInit.redirectUrl;
    } catch (error: any) {
      console.error('🛑 Payment session error (Sale & Cede):', error);
      const backendDetail = error?.error?.detail ? JSON.stringify(error.error.detail) : '';
      alert('Payment error: ' + (error?.message || 'Failed to start payment') + (backendDetail ? '\n' + backendDetail : ''));
      this.generating = false;
    }
  }
}
