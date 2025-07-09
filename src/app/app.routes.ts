import { Routes } from '@angular/router';
import { Homepage } from './pages/homepage/homepage';
import { Welcomepage } from './pages/welcomepage/welcomepage';

export const routes: Routes = [

  {
    path: "", component: Welcomepage
  },

  {
    path: "homepage", component: Homepage
  }
];
