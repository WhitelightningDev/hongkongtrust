// auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private token: string | null = null;
  private refreshing: Promise<void> | null = null;

  constructor(private http: HttpClient) {}

  initAuth(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.get<{ access_token: string }>('/auth/bootstrap').subscribe({
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
      this.http.get<{ access_token: string }>('/auth/bootstrap').subscribe({
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

  async getToken(): Promise<string | null> {
    if (!this.token) {
      const storedToken = localStorage.getItem('access_token');
      if (storedToken) {
        this.token = storedToken;
      } else {
        await this.refreshToken();
      }
    }
    return this.token;
  }

  async withTokenRefresh<T>(promise: Promise<T>): Promise<T> {
    try {
      return await promise;
    } catch (error: any) {
      if (error?.status === 401) {
        await this.refreshToken();
        return promise;
      }
      throw error;
    }
  }
}