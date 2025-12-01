import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RawMaterials } from './raw-materials';

describe('RawMaterials', () => {
  let component: RawMaterials;
  let fixture: ComponentFixture<RawMaterials>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RawMaterials]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RawMaterials);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
