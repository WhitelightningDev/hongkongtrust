import { Component, ChangeDetectionStrategy, Input, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidatorFn } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Router } from '@angular/router';

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
  pendingPaymentMethod: 'card' | 'xrp' | null = null;
  pendingAmountCents = 500 * 100;

  // XRP modal + flow state
  showXrpModal = false;
  xrpAddress = 'rMuStHBy5N17ysmiQjUj4QQv5DTk8ovWDS';
  xrpAmountXrp: number | null = null; // converted amount to send
  xrpQuoteLoading = false;
  xrpTxId: string = '';
  xrpHashTouched = false;
  xrpNetworkNotice: string | null = 'XRPL mainnet • payments confirm within seconds.';
  xrpQrData: string | null = null; // optional; can be wired to a QR generator later

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

  private isPartyComplete(p: Party | null | undefined): boolean {
    return !!(p && String(p.name || '').trim() && String(p.id || '').trim());
  }

  private partyValidator(): ValidatorFn {
    return (control: AbstractControl) => {
      const p = control.value as Party | null;
      if (!p) return { required: true };
      return this.isPartyComplete(p) ? null : { partyIncomplete: true };
    };
  }

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
  ) {
    this.cessionForm = this.fb.group({
      trustNumber: ['', Validators.required],
      settlorId: ['', Validators.required],

      // Backend TrustApplication schema fields (all editable for patch/edit)
      trustName: [''],
      fullName: [''],
      idNumber: [''],
      email: ['', [Validators.email]],
      phoneNumber: [''],
      trustEmail: ['', [Validators.email]],
      establishmentDate1: [''],
      establishmentDate2: [''],
      beneficiaries: [''],
      isBullionMember: [false],
      memberNumber: [''],
      referrerNumber: [''],
      settlorName: [''],
      settlorEmail: ['', [Validators.email]],
      trustee1Name: [''],
      trustee1Id: [''],
      trustee1Email: ['', [Validators.email]],
      trustee2Name: [''],
      trustee2Id: [''],
      trustee2Email: ['', [Validators.email]],
      trustee3Name: [''],
      trustee3Id: [''],
      trustee3Email: ['', [Validators.email]],
      trustee4Name: [''],
      trustee4Id: [''],
      trustee4Email: ['', [Validators.email]],
      ownerName: ['', Validators.required],
      ownerId: ['', Validators.required],
      ownerEmail: ['', [Validators.required, Validators.email]],
      signerName: ['', Validators.required],
      signerId: ['', Validators.required],
      signerEmail: ['', [Validators.required, Validators.email]],
      propertyAddress: [''],

      // Dropdown selections (for reference only)
      owner: [null as Party | null, [Validators.required, this.partyValidator()]],
      signer: [null as Party | null, [Validators.required, this.partyValidator()]],

      propertyList: [[], this.minArrayLength(1)],
      propertyPending: [''],
      signaturePlace: ['', Validators.required],
      signatureDate: ['', Validators.required],
      witnessName: [''],
      witnessId: [''],
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

    // Default owner: Settlor if complete; otherwise leave null until lookup
    const settlorCandidate = this.ownerOptions.find(p => p.role === 'Settlor') || null;
    const defaultOwner = this.isPartyComplete(settlorCandidate) ? (settlorCandidate as Party) : null;

    this.cessionForm.patchValue({
      settlorId: this.settlorId,
      owner: defaultOwner,
      signer: defaultSigner,
    }, { emitEvent: false });

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
    const trust_number = (tnCtrl.value || '').toString().trim();
    const id_or_passport = (idCtrl.value || '').toString().trim();

    const API_BASE = 'https://hongkongbackend.onrender.com';
    // Use GET request per new API
    const url = `${API_BASE}/trusts/${encodeURIComponent(trust_number)}?user_id=${encodeURIComponent(id_or_passport)}&_ts=${Date.now()}`;

    this.lookupLoading = true;
    try {
      const record: any = await this.http.get(url).toPromise();

      console.log('Trust lookup raw record:', record);

      this.lookupRecord = record;

      // Patch values from API response into the form
      this.cessionForm.patchValue({
        settlorId: record?.settlor_id || '',
        trustNumber: record?.trust_number || '',
        signaturePlace: record?.place_of_signature || '',
        witnessName: record?.witness_name || '',
        witnessId: record?.witness_id || '',
        // Patch new editable owner/signer fields from API record if present
        ownerName: record?.owner_name || record?.settlor_name || '',
        ownerId: record?.owner_id || record?.settlor_id || '',
        ownerEmail: record?.owner_email || record?.email || '',
        signerName: record?.signer_name || record?.trustee1_name || '',
        signerId: record?.signer_id || record?.trustee1_id || '',
        signerEmail: record?.signer_email || record?.trustee2_email || '',
        // Patch all backend TrustApplication fields
        trustName: record?.trust_name || '',
        fullName: record?.full_name || '',
        idNumber: record?.id_number || '',
        email: record?.email || '',
        phoneNumber: record?.phone_number || '',
        trustEmail: record?.trust_email || '',
        establishmentDate1: record?.establishment_date_1 || '',
        establishmentDate2: record?.establishment_date_2 || '',
        beneficiaries: record?.beneficiaries || '',
        isBullionMember: record?.is_bullion_member || false,
        memberNumber: record?.member_number || '',
        referrerNumber: record?.referrer_number || '',
        settlorName: record?.settlor_name || '',
        settlorEmail: record?.settlor_email || '',
        trustee1Name: record?.trustee1_name || '',
        trustee1Id: record?.trustee1_id || '',
        trustee1Email: record?.trustee1_email || '',
        trustee2Name: record?.trustee2_name || '',
        trustee2Id: record?.trustee2_id || '',
        trustee2Email: record?.trustee2_email || '',
        trustee3Name: record?.trustee3_name || '',
        trustee3Id: record?.trustee3_id || '',
        trustee3Email: record?.trustee3_email || '',
        trustee4Name: record?.trustee4_name || '',
        trustee4Id: record?.trustee4_id || '',
        trustee4Email: record?.trustee4_email || '',
        propertyAddress: record?.property_address || '',
      }, { emitEvent: false });

      // Defensive: promote common email field to top-level for payment-session schema, if present nested
      if (!this.lookupRecord.email) {
        this.lookupRecord.email = record?.email || record?.contact_email || record?.applicant?.email || record?.settlor?.email || null;
      }

      this.trustNameLoaded = record?.trust_name ?? null;
      this.trustDateLoaded = record?.establishment_date_2 || record?.establishment_date_1 || null;

      // Update Settlor name from API if present, else keep current
      this.settlorName = record?.settlor_name ?? this.settlorName;

      // Update Settlor ID logic (keep as before)
      const backendSettlorId = record?.settlor?.id ?? '';
      const currentSettlorId = idCtrl.value ?? '';
      if (backendSettlorId && backendSettlorId !== currentSettlorId) {
        this.settlorId = backendSettlorId;
        this.cessionForm.patchValue({ settlorId: backendSettlorId }, { emitEvent: false });
      } else {
        this.settlorId = currentSettlorId;
        // Do not patch settlorId if user has entered it and backend is empty or same
      }

      // Build trustees directly from record fields
      const trusteeFields = [
        { name: record.trustee1_name, id: record.trustee1_id },
        { name: record.trustee2_name, id: record.trustee2_id },
        { name: record.trustee3_name, id: record.trustee3_id },
        { name: record.trustee4_name, id: record.trustee4_id }
      ].filter(t => t.name?.trim() && t.id?.trim());

      this.trustees = trusteeFields.map((t, idx) => ({
        name: t.name,
        id: t.id
      }));

      this.signerOptions = this.trustees.map((t, idx) => ({
        key: `trustee${idx + 1}`,
        role: 'Trustee',
        name: t.name,
        id: t.id,
        label: `${t.name}`
      }));

      this.ownerOptions = [
        {
          key: 'settlor',
          role: 'Settlor',
          name: this.settlorName,
          id: this.settlorId,
          label: `Settlor : ${this.settlorName}`,
        },
        ...this.signerOptions
      ];

      // Rebuild party options with the fetched data
      this.rebuildOptions();

      // Optionally patch owner if Settlor is now complete
      const settlorParty: Party = {
        key: 'settlor',
        role: 'Settlor',
        name: this.settlorName,
        id: this.settlorId,
        label: `Settlor : ${this.settlorName}`,
      };
      if (this.isPartyComplete(settlorParty)) {
        this.cessionForm.patchValue({ owner: settlorParty }, { emitEvent: false });
      }

      // Instead of disabling controls, rely on template [readonly] to prevent editing but keep value visible

      // No need to patch settlorId again here; it is already handled above

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

    this.cessionForm.patchValue({
      owner: this.isPartyComplete(defaultOwner) ? defaultOwner : null,
      signer: defaultSigner
    });
    // Do NOT patch settlorId here; let user's entered value persist unless explicitly changed in lookup logic.
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
    this.cessionForm.get('propertyPending')?.setValue('');
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
      signatureDate: v.signatureDate || '',
      witnessName: v.witnessName || '',
      witnessId: v.witnessId || '',
      // All editable owner/signer details and TrustApplication fields
      trustName: v.trustName || '',
      fullName: v.fullName || '',
      idNumber: v.idNumber || '',
      email: v.email || '',
      phoneNumber: v.phoneNumber || '',
      trustEmail: v.trustEmail || '',
      establishmentDate1: v.establishmentDate1 || '',
      establishmentDate2: v.establishmentDate2 || '',
      beneficiaries: v.beneficiaries || '',
      isBullionMember: v.isBullionMember || false,
      memberNumber: v.memberNumber || '',
      referrerNumber: v.referrerNumber || '',
      settlorName: v.settlorName || '',
      settlorEmail: v.settlorEmail || '',
      trustee1Name: v.trustee1Name || '',
      trustee1Id: v.trustee1Id || '',
      trustee1Email: v.trustee1Email || '',
      trustee2Name: v.trustee2Name || '',
      trustee2Id: v.trustee2Id || '',
      trustee2Email: v.trustee2Email || '',
      trustee3Name: v.trustee3Name || '',
      trustee3Id: v.trustee3Id || '',
      trustee3Email: v.trustee3Email || '',
      trustee4Name: v.trustee4Name || '',
      trustee4Id: v.trustee4Id || '',
      trustee4Email: v.trustee4Email || '',
      ownerName: v.ownerName || '',
      ownerId: v.ownerId || '',
      ownerEmail: v.ownerEmail || '',
      signerName: v.signerName || '',
      signerId: v.signerId || '',
      signerEmail: v.signerEmail || '',
      propertyAddress: v.propertyAddress || '',
    };
  }

  submitForm(): void {
    if (this.cessionForm.invalid) {
      this.cessionForm.markAllAsTouched();
      return;
    }
    const currentOwner = this.cessionForm.get('owner')?.value as Party | null;
    if (!this.isPartyComplete(currentOwner)) {
      alert('Please perform Trust Lookup and select a valid Owner (with ID) before continuing.');
      return;
    }

    const v = this.cessionForm.value as {
      trustNumber: string;
      settlorId: string;
      owner: Party;
      signer: Party;
      propertyList: string[] | string;
      signaturePlace: string;
      signatureDate: string;
      witnessName: string;
      witnessId: string;
      ownerName?: string;
      ownerId?: string;
      ownerEmail?: string;
      signerName?: string;
      signerId?: string;
      signerEmail?: string;
      // All form fields added below
      trustName?: string;
      establishmentDate1?: string;
      establishmentDate2?: string;
      fullName?: string;
      idNumber?: string;
      email?: string;
      phoneNumber?: string;
      trustEmail?: string;
      beneficiaries?: string;
      isBullionMember?: boolean;
      memberNumber?: string;
      referrerNumber?: string;
      settlorName?: string;
      settlorEmail?: string;
      trustee1Name?: string;
      trustee1Id?: string;
      trustee1Email?: string;
      trustee2Name?: string;
      trustee2Id?: string;
      trustee2Email?: string;
      trustee3Name?: string;
      trustee3Id?: string;
      trustee3Email?: string;
      trustee4Name?: string;
      trustee4Id?: string;
      trustee4Email?: string;
      propertyAddress?: string;
    };

    // Prevent witness ID being the same as owner or signer, show Bootstrap modal instead of alert
    if (v.witnessId === v.owner.id || v.witnessId === v.signer.id) {
      // Requires Bootstrap Modal JS to be loaded and modal with id 'witnessConflictModal' present in DOM
      const modalEl = document.getElementById('witnessConflictModal');
      if (modalEl && (window as any).bootstrap && (window as any).bootstrap.Modal) {
        const modal = new (window as any).bootstrap.Modal(modalEl);
        modal.show();
      }
      // fallback if bootstrap not global (Angular CLI projects may not have it on window)
      else if (typeof (window as any).bootstrap === 'undefined' && typeof (window as any)['Bootstrap'] !== 'undefined') {
        // try alternative global
        const modal = new (window as any)['Bootstrap'].Modal(modalEl);
        modal.show();
      }
      // fallback: try global bootstrap variable (if imported as ES module)
      else if (typeof (window as any).bootstrap !== 'undefined') {
        const modal = new (window as any).bootstrap.Modal(modalEl);
        modal.show();
      }
      // If no Bootstrap modal found, do nothing (or optionally fallback to alert)
      // alert('The witness ID cannot be the same as the property owner or trustee signer.');
      return;
    }

    const propertyArr: string[] = Array.isArray(v.propertyList)
      ? v.propertyList
      : (v.propertyList ? [v.propertyList] : []);

    const pendingRaw = (this.cessionForm.get('propertyPending')?.value || '').toString().trim();
    const propertyArrMerged = pendingRaw ? [...propertyArr, pendingRaw] : propertyArr;

    const now = new Date();
    const dateSignFormatted = now.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const nowISO = now.toISOString().slice(0, 10); // keep ISO for trust_date
    // --- Trimmed helpers ---
    const signaturePlaceTrim = (v.signaturePlace || '').trim();
    const witnessNameTrim = (v.witnessName || '').trim();
    const witnessIdTrim = (v.witnessId || '').trim();
    const listString = propertyArrMerged.map(s => String(s).trim()).filter(Boolean).join('; ');

    const formSnapshot = this.getFormSnapshot();
    console.log('[Sale & Cede] Form snapshot:', formSnapshot);

    // Resolve trust number from form or from lookup record
    const resolvedTrustNumber = (v.trustNumber && v.trustNumber.toString().trim()) || (this.lookupRecord?.trust_number || this.lookupRecord?.trustNumber) || '';
    console.log('[Sale & Cede] Resolved trust number:', resolvedTrustNumber);

    // Ensure these fields are always present in payload, either from lookup or form snapshot
    // They must be stored for later use (success page)
    let list_of_property = '';
    let witness_name = '';
    let witness_id = '';
    let place_of_signature = '';
    // Prefer from lookupRecord if present, else from formSnapshot
    if (this.lookupRecord && typeof this.lookupRecord === 'object') {
      list_of_property = this.lookupRecord.list_of_property ?? '';
      witness_name = this.lookupRecord.witness_name ?? '';
      witness_id = this.lookupRecord.witness_id ?? '';
      place_of_signature = this.lookupRecord.place_of_signature ?? '';
    }
    // If missing in lookupRecord, set from formSnapshot
    if (!list_of_property) list_of_property = formSnapshot.propertyList?.join('; ') || listString;
    if (!witness_name) witness_name = formSnapshot.witnessName || witnessNameTrim;
    if (!witness_id) witness_id = formSnapshot.witnessId || witnessIdTrim;
    if (!place_of_signature) place_of_signature = formSnapshot.signaturePlace || signaturePlaceTrim;

    const payload = {
      trust_number: resolvedTrustNumber,
      trust_name: v.trustName || this.trustNameLoaded || '',
      trust_date: (this.trustDateLoaded ?? (v.establishmentDate2 || v.establishmentDate1 || nowISO)),
      establishment_date_1: v.establishmentDate1 || this.lookupRecord?.establishment_date_1 || '',
      establishment_date_2: v.establishmentDate2 || this.lookupRecord?.establishment_date_2 || '',
      // Backend TrustApplication fields
      full_name: v.fullName || '',
      id_number: v.idNumber || '',
      email: v.email || '',
      phone_number: v.phoneNumber || '',
      trust_email: v.trustEmail || '',
      beneficiaries: v.beneficiaries || '',
      is_bullion_member: v.isBullionMember || false,
      member_number: v.memberNumber || '',
      referrer_number: v.referrerNumber || '',
      settlor_name: v.settlorName || '',
      settlor_email: v.settlorEmail || '',
      trustee1_name: v.trustee1Name || '',
      trustee1_id: v.trustee1Id || '',
      trustee1_email: v.trustee1Email || '',
      trustee2_name: v.trustee2Name || '',
      trustee2_id: v.trustee2Id || '',
      trustee2_email: v.trustee2Email || '',
      trustee3_name: v.trustee3Name || '',
      trustee3_id: v.trustee3Id || '',
      trustee3_email: v.trustee3Email || '',
      trustee4_name: v.trustee4Name || '',
      trustee4_id: v.trustee4Id || '',
      trustee4_email: v.trustee4Email || '',
      property_address: v.propertyAddress || '',
      // Prefer editable fields, fallback to dropdown selection
      owner_name: v.ownerName ?? v.owner?.name ?? '',
      owner_id: v.ownerId ?? v.owner?.id ?? '',
      owner_email: v.ownerEmail ?? '',
      signer_name: v.signerName ?? v.signer?.name ?? '',
      signer_id: v.signerId ?? v.signer?.id ?? '',
      signer_email: v.signerEmail ?? '',
      list_of_property: list_of_property,
      list_of_property_text: list_of_property,
      witness_name: witness_name,
      witness_id: witness_id,
      place_of_signature: place_of_signature,
      signature_date: v.signatureDate || nowISO,
      date_sign: dateSignFormatted,
      created_at: new Date().toISOString(),
      settlor_id: v.settlorId,
      client_email: (this.lookupRecord?.email || v.email || ''),
      // Payment details for persistence and backend
      payment_method: this.pendingPaymentMethod || localStorage.getItem('paymentMethod') || 'card',
      payment_amount: this.pendingAmountZAR || 500,
      payment_amount_cents: this.pendingAmountCents || 50000,
    };

    // Preflight validation to avoid 422 on backend
    const missing: string[] = [];
    if (!resolvedTrustNumber) missing.push('Trust Number');
    if (!payload.owner_name) missing.push('Owner');
    if (!payload.owner_id) missing.push('Owner ID');
    if (!payload.signer_name) missing.push('Signer');
    if (!payload.signer_id) missing.push('Signer ID');
    if (!payload.list_of_property) missing.push('List of Property');
    if (!payload.place_of_signature) missing.push('Place of Signature');

    if (missing.length) {
      alert('Please complete the following before paying: ' + missing.join(', '));
      return;
    }

    // Stash for later (after user chooses payment method)
    localStorage.setItem('saleCedeAgreementForm', JSON.stringify(formSnapshot));
    // Ensure payload in localStorage always includes these fields
    localStorage.setItem('saleCedeAgreementPayload', JSON.stringify(payload));

    console.log('Sale & Cede Agreement Payload (pending):', payload);

    // Only require property list; witness details are not required for submission anymore.
    if (!payload.list_of_property) {
      alert('Please complete Property list before continuing.');
      return;
    }

    // Open payment method modal instead of starting payment immediately
    this.pendingAgreementPayload = payload;
    this.pendingAmountZAR = 500;
    this.openPaymentModal();
  }

  // Modal controls
  openPaymentModal(): void { this.showPaymentModal = true; }
  closePaymentModal(): void { this.showPaymentModal = false; }

  /** Proceed with the existing card payment flow */
  async confirmCardPayment(method: 'card' | 'xrp' = 'card'): Promise<void> {
    if (!this.pendingAgreementPayload) return;

    // Record selection & amounts
    this.pendingPaymentMethod = method;
    this.pendingAmountZAR = 500;
    this.pendingAmountCents = 500 * 100;

    // Persist for downstream handlers
    localStorage.setItem('paymentMethod', method);
    localStorage.setItem('paymentAmount', String(this.pendingAmountCents));
    localStorage.setItem('saleCedeFlow', 'true');

    this.closePaymentModal();
    await this.confirmPaymentForSaleCede(this.pendingAgreementPayload);
  }

  /** Start XRP flow: show XRP modal and prefetch quote */
  async startXrpFlow(method: 'card' | 'xrp' = 'xrp'): Promise<void> {
    if (!this.pendingAgreementPayload) return;

    this.pendingPaymentMethod = method;
    this.pendingAmountZAR = 500;
    this.pendingAmountCents = this.pendingAmountZAR * 100;

    // Persist common context
    localStorage.setItem('paymentMethod', method);
    localStorage.setItem('paymentAmount', String(this.pendingAmountCents));
    localStorage.setItem('saleCedeFlow', 'true');

    // Close the chooser and open the XRP modal
    this.closePaymentModal();
    this.showXrpModal = true;
    this.cdr.markForCheck();

    // Prefetch a quote for convenience
    this.refreshXrpQuote();
  }

  closeXrpModal(): void { this.showXrpModal = false; }

  backToPaymentMethods(): void {
    this.showXrpModal = false;
    this.openPaymentModal();
    this.cdr.markForCheck();
  }

  async copyXrpAddress(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.xrpAddress);
      alert('XRP address copied to clipboard');
    } catch {
      alert('Could not copy address. Please copy manually.');
    }
  }

  /** Validate and store the 64-char hex tx hash */
  onXrpHashInput(val: string): void {
    this.xrpTxId = (val || '').trim();
    this.cdr.markForCheck();
  }

  /** True if xrpTxId is exactly 64 hex chars */
  get isXrpHashValid(): boolean {
    return /^[0-9a-fA-F]{64}$/.test(this.xrpTxId || '');
  }

  /** Fetch XRP price (ZAR) from CoinGecko and compute amount */
  async refreshXrpQuote(): Promise<void> {
    this.xrpQuoteLoading = true;
    // Clear any previous amount while loading to avoid stale renders
    this.xrpAmountXrp = null;
    this.cdr.markForCheck();
    try {
      const url = 'https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd,zar';
      const res: any = await this.http.get(url).toPromise();

      // Ensure UI updates even under OnPush
      this.ngZone.run(() => {
        const priceZar = Number(res?.ripple?.zar);
        if (!isFinite(priceZar) || priceZar <= 0) {
          throw new Error('Invalid price');
        }
        const amountZar = this.pendingAmountZAR || 500;
        const xrp = amountZar / priceZar;
        // Round to 6 decimals to avoid dust issues and string->number glitches
        this.xrpAmountXrp = Number(xrp.toFixed(6));
        this.xrpQuoteLoading = false;
        this.cdr.markForCheck();
      });
    } catch (e) {
      console.error('XRP quote error:', e);
      this.ngZone.run(() => {
        this.xrpAmountXrp = null;
        this.xrpQuoteLoading = false;
        this.cdr.markForCheck();
      });
      alert('Could not fetch XRP price. Please try again.');
    }
  }

  /** Submit XRP payment details (tx hash + computed XRP amount) to backend */
  async confirmXrpPayment(): Promise<void> {
    if (!this.pendingAgreementPayload) return;
    if (!this.isXrpHashValid) {
      this.xrpHashTouched = true;
      return;
    }
    if (!this.xrpAmountXrp) {
      alert('Missing XRP amount. Please refresh the quote.');
      return;
    }

    const payload = {
      ...this.pendingAgreementPayload,
      payment_method: 'xrp',
      payment_amount: this.pendingAmountZAR || 500, // ZAR reference
      payment_amount_cents: (this.pendingAmountZAR || 500) * 100,
      xrp_amount: this.xrpAmountXrp,
      xrp_address: this.xrpAddress,
      xrp_tx_hash: this.xrpTxId,
      payment_status: 'pending',
    };

    // Stash so success page / follow-ups can read it
    localStorage.setItem('saleCedeAgreementPayloadXrp', JSON.stringify(payload));
    // Mirror standard keys so success page logic works the same as card
    localStorage.setItem('saleCedeAgreementPayload', JSON.stringify(payload));
    localStorage.setItem('paymentMethod', 'xrp');
    localStorage.setItem('paymentAmount', String(payload.payment_amount_cents));
    localStorage.setItem('saleCedeFlow', 'true');

    // Try notify backend (best effort)
    this.generating = true;
    try {
      const resp = await this.http.post<any>(
        'https://hongkongbackend.onrender.com/api/cede/xrp-payment',
        { trust_data: { ...(this.lookupRecord || {}), flow: 'sale_cede', sale_cede_context: payload } }
      ).toPromise();

      // Optional: backend may return an acknowledgement
      console.log('XRP payment ack:', resp);
      this.showXrpModal = false;
      this.cdr.markForCheck();
      alert('Thanks! We\'ve recorded your XRP payment. We\'ll email you once it confirms on-chain.');
      // Route to success page (no gateway redirect needed for XRP)
      await this.router.navigate(['/agreements/sale-cede/success'], { queryParams: { src: 'xrp' } });
    } catch (e) {
      console.error('XRP payment submit error:', e);
      this.showXrpModal = false;
      this.cdr.markForCheck();
      // Still proceed with a local confirmation so the user isn't blocked
      alert('We\'ve saved your XRP payment details locally. If you don\'t get an email soon, please contact support with your tx hash.');
      await this.router.navigate(['/agreements/sale-cede/success'], { queryParams: { src: 'xrp' } });
    } finally {
      this.generating = false;
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

      // Ensure payment fields are present in agreementPayload
      const paymentMethod = this.pendingPaymentMethod || (agreementPayload.payment_method) || (localStorage.getItem('paymentMethod') as 'card' | 'xrp' | null) || 'card';
      const amountInCents = this.pendingAmountCents || agreementPayload.payment_amount_cents || 500 * 100;
      const paymentAmount = Math.round(amountInCents / 100);

      // Patch agreementPayload if missing payment fields
      if (!agreementPayload.payment_method) agreementPayload.payment_method = paymentMethod;
      if (!agreementPayload.payment_amount) agreementPayload.payment_amount = paymentAmount;
      if (!agreementPayload.payment_amount_cents) agreementPayload.payment_amount_cents = amountInCents;

      // Store payment context for the post-payment success page (use localStorage to survive redirects)
      localStorage.setItem('paymentMethod', paymentMethod);
      localStorage.setItem('paymentAmount', String(amountInCents));
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
              payment_method: paymentMethod,
              payment_amount: paymentAmount,
              payment_amount_cents: amountInCents,
              payment_status: 'pending',
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
            // Payment details captured from modal selection
            payment_method: paymentMethod,
            payment_amount: paymentAmount, // in ZAR
            payment_amount_cents: amountInCents,
            payment_status: 'pending',
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
