import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService, RecipeWithDetails } from '../services/supabase.service';
import * as XLSX from 'xlsx';

interface SkuForm {
  name: string;
  quantity1b: number;
  quantityhalfb: number;
  quantityquarterb: number;
}

interface PremixForm {
  name: string;
  quantity1b: number;
  quantityhalfb: number;
  quantityquarterb: number;
}

interface RecipeForm {
  id?: string;
  name: string;
  stdYield: number;
  skus: SkuForm[];
  premixes: PremixForm[];
}

@Component({
  selector: 'app-recipes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recipes.html',
  styleUrls: ['./recipes.css']
})
export class RecipesComponent implements OnInit {
  // Original arrays
  recipes: RecipeWithDetails[] = [];           // ← This is what the table displays (filtered + paginated)
  allRecipes: RecipeWithDetails[] = [];        // ← Full dataset from Supabase

  selectedRecipe: RecipeWithDetails | null = null;
  editingRecipe: RecipeForm = this.createEmptyRecipe();

  showDetailsModal = false;
  showRecipeModal = false;
  isLoading = false;
  errorMessage = '';

  searchQuery = '';

  snackbarMessage = '';
  snackbarType: 'success' | 'error' | 'warning' | 'info' = 'success';
  snackbarTimeout: any;

  // Pagination
  currentPage = 1;
  itemsPerPage = 5;
  totalPages = 1;

  private supabaseService = inject(SupabaseService);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit() {
    this.loadRecipes();
  }

  createEmptyRecipe(): RecipeForm {
    return { name: '', stdYield: 0, skus: [], premixes: [] };
  }

  async loadRecipes() {
    this.isLoading = true;
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

  // NEW: Combined search + pagination
  applyFiltersAndPagination() {
    let filtered = [...this.allRecipes];

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(recipe =>
        recipe.name.toLowerCase().includes(q) ||
        recipe.skus.some(sku => sku.name.toLowerCase().includes(q)) ||
        recipe.premixes.some(premix => premix.name.toLowerCase().includes(q))
      );
    }

    this.totalPages = Math.max(1, Math.ceil(filtered.length / this.itemsPerPage));
    if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;

    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    this.recipes = filtered.slice(start, end);

    this.cdr.detectChanges();
  }

