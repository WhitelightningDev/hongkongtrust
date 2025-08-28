// auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private API_URL = 'https://hongkongbackend.onrender.com';
  private token: string | null = null;
  private refreshing: Promise<void> | null = null;

  constructor(private http: HttpClient) {}

  initAuth(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.get<{ access_token: string }>(`${this.API_URL}/auth/bootstrap`).subscribe({
        next: res => {
          this.token = res.access_token;
          localStorage.setItem('access_token', this.token);
          resolve();
        },
        error: err => reject(err)
      });
    });
  }

  refreshToken(): Promise<void> {
    if (this.refreshing) {
      return this.refreshing;
    }
    this.refreshing = new Promise((resolve, reject) => {
      this.http.get<{ access_token: string }>(`${this.API_URL}/auth/bootstrap`).subscribe({
        next: res => {
          this.token = res.access_token;
          localStorage.setItem('access_token', this.token);
          this.refreshing = null;
          resolve();
        },
        error: err => {
          this.refreshing = null;
          reject(err);
        }
      });
    });
    return this.refreshing;
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('access_token');
    }
    return this.token;
  }

  withTokenRefresh<T>(promise: Promise<T>): Promise<T> {
    return promise.catch(async error => {
      if (error?.status === 401) {
        await this.refreshToken();
        return promise;
      }
      throw error;
    });
  }
}