import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { isPlatformBrowser } from '@angular/common';
import { trigger, transition, style, animate, stagger, query } from '@angular/animations';

interface RawMaterial {
  sku: string;
  description: string;
  unitCost: number;
  costPerKg: number;
  category: string;
  currentStock: number;
  minStockLevel: number;
}

@Component({
  selector: 'app-raw-materials',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './raw-materials.html',
  styleUrls: ['./raw-materials.css'],
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
export class RawMaterialsComponent implements OnInit {
  materials: RawMaterial[] = [];
  private platformId = inject(PLATFORM_ID);

  ngOnInit() {
    this.loadMaterials();
  }

  loadMaterials() {
    // Load from localStorage or API
    const savedData = isPlatformBrowser(this.platformId) ? localStorage.getItem('ctk_mats') : null;
    if (savedData) {
      this.materials = JSON.parse(savedData);
    } else {
      // Sample data
      this.materials = [
        { sku: "4362771", description: "AJI Umami Seasoning 2.5kg×8", unitCost: 459.99, costPerKg: 184, category: "Seasoning", currentStock: 150, minStockLevel: 50 },
        { sku: "3498918", description: "Pork Belly Skinless", unitCost: 310, costPerKg: 310, category: "Pork", currentStock: 85, minStockLevel: 100 },
        { sku: "4236408", description: "Cooking Oil 17kg", unitCost: 1510, costPerKg: 88.8, category: "Oil", currentStock: 200, minStockLevel: 30 },
        { sku: "5129341", description: "Sugar White Refined", unitCost: 68, costPerKg: 68, category: "Sweetener", currentStock: 300, minStockLevel: 100 },
        { sku: "6678210", description: "Soy Sauce 5L", unitCost: 285, costPerKg: 57, category: "Condiment", currentStock: 75, minStockLevel: 25 }
      ];
      this.saveToStorage();
    }
  }

  addMaterial() {
    this.materials.push({
      sku: '',
      description: '',
      unitCost: 0,
      costPerKg: 0,
      category: '',
      currentStock: 0,
      minStockLevel: 0
    });
  }

  saveMaterial(index: number) {
    this.saveToStorage();
  }

  deleteMaterial(index: number) {
    if (confirm('Delete this material?')) {
      this.materials.splice(index, 1);
      this.saveToStorage();
    }
  }

  saveToStorage() {
    localStorage.setItem('ctk_mats', JSON.stringify(this.materials));
  }

  getStockStatus(material: RawMaterial): string {
    if (material.currentStock === 0) {
      return 'status-out-of-stock';
    } else if (material.currentStock <= (material.minStockLevel || 0)) {
      return 'status-low-stock';
    } else {
      return 'status-in-stock';
    }
  }

  getStockStatusText(material: RawMaterial): string {
    if (material.currentStock === 0) {
      return 'Out of Stock';
    } else if (material.currentStock <= (material.minStockLevel || 0)) {
      return 'Low Stock';
    } else {
      return 'In Stock';
    }
  }

  calculateTotalValue(): number {
    return this.materials.reduce((total, material) => {
      return total + (material.unitCost * (material.currentStock || 0));
    }, 0);
  }

  getCategories(): string[] {
    const categories = this.materials.map(m => m.category).filter(Boolean);
    return [...new Set(categories)];
  }

  getLowStockCount(): number {
    return this.materials.filter(material => 
      material.currentStock > 0 && material.currentStock <= (material.minStockLevel || 0)
    ).length;
  }
}