import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RawMaterialsComponent } from './raw-materials';   // ← fixed
import { SupabaseService } from '../services/supabase.service';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';

describe('RawMaterialsComponent', () => {
  let component: RawMaterialsComponent;
  let fixture: ComponentFixture<RawMaterialsComponent>;

  const fakeSupabase = {
    getMaterials: () => Promise.resolve([]),
    saveMaterial: () => Promise.resolve([{ id: '1' }]),
    deleteMaterial: () => Promise.resolve(true)
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormsModule, RawMaterialsComponent],   // standalone component
      providers: [
        DecimalPipe,
        { provide: SupabaseService, useValue: fakeSupabase }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RawMaterialsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});