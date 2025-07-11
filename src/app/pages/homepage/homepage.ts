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

    // Validators for Bullion Member
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

    // Validators for Referrer
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

 onSubmit(): void {
  if (this.trustForm.invalid) {
    this.trustForm.markAllAsTouched();
    return;
  }

  this.loading = true;
  const raw = this.trustForm.getRawValue();
  const formData = new FormData();

  formData.append('full_name', raw.fullName);
  formData.append('id_number', raw.idNumber);
  formData.append('email', raw.email);
  formData.append('phone_number', raw.phoneNumber);
  formData.append('trust_email', raw.trustEmail || '');
  formData.append('trust_name', raw.trustName);
  formData.append('establishment_date', raw.establishmentDate);
  formData.append('beneficiaries', raw.beneficiaries || '');
  formData.append('is_bullion_member', raw.isBullionMember ? 'true' : 'false');
  formData.append('member_number', raw.memberNumber || '');
  formData.append('was_referred_by_member', raw.wasReferredByMember ? 'true' : 'false');
  formData.append('referrer_number', raw.referrerNumber || '');

  // Settlor
  formData.append('settlor_name', raw.settlor.name);
  formData.append('settlor_id', raw.settlor.id);

  // Trustees — prepare JSON array
  const trusteesArray = [];

  if (raw.trustee1.name || raw.trustee1.id) {
    trusteesArray.push({ name: raw.trustee1.name, id: raw.trustee1.id });
  }
  if (raw.trustee2.name || raw.trustee2.id) {
    trusteesArray.push({ name: raw.trustee2.name, id: raw.trustee2.id });
  }
  if (raw.trustee3.name || raw.trustee3.id) {
    trusteesArray.push({ name: raw.trustee3.name, id: raw.trustee3.id });
  }
  if (raw.trustee4.name || raw.trustee4.id) {
    trusteesArray.push({ name: raw.trustee4.name, id: raw.trustee4.id });
  }

  formData.append('trustees', JSON.stringify(trusteesArray));

  // Files
  Object.entries(this.fileMap).forEach(([role, file]) => {
    formData.append('documents', file, file.name);
  });

  this.http.post('http://localhost:8000/submit-trust', formData).subscribe({
    next: () => {
      this.loading = false;
      this.showSuccessPopup = true;
      setTimeout(() => this.showSuccessPopup = false, 4000);
      this.trustForm.reset();
      this.fileMap = {};
      this.uploadedFiles = [];
    },
    error: (err) => {
      this.loading = false;
      console.error('❌ Submission error:', err);
      alert('Error submitting form. See console for details.');
    }
  });
}

}
