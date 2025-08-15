import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
  // Set your backend base URL:
  private baseUrl = '/api'; // e.g. http://localhost:8000/api
  private trustsBaseUrl = '/trusts'; // trust lookup router is mounted at /trusts

  getTrust(trust_number: string, user_id?: string): Observable<TrustLookupResponse> {
    const params = new URLSearchParams();
    if (user_id) params.set('user_id', user_id);
    params.set('_ts', Date.now().toString()); // cache-buster to avoid 304 with empty body
    const qs = params.toString();
    const url = `${this.trustsBaseUrl}/${encodeURIComponent(trust_number)}${qs ? '?' + qs : ''}`;
    return this.http.get<TrustLookupResponse>(url, {
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
    });
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