  // Call this from search input
  onSearchInput() {
    this.currentPage = 1;
    this.applyFiltersAndPagination();
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.applyFiltersAndPagination();
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.applyFiltersAndPagination();
    }
  }

  openAddRecipeModal() {
    this.editingRecipe = this.createEmptyRecipe();
    this.showRecipeModal = true;
  }

  openEditRecipeModal(recipe: RecipeWithDetails) {
    this.editingRecipe = {
      id: recipe.id,
      name: recipe.name,
      stdYield: recipe.std_yield ?? 0,
      skus: recipe.skus.map(s => ({
        name: s.name,
        quantity1b: s.quantity1b || 0,
        quantityhalfb: s.quantityhalfb || 0,
        quantityquarterb: s.quantityquarterb || 0
      })),
      premixes: recipe.premixes.map(p => ({
        name: p.name,
        quantity1b: p.quantity1b || 0,
        quantityhalfb: p.quantityhalfb || 0,
        quantityquarterb: p.quantityquarterb || 0
      }))
    };
    this.showRecipeModal = true;
  }

  closeRecipeModal() {
    this.showRecipeModal = false;
    this.editingRecipe = this.createEmptyRecipe();
  }

  viewRecipeDetails(recipe: RecipeWithDetails) {
    this.selectedRecipe = recipe;
    this.showDetailsModal = true;
  }

  closeDetailsModal() {
    this.showDetailsModal = false;
    this.selectedRecipe = null;
  }

  addSku() {
this.editingRecipe.skus.push({ name: '', quantity1b: 0, quantityhalfb: 0, quantityquarterb: 0 });  }

  removeSku(index: number) {
    this.editingRecipe.skus.splice(index, 1);
  }

  addPremix() {
    this.editingRecipe.premixes.push({ name: '', quantity1b: 0, quantityhalfb: 0, quantityquarterb: 0 });
  }

  removePremix(index: number) {
    this.editingRecipe.premixes.splice(index, 1);
  }

  isRecipeValid(): boolean {
    const hasValidSkus = this.editingRecipe.skus.some(sku => sku.name.trim() !== '');
    const hasValidPremixes = this.editingRecipe.premixes.some(premix => premix.name.trim() !== '');
    return !!this.editingRecipe.name.trim() &&
           this.editingRecipe.stdYield >= 0 &&
           (hasValidSkus || hasValidPremixes);
  }

  async saveRecipe() {
    if (!this.isRecipeValid()) {
      this.showSnackbar('Please fill in all required fields and add at least one valid SKU or Premix', 'warning');
      return;
    }

    this.isLoading = true;
    try {
      const validSkus = this.editingRecipe.skus.filter(sku => sku.name.trim() !== '');
      const validPremixes = this.editingRecipe.premixes.filter(premix => premix.name.trim() !== '');

      const recipeData: RecipeWithDetails = {
        id: this.editingRecipe.id,
        name: this.editingRecipe.name.trim(),
        std_yield: this.editingRecipe.stdYield,
        batch_size: 1,
        yield_kg: 0,
        created_at: undefined,
        skus: validSkus.map(sku => ({
          id: undefined,
          recipe_id: this.editingRecipe.id || '',
          name: sku.name.trim(),
          type: 'sku' as const,
          quantity1b: sku.quantity1b || 0,
          quantityhalfb: sku.quantityhalfb || 0,
          quantityquarterb: sku.quantityquarterb || 0,
          created_at: undefined
        })),
        premixes: validPremixes.map(premix => ({
          id: undefined,
          recipe_id: this.editingRecipe.id || '',
          name: premix.name.trim(),
          type: 'premix' as const,
          quantity1b: premix.quantity1b || 0,
          quantityhalfb: premix.quantityhalfb || 0,
          quantityquarterb: premix.quantityquarterb || 0,
          created_at: undefined
        }))
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

  async deleteRecipe(recipeId?: string, recipeName?: string) {
    if (!recipeId || !confirm(`Are you sure you want to delete "${recipeName}"?`)) return;

    this.isLoading = true;
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
    if (!confirm('DELETE ALL RECIPES?\nThis will permanently delete EVERY recipe and all SKUs/premixes.\nAre you sure?')) return;
    if (!confirm('THIS IS IRREVERSIBLE!\nAll recipe data will be gone forever.\nStill proceed?')) return;
    const confirmation = prompt('Type "DELETE ALL" to confirm:');
    if (confirmation !== 'DELETE ALL') {
      this.showSnackbar('Delete all cancelled', 'warning');
      return;
    }

    this.isLoading = true;
    try {
      const success = await this.supabaseService.deleteAllRecipes();
      if (success) {
        this.allRecipes = [];
        this.recipes = [];
        this.currentPage = 1;
        this.showSnackbar('All recipes deleted successfully', 'error');
      }
    } catch (error: any) {
      this.showSnackbar('Error deleting all recipes', 'error');
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  // FINAL CORRECT IMPORT — REPEATED PRODUCT NAME STYLE
  async fileInputChange(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.isLoading = true;
    this.showSnackbar('Importing recipes from Excel...', 'info');

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      const recipesToImport = this.parseRepeatedProductNameExcel(rows.slice(1)); // skip header

      if (recipesToImport.length === 0) {
        this.showSnackbar('No valid recipes found in the file', 'warning');
        return;
      }

      let imported = 0;
      for (const recipe of recipesToImport) {
        try {
          const payload: RecipeWithDetails = {
            name: recipe.name.trim(),
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
      if (!row || row.length < 7) continue;

      const productName = String(row[0] || '').trim();
      if (!productName) continue;

      const typeCell = String(row[1] || '').trim().toLowerCase();
      const itemName = String(row[2] || '').trim();
      if (!itemName) continue;

      const qty1b = parseFloat(row[3]) || 0;
      const qtyHalf = parseFloat(row[4]) || 0;
      const qtyQuarter = parseFloat(row[5]) || 0;
      const stdYield = parseFloat(row[6]) || 0;

      if (!recipeMap.has(productName)) {
        recipeMap.set(productName, {
          name: productName,
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
    this.loadRecipes();
  }
}