import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService, RecipeWithDetails } from '../services/supabase.service';
import * as XLSX from 'xlsx';

interface RawMaterialForm {
  name: string;
  type: 'sku' | 'premix';
  quantity1b: number;
  quantityhalfb: number;
  quantityquarterb: number;
}

interface RecipeForm {
  id?: string;
  name: string;
  sku: string;
  stdYield: number;
  rawMaterials: RawMaterialForm[];
}

interface CombinedMaterial {
  name: string;
  type: 'sku' | 'premix';
  quantity1b: number;
  quantityhalfb: number;
  quantityquarterb: number;
}

@Component({
  selector: 'app-recipes',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './recipes.html',
  styleUrls: ['./recipes.css']
})
export class RecipesComponent implements OnInit {
  recipes: RecipeWithDetails[] = [];
  allRecipes: RecipeWithDetails[] = [];
  
  expandedRecipeId: string | null = null;

  selectedRecipe: RecipeWithDetails | null = null;
  editingRecipe: RecipeForm = this.createEmptyRecipe();

  showDetailsModal = false;
  showRecipeModal = false;
  isLoading = false;
  errorMessage = '';
  loadingMessage = 'Loading recipes...';
  
  currentPage = 1;
  itemsPerPage = 8;
  totalPages = 1;
  startIndex = 0;
  endIndex = 0;

  searchQuery = '';

  snackbarMessage = '';
  snackbarType: 'success' | 'error' | 'warning' | 'info' = 'success';
  snackbarTimeout: any;

  currentDate: string = '';

  constructor(
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.setCurrentDate();
    this.loadRecipes();
  }

