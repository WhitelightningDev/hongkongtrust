// auth.interceptor.ts
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse, HttpEvent } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { catchError, from, switchMap, throwError, EMPTY } from 'rxjs';

let isRefreshing = false;

export const authInterceptor: HttpInterceptorFn = (req, next): import("rxjs").Observable<HttpEvent<any>> => {
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
      if (error.status === 401 && !isRefreshing) {
        isRefreshing = true;
        return from(authService.refreshToken()).pipe(
          switchMap(() => {
            isRefreshing = false;
            const newToken = authService.getToken();
            if (newToken) {
              const clonedReq = req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } });
              return next(clonedReq);
            }
            return throwError(() => error);
          }),
          catchError(refreshError => {
            isRefreshing = false;
            return throwError(() => refreshError);
          })
        );
      }
      if (error.status === 401 && isRefreshing) {
        // wait until refreshing is done and retry once
        return from(
          new Promise(resolve => {
            const interval = setInterval(() => {
              const newToken = authService.getToken();
              if (newToken) {
                clearInterval(interval);
                resolve(
                  next(req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } }))
                );
              }
            }, 300);
          })
        ).pipe(switchMap(result => result as import("rxjs").Observable<HttpEvent<any>>));
      }
      return throwError(() => error);
    })
  );
};