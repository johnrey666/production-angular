import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService, Material } from '../services/supabase.service';

// Define local interface that matches our HTML form
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
  isLoading: boolean = false;
  errorMessage: string = '';
  
  // Modal properties
  showModal: boolean = false;
  isEditing: boolean = false;
  currentMaterial: LocalMaterial = this.createEmptyMaterial();
  
  // Pagination properties
  currentPage: number = 1;
  itemsPerPage: number = 8;
  totalPages: number = 1;
  startIndex: number = 0;
  endIndex: number = 0;

  constructor(
    private supabase: SupabaseService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.loadMaterials();
  }

  async loadMaterials() {
    this.isLoading = true;
    this.errorMessage = '';
    
    // Force immediate UI update
    this.cdr.detectChanges();
    
    // Add a small delay to ensure UI updates
    await new Promise(resolve => setTimeout(resolve, 0));
    
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
        
        this.updatePagination();
      } else {
        this.materials = [];
        this.displayedMaterials = [];
      }
    } catch (error: any) {
      this.errorMessage = 'Failed to load materials. Please try again.';
      this.materials = [];
      this.displayedMaterials = [];
    } finally {
      this.isLoading = false;
      
      // Force UI update after loading completes
      this.cdr.detectChanges();
    }
  }

  // Pagination methods
  updatePagination() {
    this.totalPages = Math.ceil(this.materials.length / this.itemsPerPage);
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
    
    this.startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.endIndex = Math.min(this.startIndex + this.itemsPerPage, this.materials.length);
    this.displayedMaterials = this.materials.slice(this.startIndex, this.endIndex);
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

  // Create empty material template
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

  // Open modal for adding new material
  openAddModal() {
    this.currentMaterial = this.createEmptyMaterial();
    this.isEditing = false;
    this.showModal = true;
    this.cdr.detectChanges();
  }

  // Open modal for editing existing material
  openEditModal(material: LocalMaterial) {
    this.currentMaterial = {
      id: material.id,
      sku: material.sku,
      description: material.description,
      unitCost: material.unitCost,
      costPerKg: material.costPerKg,
      category: material.category,
      currentStock: material.currentStock,
      createdAt: material.createdAt
    };
    this.isEditing = true;
    this.showModal = true;
    this.cdr.detectChanges();
  }

  // Close modal
  closeModal() {
    this.showModal = false;
    this.currentMaterial = this.createEmptyMaterial();
    this.cdr.detectChanges();
  }

  // Save material (both new and edit)
  async saveMaterial() {
    // Validate required fields
    if (!this.currentMaterial.sku || !this.currentMaterial.description) {
      alert('SKU and Description are required fields.');
      return;
    }
    
    // Prepare data for Supabase
    const dbMaterial: Material = {
      sku: this.currentMaterial.sku.trim(),
      description: this.currentMaterial.description.trim(),
      unit_cost: this.currentMaterial.unitCost || 0,
      cost_per_kg: this.currentMaterial.costPerKg || 0,
      category: this.currentMaterial.category || '',
      current_stock: this.currentMaterial.currentStock || 0
    };
    
    // Add ID if editing
    if (this.isEditing && this.currentMaterial.id) {
      dbMaterial.id = this.currentMaterial.id;
    }
    
    try {
      const result = await this.supabase.saveMaterial(dbMaterial);
      
      if (result && result.length > 0) {
        const savedMaterial = result[0];
        
        if (this.isEditing) {
          // Update existing material in the array
          const index = this.materials.findIndex(m => m.id === savedMaterial.id);
          if (index !== -1) {
            this.materials[index] = {
              id: savedMaterial.id,
              sku: savedMaterial.sku,
              description: savedMaterial.description,
              unitCost: savedMaterial.unit_cost,
              costPerKg: savedMaterial.cost_per_kg,
              category: savedMaterial.category,
              currentStock: savedMaterial.current_stock,
              createdAt: savedMaterial.created_at
            };
          }
        } else {
          // Add new material to the array
          this.materials.unshift({
            id: savedMaterial.id,
            sku: savedMaterial.sku,
            description: savedMaterial.description,
            unitCost: savedMaterial.unit_cost,
            costPerKg: savedMaterial.cost_per_kg,
            category: savedMaterial.category,
            currentStock: savedMaterial.current_stock,
            createdAt: savedMaterial.created_at
          });
        }
        
        // Update pagination
        this.updatePagination();
        
        // Close modal and refresh UI
        this.closeModal();
        this.cdr.detectChanges();
      } else {
        alert('Failed to save material. Please try again.');
      }
    } catch (error: any) {
      console.error('Error saving material:', error);
      alert('Error saving material: ' + error.message);
    }
  }

  async deleteMaterial(material: LocalMaterial) {
    // Confirm deletion
    if (!confirm(`Are you sure you want to delete "${material.description}"?`)) {
      return;
    }
    
    try {
      if (material.id) {
        const success = await this.supabase.deleteMaterial(material.id);
        
        if (success) {
          // Remove from local array
          const index = this.materials.findIndex(m => m.id === material.id);
          if (index !== -1) {
            this.materials.splice(index, 1);
            this.updatePagination();
            this.cdr.detectChanges();
          }
        } else {
          alert('Failed to delete material. Please try again.');
        }
      }
    } catch (error: any) {
      alert('Error deleting material: ' + error.message);
    }
  }

  // Refresh data from database
  async refresh() {
    await this.loadMaterials();
  }

  // Calculation methods
  calculateTotalValue() {
    return this.materials.reduce((sum, m) => sum + ((m.unitCost || 0) * (m.currentStock || 0)), 0);
  }

  getLowStockCount() {
    return this.materials.filter(m => (m.currentStock || 0) < 10).length;
  }

  getCategories() {
    return [...new Set(this.materials.map(m => m.category).filter(Boolean))];
  }

getStockStatus(material: any): string {
  if (!material.currentStock || material.currentStock === 0) {
    return 'out-of-stock';
  }
  if (material.currentStock < 5) { // adjust threshold here
    return 'low-stock';
  }
  return 'in-stock';
}

getStockStatusText(material: any): string {
  if (!material.currentStock || material.currentStock === 0) {
    return 'No Stock';
  }
  if (material.currentStock < 5) {
    return 'Low Stock';
  }
  return 'In Stock';
}

}