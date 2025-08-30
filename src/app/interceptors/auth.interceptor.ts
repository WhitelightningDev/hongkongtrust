// auth.interceptor.ts
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { catchError, from, switchMap, throwError, Observable } from 'rxjs';

let isRefreshing = false;
let pendingRequests: Array<(req: HttpRequest<any>) => void> = [];

export const authInterceptor: HttpInterceptorFn = (req, next): Observable<HttpEvent<any>> => {
  const authService = inject(AuthService);
  // Skip adding Authorization for bootstrap requests
  if (!req.url.includes('/auth/bootstrap')) {
    const token = localStorage.getItem('access_token');
    if (token) {
      req = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` }
      });
    }
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        if (!isRefreshing) {
          isRefreshing = true;
          return from(authService.refreshToken()).pipe(
            switchMap(() => {
              isRefreshing = false;
              const newToken = authService.getToken();
              if (newToken) {
                // Replay all pending requests with the new token
                pendingRequests.forEach(retry => retry(req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } })));
                pendingRequests = [];
                const clonedReq = req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } });
                return next(clonedReq);
              } else {
                // No new token, clear pending requests and throw error
                pendingRequests = [];
                localStorage.removeItem('access_token');
                return throwError(() => error);
              }
            }),
            catchError(refreshError => {
              isRefreshing = false;
              pendingRequests = [];
              localStorage.removeItem('access_token');
              return throwError(() => refreshError);
            })
          );
        } else {
          // Refresh in progress, queue the request
          return new Observable<HttpEvent<any>>(observer => {
            pendingRequests.push((clonedReq: HttpRequest<any>) => {
              next(clonedReq).subscribe({
                next: event => observer.next(event),
                error: err => observer.error(err),
                complete: () => observer.complete()
              });
            });
          });
        }
      }
      return throwError(() => error);
    })
  );
};