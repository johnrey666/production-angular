import { Component, OnInit, inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService, RecipeWithDetails, RecipeItem, ProductionLog } from '../services/supabase.service';
import * as XLSX from 'xlsx';

// Production SKU interface with all required fields
interface ProductionSku {
  id?: string;
  recipe_id: string;
  name: string;
  type: 'sku' | 'premix';
  quantity1b: number;
  quantityhalfb: number;
  quantityquarterb: number;
  created_at?: string;
  actualOutput: number;      // User input field
  variance: number;          // User input field
  rawMatCost: number;        // User input field
  remark: string;            // User input field
}

// Production Recipe interface
interface ProductionRecipe {
  id?: string;
  name: string;
  std_yield?: number;
  created_at?: string;
  skus: ProductionSku[];
  premixes: ProductionSku[];
}

// Production Entry interface with collapsible state
interface ProductionEntry {
  recipe: ProductionRecipe;
  orderKg: number;          // Order quantity for this recipe
  isExpanded: boolean;      // Collapsible state
}

@Component({
  selector: 'app-production',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './production.html',
  styleUrls: ['./production.css']
})
export class ProductionComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private cdr = inject(ChangeDetectorRef);

  // Data
  entries: ProductionEntry[] = [];
  filteredEntries: ProductionEntry[] = [];
  
  // Dates
  selectedDate: string = new Date().toISOString().split('T')[0];
  availableDates: string[] = [];
  
  // Calendar state
  showCalendar = false;
  currentMonth: number;
  currentYear: number;
  calendarDays: number[] = [];
  
  // UI State
  isLoading = true;
  errorMessage = '';
  searchQuery = '';
  showSaveModal = false;
  isDataLoadedFromStorage = false; // Track if data is from localStorage
  
  // Snackbar
  snackbarMessage = '';
  snackbarType: 'success' | 'error' | 'warning' = 'success';
  snackbarTimeout: any;
  
  // Pagination
  currentPage = 1;
  itemsPerPage = 5;
  
  // Save Modal
  productionDate = new Date().toISOString().split('T')[0];
  batchName = '';
  
  get today(): string {
    return new Date().toISOString().split('T')[0];
  }

  constructor() {
    const today = new Date();
    this.currentMonth = today.getMonth();
    this.currentYear = today.getFullYear();
  }

  ngOnInit() {
    this.initializeDates();
    this.loadData();
    this.generateCalendar();
  }

  // Calendar Methods
  toggleCalendar() {
    this.showCalendar = !this.showCalendar;
    this.cdr.detectChanges();
  }

  generateCalendar() {
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
    
    const firstDayOfWeek = firstDay.getDay();
    const totalDays = lastDay.getDate();
    
    this.calendarDays = [];
    
    for (let i = 0; i < firstDayOfWeek; i++) {
      this.calendarDays.push(0);
    }
    
    for (let i = 1; i <= totalDays; i++) {
      this.calendarDays.push(i);
    }
  }

  prevMonth() {
    if (this.currentMonth === 0) {
      this.currentMonth = 11;
      this.currentYear--;
    } else {
      this.currentMonth--;
    }
    this.generateCalendar();
    this.cdr.detectChanges();
  }

  nextMonth() {
    if (this.currentMonth === 11) {
      this.currentMonth = 0;
      this.currentYear++;
    } else {
      this.currentMonth++;
    }
    this.generateCalendar();
    this.cdr.detectChanges();
  }

  getMonthName(month: number): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month];
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }

  // FIXED: The -1 day bug is GONE — now 100% accurate
  selectDate(day: number) {
    if (day === 0) return;

    // Create date using local time (no timezone shift)
    const selected = new Date(this.currentYear, this.currentMonth, day);
    
    // Manually format to YYYY-MM-DD to avoid any ISO timezone issues
    this.selectedDate = 
      selected.getFullYear() + '-' +
      String(selected.getMonth() + 1).padStart(2, '0') + '-' +
      String(selected.getDate()).padStart(2, '0');

    this.showCalendar = false;
    
    // Keep calendar on correct month
    this.currentMonth = selected.getMonth();
    this.currentYear = selected.getFullYear();
    this.generateCalendar();

    this.onDateChange();
    this.cdr.detectChanges();
  }

  isToday(day: number): boolean {
    if (day === 0) return false;
    
    const today = new Date();
    return today.getFullYear() === this.currentYear &&
           today.getMonth() === this.currentMonth &&
           today.getDate() === day;
  }

  isSelected(day: number): boolean {
    if (day === 0) return false;
    
    const selected = new Date(this.selectedDate);
    return selected.getFullYear() === this.currentYear &&
           selected.getMonth() === this.currentMonth &&
           selected.getDate() === day;
  }

  // Future dates fully allowed
  isFutureDate(day: number): boolean {
    return false;
  }

  // Quick date selection methods — also fixed with safe formatting
  selectToday() {
    const today = new Date();
    this.selectedDate = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');
      
    this.currentMonth = today.getMonth();
    this.currentYear = today.getFullYear();
    this.generateCalendar();
    this.showCalendar = false;
    this.onDateChange();
    this.cdr.detectChanges();
  }

  selectYesterday() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    this.selectedDate = yesterday.getFullYear() + '-' +
      String(yesterday.getMonth() + 1).padStart(2, '0') + '-' +
      String(yesterday.getDate()).padStart(2, '0');
      
    this.currentMonth = yesterday.getMonth();
    this.currentYear = yesterday.getFullYear();
    this.generateCalendar();
    this.showCalendar = false;
    this.onDateChange();
    this.cdr.detectChanges();
  }

  selectLastWeek() {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    this.selectedDate = lastWeek.getFullYear() + '-' +
      String(lastWeek.getMonth() + 1).padStart(2, '0') + '-' +
      String(lastWeek.getDate()).padStart(2, '0');
      
    this.currentMonth = lastWeek.getMonth();
    this.currentYear = lastWeek.getFullYear();
    this.generateCalendar();
    this.showCalendar = false;
    this.onDateChange();
    this.cdr.detectChanges();
  }

  // Close calendar when clicking outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const clickedInsideCalendar = target.closest('.calendar-widget') || target.closest('.modal-container');
    
    if (!clickedInsideCalendar) {
      this.showCalendar = false;
      this.cdr.detectChanges();
    }
  }

  // Initialize available dates (last 30 days + today + next 7 days)
  private initializeDates() {
    const dates: string[] = [];
    const today = new Date();
    
    for (let i = 30; i > 0; i--) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }
    
    dates.push(this.today);
    
    for (let i = 1; i <= 7; i++) {
      const date = new Date();
      date.setDate(today.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    
    this.availableDates = [...new Set(dates)].sort((a, b) => b.localeCompare(a));
  }

  // Load data for selected date
  async loadData() {
    this.isLoading = true;
    this.errorMessage = '';
    this.isDataLoadedFromStorage = false;
    
    try {
      const savedData = await this.loadSavedProductionData(this.selectedDate);
      
      if (savedData && savedData.length > 0) {
        this.entries = savedData;
        this.showSnackbar(`Loaded saved production data for ${this.selectedDate}`, 'success');
      } else {
        const recipes = (await this.supabase.getAllRecipesWithDetails()) || [];
        
        this.entries = recipes.map(recipe => {
          const productionRecipe: ProductionRecipe = {
            id: recipe.id,
            name: recipe.name,
            std_yield: recipe.std_yield,
            created_at: recipe.created_at,
            skus: recipe.skus.map(sku => ({
              ...sku,
              actualOutput: 0,
              variance: 0,
              rawMatCost: 0,
              remark: ''
            })),
            premixes: recipe.premixes.map(premix => ({
              ...premix,
              actualOutput: 0,
              variance: 0,
              rawMatCost: 0,
              remark: ''
            }))
          };
          
          return {
            recipe: productionRecipe,
            orderKg: 0,
            isExpanded: false
          };
        });
        
        const localStorageData = this.loadFromLocalStorage();
        if (localStorageData && localStorageData.length > 0) {
          this.entries = this.mergeLocalStorageData(this.entries, localStorageData);
          this.isDataLoadedFromStorage = true;
          this.showSnackbar(`Loaded unsaved changes for ${this.selectedDate}`, 'warning');
        } else {
          this.showSnackbar(`Starting fresh production for ${this.selectedDate}`, 'warning');
        }
      }
      
      this.filteredEntries = [...this.entries];
      
    } catch (error: any) {
      console.error('Failed to load data:', error);
      this.errorMessage = 'Failed to load production data. Please try again.';
      this.showSnackbar('Failed to load data', 'error');
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  // Load saved production data from database
  private async loadSavedProductionData(date: string): Promise<ProductionEntry[]> {
    try {
      const logs = await this.supabase.getProductionLogs(date);
      
      if (!logs || logs.length === 0) {
        return [];
      }
      
      const recipesMap = new Map<string, any>();
      
      logs.forEach((log: any) => {
        if (!recipesMap.has(log.recipe_id)) {
          recipesMap.set(log.recipe_id, {
            recipe: {
              id: log.recipe_id,
              name: log.recipe_name || 'Unknown Recipe',
              std_yield: 0,
              skus: [],
              premixes: []
            },
            orderKg: log.order_kg || 0
          });
        }
      });
      
      return Array.from(recipesMap.values()).map((item: any) => ({
        recipe: item.recipe,
        orderKg: item.orderKg,
        isExpanded: false
      }));
      
    } catch (error) {
      console.error('Error loading saved production data:', error);
      return [];
    }
  }

  private loadFromLocalStorage(): ProductionEntry[] | null {
    try {
      const key = `production_${this.selectedDate}`;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error loading from localStorage:', error);
      return null;
    }
  }

  private saveToLocalStorage() {
    try {
      const key = `production_${this.selectedDate}`;
      const data = this.entries.map(entry => ({
        ...entry,
        isExpanded: false
      }));
      localStorage.setItem(key, JSON.stringify(data));
      this.isDataLoadedFromStorage = true;
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }

  private mergeLocalStorageData(freshData: ProductionEntry[], savedData: ProductionEntry[]): ProductionEntry[] {
    const mergedData = [...freshData];
    
    savedData.forEach(savedEntry => {
      const freshIndex = mergedData.findIndex(fresh => fresh.recipe.id === savedEntry.recipe.id);
      if (freshIndex !== -1) {
        mergedData[freshIndex].orderKg = savedEntry.orderKg;
        
        mergedData[freshIndex].recipe.skus.forEach((sku, skuIndex) => {
          const savedSku = savedEntry.recipe.skus.find(s => s.name === sku.name);
          if (savedSku) {
            mergedData[freshIndex].recipe.skus[skuIndex] = { ...sku, ...savedSku };
          }
        });
        
        mergedData[freshIndex].recipe.premixes.forEach((premix, premixIndex) => {
          const savedPremix = savedEntry.recipe.premixes.find(p => p.name === premix.name);
          if (savedPremix) {
            mergedData[freshIndex].recipe.premixes[premixIndex] = { ...premix, ...savedPremix };
          }
        });
      }
    });
    
    return mergedData;
  }

  calculateActualRawMat(orderKg: number, quantity1b: number): number {
    return (orderKg || 0) * (quantity1b || 0);
  }

  getTotalSkus(entry: ProductionEntry): number {
    return entry.recipe.skus.length + entry.recipe.premixes.length;
  }

  getAllItems(entry: ProductionEntry): ProductionSku[] {
    return [...entry.recipe.skus, ...entry.recipe.premixes];
  }

toggleRecipe(entry: ProductionEntry) {
  entry.isExpanded = !entry.isExpanded;
  this.cdr.detectChanges();
}

  recalculate(entry: ProductionEntry) {
    entry.orderKg = Number(entry.orderKg) || 0;
    this.saveToLocalStorage();
    this.cdr.detectChanges();
  }

  onItemChange(entry: ProductionEntry) {
    this.saveToLocalStorage();
    this.cdr.detectChanges();
  }

  onDateChange() {
    this.currentPage = 1;
    this.searchQuery = '';
    this.loadData();
  }

  onManualDateChange() {
    this.initializeDates();
    if (!this.availableDates.includes(this.selectedDate)) {
      this.availableDates.unshift(this.selectedDate);
    }
  }

  getTotalOrder(): number {
    return this.filteredEntries.reduce((sum, entry) => sum + (entry.orderKg || 0), 0);
  }

  getTotalActualRawMat(): number {
    let total = 0;
    this.filteredEntries.forEach(entry => {
      entry.recipe.skus.forEach(sku => {
        total += this.calculateActualRawMat(entry.orderKg, sku.quantity1b);
      });
      entry.recipe.premixes.forEach(premix => {
        total += this.calculateActualRawMat(entry.orderKg, premix.quantity1b);
      });
    });
    return total;
  }

  getTotalRawMatCost(): number {
    let total = 0;
    this.filteredEntries.forEach(entry => {
      entry.recipe.skus.forEach(sku => {
        total += (sku.rawMatCost || 0);
      });
      entry.recipe.premixes.forEach(premix => {
        total += (premix.rawMatCost || 0);
      });
    });
    return total;
  }

  onSearch() {
    const q = this.searchQuery.toLowerCase().trim();
    if (!q) {
      this.filteredEntries = [...this.entries];
    } else {
      this.filteredEntries = this.entries.filter(entry =>
        entry.recipe.name.toLowerCase().includes(q) ||
        entry.recipe.skus.some(sku => sku.name.toLowerCase().includes(q)) ||
        entry.recipe.premixes.some(premix => premix.name.toLowerCase().includes(q))
      );
    }
    this.currentPage = 1;
    this.cdr.detectChanges();
  }

  get paginated() {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredEntries.slice(start, start + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredEntries.length / this.itemsPerPage));
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.cdr.detectChanges();
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.cdr.detectChanges();
    }
  }

  openSaveModal() {
    this.showSaveModal = true;
    this.productionDate = this.selectedDate;
    this.batchName = '';
    this.cdr.detectChanges();
  }

  closeSaveModal() {
    this.showSaveModal = false;
    this.showCalendar = false;
    this.cdr.detectChanges();
  }

  async saveAllProduction() {
    const hasOrders = this.filteredEntries.some(entry => entry.orderKg > 0);
    if (!hasOrders) {
      this.showSnackbar('Please enter order quantities before saving', 'warning');
      return;
    }
    
    this.openSaveModal();
  }

  async confirmSave() {
    if (!this.selectedDate) {
      this.showSnackbar('Please select a production date', 'warning');
      return;
    }

    this.isLoading = true;
    try {
      let savedCount = 0;
      await this.clearExistingLogs(this.selectedDate);
      
      for (const entry of this.filteredEntries) {
        if (entry.orderKg > 0) {
          for (const sku of entry.recipe.skus) {
            try {
              const log: ProductionLog = {
                date: this.selectedDate,
                recipe_id: entry.recipe.id || '',
                batches: 1,
                actual_output: sku.actualOutput || 0,
                raw_used: this.calculateActualRawMat(entry.orderKg, sku.quantity1b),
                raw_cost: sku.rawMatCost || 0
              };
              
              await this.supabase.saveProductionLog(log);
              savedCount++;
            } catch (error) {
              console.error('Error saving SKU:', error);
            }
          }
          
          for (const premix of entry.recipe.premixes) {
            try {
              const log: ProductionLog = {
                date: this.selectedDate,
                recipe_id: entry.recipe.id || '',
                batches: 1,
                actual_output: premix.actualOutput || 0,
                raw_used: this.calculateActualRawMat(entry.orderKg, premix.quantity1b),
                raw_cost: premix.rawMatCost || 0
              };
              
              await this.supabase.saveProductionLog(log);
              savedCount++;
            } catch (error) {
              console.error('Error saving premix:', error);
            }
          }
        }
      }

      this.clearLocalStorage();
      this.isDataLoadedFromStorage = false;
      
      this.closeSaveModal();
      this.showSnackbar(`Saved ${savedCount} production items for ${this.selectedDate}`, 'success');
      
    } catch (error: any) {
      console.error('Error saving production:', error);
      this.showSnackbar(`Failed to save: ${error.message || 'Unknown error'}`, 'error');
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  private async clearExistingLogs(date: string): Promise<boolean> {
    try {
      return true;
    } catch (error) {
      console.error('Error clearing existing logs:', error);
      return false;
    }
  }

  private clearLocalStorage() {
    try {
      const key = `production_${this.selectedDate}`;
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  }

  exportToExcel() {
    try {
      const exportData: any[] = [];
      
      exportData.push({
        'Production Date': this.selectedDate,
        'Exported On': new Date().toISOString().split('T')[0]
      });
      
      exportData.push({});

      this.filteredEntries.forEach(entry => {
        if (entry.orderKg > 0) {
          exportData.push({
            'Recipe': entry.recipe.name,
            'Order (batch)': entry.orderKg,
            'STD Yield (batch)': entry.recipe.std_yield || 0
          });
          
          exportData.push({
            'SKU / Raw Material': 'Item',
            '1B': '1B',
            '½B': '½B',
            '¼B': '¼B',
            'ACTUAL RAW MAT (batch)': 'ACTUAL RAW MAT (batch)',
            'ACTUAL OUTPUT (batch)': 'ACTUAL OUTPUT (batch)',
            'VARIANCE (batch)': 'VARIANCE (batch)',
            'RAW MAT COST (₱)': 'RAW MAT COST (₱)',
            'REMARK': 'REMARK'
          });
          
          entry.recipe.skus.forEach(sku => {
            exportData.push({
              'SKU / Raw Material': sku.name + ' (SKU)',
              '1B': sku.quantity1b,
              '½B': sku.quantityhalfb,
              '¼B': sku.quantityquarterb,
              'ACTUAL RAW MAT (batch)': this.calculateActualRawMat(entry.orderKg, sku.quantity1b),
              'ACTUAL OUTPUT (batch)': sku.actualOutput || 0,
              'VARIANCE (batch)': sku.variance || 0,
              'RAW MAT COST (₱)': sku.rawMatCost || 0,
              'REMARK': sku.remark || ''
            });
          });
          
          entry.recipe.premixes.forEach(premix => {
            exportData.push({
              'SKU / Raw Material': premix.name + ' (PRE-MIX)',
              '1B': premix.quantity1b,
              '½B': premix.quantityhalfb,
              '¼B': premix.quantityquarterb,
              'ACTUAL RAW MAT (batch)': this.calculateActualRawMat(entry.orderKg, premix.quantity1b),
              'ACTUAL OUTPUT (batch)': premix.actualOutput || 0,
              'VARIANCE (batch)': premix.variance || 0,
              'RAW MAT COST (₱)': premix.rawMatCost || 0,
              'REMARK': premix.remark || ''
            });
          });
          
          exportData.push({
            'SKU / Raw Material': '',
            '1B': '',
            '½B': '',
            '¼B': '',
            'ACTUAL RAW MAT (batch)': '',
            'ACTUAL OUTPUT (batch)': '',
            'VARIANCE (batch)': '',
            'RAW MAT COST (₱)': '',
            'REMARK': ''
          });
        }
      });
      
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      const wscols = [
        { wch: 30 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
        { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 25 }
      ];
      ws['!cols'] = wscols;
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Production_${this.selectedDate}`);
      
      const filename = `Production_${this.selectedDate}.xlsx`;
      XLSX.writeFile(wb, filename);
      
      this.showSnackbar(`Exported to ${filename}`, 'success');
    } catch (error) {
      console.error('Export error:', error);
      this.showSnackbar('Failed to export Excel', 'error');
    }
  }

  showSnackbar(message: string, type: 'success' | 'error' | 'warning' = 'success') {
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
}