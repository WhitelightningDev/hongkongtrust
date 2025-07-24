import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
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

  @ViewChild('trusteeConflictModal') trusteeConflictModal!: ElementRef;
  @ViewChild('paymentMethodModal') paymentMethodModal!: ElementRef;

  private paymentMethodModalInstance: any;


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
      trustee1: this.createTrustee(false),
      trustee2: this.createTrustee(false, true),  // Trustee 2 required
      trustee3: this.createTrustee(false),
      trustee4: this.createTrustee(false),
      paymentMethod: [null, Validators.required]
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
  }

  ngOnInit(): void {
    this.trustForm.get('email')?.valueChanges.subscribe(email => {
      if (this.useUserEmailForTrustEmail) {
        this.trustForm.get('trustEmail')?.setValue(email);
      }
    });
  }

  ngAfterViewInit(): void {
    this.paymentMethodModalInstance = new bootstrap.Modal(this.paymentMethodModal.nativeElement, {
      backdrop: 'static',
      keyboard: false
    });

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
    }, 100);
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
      id: [{ value: '', disabled: isReadonly }, required ? Validators.required : []]
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
      trustEmailControl?.setValue(this.trustForm.get('email')?.value || '');
      trustEmailControl?.disable();
    } else {
      trustEmailControl?.enable();
      trustEmailControl?.setValue('');
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
    const checked = (event.target as HTMLInputElement).checked;
    this.trustForm.patchValue({ isTrustee: checked });

    const fullName = this.trustForm.get('fullName')?.value || '';
    const idNumber = this.trustForm.get('idNumber')?.value || '';

    const nameControl = this.firstTrustee.get('name');
    const idControl = this.firstTrustee.get('id');

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
    this.trustForm.get('paymentMethod')?.reset(); // reset selection on open
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
    // Store form data for crypto page to read
    sessionStorage.setItem('trustFormData', JSON.stringify(rawForm));
    this.router.navigate(['/crypto-payment']);
  }
}


  async onSubmit(): Promise<void> {
    if (this.trustForm.invalid) {
    this.trustForm.markAllAsTouched();
     // Show toast error
    this.toastr.error('Please fill in all required fields correctly before submitting.', 'Validation Error', {
      timeOut: 4000,
      closeButton: true,
      progressBar: true,
      positionClass: 'toast-top-right'
    });
    return;
  }


  this.openPaymentMethodModal();

    this.loading = true;

    try {
      const rawForm = this.trustForm.getRawValue();
      const amount = rawForm.isBullionMember ? 1500 : 7000;
      const amountInCents = amount * 100;

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
  }
}
