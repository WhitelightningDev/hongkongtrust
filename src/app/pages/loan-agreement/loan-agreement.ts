import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { LoanAgreementService, TrustCore, TrusteeRow } from '../../loan-agreement.service';
import { AuthService } from '../../interceptors/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-loan-agreement',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './loan-agreement.html',
  styleUrls: ['./loan-agreement.css']
})
export class LoanAgreement implements OnInit {

  constructor(private router: Router, private authService: AuthService) {}

  fb = inject(FormBuilder);
  api = inject(LoanAgreementService);

  lookupForm = this.fb.group({
    trust_number: ['', Validators.required],
    user_id: [''] // optional if you disable auth in the proc
  });

  agreementForm = this.fb.group({
    Trust_Number: ['', Validators.required],
    Trust_Name: ['', Validators.required],
    Country: ['', Validators.required],
    Lender_Name: ['', Validators.required],
    Lender_ID: ['', Validators.required],
    Trustee_Name: ['', Validators.required], // signing trustee
    Witness_Name: [''],
    Loan_Date: [this.todayIso(), Validators.required],
    CurrencyCode: ['ZAR', Validators.required],
    Items: this.fb.array<FormGroup>([])
  });

  trustCore: TrustCore | null = null;
  trustees: TrusteeRow[] = [];
  lookupLoading = false;
  lookupError = '';
  saveLoading = false;
  saveError = '';
  createdId: number | null = null;
  docxLoading = false;
  docxError = '';
  docxInfo = '';

  ngOnInit(): void {
    // Ensure at least one empty item row exists initially
    if (this.items.length === 0) this.addItem();
    this.agreementForm.get('Lender_Name')?.valueChanges.subscribe(() => this.syncLenderId());
  }

  get items(): FormArray<FormGroup> {
    return this.agreementForm.get('Items') as FormArray<FormGroup>;
  }

  addItem(data?: { Desc?: string; Type?: string; Val?: number }) {
    this.items.push(this.fb.group({
      Desc: [data?.Desc ?? '', [Validators.maxLength(200)]],
      Type: [data?.Type ?? ''],
      Val: [
        data?.Val ?? null,
        {
          validators: [
            (ctrl: AbstractControl): ValidationErrors | null => (ctrl.value == null || Number(ctrl.value) >= 0) ? null : { min: true }
          ]
        }
      ]
    }));
  }

  removeItem(index: number) {
    this.items.removeAt(index);
  }

  resetAgreement() {
    this.agreementForm.reset({
      Trust_Number: this.trustCore?.trust_number ?? '',
      Trust_Name: this.trustCore?.trust_name ?? '',
      Country: '',
      Lender_Name: this.defaultLenderName(),
      Lender_ID: this.defaultLenderId(),
      Trustee_Name: this.defaultSignerName(),
      Witness_Name: '',
      Loan_Date: this.todayIso(),
      CurrencyCode: 'ZAR'
    });
    // reset items to one empty row
    while (this.items.length) this.items.removeAt(0);
    this.addItem();
    this.saveError = '';
    this.createdId = null;
    this.docxInfo = '';
  }

  onLookup() {
    this.lookupError = '';
    this.trustCore = null;
    this.trustees = [];
    this.createdId = null;

    if (this.lookupForm.invalid) {
      this.lookupForm.markAllAsTouched();
      return;
    }

    const trust_number = this.lookupForm.value.trust_number!;
    const user_id = this.lookupForm.value.user_id || undefined;

    this.lookupLoading = true;
    this.api.getTrust(trust_number, user_id).subscribe({
      next: (res) => {
        this.trustCore = res.core;
        this.trustees = res.trustees ?? [];

        // prefills
        this.agreementForm.patchValue({
          Trust_Number: this.trustCore.trust_number,
          Trust_Name: this.trustCore.trust_name,
          Lender_Name: this.defaultLenderName(),
          Lender_ID: this.defaultLenderId(),
          Trustee_Name: this.defaultSignerName()
        });

        this.lookupLoading = false;
      },
      error: (err) => {
        this.lookupLoading = false;
        this.lookupError = this.msg(err, 'Lookup failed.');
      }
    });
  }

  syncLenderId() {
    const lenderName = this.agreementForm.value.Lender_Name;
    const t = this.trustees.find(x => x.Trustee_Name === lenderName);
    if (t) this.agreementForm.patchValue({ Lender_ID: t.Trustee_ID || '' });
  }

  defaultLenderName(): string {
    const t1 = this.trustees.find(t => t.Trustee_Seq === 1);
    return t1?.Trustee_Name ?? (this.trustees[0]?.Trustee_Name ?? '');
  }
  defaultLenderId(): string {
    const t1 = this.trustees.find(t => t.Trustee_Seq === 1);
    return t1?.Trustee_ID ?? '';
    }
  defaultSignerName(): string {
    const t2 = this.trustees.find(t => t.Trustee_Seq === 2);
    if (t2?.Trustee_Name) return t2.Trustee_Name;
    // fallback to lender or next available
    return this.defaultLenderName() || (this.trustees[1]?.Trustee_Name ?? '');
  }

