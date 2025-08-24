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
  selector: 'app-edit-trust',
  imports: [  CommonModule,
    ReactiveFormsModule,
    HttpClientModule,
    FormsModule,
    ToastrModule],
  templateUrl: './edit-trust.html',
  styleUrl: './edit-trust.css'
})
export class EditTrust {
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
        settlor: this.createTrustee(false, true),   // Settlor group with required validators
        trustee1: this.createTrustee(false, true),
        trustee2: this.createTrustee(false, true),  // Trustee 2 required
        trustee3: this.createTrustee(false),
        trustee4: this.createTrustee(false),
        propertyOwner: [''],
        propertyAddress: ['', [Validators.required]],
        signer_name: ['', [Validators.required]],
        signer_id: ['', [Validators.required]],
        signer_email: ['', [Validators.required, Validators.email]],
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
  
    /**
     * Make trustEmail required only when the user is NOT mirroring their own email.
     * When mirroring (useUserEmailForTrustEmail === true), remove `required` and keep only `email` validator.
     */
    private updateTrustEmailValidators(): void {
      const trustEmailControl = this.trustForm.get('trustEmail');
      if (!trustEmailControl) return;
  
      if (this.useUserEmailForTrustEmail) {
        // Mirror email; not required, only needs to be a valid email format
        trustEmailControl.setValidators([Validators.email]);
        // Keep value in sync immediately
        const emailVal = this.trustForm.get('email')?.value || '';
        if (trustEmailControl.value !== emailVal) {
          trustEmailControl.setValue(emailVal, { emitEvent: false });
        }
      } else {
        // User intends a separate trust email; make it required + email format
        trustEmailControl.setValidators([Validators.required, Validators.email]);
      }
      trustEmailControl.updateValueAndValidity({ emitEvent: false });
    }
  
    /**
     * Default the `propertyOwner` field to Trustee 1's name.
     * If `force` is true, always set it. Otherwise, only set when the field is empty or untouched.
     */
    private syncPropertyOwnerFromTrustee1(force = false): void {
      const ownerCtrl = this.trustForm.get('propertyOwner');
      const t1Name = this.firstTrustee?.get('name')?.value?.toString().trim();
      if (!ownerCtrl || !t1Name) return;
  
      const isEmpty = !ownerCtrl.value || (ownerCtrl.value?.toString().trim() === '');
      const untouched = !ownerCtrl.touched && !ownerCtrl.dirty;
  
      if (force || isEmpty || untouched) {
        ownerCtrl.setValue(t1Name, { emitEvent: false });
      }
    }
  
