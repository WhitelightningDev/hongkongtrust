import { Component, OnInit, AfterViewInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-homepage',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule],
  templateUrl: './homepage.html',
  styleUrls: ['./homepage.css']
})
export class Homepage implements OnInit, AfterViewInit {
  trustForm: FormGroup;
  minDate: string = new Date().toISOString().split('T')[0];
  uploadedFiles: File[] = [];
  fileMap: { [key: string]: File } = {};
  useUserEmailForTrustEmail = false;

  loading = false;
  showSuccessPopup = false;

  constructor(private fb: FormBuilder, private http: HttpClient) {
    this.trustForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      fullName: ['', Validators.required],
      idNumber: ['', Validators.required],
      isSettlor: [false],
      isTrustee: [false],
      trustEmail: ['', [Validators.email]],
      phoneNumber: ['', Validators.required],
      trustName: ['', Validators.required],
      establishmentDate: ['', Validators.required],
      altSettlorName: [''],
      beneficiaries: [''],
      isBullionMember: [false],
      memberNumber: [''],
      wasReferredByMember: [false],
      referrerNumber: [''],

      settlor: this.fb.group({
        name: ['', Validators.required],
        id: ['', Validators.required]
      }),

      trustee1: this.createTrustee(false),
      trustee2: this.createTrustee(false),
      trustee3: this.createTrustee(false),
      trustee4: this.createTrustee(false)
    });

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

  createTrustee(isReadonly = false): FormGroup {
    return this.fb.group({
      name: [{ value: '', disabled: isReadonly }],
      id: [{ value: '', disabled: isReadonly }]
    });
  }

  onFileUpload(role: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.fileMap[role] = file;
      console.log(`Uploaded file for ${role}:`, file.name);
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

async onSubmit(): Promise<void> {
  if (this.trustForm.invalid) {
    this.trustForm.markAllAsTouched();
    return;
  }

  this.loading = true;

  try {
    const rawForm = this.trustForm.getRawValue();
    const amount = rawForm.isBullionMember ? 5 : 7500;
    const amountInCents = amount * 100;

    // 1. Request Yoco payment session + trust ID from backend
    const paymentInit = await this.http.post<any>(
      'https://hongkongbackend.onrender.com/api/payment-session',
      {
        amount_cents: amountInCents,
        trust_data: rawForm
      }
    ).toPromise();

    if (
      !paymentInit ||
      !paymentInit.redirectUrl ||
      !paymentInit.trust_id
    ) {
      throw new Error('Invalid response from backend');
    }

    const trustId = paymentInit.trust_id;

    // 2. Save trust form + uploaded files to sessionStorage
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

    // 3. Optional: UX pause before redirect
    await new Promise((res) => setTimeout(res, 500));

    this.loading = false;

    // 4. Redirect to Yoco-hosted payment page
    window.location.href = paymentInit.redirectUrl;

  } catch (error: any) {
    alert('Error: ' + (error.message || error));
    console.error('🛑 Payment session error:', error);
    this.loading = false;
  }
}


}
