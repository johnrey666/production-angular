import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService, Material } from '../services/supabase.service';
import * as XLSX from 'xlsx';

interface LocalMaterial {
  id?: string;
  sku: string;
  description: string;
  unitCost: number;
  costPerKg: number;
  category: string;
  currentStock: number;
  createdAt?: string;
}

@Component({
  selector: 'app-raw-materials',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalPipe],
  templateUrl: './raw-materials.html',
  styleUrls: ['./raw-materials.css']
})
export class RawMaterialsComponent implements OnInit {
  materials: LocalMaterial[] = [];
  displayedMaterials: LocalMaterial[] = [];
  allMaterials: LocalMaterial[] = [];

  isLoading = false;
  errorMessage = '';
  loadingMessage = 'Loading materials...'; // Added property

  // Search & Filter
  searchQuery = '';
  selectedFilterCategory = '';

  // Modal
  showModal = false;
  isEditing = false;
  currentMaterial: LocalMaterial = this.createEmptyMaterial();
  selectedCategory = '';
  customCategory = '';

  // Pagination
  currentPage = 1;
  itemsPerPage = 10; // Changed from 5 to match dashboard
  totalPages = 1;
  startIndex = 0;
  endIndex = 0;

  // Page totals
  pageUnitCost = 0; // Added property
  pageCostPerKg = 0; // Added property

  // Snackbar
  snackbarMessage = '';
  snackbarType: 'success' | 'error' | 'warning' | 'info' = 'success';
  snackbarTimeout: any;

  // Current date for display
  currentDate: string = ''; // Added property

  private fixedCategories = [
    'Spices (Vatable)',
    'Meat & Veg (Non VAT)',
    'Packaging',
    'Cleaning Materials',
    'R&D Materials'
  ];

