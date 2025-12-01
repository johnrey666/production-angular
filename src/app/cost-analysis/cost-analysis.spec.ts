import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CostAnalysis } from './cost-analysis';

describe('CostAnalysis', () => {
  let component: CostAnalysis;
  let fixture: ComponentFixture<CostAnalysis>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CostAnalysis]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CostAnalysis);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