    ngOnInit(): void {
      // Keep Trustee 1 in sync with Settlor while "I am Trustee 1" is checked
      this.trustForm.get('settlor.name')?.valueChanges.subscribe(v => {
        if (this.trustForm.get('isTrustee')?.value) {
          this.firstTrustee.get('name')?.setValue(v || '', { emitEvent: false });
        }
      });
      this.trustForm.get('settlor.id')?.valueChanges.subscribe(v => {
        if (this.trustForm.get('isTrustee')?.value) {
          this.firstTrustee.get('id')?.setValue(v || '', { emitEvent: false });
        }
      });
      this.trustForm.get('email')?.valueChanges.subscribe(v => {
        if (this.trustForm.get('isTrustee')?.value) {
          this.firstTrustee.get('email')?.setValue(v || '', { emitEvent: false });
        }
      });
  
      // If the user is the Settlor on load, default Settlor email from applicant email (once)
      if (this.trustForm.get('isSettlor')?.value) {
        const applicantEmailInit = this.trustForm.get('email')?.value || '';
        const settlorEmailCtrl = this.settlor.get('email');
        if (settlorEmailCtrl && !settlorEmailCtrl.value) {
          settlorEmailCtrl.setValue(applicantEmailInit, { emitEvent: false });
        }
      }
  
      // Keep Settlor email mirrored to applicant email UNTIL user edits Settlor email
      this.trustForm.get('email')?.valueChanges.subscribe(v => {
        if (!this.trustForm.get('isSettlor')?.value) return;
        const settlorEmailCtrl = this.settlor.get('email');
        if (settlorEmailCtrl && !settlorEmailCtrl.dirty) {
          settlorEmailCtrl.setValue(v || '', { emitEvent: false });
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
        this.updateTrustEmailValidators();
      });
  
      // Initialize checkbox state if trustEmail already equals email
      const initEmail = this.trustForm.get('email')?.value || '';
      const initTrustEmail = this.trustForm.get('trustEmail')?.value || '';
      if (initEmail && initTrustEmail && initEmail === initTrustEmail) {
        this.useUserEmailForTrustEmail = true;
      }
      this.updateTrustEmailValidators();
  
      // Initialize propertyOwner from Trustee 1 on load
      this.syncPropertyOwnerFromTrustee1();
  
      // Keep propertyOwner in sync with Trustee 1 name unless the user has edited it
      this.firstTrustee.get('name')?.valueChanges.subscribe(() => {
        this.syncPropertyOwnerFromTrustee1(false);
      });
  
      // --- Signer defaults from Trustee 2 ---
      // Set initial signer values from Trustee 2 if signer fields are empty
      const t2init = this.secondTrustee?.value || {};
      this.trustForm.patchValue({
        signer_name: this.trustForm.get('signer_name')?.value || t2init.name || '',
        signer_id: this.trustForm.get('signer_id')?.value || t2init.id || '',
        signer_email: this.trustForm.get('signer_email')?.value || t2init.email || '',
      }, { emitEvent: false });
  
      // Keep signer fields pristine so they continue mirroring until user edits
      this.trustForm.get('signer_name')?.markAsPristine();
      this.trustForm.get('signer_id')?.markAsPristine();
      this.trustForm.get('signer_email')?.markAsPristine();
  
      // Mirror Trustee 2 into signer fields UNTIL the user edits those signer fields (controls remain pristine/not dirty)
      this.secondTrustee.valueChanges.subscribe(v => {
        if (!v) return;
        const signerNameCtrl  = this.trustForm.get('signer_name');
        const signerIdCtrl    = this.trustForm.get('signer_id');
        const signerEmailCtrl = this.trustForm.get('signer_email');
  
        if (signerNameCtrl && !signerNameCtrl.dirty) {
          signerNameCtrl.setValue(v.name || '', { emitEvent: false });
        }
        if (signerIdCtrl && !signerIdCtrl.dirty) {
          signerIdCtrl.setValue(v.id || '', { emitEvent: false });
        }
        if (signerEmailCtrl && !signerEmailCtrl.dirty) {
          signerEmailCtrl.setValue(v.email || '', { emitEvent: false });
        }
      });
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
        this.syncPropertyOwnerFromTrustee1();
      }, 100);
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
    get fourthTrustee(): FormGroup {
      return this.trustForm.get('trustee4') as FormGroup;
    }
  
  
    // Create trustee/settlors with dynamic required validation
  createTrustee(isReadonly = false, required = false): FormGroup {
    return this.fb.group({
      name: [{ value: '', disabled: isReadonly }, required ? Validators.required : []],
      id: [{ value: '', disabled: isReadonly }, required ? Validators.required : []],
      email: [{ value: '', disabled: isReadonly }, [Validators.email]]
    });
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
      this.updateTrustEmailValidators();
    }
  
    /** 🔔 Triggered on textarea blur */
    checkBeneficiariesAgainstTrustees(): void {
      const beneficiaries = this.trustForm.get('beneficiaries')?.value?.toLowerCase() || '';
      const trusteeNames: string[] = [];
  
      const names = [
        this.firstTrustee.get('name')?.value,
        this.secondTrustee.get('name')?.value,
        this.thirdTrustee.get('name')?.value,
        this.fourthTrustee.get('name')?.value,
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
        // Mirror and lock Settlor email from applicant email
        const emailControl = this.settlor.get('email');
        const applicantEmail = this.trustForm.get('email')?.value || '';
        emailControl?.setValue(applicantEmail);
        emailControl?.disable();
      } else {
        nameControl?.enable();
        idControl?.enable();
        nameControl?.reset();
        idControl?.reset();
        // Enable and reset Settlor email
        const emailControl = this.settlor.get('email');
        emailControl?.enable();
        emailControl?.reset();
      }
    }
  
