import { Component, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-homepage',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './homepage.html',
  styleUrls: ['./homepage.css']
})
export class Homepage implements OnInit {
  trustForm: FormGroup;
  minDate: string = new Date().toISOString().split('T')[0];
  uploadedFiles: File[] = [];
  fileMap: { [key: string]: File } = {};
  useUserEmailForTrustEmail = false;

  constructor(private fb: FormBuilder) {
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
      trustees: this.fb.array([
        this.createTrustee(true),  // Trustee 1 (readonly)
        this.createTrustee(false)  // Trustee 2
      ])
    });

    // Sync fullName to altSettlorName and trustee[0].name
    this.trustForm.get('fullName')!.valueChanges.subscribe(name => {
      this.trustForm.get('altSettlorName')!.setValue(name, { emitEvent: false });
      this.trustees.at(0).get('name')!.setValue(name, { emitEvent: false });
    });

    // Sync idNumber to trustee[0].id
    this.trustForm.get('idNumber')!.valueChanges.subscribe(id => {
      this.trustees.at(0).get('id')!.setValue(id, { emitEvent: false });
    });
  }

  ngOnInit() {
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

    const formData = new FormData();
    Object.entries(this.trustForm.value).forEach(([key, value]) => {
      if (key === 'trustees') {
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, value as string);
      }
    });

    // Append bulk files (general uploads)
    this.uploadedFiles.forEach((file, index) => {
      formData.append(`documents[${index}]`, file, file.name);
    });

    // Append per-role documents
    Object.entries(this.fileMap).forEach(([role, file]) => {
      formData.append(`document_${role}`, file, file.name);
    });

    console.log('Form submitted:', this.trustForm.value);
    console.log('General Files:', this.uploadedFiles);
    console.log('Individual Documents:', this.fileMap);
  }
}
