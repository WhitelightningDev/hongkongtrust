import { Component, OnInit, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LoanAgreementService, TrustCore, TrusteeRow } from '../../loan-agreement.service';

@Component({
  selector: 'app-loan-agreement',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './loan-agreement.html',
  styleUrls: ['./loan-agreement.css']
})
export class LoanAgreement implements OnInit {

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

  ngOnInit(): void {
    // Ensure at least one empty item row exists initially
    if (this.items.length === 0) this.addItem();
  }

  get items(): FormArray<FormGroup> {
    return this.agreementForm.get('Items') as FormArray<FormGroup>;
  }

  addItem(data?: { Desc?: string; Type?: string; Val?: number }) {
    this.items.push(this.fb.group({
      Desc: [data?.Desc ?? ''],
      Type: [data?.Type ?? ''],
      Val: [data?.Val ?? null]
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
        this.lookupError = err?.error?.message || err?.message || 'Lookup failed.';
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
  trusteeNames(): string {
    return (this.trustees || []).map(t => t.Trustee_Name).join(', ');
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
      },
      error: (err) => {
        this.saveLoading = false;
        this.saveError = err?.error?.message || err?.message || 'Save failed.';
      }
    });
  }

  private todayIso(): string {
    const d = new Date();
    return d.toISOString().slice(0,10);
  }
}