    onTrusteeCheckboxChange(event: Event): void {
      if (this.isEditMode) { return; }
      const checked = (event.target as HTMLInputElement).checked;
      this.trustForm.patchValue({ isTrustee: checked });
  
      const settlorName  = this.settlor.get('name')?.value || this.trustForm.get('fullName')?.value || '';
      const settlorId    = this.settlor.get('id')?.value   || this.trustForm.get('idNumber')?.value   || '';
      const settlorEmail = this.trustForm.get('email')?.value || '';
  
      const nameControl  = this.firstTrustee.get('name');
      const idControl    = this.firstTrustee.get('id');
      const emailControl = this.firstTrustee.get('email');
  
      if (checked) {
        nameControl?.setValue(settlorName, { emitEvent: false });
        idControl?.setValue(settlorId, { emitEvent: false });
        emailControl?.setValue(settlorEmail, { emitEvent: false });
        nameControl?.disable({ emitEvent: false });
        idControl?.disable({ emitEvent: false });
        emailControl?.disable({ emitEvent: false });
      } else {
        nameControl?.enable({ emitEvent: false });
        idControl?.enable({ emitEvent: false });
        emailControl?.enable({ emitEvent: false });
        nameControl?.reset('', { emitEvent: false });
        idControl?.reset('', { emitEvent: false });
        emailControl?.reset('', { emitEvent: false });
      }
      this.syncPropertyOwnerFromTrustee1(true);
    }
  
    onBeneficiariesBlur(): void {
      const trusteeNames = [
        this.firstTrustee.get('name')?.value?.toLowerCase(),
        this.secondTrustee.get('name')?.value?.toLowerCase(),
        this.thirdTrustee.get('name')?.value?.toLowerCase(),
        this.fourthTrustee.get('name')?.value?.toLowerCase()
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
      // Map UI `propertyAddress` -> backend `Property_Address`
      const trustDataForBackend = { ...rawForm, Property_Address: rawForm.propertyAddress || '' };
  
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
              trust_data: trustDataForBackend
            }
          ).toPromise();
  
          if (!paymentInit || !paymentInit.redirectUrl || !paymentInit.trust_id) {
            throw new Error('Invalid response from backend');
          }
  
          const trustId = paymentInit.trust_id;
  
