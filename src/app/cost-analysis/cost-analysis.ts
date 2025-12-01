import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';

interface Ingredient {
  materialIndex: number;
  quantity: number;
}

interface ProductCost {
  name: string;
  cost: number;
}

@Component({
  selector: 'app-cost-analysis',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cost-analysis.html',
  styleUrls: ['./cost-analysis.css'],
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
export class CostAnalysisComponent implements OnInit {
  recipeName: string = '';
  recipeIngredients: Ingredient[] = [];
  totalRecipeCost: number = 0;
  
  // Summary data
  totalRawCost: number = 892450;
  avgCostPerKg: number = 313;
  highestCostProduct: string = 'Pork BBQ';
  netVariance: number = 12.4;
  
  rawMaterials: any[] = [];
  productCosts: ProductCost[] = [];

  ngOnInit() {
    this.loadRawMaterials();
    this.loadProductionData();
    this.addIngredientRow(); // Start with one empty row
  }

  loadRawMaterials() {
    const savedMaterials = localStorage.getItem('ctk_mats');
    if (savedMaterials) {
      this.rawMaterials = JSON.parse(savedMaterials);
    } else {
      // Sample data
      this.rawMaterials = [
        { sku: "3498918", description: "Pork Belly Skinless", costPerKg: 310 },
        { sku: "4362771", description: "AJI Umami Seasoning", costPerKg: 184 },
        { sku: "4474919", description: "Soy Sauce", costPerKg: 57 },
        { sku: "4236408", description: "Cooking Oil", costPerKg: 88.8 },
        { sku: "5129341", description: "Sugar White Refined", costPerKg: 68 }
      ];
    }
  }

  loadProductionData() {
    // Load and calculate production data
    const savedProduction = localStorage.getItem('ctk_prod');
    const today = new Date().toISOString().split('T')[0];
    
    if (savedProduction) {
      const productionData = JSON.parse(savedProduction);
      const todayData = productionData[today] || [];
      
      // Calculate product costs (simplified)
      this.productCosts = [
        { name: 'Pork BBQ', cost: 345000 },
        { name: 'Chicken Adobo', cost: 287000 },
        { name: 'Beef Caldereta', cost: 260450 }
      ];
    }
  }

  addIngredientRow() {
    this.recipeIngredients.push({
      materialIndex: -1,
      quantity: 0
    });
  }

  removeIngredient(index: number) {
    this.recipeIngredients.splice(index, 1);
    this.calculateRecipeCost();
  }

  onMaterialChange(index: number) {
    this.calculateRecipeCost();
  }

  calculateRecipeCost() {
    this.totalRecipeCost = this.recipeIngredients.reduce((total, ingredient) => {
      return total + this.calculateIngredientTotalCost(ingredient);
    }, 0);
  }

  calculateIngredientTotalCost(ingredient: Ingredient): number {
    if (ingredient.materialIndex === -1) return 0;
    const material = this.rawMaterials[ingredient.materialIndex];
    const costPerKg = material?.costPerKg || 0;
    return (ingredient.quantity || 0) * costPerKg;
  }

  getMaterialCostPerKg(materialIndex: number): number {
    if (materialIndex === -1) return 0;
    return this.rawMaterials[materialIndex]?.costPerKg || 0;
  }

  calculateCostPerKg(): number {
    // Simple estimation - in real app, you'd have yield data
    return this.totalRecipeCost / 10; // Assuming 10kg yield for calculation
  }

  getCostPercentage(cost: number): number {
    const total = this.productCosts.reduce((sum, product) => sum + product.cost, 0);
    return total > 0 ? (cost / total) * 100 : 0;
  }

  calculateEfficiency(): number {
    // Simplified efficiency calculation
    return 85 + Math.random() * 10;
  }

  calculateWasteReduction(): number {
    // Simplified waste reduction calculation
    return 78 + Math.random() * 15;
  }

  getCostRecommendation(): string {
    if (this.totalRecipeCost > 5000) {
      return "Consider optimizing ingredient quantities or sourcing alternative materials to reduce costs.";
    } else if (this.totalRecipeCost < 2000) {
      return "Cost efficiency is good. Focus on maintaining quality while exploring bulk purchasing options.";
    } else {
      return "Current cost structure is optimal. Monitor market prices for potential savings.";
    }
  }
}