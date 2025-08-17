import { Routes } from '@angular/router';
import { Homepage } from './pages/homepage/homepage';
import { Welcomepage } from './pages/welcomepage/welcomepage';
import { SuccessComponent } from './pages/success/success';
import { CryptoPayment } from './pages/crypto-payment/crypto-payment';
import { CryptoSuccess } from './pages/crypto-success/crypto-success';
import { Pricing } from './pages/pricing/pricing';
import { Learnmore } from './pages/learnmore/learnmore';
import { Downloads } from './pages/downloads/downloads';
import { Contact } from './pages/contact/contact';
import { SaleAndCedeAgreement } from './pages/sale-and-cede-agreement/sale-and-cede-agreement';
import { SaleAndCedeAgreementSuccessComponent } from './pages/sale-and-cede-agreement-success/sale-and-cede-agreement-success';
import { TestingPage } from './pages/testing-page/testing-page';
import { LoanAgreement } from './pages/loan-agreement/loan-agreement';
import { LeaseAgreement } from './pages/lease-agreement/lease-agreement';
import { TrusteeResolution } from './pages/trustee-resolution/trustee-resolution';



export const routes: Routes = [
  // {
  //   path: '', component: TestingPage
  // },
  {
    path: '',
    component: Welcomepage,
  },

  {
    path: 'homepage',
    component: Homepage,
  },

  {
    path: 'success',
    component: SuccessComponent,
  },
  {
    path: 'lease-agreement', component: LeaseAgreement
  },
  {
path: 'trustee-resolution', component: TrusteeResolution
  },
  {
    path: 'loan-agreement', component: LoanAgreement
  },

  {
    path: 'crypto-payment', component: CryptoPayment
  },
  {
    path: 'crypto-success', component: CryptoSuccess
  },
  {
    path: 'HKFT-Pricing', component: Pricing
  },
  {
    path: 'Learnmore', component: Learnmore
  },
  {
    path: 'Downloads', component: Downloads
  },
  {
    path: 'contact', component: Contact
  },
  {
    path: 'sale-and-cede-agreement', component: SaleAndCedeAgreement
  },
  {
    path: 'sale-cede/success', component: SaleAndCedeAgreementSuccessComponent
  },
  { path: 'agreements/sale-cede/success', component: SaleAndCedeAgreementSuccessComponent },
  { path: '**', redirectTo: '' },
  
];
