import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CryptoSuccess } from './crypto-success';

describe('CryptoSuccess', () => {
  let component: CryptoSuccess;
  let fixture: ComponentFixture<CryptoSuccess>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CryptoSuccess]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CryptoSuccess);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
