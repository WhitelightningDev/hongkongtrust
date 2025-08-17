import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeaseAgreement } from './lease-agreement';

describe('LeaseAgreement', () => {
  let component: LeaseAgreement;
  let fixture: ComponentFixture<LeaseAgreement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeaseAgreement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LeaseAgreement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
