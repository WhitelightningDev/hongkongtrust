import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SaleAndCedeAgreement } from './sale-and-cede-agreement';

describe('SaleAndCedeAgreement', () => {
  let component: SaleAndCedeAgreement;
  let fixture: ComponentFixture<SaleAndCedeAgreement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SaleAndCedeAgreement]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SaleAndCedeAgreement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
