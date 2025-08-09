import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SaleAndCedeAgreementSuccess } from './sale-and-cede-agreement-success';

describe('SaleAndCedeAgreementSuccess', () => {
  let component: SaleAndCedeAgreementSuccess;
  let fixture: ComponentFixture<SaleAndCedeAgreementSuccess>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SaleAndCedeAgreementSuccess]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SaleAndCedeAgreementSuccess);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
