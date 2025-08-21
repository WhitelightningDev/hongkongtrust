import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditTrust } from './edit-trust';

describe('EditTrust', () => {
  let component: EditTrust;
  let fixture: ComponentFixture<EditTrust>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditTrust]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditTrust);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
