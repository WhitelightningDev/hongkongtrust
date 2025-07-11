import { Component, OnInit, AfterViewInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
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
      isSettlor: [true],
      isTrustee: [false],
      trustEmail: ['', [Validators.email]],
      phoneNumber: ['', Validators.required],
      trustName: ['', Validators.required],
      establishmentDate: ['', Validators.required],
      altSettlorName: [''],
      beneficiaries: [''],
      isBullionMember: [false],
      memberNumber: [''],

      settlor: this.fb.group({
        name: ['', Validators.required],
        id: ['', Validators.required]
      }),

      trustees: this.fb.array([
        this.createTrustee(false),
        this.createTrustee(false)
      ])
    });

    this.trustForm.get('fullName')!.valueChanges.subscribe(name => {
      const settlorName = this.trustForm.get('settlor.name')!;
      if (!settlorName.value) settlorName.setValue(name, { emitEvent: false });

      const trusteeName = this.trustees.at(0).get('name')!;
      if (!trusteeName.value) trusteeName.setValue(name, { emitEvent: false });

      this.trustForm.get('altSettlorName')!.setValue(name, { emitEvent: false });
    });

    this.trustForm.get('idNumber')!.valueChanges.subscribe(id => {
      const settlorId = this.trustForm.get('settlor.id')!;
      if (!settlorId.value) settlorId.setValue(id, { emitEvent: false });

      const trusteeId = this.trustees.at(0).get('id')!;
      if (!trusteeId.value) trusteeId.setValue(id, { emitEvent: false });
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
      }
      memberNumber.updateValueAndValidity();
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
  // Workaround for browser autofill after Angular's view initialization
  setTimeout(() => {
    const fullName = this.trustForm.get('fullName')?.value;
    const idNumber = this.trustForm.get('idNumber')?.value;

    // Autofill Settlor and Trustee 1 Full Name
    if (fullName?.trim()) {
      const settlorNameControl = this.trustForm.get('settlor.name');
      const trusteeNameControl = this.trustees.at(0)?.get('name');

      if (settlorNameControl && !settlorNameControl.value?.trim()) {
        settlorNameControl.setValue(fullName, { emitEvent: false });
      }

      if (trusteeNameControl && !trusteeNameControl.value?.trim()) {
        trusteeNameControl.setValue(fullName, { emitEvent: false });
      }

      this.trustForm.get('altSettlorName')?.setValue(fullName, { emitEvent: false });
    }

    // Autofill Settlor and Trustee 1 ID
    if (idNumber?.trim()) {
      const settlorIdControl = this.trustForm.get('settlor.id');
      const trusteeIdControl = this.trustees.at(0)?.get('id');

      if (settlorIdControl && !settlorIdControl.value?.trim()) {
        settlorIdControl.setValue(idNumber, { emitEvent: false });
      }

      if (trusteeIdControl && !trusteeIdControl.value?.trim()) {
        trusteeIdControl.setValue(idNumber, { emitEvent: false });
      }
    }
  }, 500); // Adjust delay if needed for autofill timing
}


  get trustees(): FormArray {
    return this.trustForm.get('trustees') as FormArray;
  }

  get firstTrustee(): FormGroup {
    return this.trustees.at(0) as FormGroup;
  }

  get secondTrustee(): FormGroup {
    return this.trustees.at(1) as FormGroup;
  }

  createTrustee(isReadonly = false): FormGroup {
    return this.fb.group({
      name: [{ value: '', disabled: isReadonly }, Validators.required],
      id: [{ value: '', disabled: isReadonly }, Validators.required]
    });
  }

  addTrustee(): void {
    this.trustees.push(this.createTrustee(false));
  }

  onFileUpload(role: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.fileMap[role] = file;
      console.log(`Uploaded file for ${role}:`, file.name);
    }
  }

  onFileChange(event: any): void {
    if (event.target.files && event.target.files.length > 0) {
      this.uploadedFiles = Array.from(event.target.files);
    }
  }

  toggleUseUserEmailForTrustEmail(event: Event): void {
    this.useUserEmailForTrustEmail = (event.target as HTMLInputElement).checked;

    if (this.useUserEmailForTrustEmail) {
      const userEmail = this.trustForm.get('email')?.value || '';
      this.trustForm.get('trustEmail')?.setValue(userEmail);
      this.trustForm.get('trustEmail')?.disable();
    } else {
      this.trustForm.get('trustEmail')?.enable();
      this.trustForm.get('trustEmail')?.setValue('');
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

    formData.append('settlor', JSON.stringify(raw.settlor));
    formData.append('trustees', JSON.stringify(raw.trustees));

    Object.entries(this.fileMap).forEach(([role, file]) => {
      formData.append('documents', file, file.name);
    });

    this.uploadedFiles.forEach(file => {
      formData.append('documents', file, file.name);
    });

    this.http.post('http://localhost:8000/submit-trust', formData).subscribe({
      next: () => {
        this.loading = false;
        this.showSuccessPopup = true;

        setTimeout(() => {
          this.showSuccessPopup = false;
        }, 4000);

        this.trustForm.reset();
      },
      error: (err) => {
        this.loading = false;
        console.error('❌ Submission error:', err);
        alert('Error submitting form. See console for details.');
      }
    });
  }
}
