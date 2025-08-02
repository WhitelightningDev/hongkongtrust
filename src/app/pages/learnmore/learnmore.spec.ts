import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Learnmore } from './learnmore';

describe('Learnmore', () => {
  let component: Learnmore;
  let fixture: ComponentFixture<Learnmore>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Learnmore]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Learnmore);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
