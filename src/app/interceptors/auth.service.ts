// auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private API_URL = 'https://hongkongbackend.onrender.com';
  private token: string | null = null;
  private expiresAt: number | null = null;
  private refreshing: Promise<void> | null = null;

  constructor(private http: HttpClient) {}

  async initAuth(): Promise<void> {
    try {
      const res = await this.http.get<{ access_token: string; expires_in?: number }>(`${this.API_URL}/auth/bootstrap`).toPromise();
      if (res) {
        this.setToken(res.access_token, res.expires_in);
      }
    } catch (err) {
      return Promise.reject(err);
    }
  }

  async refreshToken(): Promise<void> {
    if (this.refreshing) {
      return this.refreshing;
    }
    this.refreshing = (async () => {
      try {
        const res = await this.http.get<{ access_token: string; expires_in?: number }>(`${this.API_URL}/auth/bootstrap`).toPromise();
        if (res) {
          this.setToken(res.access_token, res.expires_in);
        }
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  private setToken(token: string, expiresIn?: number) {
    this.token = token;
    localStorage.setItem('access_token', token);
    if (expiresIn) {
      this.expiresAt = Date.now() + expiresIn * 1000;
      localStorage.setItem('expires_at', this.expiresAt.toString());
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('access_token');
      const expires = localStorage.getItem('expires_at');
      this.expiresAt = expires ? parseInt(expires, 10) : null;
    }
    if (this.expiresAt && Date.now() > this.expiresAt) {
      // token expired, refresh
      this.refreshToken();
      return null;
    }
    return this.token;
  }

  async withTokenRefresh<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      if (error?.status === 401) {
        await this.refreshToken();
        return fn();
      }
      throw error;
    }
  }
}