          sessionStorage.setItem('trustFormData', JSON.stringify(trustDataForBackend));
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
        sessionStorage.setItem('trustFormData', JSON.stringify(trustDataForBackend));
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
     * Expects backend route: GET {API_BASE}/edit-trust/lookup
     */
    async performEditLookup(): Promise<void> {
      if (this.editLookupForm.invalid) {
        this.editLookupForm.markAllAsTouched();
        return;
      }
      const { trust_number, id_or_passport } = this.editLookupForm.value;

      const API_BASE = 'https://hongkongbackend.onrender.com';
      const url = `${API_BASE}/edit-trust/lookup?trust_number=${encodeURIComponent(trust_number)}&id_or_passport=${encodeURIComponent(id_or_passport)}`;

      this.lookupLoading = true;
      try {
        const record: any = await this.http.get(url).toPromise();
  
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
        referrerNumber: rec.referrer_number || '',
        propertyAddress: rec.property_address || rec.Property_Address || '',
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
      const [t1, t2, t3, t4] = [
        trustees[0] || { name: '', id: '' },
        trustees[1] || { name: '', id: '' },
        trustees[2] || { name: '', id: '' },
        trustees[3] || { name: '', id: '' },
      ];
      this.firstTrustee.enable();
      this.secondTrustee.enable();
      this.thirdTrustee.enable();
      this.fourthTrustee.enable();

      this.firstTrustee.patchValue({ name: t1.name || '', id: t1.id || '' }, { emitEvent: false });
      this.secondTrustee.patchValue({ name: t2.name || '', id: t2.id || '' }, { emitEvent: false });
      this.thirdTrustee.patchValue({ name: t3.name || '', id: t3.id || '' }, { emitEvent: false });
      this.fourthTrustee.patchValue({ name: t4.name || '', id: t4.id || '' }, { emitEvent: false });

      // Extra fields from backend
      this.settlor.get('email')?.setValue(rec.settlor_email || '', { emitEvent: false });
      this.firstTrustee.get('email')?.setValue(rec.trustee1_email || '', { emitEvent: false });
      this.secondTrustee.get('email')?.setValue(rec.trustee2_email || '', { emitEvent: false });
      this.thirdTrustee.get('email')?.setValue(rec.trustee3_email || '', { emitEvent: false });

      this.trustForm.patchValue({
        propertyOwner: rec.owner_name || '',
        signer_name: rec.signer_name || '',
        signer_id: rec.signer_id || '',
        signer_email: rec.signer_email || '',
        propertyAddress: rec.Property_Address || ''
      }, { emitEvent: false });

      // Sync propertyOwner from Trustee 1 after patching trustees
      this.syncPropertyOwnerFromTrustee1(true);

      // Populate signer fields from record or default to Trustee 2
      const signerFromRecName  = rec.signer_name  || '';
      const signerFromRecId    = rec.signer_id    || '';
      const signerFromRecEmail = rec.signer_email || '';

      const fallbackSignerName  = signerFromRecName  || (this.secondTrustee.get('name')?.value || '');
      const fallbackSignerId    = signerFromRecId    || (this.secondTrustee.get('id')?.value   || '');
      const fallbackSignerEmail = signerFromRecEmail || (this.secondTrustee.get('email')?.value|| '');

      this.trustForm.patchValue({
        signer_name: fallbackSignerName,
        signer_id: fallbackSignerId,
        signer_email: fallbackSignerEmail,
      }, { emitEvent: false });

      // Ensure trustName input (if present) is disabled in edit mode
      const trustNameControl = this.trustForm.get('trustName');
      if (trustNameControl && !trustNameControl.disabled) {
        trustNameControl.disable({ emitEvent: false });
      }
    }
  
    /**
     * Build payload for PUT /trusts/edit-trust/{trust_number}
     * Includes all fields required by the backend update endpoint.
     */
    private buildEditPayload(): any {
      // Collect trustees in order, omit empty rows at the end
      const trustees = [
        this.firstTrustee.value,
        this.secondTrustee.value,
        this.thirdTrustee.value,
        this.fourthTrustee.value
      ].filter(t => (t?.name && String(t.name).trim()) || (t?.id && String(t.id).trim()));

      // Build payload with all required fields for backend update endpoint
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
        trustees,
        // Additional fields required by backend
        settlor_email: this.settlor.get('email')?.value,
        trustee1_email: this.firstTrustee.get('email')?.value,
        trustee2_email: this.secondTrustee.get('email')?.value,
        trustee3_email: this.thirdTrustee.get('email')?.value,
        owner_name: this.trustForm.get('propertyOwner')?.value,
        owner_id: this.firstTrustee.get('id')?.value,
        owner_email: this.firstTrustee.get('email')?.value,
        signer_name: this.trustForm.get('signer_name')?.value,
        signer_id: this.trustForm.get('signer_id')?.value,
        signer_email: this.trustForm.get('signer_email')?.value,
        Property_Address: this.trustForm.get('propertyAddress')?.value,
      };
    }

    /**
     * Start the fixed R165 payment flow for editing trusts.
     * 1. Checks edit mode and trust number, shows error if not valid.
     * 2. Calls backend POST /edit-trust-payment/{trust_number} with amount and payload.
     * 3. Redirects user to payment URL.
     * 4. Shows error toast on failure.
     */
    async startEditPayment(): Promise<void> {
      if (!this.isEditMode || !this.editTrustNumber) {
        this.toastr.error('Edit mode not active or trust number missing.', 'Edit Payment Error', {
          timeOut: 5000, closeButton: true, progressBar: true
        });
        return;
      }
      const API_BASE = 'https://hongkongbackend.onrender.com';
      const url = `${API_BASE}/payments/edit-trust-payment/${encodeURIComponent(this.editTrustNumber)}`;
      try {
        // Initiate payment for R165 (16500 cents) and send payload
        const paymentInit = await this.http.post<any>(
          url,
          {
            amount_cents: 16500,
            payload: this.buildEditPayload()
          }
        ).toPromise();
        if (!paymentInit || !paymentInit.redirectUrl) {
          throw new Error('No payment redirect URL returned.');
        }
        // Redirect to payment URL
        window.location.href = paymentInit.redirectUrl;
      } catch (err: any) {
        const msg = err?.error?.detail || err?.message || 'Failed to start edit payment';
        this.toastr.error(msg, 'Edit Payment Error', {
          timeOut: 7000, closeButton: true, progressBar: true
        });
      }
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
        this.toastr.success('Amended deed generated and sent to admin.', 'Trust updated', {
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
  