  private setCurrentDate() {
    const now = new Date();
    this.currentDate = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  createEmptyRecipe(): RecipeForm {
    return { name: '', sku: '', stdYield: 0, rawMaterials: [] };
  }

  getTotalRawMaterials(recipe: RecipeWithDetails): number {
    return (recipe.skus?.length || 0) + (recipe.premixes?.length || 0);
  }

  getCombinedMaterials(recipe: RecipeWithDetails): CombinedMaterial[] {
    const combined: CombinedMaterial[] = [];
    
    if (recipe.skus) {
      recipe.skus.forEach(sku => {
        combined.push({
          name: sku.name,
          type: 'sku',
          quantity1b: sku.quantity1b || 0,
          quantityhalfb: sku.quantityhalfb || 0,
          quantityquarterb: sku.quantityquarterb || 0
        });
      });
    }
    
    if (recipe.premixes) {
      recipe.premixes.forEach(premix => {
        combined.push({
          name: premix.name,
          type: 'premix',
          quantity1b: premix.quantity1b || 0,
          quantityhalfb: premix.quantityhalfb || 0,
          quantityquarterb: premix.quantityquarterb || 0
        });
      });
    }
    
    return combined;
  }

  toggleRecipeExpand(recipeId: string | undefined) {
    if (!recipeId) return;
    this.expandedRecipeId = this.expandedRecipeId === recipeId ? null : recipeId;
    this.cdr.detectChanges();
  }

  async loadRecipes() {
    this.isLoading = true;
    this.loadingMessage = 'Loading recipes...';
    this.errorMessage = '';
    try {
      const data = await this.supabaseService.getAllRecipesWithDetails();
      this.allRecipes = data || [];
      this.applyFiltersAndPagination();
    } catch (error: any) {
      console.error('Error loading recipes:', error);
      this.errorMessage = 'Failed to load recipes. Please try again.';
      this.showSnackbar('Failed to load recipes', 'error');
      this.allRecipes = [];
      this.recipes = [];
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  applyFiltersAndPagination() {
    let filtered = [...this.allRecipes];

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(recipe =>
        recipe.name.toLowerCase().includes(q) ||
        (recipe.sku && recipe.sku.toLowerCase().includes(q)) ||
        recipe.skus.some(sku => sku.name.toLowerCase().includes(q)) ||
        recipe.premixes.some(premix => premix.name.toLowerCase().includes(q))
      );
    }

    this.totalPages = Math.max(1, Math.ceil(filtered.length / this.itemsPerPage));
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;

    this.startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.endIndex = Math.min(this.startIndex + this.itemsPerPage, filtered.length);
    this.recipes = filtered.slice(this.startIndex, this.endIndex);

    this.cdr.detectChanges();
  }

  onSearchInput() {
    this.currentPage = 1;
    this.expandedRecipeId = null;
    this.applyFiltersAndPagination();
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.expandedRecipeId = null;
      this.applyFiltersAndPagination();
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.expandedRecipeId = null;
      this.applyFiltersAndPagination();
    }
  }

  openAddRecipeModal() {
    this.editingRecipe = this.createEmptyRecipe();
    this.showRecipeModal = true;
  }

  openEditRecipeModal(recipe: RecipeWithDetails) {
    const rawMaterials: RawMaterialForm[] = [];
    
    if (recipe.skus) {
      recipe.skus.forEach(sku => {
        rawMaterials.push({
          name: sku.name,
          type: 'sku',
          quantity1b: sku.quantity1b || 0,
          quantityhalfb: sku.quantityhalfb || 0,
          quantityquarterb: sku.quantityquarterb || 0
        });
      });
    }
    
    if (recipe.premixes) {
      recipe.premixes.forEach(premix => {
        rawMaterials.push({
          name: premix.name,
          type: 'premix',
          quantity1b: premix.quantity1b || 0,
          quantityhalfb: premix.quantityhalfb || 0,
          quantityquarterb: premix.quantityquarterb || 0
        });
      });
    }
    
    this.editingRecipe = {
      id: recipe.id,
      name: recipe.name,
      sku: recipe.sku || '',
      stdYield: recipe.std_yield ?? 0,
      rawMaterials
    };
    this.showRecipeModal = true;
    this.expandedRecipeId = null;
  }

  closeRecipeModal() {
    this.showRecipeModal = false;
    this.editingRecipe = this.createEmptyRecipe();
  }

  viewRecipeDetails(recipe: RecipeWithDetails) {
    this.selectedRecipe = recipe;
    this.showDetailsModal = true;
    this.expandedRecipeId = null;
  }

  closeDetailsModal() {
    this.showDetailsModal = false;
    this.selectedRecipe = null;
  }

  addRawMaterial(type: 'sku' | 'premix') {
    this.editingRecipe.rawMaterials.push({ 
      name: '', 
      type: type,
      quantity1b: 0, 
      quantityhalfb: 0, 
      quantityquarterb: 0 
    });
  }

  removeRawMaterial(index: number) {
    this.editingRecipe.rawMaterials.splice(index, 1);
  }

  isRecipeValid(): boolean {
    const hasValidMaterials = this.editingRecipe.rawMaterials.some(material => material.name.trim() !== '');
    return !!this.editingRecipe.name.trim() &&
           this.editingRecipe.stdYield >= 0 &&
           hasValidMaterials;
  }

  async saveRecipe() {
    if (!this.isRecipeValid()) {
      this.showSnackbar('Please fill in all required fields and add at least one valid raw material', 'warning');
      return;
    }

    this.isLoading = true;
    this.loadingMessage = 'Saving recipe...';
    try {
      const validMaterials = this.editingRecipe.rawMaterials.filter(material => material.name.trim() !== '');
      
      const skus = validMaterials
        .filter(material => material.type === 'sku')
        .map(material => ({
          id: undefined,
          recipe_id: this.editingRecipe.id || '',
          name: material.name.trim(),
          type: 'sku' as const,
          quantity1b: material.quantity1b || 0,
          quantityhalfb: material.quantityhalfb || 0,
          quantityquarterb: material.quantityquarterb || 0,
          created_at: undefined
        }));
      
      const premixes = validMaterials
        .filter(material => material.type === 'premix')
        .map(material => ({
          id: undefined,
          recipe_id: this.editingRecipe.id || '',
          name: material.name.trim(),
          type: 'premix' as const,
          quantity1b: material.quantity1b || 0,
          quantityhalfb: material.quantityhalfb || 0,
          quantityquarterb: material.quantityquarterb || 0,
          created_at: undefined
        }));

      const recipeData: RecipeWithDetails = {
        id: this.editingRecipe.id,
        name: this.editingRecipe.name.trim(),
        sku: this.editingRecipe.sku?.trim() || null,
        std_yield: this.editingRecipe.stdYield,
        batch_size: 1,
        yield_kg: 0,
        created_at: undefined,
        skus,
        premixes
      };

      const result = await this.supabaseService.saveRecipeWithItems(recipeData);
      if (result) {
        await this.loadRecipes();
        this.closeRecipeModal();
        this.showSnackbar(`Recipe "${this.editingRecipe.name}" saved successfully`, 'success');
      }
    } catch (error: any) {
      console.error('Error saving recipe:', error);
      this.showSnackbar(`Failed to save recipe: ${error.message || 'Unknown error'}`, 'error');
    } finally {
      this.isLoading = false;
    }
  }

  async deleteRecipe(recipeId: string | undefined, recipeName?: string) {
    if (!recipeId || !confirm(`Are you sure you want to delete "${recipeName}"?`)) return;

    this.isLoading = true;
    this.loadingMessage = 'Deleting recipe...';
    try {
      const success = await this.supabaseService.deleteRecipe(recipeId);
      if (success) {
        await this.loadRecipes();
        this.showSnackbar(`Recipe "${recipeName}" deleted`, 'error');
      }
    } catch (error: any) {
      console.error('Delete error:', error);
      this.showSnackbar('Failed to delete recipe', 'error');
    } finally {
      this.isLoading = false;
    }
  }

  async deleteAllRecipes() {
    if (!confirm('DELETE ALL RECIPES?\nThis will permanently delete EVERY recipe and all raw materials.\nAre you sure?')) return;
    if (!confirm('THIS IS IRREVERSIBLE!\nAll recipe data will be gone forever.\nStill proceed?')) return;
    const confirmation = prompt('Type "DELETE ALL" to confirm:');
    if (confirmation !== 'DELETE ALL') {
      this.showSnackbar('Delete all cancelled', 'warning');
      return;
    }

    this.isLoading = true;
    this.loadingMessage = 'Deleting all recipes...';
    try {
      const success = await this.supabaseService.deleteAllRecipes();
      if (success) {
        this.allRecipes = [];
        this.recipes = [];
        this.currentPage = 1;
        this.expandedRecipeId = null;
        this.showSnackbar('All recipes deleted successfully', 'error');
      }
    } catch (error: any) {
      this.showSnackbar('Error deleting all recipes', 'error');
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  async fileInputChange(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.isLoading = true;
    this.loadingMessage = 'Importing recipes...';
    this.showSnackbar('Importing recipes from Excel...', 'info');

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      const recipesToImport = this.parseRepeatedProductNameExcel(rows.slice(1));

      if (recipesToImport.length === 0) {
        this.showSnackbar('No valid recipes found in the file', 'warning');
        return;
      }

      let imported = 0;
      for (const recipe of recipesToImport) {
        try {
          const rawMaterials: RawMaterialForm[] = [];
          
          recipe.skus.forEach((sku: any) => {
            rawMaterials.push({
              name: sku.name,
              type: 'sku',
              quantity1b: sku.quantity1b || 0,
              quantityhalfb: sku.quantityhalfb || 0,
              quantityquarterb: sku.quantityquarterb || 0
            });
          });
          
          recipe.premixes.forEach((premix: any) => {
            rawMaterials.push({
              name: premix.name,
              type: 'premix',
              quantity1b: premix.quantity1b || 0,
              quantityhalfb: premix.quantityhalfb || 0,
              quantityquarterb: premix.quantityquarterb || 0
            });
          });
          
          const payload: RecipeWithDetails = {
            name: recipe.name.trim(),
            sku: recipe.sku || null,
            std_yield: recipe.stdYield,
            batch_size: 1,
            yield_kg: 0,
            skus: recipe.skus.map((s: any) => ({ ...s, type: 'sku' as const })),
            premixes: recipe.premixes.map((p: any) => ({ ...p, type: 'premix' as const }))
          };
          
          await this.supabaseService.saveRecipeWithItems(payload);
          imported++;
        } catch (err) {
          console.error(`Failed to import: ${recipe.name}`, err);
        }
      }

      await this.loadRecipes();
      this.showSnackbar(`Successfully imported ${imported} recipe(s)!`, 'success');
    } catch (error: any) {
      console.error('Import failed:', error);
      this.showSnackbar(`Import failed: ${error.message || 'Unknown error'}`, 'error');
    } finally {
      this.isLoading = false;
      event.target.value = '';
    }
  }

  private parseRepeatedProductNameExcel(rows: any[][]): any[] {
    const recipeMap = new Map<string, any>();

    for (const row of rows) {
      if (!row || row.length < 8) continue;

      const productName = String(row[0] || '').trim();
      if (!productName) continue;

      const sku = String(row[1] || '').trim();
      const typeCell = String(row[2] || '').trim().toLowerCase();
      const itemName = String(row[3] || '').trim();
      if (!itemName) continue;

      const qty1b = parseFloat(row[4]) || 0;
      const qtyHalf = parseFloat(row[5]) || 0;
      const qtyQuarter = parseFloat(row[6]) || 0;
      const stdYield = parseFloat(row[7]) || 0;

      if (!recipeMap.has(productName)) {
        recipeMap.set(productName, {
          name: productName,
          sku: sku,
          stdYield: stdYield,
          skus: [],
          premixes: []
        });
      }

      const recipe = recipeMap.get(productName)!;
      const item = {
        name: itemName,
        quantity1b: qty1b,
        quantityhalfb: qtyHalf,
        quantityquarterb: qtyQuarter
      };

      if (typeCell === 'premix' || typeCell.includes('premix')) {
        recipe.premixes.push(item);
      } else {
        recipe.skus.push(item);
      }
    }

    return Array.from(recipeMap.values()).filter(r =>
      r.skus.length > 0 || r.premixes.length > 0
    );
  }

  showSnackbar(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') {
    if (this.snackbarTimeout) clearTimeout(this.snackbarTimeout);
    this.snackbarMessage = message;
    this.snackbarType = type;
    this.snackbarTimeout = setTimeout(() => this.hideSnackbar(), 4000);
    this.cdr.detectChanges();
  }

  hideSnackbar() {
    this.snackbarMessage = '';
    this.cdr.detectChanges();
  }

  refresh() {
    this.loadingMessage = 'Refreshing recipes...';
    this.loadRecipes();
  }
}