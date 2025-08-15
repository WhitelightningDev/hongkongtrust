import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoanAgreement } from './loan-agreement';

describe('LoanAgreement', () => {
  let component: LoanAgreement;
  let fixture: ComponentFixture<LoanAgreement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoanAgreement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoanAgreement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
