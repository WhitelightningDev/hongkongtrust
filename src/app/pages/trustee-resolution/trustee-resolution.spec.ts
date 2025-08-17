import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TrusteeResolution } from './trustee-resolution';

describe('TrusteeResolution', () => {
  let component: TrusteeResolution;
  let fixture: ComponentFixture<TrusteeResolution>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrusteeResolution]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TrusteeResolution);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
