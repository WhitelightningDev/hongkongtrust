// auth.interceptor.ts
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { catchError, from, switchMap, throwError, EMPTY } from 'rxjs';

let isRefreshing = false;

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn) => {
  const authService = inject(AuthService);
  const token = localStorage.getItem('access_token');

  if (token) {
    req = req.clone({
      setHeaders: {
        ...req.headers.keys().reduce((acc, key) => {
          acc[key] = req.headers.getAll(key) || [];
          return acc;
        }, {} as Record<string, string | string[]>),
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isRefreshing) {
        isRefreshing = true;
        return from(authService.refreshToken()).pipe(
          switchMap(() => {
            isRefreshing = false;
            const newToken = authService.getToken();
            const clonedReq = newToken
              ? req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } })
              : req;
            return next(clonedReq);
          }),
          catchError(refreshError => {
            isRefreshing = false;
            return throwError(() => refreshError);
          })
        );
      }
      if (error.status === 401 && isRefreshing) {
        // drop the request if a refresh is already happening
        return EMPTY;
      }
      return throwError(() => error);
    })
  );
};