import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { isPlatformBrowser } from '@angular/common';
import { trigger, transition, style, animate } from '@angular/animations';

interface Ingredient {
  sku: string;
  qty: number;
}

interface Recipe {
  name: string;
  batchSize: number;
  yieldKg: number;
  ingredients: Ingredient[];
}

interface RawMaterial {
  sku: string;
  description: string;
  unitCost: number;
  costPerKg: number;
  category: string;
}

@Component({
  selector: 'app-recipes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recipes.html',
  styleUrls: ['./recipes.css'],
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
export class RecipesComponent implements OnInit {
  recipes: Recipe[] = [];
  rawMaterials: RawMaterial[] = [];
  private platformId = inject(PLATFORM_ID);

  ngOnInit() {
    this.loadRecipes();
    this.loadRawMaterials();
  }

  loadRecipes() {
    const savedRecipes = isPlatformBrowser(this.platformId) ? localStorage.getItem('ctk_recipes') : null;
    if (savedRecipes) {
      this.recipes = JSON.parse(savedRecipes);
    } else {
      // Sample recipes
      this.recipes = [
        {
          name: "Pork BBQ",
          batchSize: 1,
          yieldKg: 25,
          ingredients: [
            { sku: "3498918", qty: 7 },
            { sku: "4474919", qty: 0.8 },
            { sku: "4362771", qty: 0.1 }
          ]
        },
        {
          name: "Chicken Cordon Bleu",
          batchSize: 1,
          yieldKg: 20,
          ingredients: [
            { sku: "3735649", qty: 10 },
            { sku: "4447742", qty: 1 }
          ]
        }
      ];
      this.saveRecipes();
    }
  }

  loadRawMaterials() {
    const savedMaterials = localStorage.getItem('ctk_mats');
    if (savedMaterials) {
      this.rawMaterials = JSON.parse(savedMaterials);
    } else {
      // Sample materials if none exist
      this.rawMaterials = [
        { sku: "3498918", description: "Pork Belly Skinless", unitCost: 310, costPerKg: 310, category: "Pork" },
        { sku: "4362771", description: "AJI Umami Seasoning", unitCost: 459.99, costPerKg: 184, category: "Seasoning" },
        { sku: "4474919", description: "Soy Sauce", unitCost: 285, costPerKg: 57, category: "Condiment" },
        { sku: "3735649", description: "Chicken Breast", unitCost: 280, costPerKg: 280, category: "Chicken" },
        { sku: "4447742", description: "Ham", unitCost: 320, costPerKg: 320, category: "Pork" }
      ];
    }
  }

  addRecipe() {
    this.recipes.push({
      name: "New Recipe",
      batchSize: 1,
      yieldKg: 1,
      ingredients: []
    });
    this.saveRecipes();
  }

  deleteRecipe(index: number) {
    if (confirm('Delete this recipe?')) {
      this.recipes.splice(index, 1);
      this.saveRecipes();
    }
  }

  addIngredient(recipeIndex: number) {
    const fallbackSku = this.rawMaterials.length > 0 ? this.rawMaterials[0].sku : '';
    this.recipes[recipeIndex].ingredients.push({
      sku: fallbackSku,
      qty: 1
    });
    this.saveRecipes();
  }

  deleteIngredient(recipeIndex: number, ingredientIndex: number) {
    this.recipes[recipeIndex].ingredients.splice(ingredientIndex, 1);
    this.saveRecipes();
  }

  onIngredientChange(recipeIndex: number, ingredientIndex: number) {
    this.saveRecipes();
  }

  saveRecipes() {
    localStorage.setItem('ctk_recipes', JSON.stringify(this.recipes));
  }

  getMaterialCost(sku: string): number {
    const material = this.rawMaterials.find(m => m.sku === sku);
    return material ? material.costPerKg : 0;
  }

  calculateIngredientCost(ingredient: Ingredient): number {
    const materialCost = this.getMaterialCost(ingredient.sku);
    return materialCost * (ingredient.qty || 0);
  }

  calculateRecipeCost(recipe: Recipe): number {
    return recipe.ingredients.reduce((total, ingredient) => {
      return total + this.calculateIngredientCost(ingredient);
    }, 0);
  }

  calculateCostPerKg(recipe: Recipe): number {
    if (recipe.yieldKg <= 0) return 0;
    return this.calculateRecipeCost(recipe) / recipe.yieldKg;
  }

  calculateEfficiency(recipe: Recipe): string {
    const baseEfficiency = 85;
    const costPerKg = this.calculateCostPerKg(recipe);
    
    let efficiency = baseEfficiency;
    if (costPerKg > 100) efficiency -= 10;
    if (costPerKg > 200) efficiency -= 15;
    if (costPerKg < 50) efficiency += 10;
    
    return Math.max(70, Math.min(95, efficiency)).toFixed(0);
  }
}