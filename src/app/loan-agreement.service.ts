import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface TrustCore {
  trust_number: string;
  trust_name: string;
  full_name?: string;
  id_number?: string;
  email?: string;
  phone_number?: string;
  trust_email?: string;
  member_number?: string;
  referrer_number?: string;
  submitted_at?: string;
  status?: string;
  payment_status?: string;
  payment_method?: string;
  payment_amount?: number;
  payment_currency?: string;
  payment_timestamp?: string;
}
export interface TrusteeRow {
  Trustee_Seq: number;
  Trustee_Name: string;
  Trustee_ID: string | null;
}
export interface TrustLookupResponse {
  core: TrustCore;
  trustees: TrusteeRow[];
}

@Injectable({ providedIn: 'root' })
export class LoanAgreementService {
  private http = inject(HttpClient);
  // Backend lives on Render
  private baseUrl = 'https://hongkongbackend.onrender.com/api';
  private trustsBaseUrl = 'https://hongkongbackend.onrender.com/trusts';

  getTrust(trust_number: string, user_id?: string): Observable<TrustLookupResponse> {
    const params = new URLSearchParams();
    if (user_id) params.set('user_id', user_id);
    params.set('_ts', Date.now().toString());
    const qs = params.toString();
    const url = `${this.trustsBaseUrl}/${encodeURIComponent(trust_number)}${qs ? '?' + qs : ''}`;
    return this.http.get<any>(url, {
      headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
    }).pipe(
      map((raw: any): TrustLookupResponse => {
        const core: TrustCore = {
          trust_number: raw.trust_number,
          trust_name: raw.trust_name,
          full_name: raw.full_name,
          id_number: raw.id_number,
          email: raw.email,
          phone_number: raw.phone_number,
          trust_email: raw.trust_email,
          member_number: raw.member_number,
          referrer_number: raw.referrer_number,
          submitted_at: raw.submitted_at,
          status: raw.status,
          payment_status: raw.payment_status,
          payment_method: raw.payment_method,
          payment_amount: raw.payment_amount,
          payment_currency: raw.payment_currency,
          payment_timestamp: raw.payment_timestamp,
        };

        const trustees: TrusteeRow[] = [];
        const pushIf = (seq: number, name: any, id: any) => {
          const n = (name ?? '').toString().trim();
          const i = (id ?? '').toString().trim();
          if (n) trustees.push({ Trustee_Seq: seq, Trustee_Name: n, Trustee_ID: i || null });
        };
        pushIf(1, raw.trustee1_name, raw.trustee1_id);
        pushIf(2, raw.trustee2_name, raw.trustee2_id);
        pushIf(3, raw.trustee3_name, raw.trustee3_id);
        pushIf(4, raw.trustee4_name, raw.trustee4_id);

        return { core, trustees } as TrustLookupResponse;
      })
    );
  }

  createLoanAgreement(payload: {
    Trust_Number: string;
    User_Id: string | null;
    Trust_Name: string;
    Country: string;
    Lender_Name: string;
    Lender_ID: string;
    Trustee_Name: string;
    Witness_Name: string | null;
    Loan_Date: string; // YYYY-MM-DD
    CurrencyCode: string;
    Items: { Desc: string | null; Type: string | null; Val: number | null }[];
  }): Observable<{ Loan_Agreement_ID: number }> {
    return this.http.post<{ Loan_Agreement_ID: number }>(`${this.baseUrl}/loan-agreements`, payload);
  }
}