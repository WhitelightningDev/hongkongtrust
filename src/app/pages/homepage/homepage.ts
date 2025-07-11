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
      isSettlor: [false],   // default unchecked
      isTrustee: [false],   // default unchecked
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

      trustees: this.fb.array([
        this.createTrustee(false),
        this.createTrustee(false)
      ])
    });

    // Validators for bullion member number
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

    // Validators for referrer number
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
    // Sync trustEmail if "use my email" is checked
    this.trustForm.get('email')?.valueChanges.subscribe(email => {
      if (this.useUserEmailForTrustEmail) {
        this.trustForm.get('trustEmail')?.setValue(email);
      }
    });
  }

  ngAfterViewInit(): void {
    // Autofill settlor and trustee names and IDs after view init (handle autofill/browser quirks)
    setTimeout(() => {
      const fullName = this.trustForm.get('fullName')?.value;
      const idNumber = this.trustForm.get('idNumber')?.value;

      if (fullName?.trim()) {
        if (!this.trustForm.get('isSettlor')?.value) {
          const settlorNameControl = this.trustForm.get('settlor.name');
          if (settlorNameControl && !settlorNameControl.value?.trim()) {
            settlorNameControl.setValue(fullName, { emitEvent: false });
          }
        }

        if (!this.trustForm.get('isTrustee')?.value) {
          const trusteeNameControl = this.trustees.at(0)?.get('name');
          if (trusteeNameControl && !trusteeNameControl.value?.trim()) {
            trusteeNameControl.setValue(fullName, { emitEvent: false });
          }
        }

        this.trustForm.get('altSettlorName')?.setValue(fullName, { emitEvent: false });
      }

      if (idNumber?.trim()) {
        if (!this.trustForm.get('isSettlor')?.value) {
          const settlorIdControl = this.trustForm.get('settlor.id');
          if (settlorIdControl && !settlorIdControl.value?.trim()) {
            settlorIdControl.setValue(idNumber, { emitEvent: false });
          }
        }

        if (!this.trustForm.get('isTrustee')?.value) {
          const trusteeIdControl = this.trustees.at(0)?.get('id');
          if (trusteeIdControl && !trusteeIdControl.value?.trim()) {
            trusteeIdControl.setValue(idNumber, { emitEvent: false });
          }
        }
      }
    }, 100); // delay for autofill fix
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

  onSettlorCheckboxChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.trustForm.patchValue({ isSettlor: checked });

    const settlorNameControl = this.trustForm.get('settlor.name');
    const settlorIdControl = this.trustForm.get('settlor.id');

    if (checked) {
      const fullName = this.trustForm.get('fullName')?.value || '';
      const idNumber = this.trustForm.get('idNumber')?.value || '';

      settlorNameControl?.setValue(fullName);
      settlorIdControl?.setValue(idNumber);

      settlorNameControl?.disable();
      settlorIdControl?.disable();
    } else {
      settlorNameControl?.enable();
      settlorIdControl?.enable();

      settlorNameControl?.setValue('');
      settlorIdControl?.setValue('');
    }
  }

  onTrusteeCheckboxChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.trustForm.patchValue({ isTrustee: checked });

    const trusteeNameControl = this.firstTrustee.get('name');
    const trusteeIdControl = this.firstTrustee.get('id');

    if (checked) {
      const fullName = this.trustForm.get('fullName')?.value || '';
      const idNumber = this.trustForm.get('idNumber')?.value || '';

      trusteeNameControl?.setValue(fullName);
      trusteeIdControl?.setValue(idNumber);

      trusteeNameControl?.disable();
      trusteeIdControl?.disable();
    } else {
      trusteeNameControl?.enable();
      trusteeIdControl?.enable();

      trusteeNameControl?.setValue('');
      trusteeIdControl?.setValue('');
    }
  }

  onSubmit(): void {
    if (this.trustForm.invalid) {
    this.trustForm.markAllAsTouched(); // show errors
    return; // prevent submission
  }

    this.loading = true;

    const raw = this.trustForm.getRawValue();
    const formData = new FormData();

    // Flattened fields
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

    // Settlor fields
    formData.append('settlor_name', raw.settlor.name);
    formData.append('settlor_id', raw.settlor.id);

    // Trustees as JSON array
    formData.append('trustees', JSON.stringify(raw.trustees));

    // File uploads (mapped by role)
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
        // reset files as well
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
