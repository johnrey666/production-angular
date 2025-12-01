import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate, stagger, query } from '@angular/animations';

interface ProductionEntry {
  product: string;
  batches: number;
  output: number;
}

interface Recipe {
  name: string;
  yieldKg: number;
  ingredients: any[];
}

@Component({
  selector: 'app-production',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './production.html',
  styleUrls: ['./production.css'],
  animations: [
    trigger('fadeInUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(30px)' }),
        animate('600ms cubic-bezier(0.4, 0, 0.2, 1)', 
          style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('slideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(-20px)' }),
        animate('400ms cubic-bezier(0.4, 0, 0.2, 1)', 
          style({ opacity: 1, transform: 'translateX(0)' }))
      ])
    ])
  ]
})
export class ProductionComponent implements OnInit {
  selectedDate: string = '';
  currentDate: string = '';
  currentEntries: ProductionEntry[] = [];
  
  // Sample data - replace with your actual data service
  recipes: Recipe[] = [
    { name: 'Pork BBQ', yieldKg: 25, ingredients: [] },
    { name: 'Chicken Adobo', yieldKg: 20, ingredients: [] },
    { name: 'Beef Caldereta', yieldKg: 18, ingredients: [] },
    { name: 'Fish Escabeche', yieldKg: 15, ingredients: [] }
  ];
  
  rawMaterials: any[] = [];
  productionData: { [key: string]: ProductionEntry[] } = {};

  ngOnInit() {
    this.setToday();
    this.loadDay();
  }

  setToday() {
    const today = new Date();
    this.selectedDate = today.toISOString().split('T')[0];
    this.currentDate = today.toLocaleDateString('en-PH', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  loadDay() {
    // Load entries for selected date
    if (!this.productionData[this.selectedDate]) {
      this.productionData[this.selectedDate] = [];
    }
    this.currentEntries = this.productionData[this.selectedDate];
    this.calculateTotals();
  }

  addRow() {
    this.currentEntries.push({
      product: this.recipes.length > 0 ? this.recipes[0].name : '',
      batches: 1,
      output: 0
    });
    this.calculateTotals();
  }

  onProductChange(index: number) {
    const entry = this.currentEntries[index];
    if (entry.product) {
      // Auto-set batches to 1 when product is selected
      entry.batches = 1;
      this.updateEntry(index);
    }
  }

  updateEntry(index: number) {
    this.calculateTotals();
    // Save to localStorage or service here
    this.saveData();
  }

  deleteEntry(index: number) {
    if (confirm('Delete this entry?')) {
      this.currentEntries.splice(index, 1);
      this.calculateTotals();
      this.saveData();
    }
  }

  getRecipeYield(productName: string): number {
    const recipe = this.recipes.find(r => r.name === productName);
    return recipe?.yieldKg || 0;
  }

  calculateExpectedOutput(entry: ProductionEntry): number {
    const yieldKg = this.getRecipeYield(entry.product);
    return (entry.batches || 0) * yieldKg;
  }

  calculateRawCost(entry: ProductionEntry): number {
    // Simplified calculation - replace with your actual cost logic
    const recipe = this.recipes.find(r => r.name === entry.product);
    if (!recipe) return 0;
    
    // Sample cost calculation - adjust based on your data structure
    const baseCostPerBatch = 1500; // Replace with actual calculation
    return (entry.batches || 0) * baseCostPerBatch;
  }

  calculateVariance(entry: ProductionEntry): number {
    const expected = this.calculateExpectedOutput(entry);
    return (entry.output || 0) - expected;
  }

  getVarianceClass(entry: ProductionEntry): string {
    const variance = this.calculateVariance(entry);
    if (variance > 0) return 'positive';
    if (variance < 0) return 'negative';
    return '';
  }

  calculateCostPerKg(entry: ProductionEntry): string {
    const rawCost = this.calculateRawCost(entry);
    const output = entry.output || 0;
    return output > 0 ? `₱${(rawCost / output).toFixed(1)}` : '-';
  }

  get totalCost(): number {
    return this.currentEntries.reduce((sum, entry) => sum + this.calculateRawCost(entry), 0);
  }

  get totalOutput(): number {
    return this.currentEntries.reduce((sum, entry) => sum + (entry.output || 0), 0);
  }

  calculateAverageCost(): string {
    return this.totalOutput > 0 ? `₱${(this.totalCost / this.totalOutput).toFixed(1)}/kg` : '₱0/kg';
  }

  calculateTotals() {
    // Force change detection
    this.currentEntries = [...this.currentEntries];
  }

  saveData() {
    // Save to localStorage or your data service
    this.productionData[this.selectedDate] = this.currentEntries;
    // localStorage.setItem('ctk_prod', JSON.stringify(this.productionData));
  }
}