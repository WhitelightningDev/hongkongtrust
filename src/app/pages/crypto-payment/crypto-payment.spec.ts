import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CryptoPayment } from './crypto-payment';

describe('CryptoPayment', () => {
  let component: CryptoPayment;
  let fixture: ComponentFixture<CryptoPayment>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CryptoPayment]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CryptoPayment);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
