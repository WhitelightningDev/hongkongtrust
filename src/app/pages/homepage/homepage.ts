import { Component, OnInit } from '@angular/core';
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
export class Homepage implements OnInit {
  trustForm: FormGroup;
  minDate: string = new Date().toISOString().split('T')[0];
  uploadedFiles: File[] = [];
  fileMap: { [key: string]: File } = {};
  useUserEmailForTrustEmail = false;

  // Controls loading spinner and blur overlay visibility
  loading = false;

  // Controls success popup visibility
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
      trustees: this.fb.array([
        this.createTrustee(true),
        this.createTrustee(false)
      ])
    });

    this.trustForm.get('fullName')!.valueChanges.subscribe(name => {
      this.trustForm.get('altSettlorName')!.setValue(name, { emitEvent: false });
      this.trustees.at(0).get('name')!.setValue(name, { emitEvent: false });
    });

    this.trustForm.get('idNumber')!.valueChanges.subscribe(id => {
      this.trustees.at(0).get('id')!.setValue(id, { emitEvent: false });
    });

    this.trustForm.get('isBullionMember')!.valueChanges.subscribe((isMember: boolean) => {
      const memberNumberControl = this.trustForm.get('memberNumber')!;
      if (isMember) {
        memberNumberControl.setValidators([
          Validators.required,
          Validators.pattern(/^BB\d{6}$/i)
        ]);
      } else {
        memberNumberControl.clearValidators();
      }
      memberNumberControl.updateValueAndValidity();
    });
  }

  ngOnInit(): void {
    this.trustForm.get('email')?.valueChanges.subscribe(email => {
      if (this.useUserEmailForTrustEmail) {
        this.trustForm.get('trustEmail')?.setValue(email);
      }
    });
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

    this.loading = true; // Show spinner & blur overlay

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

    formData.append('trustees', JSON.stringify(raw.trustees));

    Object.entries(this.fileMap).forEach(([role, file]) => {
      formData.append('documents', file, file.name);
    });

    this.uploadedFiles.forEach(file => {
      formData.append('documents', file, file.name);
    });

    this.http.post('http://localhost:8000/submit-trust', formData).subscribe({
      next: (res) => {
        this.loading = false;        // Hide spinner & blur
        this.showSuccessPopup = true;

        setTimeout(() => {
          this.showSuccessPopup = false;
        }, 4000);

        this.trustForm.reset();
      },
      error: (err) => {
        this.loading = false;        // Hide spinner & blur
        console.error('❌ Submission error:', err);
        alert('Error submitting form. See console for details.');
      }
    });
  }
}