  private msg(err: any, fallback: string): string {
    // FastAPI usually returns { detail: { message } } or { detail: string }
    if (!err) return fallback;
    const d = err.error ?? err;
    if (typeof d?.detail === 'string') return d.detail;
    if (typeof d?.detail?.message === 'string') return d.detail.message;
    if (typeof d?.message === 'string') return d.message;
    return fallback;
  }

  trusteeNames(): string {
    return (this.trustees || []).map(t => t.Trustee_Name).join(', ');
  }

  private hasAtLeastOnePositiveItem(): boolean {
    return (this.items.value as any[]).some(i => i?.Val != null && Number(i.Val) > 0);
  }

  onSave() {
    this.saveError = '';
    this.createdId = null;

    if (!this.trustCore) {
      this.saveError = 'Please look up a trust first.';
      return;
    }
    if (this.agreementForm.invalid) {
      this.agreementForm.markAllAsTouched();
      return;
    }
    if (!this.hasAtLeastOnePositiveItem()) {
      this.saveError = 'At least one loan item value must be greater than zero.';
      return;
    }

    const v = this.agreementForm.value;

    // Map Items -> proc args Item1..Item6 (backend will accept as flat)
    const flatItems = (this.items.value as any[])
      .slice(0, 6)
      .map((x) => ({
        Desc: x.Desc || null,
        Type: x.Type || null,
        Val: x.Val !== null && x.Val !== undefined ? Number(x.Val) : null
      }));

    // Build payload for the POST /loan-agreements
    const payload = {
      Trust_Number: v.Trust_Number as string,
      User_Id: (this.lookupForm.value.user_id || null) as string | null,
      Trust_Name: v.Trust_Name as string,
      Country: v.Country as string,
      Lender_Name: v.Lender_Name as string,
      Lender_ID: v.Lender_ID as string,
      Trustee_Name: v.Trustee_Name as string,
      Witness_Name: (v.Witness_Name || null) as string | null,
      Loan_Date: v.Loan_Date as string, // ISO date (YYYY-MM-DD)
      CurrencyCode: v.CurrencyCode as string,
      Items: flatItems
    };

    this.saveLoading = true;
    this.api.createLoanAgreement(payload).subscribe({
      next: (res) => {
        this.saveLoading = false;
        this.createdId = res?.Loan_Agreement_ID ?? null;
        this.docxInfo = 'Generating your loan agreement document now. It will be available for download on this page.';
        this.onDownloadDocx();
      },
      error: (err) => {
        this.saveLoading = false;
        this.saveError = this.msg(err, 'Save failed.');
      }
    });
  }

  onDownloadDocx() {
    this.docxError = '';
    if (!this.docxInfo) {
      this.docxInfo = 'Generating your loan agreement document now. It will be available for download on this page.';
    }

    if (!this.trustCore) {
      this.docxError = 'Please look up a trust first.';
      return;
    }
    if (this.agreementForm.invalid) {
      this.agreementForm.markAllAsTouched();
      this.docxError = 'Please complete the required fields before generating the document.';
      return;
    }
    if (!this.hasAtLeastOnePositiveItem()) {
      this.docxError = 'At least one loan item value must be greater than zero.';
      return;
    }

    const v = this.agreementForm.value;
    const flatItems = (this.items.value as any[])
      .slice(0, 6)
      .map((x) => ({
        Desc: x.Desc || null,
        Type: x.Type || null,
        Val: x.Val !== null && x.Val !== undefined ? Number(x.Val) : null
      }));

    const payload = {
      Trust_Number: v.Trust_Number as string,
      User_Id: (this.lookupForm.value.user_id || null) as string | null,
      Trust_Name: v.Trust_Name as string,
      Country: v.Country as string,
      Lender_Name: v.Lender_Name as string,
      Lender_ID: v.Lender_ID as string,
      Trustee_Name: v.Trustee_Name as string,
      Witness_Name: (v.Witness_Name || null) as string | null,
      Loan_Date: v.Loan_Date as string,
      CurrencyCode: v.CurrencyCode as string,
      Items: flatItems
    };

    this.docxLoading = true;
    this.api.generateLoanAgreementDocx(payload).subscribe({
      next: (blob: Blob) => {
        this.docxLoading = false;
        this.docxInfo = 'Your document is being downloaded. If it did not start, please check your browser pop-up/download settings.';
        const tn = (this.trustCore?.trust_number || 'loan').replace(/\//g, '-');
        const a = document.createElement('a');
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.download = `Loan_Agreement_${tn}.docx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      },
      error: (err: any) => {
        this.docxLoading = false;
        this.docxError = this.msg(err, 'Failed to generate document.');
        this.docxInfo = '';
      }
    });
  }

  private todayIso(): string {
    const d = new Date();
    return d.toISOString().slice(0,10);
  }

  goBackToHome(): void {
    this.router.navigate(['/']);
  }
}