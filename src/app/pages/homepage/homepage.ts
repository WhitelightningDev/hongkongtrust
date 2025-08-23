import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors, ValidatorFn, FormControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastrService, ToastrModule } from 'ngx-toastr';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

declare var bootstrap: any;

// Custom validator for trustName
export function trustNameValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value?.toLowerCase() || '';
    if (value.includes('the') || value.includes('trust') || value.includes('foreign') || value.includes('hong') || value.includes('kong')) {
      return { forbiddenWords: true };
    }
    return null;
  };
}

@Component({
  selector: 'app-homepage',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    HttpClientModule,
    FormsModule,
    ToastrModule
  ],
  templateUrl: './homepage.html',
  styleUrls: ['./homepage.css']
})
export class Homepage implements OnInit, AfterViewInit {
  private toastr = inject(ToastrService);
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);

  trustForm: FormGroup;
  minDate = new Date().toISOString().split('T')[0];
  uploadedFiles: File[] = [];
  fileMap: { [key: string]: File } = {};
  useUserEmailForTrustEmail = false;
  loading = false;
  showSuccessPopup = false;

  // ---- Edit Existing Trust state ----
  isEditMode = false;                // when true, submit flow will call PUT instead of payment
  editTrustNumber: string | null = null;  // immutable, returned from lookup
  editTrustName: string | null = null;    // immutable, returned from lookup

  // Small lookup form (inside modal): trust number + ID/Passport
  editLookupForm: FormGroup = this.fb.group({
    trust_number: ['', Validators.required],
    id_or_passport: ['', Validators.required]
  });

  // Loading flags specific to edit flow
  lookupLoading = false;
  editSaving = false;

  @ViewChild('trusteeConflictModal') trusteeConflictModal!: ElementRef;
  @ViewChild('paymentMethodModal') paymentMethodModal!: ElementRef;
  @ViewChild('editTrustModal') editTrustModal!: ElementRef; // modal for Edit Existing Trust lookup

  private paymentMethodModalInstance: any;
  private editTrustModalInstance: any;

  constructor() {
    this.trustForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      fullName: ['', Validators.required],
      idNumber: ['', Validators.required],
      isSettlor: [false],
      isTrustee: [false],
      trustEmail: ['', [Validators.email]],
      phoneNumber: ['', Validators.required],
      trustName: ['', [Validators.required, trustNameValidator()]],
      establishmentDate: ['', Validators.required],
      altSettlorName: [''],
      beneficiaries: [''],
      isBullionMember: [false],
      memberNumber: [''],
      wasReferredByMember: [false],
      referrerNumber: [''],
      settlor: this.createTrustee(false, true, true),   // Settlor group with required validators and email
      trustee1: this.createTrustee(false, true, true),
      trustee2: this.createTrustee(false, true, true),  // Trustee 2 required
      trustee3: this.createTrustee(false, false, true), // Trustee 3 optional with email, not required
      propertyOwner: ['', Validators.required],
      propertyAddress: ['', Validators.required],
      paymentMethod: [null]  // No Validators.required here
    });

    // Update validators dynamically based on checkboxes
    this.trustForm.get('isBullionMember')!.valueChanges.subscribe((isMember: boolean) => {
      const memberNumber = this.trustForm.get('memberNumber')!;
      if (isMember) {
        memberNumber.setValidators([
          Validators.required,
          Validators.pattern(/^BB\d{6}$/i)
        ]);
      } else {
        memberNumber.clearValidators();
        memberNumber.setValue('');
      }
      memberNumber.updateValueAndValidity();
    });

    this.trustForm.get('wasReferredByMember')!.valueChanges.subscribe((wasReferred: boolean) => {
      const referrerControl = this.trustForm.get('referrerNumber')!;
      if (wasReferred) {
        referrerControl.setValidators([
          Validators.required,
          Validators.pattern(/^BB\d{6}$/i)
        ]);
      } else {
        referrerControl.clearValidators();
        referrerControl.setValue('');
      }
      referrerControl.updateValueAndValidity();
    });

    // Conditional required validator for trustEmail based on useUserEmailForTrustEmail
  }

  ngOnInit(): void {
    // If checkbox is ON, keep trustEmail in sync with email
    this.trustForm.get('email')?.valueChanges.subscribe(email => {
      if (this.useUserEmailForTrustEmail) {
        this.trustForm.get('trustEmail')?.setValue(email || '');
      }
    });

    // Auto-toggle the checkbox when user types a trustEmail equal to email
    this.trustForm.get('trustEmail')?.valueChanges.subscribe(trustEmail => {
      const email = this.trustForm.get('email')?.value || '';
      const equal = (trustEmail || '') === email;
      if (equal && !this.useUserEmailForTrustEmail) {
        this.useUserEmailForTrustEmail = true;
      } else if (!equal && this.useUserEmailForTrustEmail) {
        this.useUserEmailForTrustEmail = false;
      }
    });

    // Initialize checkbox state if trustEmail already equals email
    const initEmail = this.trustForm.get('email')?.value || '';
    const initTrustEmail = this.trustForm.get('trustEmail')?.value || '';
    if (initEmail && initTrustEmail && initEmail === initTrustEmail) {
      this.useUserEmailForTrustEmail = true;
    }
  }

  ngAfterViewInit(): void {
    this.paymentMethodModalInstance = new bootstrap.Modal(this.paymentMethodModal.nativeElement, {
      backdrop: 'static',
      keyboard: false
    });

    // Modal for "EDIT EXISTING TRUST"
    if (this.editTrustModal?.nativeElement) {
      this.editTrustModalInstance = new bootstrap.Modal(this.editTrustModal.nativeElement, {
        backdrop: 'static',
        keyboard: false
      });
    }

    // Prefill settlor and first trustee from fullName and idNumber if empty
    setTimeout(() => {
      const fullName = this.trustForm.get('fullName')?.value;
      const idNumber = this.trustForm.get('idNumber')?.value;

      if (fullName?.trim()) {
        if (!this.trustForm.get('isSettlor')?.value && !this.settlor.get('name')?.value?.trim()) {
          this.settlor.get('name')?.setValue(fullName, { emitEvent: false });
        }
        if (!this.trustForm.get('isTrustee')?.value && !this.firstTrustee.get('name')?.value?.trim()) {
          this.firstTrustee.get('name')?.setValue(fullName, { emitEvent: false });
        }
        this.trustForm.get('altSettlorName')?.setValue(fullName, { emitEvent: false });
      }

      if (idNumber?.trim()) {
        if (!this.trustForm.get('isSettlor')?.value && !this.settlor.get('id')?.value?.trim()) {
          this.settlor.get('id')?.setValue(idNumber, { emitEvent: false });
        }
        if (!this.trustForm.get('isTrustee')?.value && !this.firstTrustee.get('id')?.value?.trim()) {
          this.firstTrustee.get('id')?.setValue(idNumber, { emitEvent: false });
        }
      }
      // Email autofill for settlor/trustee1 is now handled only in onTrusteeCheckboxChange
    }, 100);

    // Keep propertyOwner synced with Trustee 1's name if blank, but allow user override
    this.firstTrustee.get('name')?.valueChanges.subscribe(name => {
      const currentOwner = this.trustForm.get('propertyOwner')?.value;
      if (!currentOwner || currentOwner.trim() === '') {
        this.trustForm.get('propertyOwner')?.setValue(name || '', { emitEvent: false });
      }
    });
  }

   goBackToHome(): void {
    this.router.navigate(['/']);
  }

  // Accessors for nested FormGroups
  get settlor(): FormGroup {
    return this.trustForm.get('settlor') as FormGroup;
  }
  get firstTrustee(): FormGroup {
    return this.trustForm.get('trustee1') as FormGroup;
  }
  get secondTrustee(): FormGroup {
    return this.trustForm.get('trustee2') as FormGroup;
  }
  get thirdTrustee(): FormGroup {
    return this.trustForm.get('trustee3') as FormGroup;
  }

  // Create trustee/settlors with dynamic required validation and optional email
  createTrustee(isReadonly = false, required = false, withEmail = false): FormGroup {
    const group: any = {
      name: [{ value: '', disabled: isReadonly }, required ? Validators.required : []],
      id: [{ value: '', disabled: isReadonly }, required ? Validators.required : []]
    };
    if (withEmail) {
      group.email = ['', required ? [Validators.required, Validators.email] : [Validators.email]];
    }
    return this.fb.group(group);
  }

  onFileUpload(role: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.fileMap[role] = file;
    }
  }

  toggleUseUserEmailForTrustEmail(event: Event): void {
    this.useUserEmailForTrustEmail = (event.target as HTMLInputElement).checked;
    const trustEmailControl = this.trustForm.get('trustEmail');
    if (this.useUserEmailForTrustEmail) {
      // Mirror the current email; field remains enabled (template uses [readOnly])
      trustEmailControl?.setValue(this.trustForm.get('email')?.value || '');
    } else {
      // Leave whatever the user typed; no clearing
    }
  }

  /** 🔔 Triggered on textarea blur */
  checkBeneficiariesAgainstTrustees(): void {
    const beneficiaries = this.trustForm.get('beneficiaries')?.value?.toLowerCase() || '';
    const trusteeNames: string[] = [];

    const names = [
      this.firstTrustee.get('name')?.value,
      this.secondTrustee.get('name')?.value,
      this.thirdTrustee.get('name')?.value,
    ];

    names.forEach(name => {
      if (name?.trim()) {
        trusteeNames.push(name.toLowerCase());
      }
    });

    const conflict = trusteeNames.find(trustee => beneficiaries.includes(trustee));
    if (conflict) {
      const modalEl = document.getElementById('trusteeConflictModal');
      if (modalEl) {
        const modalInstance = new bootstrap.Modal(modalEl);
        modalInstance.show();
      }
    }
  }

  onSettlorCheckboxChange(event: Event): void {
    if (this.isEditMode) { return; }
    const checked = (event.target as HTMLInputElement).checked;
    this.trustForm.patchValue({ isSettlor: checked });

    const fullName = this.trustForm.get('fullName')?.value || '';
    const idNumber = this.trustForm.get('idNumber')?.value || '';

    const nameControl = this.settlor.get('name');
    const idControl = this.settlor.get('id');

    if (checked) {
      nameControl?.setValue(fullName);
      idControl?.setValue(idNumber);
      nameControl?.disable();
      idControl?.disable();
    } else {
      nameControl?.enable();
      idControl?.enable();
      nameControl?.reset();
      idControl?.reset();
    }
  }

  onTrusteeCheckboxChange(event: Event): void {
    if (this.isEditMode) { return; }
    const checked = (event.target as HTMLInputElement).checked;
    this.trustForm.patchValue({ isTrustee: checked });

    const settlorName = this.settlor.get('name')?.value || '';
    const settlorId = this.settlor.get('id')?.value || '';
    const settlorEmail = this.settlor.get('email')?.value || '';

    const nameControl = this.firstTrustee.get('name');
    const idControl = this.firstTrustee.get('id');
    const emailControl = this.firstTrustee.get('email');

    if (checked) {
      nameControl?.setValue(settlorName);
      idControl?.setValue(settlorId);
      emailControl?.setValue(settlorEmail);
      nameControl?.disable();
      idControl?.disable();
      emailControl?.disable();
    } else {
      nameControl?.enable();
      idControl?.enable();
      emailControl?.enable();
      nameControl?.reset();
      idControl?.reset();
      emailControl?.reset();
    }
  }

  onBeneficiariesBlur(): void {
    const trusteeNames = [
      this.firstTrustee.get('name')?.value?.toLowerCase(),
      this.secondTrustee.get('name')?.value?.toLowerCase(),
      this.thirdTrustee.get('name')?.value?.toLowerCase()
    ].filter(Boolean);

    const beneficiaries = this.trustForm.get('beneficiaries')?.value?.toLowerCase() || '';

    const isConflict = trusteeNames.some(name => beneficiaries.includes(name));
    if (isConflict) {
      const modal = new bootstrap.Modal(this.trusteeConflictModal.nativeElement);
      modal.show();
    }
  }

  openPaymentMethodModal(): void {
    this.trustForm.get('paymentMethod')?.reset(); // reset payment method selection each time modal opens
    this.paymentMethodModalInstance.show();
  }

  async confirmPaymentMethod(): Promise<void> {
    const selectedMethod = this.trustForm.get('paymentMethod')?.value;

    if (!selectedMethod) {
      alert('Please select a payment method.');
      return;
    }

    this.paymentMethodModalInstance.hide();

    const rawForm = this.trustForm.getRawValue();

    if (selectedMethod === 'cardEFT') {
      this.loading = true;

      try {
        const amount = rawForm.isBullionMember ? 1500 : 7000;
        const amountInCents = amount * 100;

        // Store payment method and amount in sessionStorage
        sessionStorage.setItem('paymentMethod', 'card');
        sessionStorage.setItem('paymentAmount', amountInCents.toString());

        const paymentInit = await this.http.post<any>(
          'https://hongkongbackend.onrender.com/api/payment-session',
          {
            amount_cents: amountInCents,
            trust_data: rawForm
          }
        ).toPromise();

        if (!paymentInit || !paymentInit.redirectUrl || !paymentInit.trust_id) {
          throw new Error('Invalid response from backend');
        }

        const trustId = paymentInit.trust_id;

        sessionStorage.setItem('trustFormData', JSON.stringify(rawForm));
        sessionStorage.setItem('trustId', trustId);

        const serializedFiles = await Promise.all(
          Object.entries(this.fileMap).map(async ([role, file]) => {
            const buffer = await file.arrayBuffer();
            return {
              role,
              name: file.name,
              type: file.type,
              buffer: Array.from(new Uint8Array(buffer))
            };
          })
        );

        sessionStorage.setItem('trustFiles', JSON.stringify(serializedFiles));

        await new Promise((res) => setTimeout(res, 500));

        this.loading = false;

        window.location.href = paymentInit.redirectUrl;

      } catch (error: any) {
        alert('Error: ' + (error.message || error));
        console.error('🛑 Payment session error:', error);
        this.loading = false;
      }
    } else if (selectedMethod === 'crypto') {
      // Store form data for crypto payment page to read
      sessionStorage.setItem('trustFormData', JSON.stringify(rawForm));
      this.router.navigate(['/crypto-payment']);
    }
  }

  async onSubmit(): Promise<void> {
    if (this.trustForm.invalid) {
      this.trustForm.markAllAsTouched();

      // Collect invalid fields' keys for top-level and nested controls
      const invalidFields: string[] = [];

      Object.keys(this.trustForm.controls).forEach(key => {
        const control = this.trustForm.get(key);

        if (control?.invalid) {
          if (control instanceof FormGroup) {
            // Nested group: check which child controls are invalid
            Object.keys(control.controls).forEach(nestedKey => {
              const nestedControl = control.get(nestedKey);
              if (nestedControl?.invalid) {
                invalidFields.push(`${key}.${nestedKey}`);
              }
            });
          } else {
            invalidFields.push(key);
          }
        }
      });

      // Format the invalid fields nicely for the toast message
      const formattedFields = invalidFields.length
        ? invalidFields.map(f => f.replace(/([A-Z])/g, ' $1').toLowerCase()).join(', ')
        : 'some required fields';

      // Show toast error with the list of invalid fields
      this.toastr.error(
        `Please fill in or correct the following fields: ${formattedFields}`,
        'Validation Error',
        {
          timeOut: 6000,
          closeButton: true,
          progressBar: true,
          positionClass: 'toast-top-right',
          tapToDismiss: false,
          toastClass: 'ngx-toastr toast-error custom-toast' // your own custom class to hook CSS
        }
      );

      // Also log for debugging
      console.log('Form valid?', this.trustForm.valid);
      console.log('Invalid fields:', invalidFields);

      return;
    }

    // If we're editing an existing trust, save edits instead of opening payment
    if (this.isEditMode) {
      this.submitEdits();
      return;
    }

    // If valid and not in edit mode, open payment modal as before
    this.openPaymentMethodModal();
  }


  /**
   * Normalize various incoming date formats to ISO 'yyyy-MM-dd' for binding to &lt;input type="date"&gt; and DatePipe.
   * Supports:
   *  - 'YYYY-MM-DD'
   *  - 'DD/MM/YYYY' or 'DD-MM-YYYY'
   *  - '1st day of August 2025'
   *  - '1 August 2025' or '01 August 2025'
   */
  private normalizeToISODate(input: any): string | null {
    if (!input) return null;
    if (input instanceof Date && !isNaN(input.getTime())) {
      return input.toISOString().slice(0, 10);
    }
    const raw = String(input).trim();
    // Already ISO-like yyyy-MM-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    // DD/MM/YYYY or DD-MM-YYYY
    let m = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (m) {
      const d = m[1].padStart(2,'0');
      const mo = m[2].padStart(2,'0');
      return `${m[3]}-${mo}-${d}`;
    }
    // '1st day of August 2025'
    m = raw.match(/^(\d{1,2})(st|nd|rd|th)\s+day of\s+([A-Za-z]+)\s+(\d{4})$/i);
    if (m) {
      const day = m[1].padStart(2,'0');
      const monthName = m[3].toLowerCase();
      const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
      const mi = months.indexOf(monthName);
      if (mi >= 0) {
        const month = String(mi+1).padStart(2,'0');
        return `${m[4]}-${month}-${day}`;
      }
    }
    // '1 August 2025' or '01 August 2025'
    m = raw.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
    if (m) {
      const day = m[1].padStart(2,'0');
      const monthName = m[2].toLowerCase();
      const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
      const mi = months.indexOf(monthName);
      if (mi >= 0) {
        const month = String(mi+1).padStart(2,'0');
        return `${m[3]}-${month}-${day}`;
      }
    }
    // Fallback: try Date.parse
    const t = Date.parse(raw);
    if (!isNaN(t)) {
      const d = new Date(t);
      return d.toISOString().slice(0, 10);
    }
    return null;
  }
  // =========================
  // EDIT EXISTING TRUST FLOW
  // =========================

  /**
   * Open the Edit Existing Trust modal (asks for trust number + ID/passport)
   */
  openEditModal(): void {
    this.editLookupForm.reset();
    this.lookupLoading = false;
    this.isEditMode = false;
    this.editTrustNumber = null;
    this.editTrustName = null;
    if (this.editTrustModalInstance) {
      this.editTrustModalInstance.show();
    }
  }

  /**
   * Perform lookup to authenticate settlor/applicant and pull existing trust data.
   * Expects backend route: POST {API_BASE}/trusts/edit-trust/lookup
   */
  async performEditLookup(): Promise<void> {
    if (this.editLookupForm.invalid) {
      this.editLookupForm.markAllAsTouched();
      return;
    }
    const { trust_number, id_or_passport } = this.editLookupForm.value;

    const API_BASE = 'https://hongkongbackend.onrender.com';
    const url = `${API_BASE}/trusts/edit-trust/lookup`;

    this.lookupLoading = true;
    try {
      const record: any = await this.http.post(url, { trust_number, id_or_passport }).toPromise();

      // Store immutable display values
      this.editTrustNumber = record.trust_number;
      this.editTrustName = record.trust_name;

      // Prefill the main form with editable data
      this.prefillFormFromLookup(record);

      // Switch to edit mode and close the lookup modal
      this.isEditMode = true;
      // Ensure trustName control is disabled in edit mode
      const tn = this.trustForm.get('trustName');
      if (tn && !tn.disabled) {
        tn.disable({ emitEvent: false });
      }
      if (this.editTrustModalInstance) {
        this.editTrustModalInstance.hide();
      }

      this.toastr.success('Trust loaded. You can now edit and save changes.', 'Edit mode enabled', {
        timeOut: 4000, closeButton: true, progressBar: true
      });
    } catch (err: any) {
      const msg = err?.error?.detail || err?.message || 'Lookup failed';
      this.toastr.error(msg, 'Lookup Error', { timeOut: 6000, closeButton: true, progressBar: true });
    } finally {
      this.lookupLoading = false;
    }
  }

  /**
   * Patch the main form from a lookup record.
   * Trust name/number remain immutable (not written to editable controls).
   */
  private prefillFormFromLookup(rec: any): void {
    // Toggle member flags first so validators attach before patching values
    this.trustForm.get('isBullionMember')?.setValue(!!rec.is_bullion_member, { emitEvent: true });
    this.trustForm.get('wasReferredByMember')?.setValue(!!rec.referrer_number, { emitEvent: true });

    // Basic fields
    this.trustForm.patchValue({
      fullName: rec.full_name || '',
      idNumber: rec.id_number || '',
      email: rec.email || '',
      phoneNumber: rec.phone_number || '',
      trustEmail: rec.trust_email || '',
      trustName: rec.trust_name || '', // visible but immutable in edit mode
      establishmentDate: this.normalizeToISODate(rec.establishment_date) || '',
      beneficiaries: rec.beneficiaries || '',
      memberNumber: rec.member_number || '',
      referrerNumber: rec.referrer_number || ''
    }, { emitEvent: false });

    // Settlor block
    this.settlor.get('name')?.enable();
    this.settlor.get('id')?.enable();
    this.settlor.patchValue({
      name: rec.settlor_name || '',
      id: rec.settlor_id || ''
    }, { emitEvent: false });

    // Trustees (array in response)
    const trustees: any[] = Array.isArray(rec.trustees) ? rec.trustees : [];
    const [t1, t2, t3] = [
      trustees[0] || { name: '', id: '' },
      trustees[1] || { name: '', id: '' },
      trustees[2] || { name: '', id: '' }
    ];
    this.firstTrustee.enable();
    this.secondTrustee.enable();
    this.thirdTrustee.enable();
    this.firstTrustee.patchValue({ name: t1.name || '', id: t1.id || '' }, { emitEvent: false });
    this.secondTrustee.patchValue({ name: t2.name || '', id: t2.id || '' }, { emitEvent: false });
    this.thirdTrustee.patchValue({ name: t3.name || '', id: t3.id || '' }, { emitEvent: false });

    // Ensure trustName input (if present) is disabled in edit mode
    const trustNameControl = this.trustForm.get('trustName');
    if (trustNameControl && !trustNameControl.disabled) {
      trustNameControl.disable({ emitEvent: false });
    }
  }

  /**
   * Build payload for PUT /trusts/edit-trust/{trust_number}
   */
  private buildEditPayload(): any {
    // Collect trustees in order, omit empty rows at the end
    const trustees = [
      this.firstTrustee.value,
      this.secondTrustee.value,
      this.thirdTrustee.value
    ].filter(t => (t?.name && String(t.name).trim()) || (t?.id && String(t.id).trim()));

    return {
      id_number: this.trustForm.get('idNumber')?.value,
      email: this.trustForm.get('email')?.value,
      phone_number: this.trustForm.get('phoneNumber')?.value,
      trust_email: this.trustForm.get('trustEmail')?.value,
      establishment_date: this.trustForm.get('establishmentDate')?.value,
      beneficiaries: this.trustForm.get('beneficiaries')?.value,
      is_bullion_member: !!this.trustForm.get('isBullionMember')?.value,
      member_number: this.trustForm.get('memberNumber')?.value || null,
      referrer_number: this.trustForm.get('referrerNumber')?.value || null,
      settlor_name: this.settlor.get('name')?.value,
      settlor_id: this.settlor.get('id')?.value,
      trustees
    };
  }

  /**
   * Save edits (PUT). On success, backend regenerates deed and emails PDF.
   */
  async submitEdits(): Promise<void> {
    if (!this.isEditMode || !this.editTrustNumber) {
      return;
    }

    // Validate minimum trustees (first two required in form definition)
    if (this.firstTrustee.invalid || this.secondTrustee.invalid) {
      this.firstTrustee.markAllAsTouched();
      this.secondTrustee.markAllAsTouched();
      this.toastr.error('Trust requires at least two trustees with name and ID.', 'Validation', {
        timeOut: 5000, closeButton: true, progressBar: true
      });
      return;
    }

    const API_BASE = 'https://hongkongbackend.onrender.com';
    const url = `${API_BASE}/trusts/edit-trust/${encodeURIComponent(this.editTrustNumber)}`;
    const payload = this.buildEditPayload();

    this.editSaving = true;
    try {
      await this.http.put(url, payload).toPromise();
      this.toastr.success('Amended deed generated and emailed. Check your inbox.', 'Trust updated', {
        timeOut: 6000, closeButton: true, progressBar: true
      });

      // Leave the page in edit mode but scroll to top / provide visual confirmation if needed
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      const msg = err?.error?.detail || err?.message || 'Failed to save edits';
      this.toastr.error(msg, 'Save Error', { timeOut: 7000, closeButton: true, progressBar: true });
    } finally {
      this.editSaving = false;
    }
  }

  /**
   * Exit edit mode and re-enable original submission flow.
   */
  exitEditMode(): void {
    this.isEditMode = false;
    this.editTrustNumber = null;
    this.editTrustName = null;
    const trustNameControl = this.trustForm.get('trustName');
    if (trustNameControl) {
      trustNameControl.enable({ emitEvent: false });
    }
  }

}