  constructor(
    private supabase: SupabaseService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.setCurrentDate();
    this.loadMaterials();
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

  async loadMaterials() {
    this.isLoading = true;
    this.loadingMessage = 'Loading materials...';
    try {
      const data = await this.supabase.getMaterials();
      if (data && Array.isArray(data)) {
        this.materials = data.map((item: Material) => ({
          id: item.id,
          sku: item.sku || '',
          description: item.description || '',
          unitCost: item.unit_cost || 0,
          costPerKg: item.cost_per_kg || 0,
          category: item.category || '',
          currentStock: item.current_stock || 0,
          createdAt: item.created_at
        }));
        this.allMaterials = [...this.materials];
        this.applyFiltersAndSearch();
        this.calculatePageTotals(); // Calculate initial page totals
      }
    } catch (error: any) {
      this.errorMessage = 'Failed to load materials.';
      this.showSnackbar('Failed to load materials', 'error');
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  applyFiltersAndSearch() {
    let filtered = [...this.allMaterials];

    // Search
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(m =>
        (m.sku?.toLowerCase().includes(q) || false) ||
        (m.description?.toLowerCase().includes(q) || false)
      );
    }

    // Category filter
    if (this.selectedFilterCategory && this.selectedFilterCategory !== '') {
      filtered = filtered.filter(m => m.category === this.selectedFilterCategory);
    }

    this.materials = filtered;
    this.currentPage = 1;
    this.updatePagination();
  }

  get uniqueCategories(): string[] {
    const categories = new Set<string>();
    for (const material of this.allMaterials) {
      if (material && material.category) {
        categories.add(material.category);
      }
    }
    return Array.from(categories).sort();
  }

  updatePagination() {
    this.totalPages = Math.max(Math.ceil(this.materials.length / this.itemsPerPage), 1);
    
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
    
    this.startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.endIndex = Math.min(this.startIndex + this.itemsPerPage, this.materials.length);
    this.displayedMaterials = this.materials.slice(this.startIndex, this.endIndex);
    
    this.calculatePageTotals(); // Recalculate totals when page changes
    this.cdr.detectChanges();
  }

  calculatePageTotals() {
    // Calculate totals for the current displayed page
    this.pageUnitCost = this.displayedMaterials.reduce((sum, item) => sum + (item.unitCost || 0), 0);
    this.pageCostPerKg = this.displayedMaterials.reduce((sum, item) => sum + (item.costPerKg || 0), 0);
  }

  nextPage() { 
    if (this.currentPage < this.totalPages) { 
      this.currentPage++; 
      this.updatePagination(); 
    }
  }
  
  previousPage() { 
    if (this.currentPage > 1) { 
      this.currentPage--; 
      this.updatePagination(); 
    }
  }

  createEmptyMaterial(): LocalMaterial {
    return { 
      sku: '', 
      description: '', 
      unitCost: 0, 
      costPerKg: 0, 
      category: '', 
      currentStock: 0 
    };
  }

  openAddModal() {
    this.currentMaterial = this.createEmptyMaterial();
    this.isEditing = false;
    this.selectedCategory = '';
    this.customCategory = '';
    this.showModal = true;
  }

  openEditModal(material: LocalMaterial) {
    this.currentMaterial = { ...material };
    this.isEditing = true;

    if (this.fixedCategories.includes(material.category)) {
      this.selectedCategory = material.category;
      this.customCategory = '';
    } else {
      this.selectedCategory = 'Others';
      this.customCategory = material.category || '';
    }
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
    this.selectedCategory = '';
    this.customCategory = '';
    this.currentMaterial = this.createEmptyMaterial();
  }

  onCategoryChange() {
    if (this.selectedCategory !== 'Others') {
      this.customCategory = '';
    }
  }

  // Snackbar methods
  showSnackbar(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') {
    // Clear any existing timeout
    if (this.snackbarTimeout) {
      clearTimeout(this.snackbarTimeout);
    }
    
    // Set new message and type
    this.snackbarMessage = message;
    this.snackbarType = type;
    
    // Auto hide after 3 seconds
    this.snackbarTimeout = setTimeout(() => {
      this.hideSnackbar();
    }, 3000);
    
    this.cdr.detectChanges();
  }

  hideSnackbar() {
    this.snackbarMessage = '';
    if (this.snackbarTimeout) {
      clearTimeout(this.snackbarTimeout);
      this.snackbarTimeout = null;
    }
    this.cdr.detectChanges();
  }

  async saveMaterial() {
    if (!this.currentMaterial.sku?.trim() || !this.currentMaterial.description?.trim()) {
      this.showSnackbar('SKU and Description are required', 'warning');
      return;
    }
    if (!this.selectedCategory) {
      this.showSnackbar('Please select a category', 'warning');
      return;
    }

    const finalCategory = this.selectedCategory === 'Others'
      ? (this.customCategory?.trim() || '')
      : this.selectedCategory;

    if (this.selectedCategory === 'Others' && !finalCategory) {
      this.showSnackbar('Please specify the custom category', 'warning');
      return;
    }

    this.currentMaterial.category = finalCategory;

    const dbMaterial: Material = {
      sku: this.currentMaterial.sku.trim(),
      description: this.currentMaterial.description.trim(),
      unit_cost: this.currentMaterial.unitCost || 0,
      cost_per_kg: this.currentMaterial.costPerKg || 0,
      category: finalCategory,
      current_stock: this.currentMaterial.currentStock || 0
    };

    if (this.isEditing && this.currentMaterial.id) {
      dbMaterial.id = this.currentMaterial.id;
    }

    try {
      const result = await this.supabase.saveMaterial(dbMaterial);
      if (result && result.length > 0) {
        const savedMaterial = result[0];
        const localMaterial: LocalMaterial = {
          id: savedMaterial.id,
          sku: savedMaterial.sku || '',
          description: savedMaterial.description || '',
          unitCost: savedMaterial.unit_cost || 0,
          costPerKg: savedMaterial.cost_per_kg || 0,
          category: savedMaterial.category || '',
          currentStock: savedMaterial.current_stock || 0,
          createdAt: savedMaterial.created_at
        };

        if (this.isEditing && this.currentMaterial.id) {
          const index = this.allMaterials.findIndex(m => m.id === this.currentMaterial.id);
          if (index !== -1) {
            this.allMaterials[index] = localMaterial;
          }
          this.showSnackbar(`Material "${this.currentMaterial.sku}" updated successfully`, 'success');
        } else {
          this.allMaterials.unshift(localMaterial);
          this.showSnackbar(`Material "${this.currentMaterial.sku}" added successfully`, 'success');
        }

        this.applyFiltersAndSearch();
        this.closeModal();
      }
    } catch (error: any) {
      console.error('Save error:', error);
      this.showSnackbar(`Failed to ${this.isEditing ? 'update' : 'add'} material`, 'error');
    }
  }

  async deleteMaterial(material: LocalMaterial) {
    if (!confirm(`Are you sure you want to delete "${material.sku}"?`)) return;
    if (!material.id) {
      this.showSnackbar('Cannot delete: Material ID not found', 'error');
      return;
    }

    // Store the sku before deletion for the snackbar
    const deletedSku = material.sku;
    
    try {
      await this.supabase.deleteMaterial(material.id);
      
      // Remove from arrays
      this.allMaterials = this.allMaterials.filter(m => m.id !== material.id);
      
      // Update display immediately
      this.applyFiltersAndSearch();
      
      // Show snackbar immediately
      this.showSnackbar(`Material "${deletedSku}" deleted successfully`, 'error'); // Red for delete
      
    } catch (error: any) {
      console.error('Delete error:', error);
      this.showSnackbar(`Failed to delete material`, 'error');
    }
  }

  async deleteAllMaterials() {
    if (!confirm('⚠️ DELETE EVERYTHING?\nThis will permanently delete ALL raw materials.\nAre you absolutely sure?')) {
      return;
    }
    if (!confirm('LAST CHANCE!\nThis action cannot be undone.\nType "DELETE" to confirm:')) {
      return;
    }
    if (prompt('Type DELETE to confirm:') !== 'DELETE') {
      return;
    }

    this.isLoading = true;
    this.loadingMessage = 'Deleting all materials...';
    try {
      await this.supabase.deleteAllMaterials();
      
      // Clear all arrays
      this.allMaterials = [];
      this.materials = [];
      this.displayedMaterials = [];
      
      // Reset pagination and totals
      this.currentPage = 1;
      this.pageUnitCost = 0;
      this.pageCostPerKg = 0;
      this.updatePagination();
      
      // Show snackbar immediately
      this.showSnackbar('All materials deleted successfully', 'error'); // Red for delete
    } catch (error: any) {
      console.error('Delete all error:', error);
      this.showSnackbar(`Failed to delete all materials`, 'error');
    } finally {
      this.isLoading = false;
    }
  }

  async fileInputChange(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.isLoading = true;
    this.loadingMessage = 'Importing materials...';
    this.cdr.detectChanges();

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      const materialsToImport: Material[] = rows.slice(1)
        .filter((row: any) => row && row.length > 0)
        .map((row: any) => {
          const rawCat = String(row[4] || '').trim().toUpperCase();
          let category = 'Uncategorized';
          
          if (rawCat.includes('SPICES')) category = 'Spices (Vatable)';
          else if (rawCat.includes('MEAT') || rawCat.includes('VEGETABLES')) category = 'Meat & Veg (Non VAT)';
          else if (rawCat.includes('PACKAGING')) category = 'Packaging';
          else if (rawCat.includes('CLEANING')) category = 'Cleaning Materials';
          else if (rawCat.includes('R&D')) category = 'R&D Materials';
          else if (rawCat) category = rawCat;

          return {
            sku: String(row[0] || '').trim(),
            description: String(row[1] || '').trim(),
            unit_cost: parseFloat(row[2]) || 0,
            cost_per_kg: parseFloat(row[3]) || 0,
            category,
            current_stock: 0
          };
        })
        .filter(m => m.sku && m.description);

      if (materialsToImport.length === 0) {
        this.showSnackbar('No valid data found in the Excel file', 'warning');
        return;
      }

      const result = await this.supabase.bulkUpsertMaterials(materialsToImport);
      
      if (result && Array.isArray(result)) {
        const importedLocalMaterials: LocalMaterial[] = result.map((item: Material) => ({
          id: item.id,
          sku: item.sku || '',
          description: item.description || '',
          unitCost: item.unit_cost || 0,
          costPerKg: item.cost_per_kg || 0,
          category: item.category || '',
          currentStock: item.current_stock || 0,
          createdAt: item.created_at
        }));
        
        this.allMaterials = [...importedLocalMaterials, ...this.allMaterials];
        this.applyFiltersAndSearch();
        
        this.showSnackbar(`Successfully imported ${materialsToImport.length} materials`, 'success'); // Green for import
      }
    } catch (error: any) {
      console.error('Import error:', error);
      this.showSnackbar(`Import failed: ${error.message}`, 'error');
    } finally {
      this.isLoading = false;
      event.target.value = '';
    }
  }

  async refresh() {
    this.loadingMessage = 'Refreshing materials...';
    await this.loadMaterials();
  }

  // Helper method to get material type for display
  getMaterialType(): string {
    return 'Raw Material';
  }
}