import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { SupabaseService } from '../services/supabase.service';

interface ReportItem {
  id?: string;
  store: string;
  sku: string;
  description: string;
  type: string;
  um: string;
  price: number;
  storeOrder: number;
  delivered: number;
  undelivered: number;
  fillRate: number;
  remarks: string;
  weekStartDate: string; // Added: Start date of the week (YYYY-MM-DD)
  weekEndDate: string;   // Added: End date of the week (YYYY-MM-DD)
  weekNumber: number;    // Added: Week number (1-52/53)
  year: number;          // Added: Year
  created_at?: string;
}

interface AggregatedItem {
  sku: string;
  description: string;
  type: string;
  um: string;
  price: number;
  totalStoreOrder: number;
  totalDelivered: number;
  totalUndelivered: number;
  fillRate: number;
  storeCount: number;
  remarks: string;
  stores: string[];
  weekStartDate: string;
  weekEndDate: string;
  weekNumber: number;
  year: number;
}

interface DatabaseReportItem {
  id?: string;
  store: string;
  sku: string;
  description: string;
  type: string;
  um: string;
  price: number;
  store_order: number;
  delivered: number;
  undelivered: number;
  fill_rate: number;
  remarks: string;
  week_start_date: string;
  week_end_date: string;
  week_number: number;
  year: number;
  created_at?: string;
  updated_at?: string;
}

interface WeekOption {
  label: string;
  weekStartDate: string;
  weekEndDate: string;
  weekNumber: number;
  year: number;
}

interface SkuCatalogItem {
  id?: string;
  sku: string;
  description: string;
  um?: string;
  price?: number;
  type?: string;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.html',
  styleUrls: ['./reports.css']
})
export class ReportsComponent implements OnInit {
  // Store management
  selectedStore: string = '';
  newStoreName: string = '';
  predefinedStores: string[] = [
    'DRG-FG EXP',
    'MBT-FG EXP', 
    'PIO-FG EXP',
    'IRO-FG EXP',
    'TA-FTG',
    'LC-FTG',
    'LC-FG',
    'NG-FG',
    'LC-CN',
    'LC-CN Hall',
    'TA-CN'
  ];
  customStores: string[] = [];
  allStores: string[] = ['All', ...this.predefinedStores];
  
  // Week management
  selectedWeek: WeekOption | null = null;
  availableWeeks: WeekOption[] = [];
  showWeekSelector = false;
  
  // Date range for current week (if no week selected)
  currentWeekStartDate: string;
  currentWeekEndDate: string;
  currentWeekNumber: number;
  currentYear: number;
  
  // Product types
  productTypes: string[] = [
    'Finished Goods',
    'Raw Materials',
    'Packaging',
    'Semi-Finished',
    'Others'
  ];
  
  // Data management
  allReportData: Map<string, ReportItem[]> = new Map();
  displayedData: ReportItem[] = [];
  aggregatedData: AggregatedItem[] = [];
  displayedAggregatedData: AggregatedItem[] = [];
  showAggregatedView = false;
  
  // UI State
  isLoading = false;
  errorMessage = '';
  searchQuery = '';
  loadingMessage = '';
  loadingProgress = '';
  isInitializing = false;
  
  // Modal State
  showModal = false;
  isEditing = false;
  currentProduct: ReportItem = this.createEmptyProduct();

  // SKU catalog + flags
  skuCatalog: SkuCatalogItem[] = [];
  isLoadingCatalog = false;
  isSavingData = false;
  
  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;
  startIndex = 0;
  endIndex = 0;
  
  // Snackbar
  snackbarMessage = '';
  snackbarType: 'success' | 'error' | 'warning' | 'info' = 'success';
  snackbarTimeout: any;

  constructor(
    private cdr: ChangeDetectorRef,
    private supabase: SupabaseService
  ) {
    // Initialize current week
    const currentWeek = this.getCurrentWeek();
    this.currentWeekStartDate = currentWeek.weekStartDate;
    this.currentWeekEndDate = currentWeek.weekEndDate;
    this.currentWeekNumber = currentWeek.weekNumber;
    this.currentYear = currentWeek.year;
    
    // Set selected week to current week by default
    this.selectedWeek = {
      label: `Week ${currentWeek.weekNumber}, ${currentWeek.year} (${this.formatDate(currentWeek.weekStartDate)} - ${this.formatDate(currentWeek.weekEndDate)})`,
      ...currentWeek
    };
  }

  ngOnInit() {
    this.testDatabaseConnection().then(success => {
      if (success) {
        this.loadSkuCatalog().then(() => this.loadReportsFromDatabase());
      }
    });
  }

  // SKU catalog loader
  async loadSkuCatalog() {
    this.isLoadingCatalog = true;
    try {
      const { data, error } = await this.supabase['supabase']
        .from('sku_catalog')
        .select('*')
        .order('sku');

      if (error) {
        console.error('Error loading SKU catalog:', error);
        // If table doesn't exist, create it (best-effort) and seed defaults
        if (error.code === '42P01') {
          this.showSnackbar('SKU catalog table not found. Creating it (local seed)...', 'info');
          await this.createSkuCatalogTable();
          await this.insertDefaultSkus();
          this.skuCatalog = this.skuCatalog || [];
        } else {
          this.showSnackbar('Error loading SKU catalog: ' + (error.message || ''), 'error');
        }
        return;
      }

      this.skuCatalog = (data || []) as SkuCatalogItem[];
    } catch (err) {
      console.error('Unexpected error loading SKU catalog:', err);
    } finally {
      this.isLoadingCatalog = false;
    }
  }

  async createSkuCatalogTable() {
    // Best-effort informational stub. Creating DB objects programmatically
    // is environment-specific; we seed local catalog instead.
    console.log('createSkuCatalogTable: called (stub)');
    this.showSnackbar('Created SKU catalog (local seed)', 'info');
  }

  async insertDefaultSkus() {
    // Seed a small set of SKUs locally so UI is usable even without DB
    this.skuCatalog = [
      { sku: '4362771', description: 'AJI Umami Seasoning 2.5kg×8', um: 'kg', price: 459.99, type: 'Seasoning' },
      { sku: '3498918', description: 'Pork Belly Skinless', um: 'kg', price: 310, type: 'Pork' },
      { sku: '4236408', description: 'Cooking Oil 17kg', um: 'L', price: 1510, type: 'Oil' }
    ];
    this.showSnackbar('Default SKU catalog seeded locally', 'info');
  }

  onSkuSelect(sku: string) {
    const item = this.skuCatalog.find(i => i.sku === sku);
    if (!item) return;
    this.currentProduct.sku = item.sku;
    this.currentProduct.description = item.description;
    if (item.um) this.currentProduct.um = item.um;
    if (item.price) this.currentProduct.price = item.price;
    if (item.type) this.currentProduct.type = item.type;
  }

  // Initialize week with all SKUs (minimal implementation)
  async initializeWeekWithAllSkus() {
    if (!this.selectedStore || this.selectedStore === 'custom' || this.selectedStore === 'All') {
      this.showSnackbar('Please select a specific store first', 'warning');
      return;
    }

    if (!this.selectedWeek) {
      this.showSnackbar('Please select a week first', 'warning');
      return;
    }

    if (this.skuCatalog.length === 0) {
      this.showSnackbar('SKU catalog is empty. Please load SKUs first.', 'warning');
      return;
    }

    if (!confirm(`Initialize Week ${this.selectedWeek.weekNumber}, ${this.selectedWeek.year} for ${this.selectedStore} with all SKUs?`)) {
      return;
    }

    this.isInitializing = true;
    this.loadingMessage = 'Initializing week with all SKUs...';
    this.loadingProgress = '';
    try {
      // Minimal behavior: create local entries only (no heavy DB ops here)
      const storeData = this.allReportData.get(this.selectedStore) || [];
      for (const skuItem of this.skuCatalog) {
        const exists = storeData.some(p => p.sku === skuItem.sku && p.weekStartDate === this.selectedWeek!.weekStartDate && p.weekEndDate === this.selectedWeek!.weekEndDate);
        if (exists) continue;
        const newItem: ReportItem = {
          store: this.selectedStore,
          sku: skuItem.sku,
          description: skuItem.description,
          type: skuItem.type || 'Finished Goods',
          um: skuItem.um || 'pack',
          price: skuItem.price || 0,
          storeOrder: 0,
          delivered: 0,
          undelivered: 0,
          fillRate: 0,
          remarks: '',
          weekStartDate: this.selectedWeek.weekStartDate,
          weekEndDate: this.selectedWeek.weekEndDate,
          weekNumber: this.selectedWeek.weekNumber,
          year: this.selectedWeek.year
        };
        storeData.push(newItem);
      }
      this.allReportData.set(this.selectedStore, storeData);
      this.showSnackbar('Week initialized locally with SKUs', 'success');
      this.loadStoreData();
    } catch (err) {
      console.error('Error initializing week:', err);
      this.showSnackbar('Failed to initialize week', 'error');
    } finally {
      this.isInitializing = false;
      this.loadingMessage = '';
      this.loadingProgress = '';
    }
  }

  async fixSchemaCache(): Promise<void> {
    try {
      this.showSnackbar('Attempting to fix schema cache...', 'info');
      const { error } = await this.supabase['supabase']
        .from('production_reports')
        .select('id')
        .limit(1);

      if (error && error.code === 'PGRST204') {
        this.showSnackbar('Schema cache still needs refresh. Run "NOTIFY pgrst, \'reload schema\'" in Supabase SQL Editor.', 'warning');
      } else {
        this.showSnackbar('Schema cache appears OK', 'success');
      }
    } catch (err) {
      console.error('Error fixing schema cache:', err);
      this.showSnackbar('Failed to check schema cache', 'error');
    }
  }

  // Helper method to get current week info
  getCurrentWeek(): { weekStartDate: string, weekEndDate: string, weekNumber: number, year: number } {
    const today = new Date();
    const year = today.getFullYear();
    
    // Get start of week (Monday)
    const startOfWeek = new Date(today);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    startOfWeek.setDate(diff);
    
    // Get end of week (Sunday)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    // Get week number (ISO week number)
    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (today.getTime() - firstDayOfYear.getTime()) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    
    return {
      weekStartDate: startOfWeek.toISOString().split('T')[0],
      weekEndDate: endOfWeek.toISOString().split('T')[0],
      weekNumber: weekNumber,
      year: year
    };
  }

  // Format date for display
  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  }

  // Generate weeks for selector (last 12 weeks + future 4 weeks)
  generateWeekOptions() {
    const weeks: WeekOption[] = [];
    const today = new Date();
    const currentWeek = this.getCurrentWeek();
    
    // Add current week
    weeks.push({
      label: `Current Week: ${this.formatDate(currentWeek.weekStartDate)} - ${this.formatDate(currentWeek.weekEndDate)}`,
      weekStartDate: currentWeek.weekStartDate,
      weekEndDate: currentWeek.weekEndDate,
      weekNumber: currentWeek.weekNumber,
      year: currentWeek.year
    });
    
    // Add past 12 weeks
    for (let i = 1; i <= 12; i++) {
      const date = new Date(currentWeek.weekStartDate);
      date.setDate(date.getDate() - (i * 7));
      const pastWeek = this.getWeekForDate(date);
      
      weeks.push({
        label: `Week ${pastWeek.weekNumber}, ${pastWeek.year} (${this.formatDate(pastWeek.weekStartDate)} - ${this.formatDate(pastWeek.weekEndDate)})`,
        weekStartDate: pastWeek.weekStartDate,
        weekEndDate: pastWeek.weekEndDate,
        weekNumber: pastWeek.weekNumber,
        year: pastWeek.year
      });
    }
    
    // Add future 4 weeks
    for (let i = 1; i <= 4; i++) {
      const date = new Date(currentWeek.weekStartDate);
      date.setDate(date.getDate() + (i * 7));
      const futureWeek = this.getWeekForDate(date);
      
      weeks.push({
        label: `Week ${futureWeek.weekNumber}, ${futureWeek.year} (${this.formatDate(futureWeek.weekStartDate)} - ${this.formatDate(futureWeek.weekEndDate)})`,
        weekStartDate: futureWeek.weekStartDate,
        weekEndDate: futureWeek.weekEndDate,
        weekNumber: futureWeek.weekNumber,
        year: futureWeek.year
      });
    }
    
    this.availableWeeks = weeks;
  }

  // Get week info for a specific date
  getWeekForDate(date: Date): { weekStartDate: string, weekEndDate: string, weekNumber: number, year: number } {
    const year = date.getFullYear();
    
    // Get start of week (Monday)
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    
    // Get end of week (Sunday)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    // Get week number
    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    
    return {
      weekStartDate: startOfWeek.toISOString().split('T')[0],
      weekEndDate: endOfWeek.toISOString().split('T')[0],
      weekNumber: weekNumber,
      year: year
    };
  }

  async loadReportsFromDatabase() {
    this.isLoading = true;
    try {
      console.log('Loading production reports from database...');
      
      const { data, error } = await this.supabase['supabase']
        .from('production_reports')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching data:', error);
        
        // Handle specific error codes
        if (error.code === 'PGRST204') {
          this.showSnackbar(
            'Database schema cache needs refresh. Please wait 30 seconds and try again.',
            'warning'
          );
        } else if (error.code === '42P01') {
          this.showSnackbar('Database table not found. It will be created when you add your first product.', 'info');
        } else {
          this.showSnackbar('Error loading production data: ' + error.message, 'error');
        }
        return;
      }
      
      if (data && data.length > 0) {
        // Clear existing data
        this.allReportData.clear();
        this.aggregatedData = [];
        this.displayedAggregatedData = [];
        
        data.forEach(dbItem => {
          const localItem = this.fromDatabaseFormat(dbItem);
          const store = localItem.store;
          
          if (!this.allReportData.has(store)) {
            this.allReportData.set(store, []);
          }
          this.allReportData.get(store)!.push(localItem);
          
          // Add store to custom stores if it's not predefined
          if (!this.predefinedStores.includes(store) && !this.customStores.includes(store)) {
            this.customStores.push(store);
            if (!this.allStores.includes(store)) {
              this.allStores.splice(1, 0, store);
            }
          }
        });
        
        // Sort stores alphabetically (except 'All')
        const storesWithoutAll = this.allStores.filter(s => s !== 'All');
        storesWithoutAll.sort();
        this.allStores = ['All', ...storesWithoutAll];
        
        // Generate week options based on available data
        this.generateWeekOptions();
        
        // Filter data for selected week
        this.filterDataByWeek();
        
        this.showSnackbar(`Loaded ${data.length} production items across ${this.allReportData.size} stores`, 'success');
        
      } else {
        this.showSnackbar('No production data found. Start by selecting a store and adding products.', 'info');
        this.generateWeekOptions();
      }
      
    } catch (error: any) {
      console.error('Error loading reports:', error);
      this.showSnackbar('Failed to load production data: ' + error.message, 'error');
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  // Filter data by selected week
  filterDataByWeek() {
    if (!this.selectedWeek) return;
    
    // Filter allReportData by week
    const filteredData = new Map<string, ReportItem[]>();
    
    this.allReportData.forEach((storeItems, storeName) => {
      const weekItems = storeItems.filter(item => 
        item.weekStartDate === this.selectedWeek!.weekStartDate &&
        item.weekEndDate === this.selectedWeek!.weekEndDate
      );
      
      if (weekItems.length > 0) {
        filteredData.set(storeName, weekItems);
      }
    });
    
    this.allReportData = filteredData;
    
    // Refresh view based on current selection
    if (this.selectedStore === 'All') {
      this.loadAggregatedData();
    } else if (this.selectedStore && this.selectedStore !== 'custom') {
      this.loadStoreData();
    }
  }

  onWeekChange(week: WeekOption) {
    this.selectedWeek = week;
    this.filterDataByWeek();
    this.showWeekSelector = false;
  }

  onStoreChange() {
    if (this.selectedStore === 'custom') {
      this.newStoreName = '';
      this.showAggregatedView = false;
      this.displayedData = [];
    } else if (this.selectedStore === 'All') {
      this.loadAggregatedData();
    } else if (this.selectedStore && this.selectedStore !== 'custom') {
      this.showAggregatedView = false;
      this.loadStoreData();
    } else {
      this.showAggregatedView = false;
      this.displayedData = [];
    }
    this.currentPage = 1;
    this.applyFiltersAndSearch();
  }

  loadStoreData() {
    const storeData = this.getCurrentStoreData();
    this.displayedData = [...storeData];
    this.applyFiltersAndSearch();
  }

  loadAggregatedData() {
    this.showAggregatedView = true;
    this.calculateAggregatedData();
    this.applyAggregatedFilters();
  }

  calculateAggregatedData() {
    const skuMap = new Map<string, AggregatedItem>();
    
    // Collect all data from all stores for the selected week
    this.allReportData.forEach((storeItems, storeName) => {
      storeItems.forEach(item => {
        if (!skuMap.has(item.sku)) {
          // Create new aggregated item
          skuMap.set(item.sku, {
            sku: item.sku,
            description: item.description,
            type: item.type,
            um: item.um,
            price: item.price,
            totalStoreOrder: 0,
            totalDelivered: 0,
            totalUndelivered: 0,
            fillRate: 0,
            storeCount: 0,
            remarks: '',
            stores: [],
            weekStartDate: item.weekStartDate,
            weekEndDate: item.weekEndDate,
            weekNumber: item.weekNumber,
            year: item.year
          });
        }
        
        const aggregatedItem = skuMap.get(item.sku)!;
        aggregatedItem.totalStoreOrder += item.storeOrder;
        aggregatedItem.totalDelivered += item.delivered;
        aggregatedItem.totalUndelivered += item.undelivered;
        aggregatedItem.storeCount++;
        
        // Add store to list if not already there
        if (!aggregatedItem.stores.includes(storeName)) {
          aggregatedItem.stores.push(storeName);
        }
        
        // Update remarks based on the most recent store's remarks
        if (item.remarks) {
          aggregatedItem.remarks = item.remarks;
        }
      });
    });
    
    // Calculate fill rate for each aggregated item
    skuMap.forEach(item => {
      if (item.totalStoreOrder > 0) {
        item.fillRate = Math.round((item.totalDelivered / item.totalStoreOrder) * 100);
      } else {
        item.fillRate = 0;
      }
      
      // Set remarks based on aggregated fill rate
      if (item.fillRate >= 95) item.remarks = 'Excellent';
      else if (item.fillRate >= 85) item.remarks = 'Good';
      else if (item.fillRate >= 70) item.remarks = 'Fair';
      else if (item.fillRate > 0) item.remarks = 'Needs Attention';
      else item.remarks = '';
    });
    
    // Convert map to array and sort
    this.aggregatedData = Array.from(skuMap.values())
      .sort((a, b) => a.sku.localeCompare(b.sku));
  }

  getCurrentStoreData(): ReportItem[] {
    if (!this.selectedStore || this.selectedStore === 'custom' || this.selectedStore === 'All') {
      return [];
    }
    return this.allReportData.get(this.selectedStore) || [];
  }

  addCustomStore() {
    if (!this.newStoreName.trim()) {
      this.showSnackbar('Please enter a store name', 'warning');
      return;
    }
    
    const storeName = this.newStoreName.trim();
    
    if (this.allStores.includes(storeName)) {
      this.showSnackbar(`Store "${storeName}" already exists`, 'error');
      return;
    }
    
    this.customStores.push(storeName);
    this.allStores.splice(1, 0, storeName);
    this.selectedStore = storeName;
    this.newStoreName = '';
    
    // Initialize empty data for new store
    this.allReportData.set(storeName, []);
    
    this.showSnackbar(`Store "${storeName}" added successfully`, 'success');
    this.loadStoreData();
  }

  fromDatabaseFormat(dbItem: any): ReportItem {
    return {
      id: dbItem.id,
      store: dbItem.store,
      sku: dbItem.sku,
      description: dbItem.description,
      type: dbItem.type || 'Finished Goods',
      um: dbItem.um,
      price: dbItem.price,
      storeOrder: dbItem.store_order,
      delivered: dbItem.delivered,
      undelivered: dbItem.undelivered,
      fillRate: dbItem.fill_rate,
      remarks: dbItem.remarks,
      weekStartDate: dbItem.week_start_date || this.currentWeekStartDate,
      weekEndDate: dbItem.week_end_date || this.currentWeekEndDate,
      weekNumber: dbItem.week_number || this.currentWeekNumber,
      year: dbItem.year || this.currentYear,
      created_at: dbItem.created_at
    };
  }

  toDatabaseFormat(localItem: ReportItem): any {
    const dbItem: any = {
      store: localItem.store,
      sku: localItem.sku,
      description: localItem.description,
      type: localItem.type,
      um: localItem.um,
      price: localItem.price,
      store_order: localItem.storeOrder,
      delivered: localItem.delivered,
      undelivered: localItem.undelivered,
      fill_rate: localItem.fillRate,
      remarks: localItem.remarks,
      week_start_date: localItem.weekStartDate,
      week_end_date: localItem.weekEndDate,
      week_number: localItem.weekNumber,
      year: localItem.year
    };
    
    // Only include id if it exists (for updates)
    if (localItem.id) {
      dbItem.id = localItem.id;
    }
    
    return dbItem;
  }

  getTypeClass(type: string): string {
    switch(type) {
      case 'Finished Goods': return 'type-fg';
      case 'Raw Materials': return 'type-rm';
      case 'Packaging': return 'type-pkg';
      case 'Semi-Finished': return 'type-sf';
      case 'Others': return 'type-other';
      default: return 'type-other';
    }
  }

  async saveToDatabase(item: ReportItem): Promise<ReportItem | null> {
    try {
      const dbItem = this.toDatabaseFormat(item);
      
      console.log('DEBUG: Attempting to save product:', {
        store: dbItem.store,
        sku: dbItem.sku,
        weekStartDate: dbItem.week_start_date,
        weekEndDate: dbItem.week_end_date
      });
      
      let result;
      
      if (item.id) {
        // Update existing
        console.log('DEBUG: Updating existing product with ID:', item.id);
        const { data, error } = await this.supabase['supabase']
          .from('production_reports')
          .update(dbItem)
          .eq('id', item.id)
          .select();
        
        if (error) {
          console.error('Update error details:', {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint
          });
          throw error;
        }
        result = data;
      } else {
        // Insert new
        console.log('DEBUG: Inserting new product with week columns');
        
        // First try direct insert with SELECT
        const { data, error } = await this.supabase['supabase']
          .from('production_reports')
          .insert([dbItem])
          .select();
        
        if (error) {
          console.error('Insert error (with select):', {
            code: error.code,
            message: error.message,
            details: error.details
          });
          
          // If it's a schema cache error (PGRST204), retry without SELECT
          if (error.code === 'PGRST204') {
            console.log('DEBUG: Schema cache error detected, retrying without SELECT...');
            
            // Insert without expecting data back
            const { error: insertError } = await this.supabase['supabase']
              .from('production_reports')
              .insert([dbItem]);
            
            if (insertError) {
              console.error('Insert error (without select):', insertError);
              throw insertError;
            }
            
            // Then fetch the inserted record by unique combination
            const { data: fetchedData, error: fetchError } = await this.supabase['supabase']
              .from('production_reports')
              .select()
              .eq('store', dbItem.store)
              .eq('sku', dbItem.sku)
              .eq('week_start_date', dbItem.week_start_date)
              .eq('week_end_date', dbItem.week_end_date)
              .order('created_at', { ascending: false })
              .limit(1);
            
            if (fetchError) {
              console.error('Fetch error after insert:', fetchError);
              throw fetchError;
            }
            
            result = fetchedData;
          } else {
            throw error;
          }
        } else {
          result = data;
        }
      }
      
      if (result && result.length > 0) {
        console.log('DEBUG: Save successful, returned:', result[0]);
        return this.fromDatabaseFormat(result[0]);
      }
      
      console.warn('DEBUG: No data returned from save operation');
      return null;
      
    } catch (error: any) {
      console.error('Error saving to database:', error);
      
      // Show specific error messages
      if (error.code === 'PGRST204') {
        this.showSnackbar(
          'Database schema cache issue. Please refresh page in 30 seconds.',
          'warning'
        );
      } else if (error.code === '23505') { // Unique violation
        this.showSnackbar(
          `Product "${item.sku}" already exists for this store and week.`,
          'error'
        );
      } else if (error.code === '23502') { // Not null violation
        this.showSnackbar(
          'Database error: Required fields missing.',
          'error'
        );
      } else if (error.code === '42P01') { // Table doesn't exist
        this.showSnackbar(
          'Production reports table not found. Please create it in Supabase.',
          'error'
        );
      } else {
        this.showSnackbar(
          `Database error: ${error.message || 'Unknown error'}`,
          'error'
        );
      }
      
      throw error;
    }
  }

  async deleteFromDatabase(id: string): Promise<boolean> {
    try {
      const { error } = await this.supabase['supabase']
        .from('production_reports')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error('Error deleting from database:', error);
      throw error;
    }
  }

  async clearStoreFromDatabase(storeName: string, weekStartDate?: string, weekEndDate?: string): Promise<boolean> {
    try {
      let query = this.supabase['supabase']
        .from('production_reports')
        .delete()
        .eq('store', storeName);
      
      // If week dates are provided, delete only for that week
      if (weekStartDate && weekEndDate) {
        query = query
          .eq('week_start_date', weekStartDate)
          .eq('week_end_date', weekEndDate);
      }
      
      const { error } = await query;
      
      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error('Error clearing store data:', error);
      throw error;
    }
  }

  applyFiltersAndSearch() {
    if (this.selectedStore === 'All') {
      this.applyAggregatedFilters();
    } else {
      const storeData = this.getCurrentStoreData();
      let filtered = [...storeData];
      
      if (this.searchQuery.trim()) {
        const q = this.searchQuery.toLowerCase();
        filtered = filtered.filter(item =>
          item.sku.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.type.toLowerCase().includes(q)
        );
      }
      
      this.updatePagination(filtered);
    }
  }

  applyAggregatedFilters() {
    let filtered = [...this.aggregatedData];
    
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.sku.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q) ||
        item.stores.some(store => store.toLowerCase().includes(q))
      );
    }
    
    this.updateAggregatedPagination(filtered);
  }

  updatePagination(filteredData: ReportItem[] = this.displayedData) {
    this.totalPages = Math.max(Math.ceil(filteredData.length / this.itemsPerPage), 1);
    
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
    
    this.startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.endIndex = Math.min(this.startIndex + this.itemsPerPage, filteredData.length);
    this.displayedData = filteredData.slice(this.startIndex, this.endIndex);
    
    this.cdr.detectChanges();
  }

  updateAggregatedPagination(filteredData: AggregatedItem[] = this.aggregatedData) {
    this.totalPages = Math.max(Math.ceil(filteredData.length / this.itemsPerPage), 1);
    
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
    
    this.startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.endIndex = Math.min(this.startIndex + this.itemsPerPage, filteredData.length);
    this.displayedAggregatedData = filteredData.slice(this.startIndex, this.endIndex);
    
    this.cdr.detectChanges();
  }

  nextPage() { 
    if (this.currentPage < this.totalPages) { 
      this.currentPage++; 
      if (this.selectedStore === 'All') {
        this.updateAggregatedPagination();
      } else {
        this.updatePagination();
      }
    }
  }
  
  previousPage() { 
    if (this.currentPage > 1) { 
      this.currentPage--; 
      if (this.selectedStore === 'All') {
        this.updateAggregatedPagination();
      } else {
        this.updatePagination();
      }
    }
  }

  createEmptyProduct(): ReportItem {
    const currentWeek = this.getCurrentWeek();
    
    return { 
      store: this.selectedStore,
      sku: '', 
      description: '',
      type: 'Finished Goods',
      um: 'pack', 
      price: 0, 
      storeOrder: 0, 
      delivered: 0, 
      undelivered: 0, 
      fillRate: 0, 
      remarks: '',
      weekStartDate: currentWeek.weekStartDate,
      weekEndDate: currentWeek.weekEndDate,
      weekNumber: currentWeek.weekNumber,
      year: currentWeek.year
    };
  }

  async calculateRow(item: ReportItem) {
    // Calculate values
    item.undelivered = parseFloat((item.storeOrder - item.delivered).toFixed(1));
    
    if (item.storeOrder > 0) {
      item.fillRate = Math.round((item.delivered / item.storeOrder) * 100);
    } else {
      item.fillRate = 0;
    }
    
    if (item.undelivered < 0) {
      item.undelivered = 0;
    }
    
    if (item.delivered > item.storeOrder) {
      item.delivered = item.storeOrder;
      item.undelivered = 0;
      item.fillRate = 100;
    }
    
    // Update remarks based on fill rate
    if (item.fillRate >= 95) item.remarks = 'Excellent';
    else if (item.fillRate >= 85) item.remarks = 'Good';
    else if (item.fillRate >= 70) item.remarks = 'Fair';
    else if (item.fillRate > 0) item.remarks = 'Needs Attention';
    else item.remarks = '';
    
    // Save changes to database (only if item has an ID)
    if (item.id) {
      try {
        await this.saveToDatabase(item);
      } catch (error: any) {
        console.error('Error saving calculation:', error);
        this.showSnackbar('Failed to save changes to database: ' + (error?.message || String(error)), 'error');
      }
    }
  }

  getFillRateClass(fillRate: number): string {
    if (fillRate >= 90) return 'high';
    if (fillRate >= 70) return 'medium';
    return 'low';
  }

  showSnackbar(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') {
    if (this.snackbarTimeout) {
      clearTimeout(this.snackbarTimeout);
    }
    
    this.snackbarMessage = message;
    this.snackbarType = type;
    
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

  addNewProduct() {
    if (!this.selectedStore || this.selectedStore === 'custom' || this.selectedStore === 'All') {
      this.showSnackbar('Please select a specific store first', 'warning');
      return;
    }
    
    this.currentProduct = this.createEmptyProduct();
    this.isEditing = false;
    this.showModal = true;
  }

  editProduct(product: ReportItem) {
    this.currentProduct = { ...product };
    this.isEditing = true;
    this.showModal = true;
  }

  async saveProduct() {
    if (!this.currentProduct.sku?.trim() || !this.currentProduct.description?.trim()) {
      this.showSnackbar('SKU and Description are required', 'warning');
      return;
    }

    // Validate SKU format (alphanumeric with optional hyphens)
    const skuRegex = /^[A-Za-z0-9\-]+$/;
    if (!skuRegex.test(this.currentProduct.sku.trim())) {
      this.showSnackbar('SKU can only contain letters, numbers, and hyphens', 'warning');
      return;
    }

    try {
      // Save to database
      const savedItem = await this.saveToDatabase(this.currentProduct);
      
      if (!savedItem) {
        this.showSnackbar('Failed to save product to database', 'error');
        return;
      }

      // Update local data
      const storeData = this.getCurrentStoreData();
      
      if (this.isEditing) {
        const index = storeData.findIndex(p => p.id === savedItem.id);
        if (index !== -1) {
          storeData[index] = savedItem;
          this.allReportData.set(this.selectedStore, storeData);
          this.showSnackbar(`Product "${savedItem.sku}" updated successfully`, 'success');
        }
      } else {
        // Check for duplicate SKU in current store for the same week
        if (storeData.some(p => p.sku === savedItem.sku && 
            p.weekStartDate === savedItem.weekStartDate && 
            p.weekEndDate === savedItem.weekEndDate)) {
          this.showSnackbar(`Product with SKU "${savedItem.sku}" already exists in this store for the selected week`, 'error');
          return;
        }
        
        storeData.unshift(savedItem);
        this.allReportData.set(this.selectedStore, storeData);
        this.showSnackbar(`Product "${savedItem.sku}" added successfully to ${this.selectedStore}`, 'success');
      }

      // Refresh the appropriate view
      if (this.selectedStore === 'All') {
        this.loadAggregatedData();
      } else {
        this.loadStoreData();
      }
      
      this.closeModal();
    } catch (error: any) {
      console.error('Error saving product:', error);
      
      if (error.code === '23505') { // Unique constraint violation
        this.showSnackbar(`Product with SKU "${this.currentProduct.sku}" already exists in database for this week`, 'error');
      } else {
        this.showSnackbar('Failed to save product: ' + error.message, 'error');
      }
    }
  }

  async deleteProduct(product: ReportItem) {
    if (!confirm(`Are you sure you want to delete "${product.sku}" from ${this.selectedStore} for week ${product.weekNumber}, ${product.year}?`)) return;

    if (!product.id) {
      this.showSnackbar('Cannot delete: Product ID not found', 'error');
      return;
    }

    try {
      // Delete from database
      const success = await this.deleteFromDatabase(product.id);
      
      if (!success) {
        this.showSnackbar('Failed to delete from database', 'error');
        return;
      }

      // Remove from local data
      const storeData = this.getCurrentStoreData();
      const index = storeData.findIndex(p => p.id === product.id);
      if (index !== -1) {
        storeData.splice(index, 1);
        this.allReportData.set(this.selectedStore, storeData);
        this.loadStoreData();
        this.showSnackbar(`Product "${product.sku}" deleted successfully from ${this.selectedStore}`, 'error');
      }
    } catch (error: any) {
      console.error('Error deleting product:', error);
      this.showSnackbar('Failed to delete product: ' + (error?.message || String(error)), 'error');
    }
  }

  async clearCurrentStoreData() {
    if (!this.selectedStore || this.selectedStore === 'custom' || this.selectedStore === 'All') {
      this.showSnackbar('Please select a specific store first', 'warning');
      return;
    }

    let message = `⚠️ CLEAR ALL DATA FOR ${this.selectedStore}`;
    if (this.selectedWeek) {
      message += `\nWeek: ${this.selectedWeek.weekNumber}, ${this.selectedWeek.year} (${this.formatDate(this.selectedWeek.weekStartDate)} - ${this.formatDate(this.selectedWeek.weekEndDate)})`;
    }
    message += `\nThis will permanently delete ALL production data for this store.\nAre you absolutely sure?`;

    if (!confirm(message)) {
      return;
    }
    
    if (!confirm('LAST CHANCE!\nThis action cannot be undone.\nType "CLEAR" to confirm:')) {
      return;
    }
    
    if (prompt('Type CLEAR to confirm:') !== 'CLEAR') {
      return;
    }

    this.isLoading = true;
    try {
      const success = await this.clearStoreFromDatabase(
        this.selectedStore, 
        this.selectedWeek?.weekStartDate, 
        this.selectedWeek?.weekEndDate
      );
      
      if (success) {
        this.allReportData.set(this.selectedStore, []);
        this.loadStoreData();
        this.showSnackbar(`All production data cleared for ${this.selectedStore}`, 'error');
      } else {
        this.showSnackbar('Failed to clear store data from database', 'error');
      }
    } catch (error: any) {
      console.error('Error clearing store data:', error);
      this.showSnackbar('Failed to clear store data: ' + (error?.message || String(error)), 'error');
    } finally {
      this.isLoading = false;
    }
  }

  exportToExcel() {
    if (!this.selectedStore || this.selectedStore === 'custom') {
      this.showSnackbar('Please select a store first', 'warning');
      return;
    }

    if (this.selectedStore === 'All') {
      this.exportAggregatedToExcel();
      return;
    }

    const storeData = this.getCurrentStoreData();
    if (storeData.length === 0) {
      this.showSnackbar(`No data to export for ${this.selectedStore}. Add some products first.`, 'warning');
      return;
    }

    try {
      const weekInfo = storeData[0] ? `Week ${storeData[0].weekNumber}, ${storeData[0].year} (${this.formatDate(storeData[0].weekStartDate)} - ${this.formatDate(storeData[0].weekEndDate)})` : '';
      
      const exportData: (string | number)[][] = [
        [`${this.selectedStore} - Production Report - ${weekInfo} - Generated ${new Date().toLocaleString()}`],
        [],
        ['SKU', 'Description', 'Type', 'UM', 'Price (₱)', 'Store Order', 'Delivered', 'Undelivered', 'Fill Rate %', 'Remarks']
      ];

      storeData.forEach(item => {
        exportData.push([
          item.sku,
          item.description,
          item.type,
          item.um,
          item.price,
          item.storeOrder,
          item.delivered,
          item.undelivered,
          item.fillRate + '%',
          item.remarks
        ]);
      });

      const totalStoreOrder = storeData.reduce((sum, item) => sum + item.storeOrder, 0);
      const totalDelivered = storeData.reduce((sum, item) => sum + item.delivered, 0);
      const totalUndelivered = storeData.reduce((sum, item) => sum + item.undelivered, 0);
      const avgFillRate = storeData.length > 0 
        ? Math.round(storeData.reduce((sum, item) => sum + item.fillRate, 0) / storeData.length)
        : 0;

      exportData.push(
        [],
        ['Summary', '', '', '', '', '', '', '', '', ''],
        ['Total Store Order:', '', '', '', '', totalStoreOrder.toString()],
        ['Total Delivered:', '', '', '', '', '', totalDelivered.toString()],
        ['Total Undelivered:', '', '', '', '', '', '', totalUndelivered.toString()],
        ['Average Fill Rate:', '', '', '', '', '', '', '', avgFillRate + '%']
      );

      const ws = XLSX.utils.aoa_to_sheet(exportData);
      const wscols = [
        { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 8 }, { wch: 10 },
        { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }
      ];
      ws['!cols'] = wscols;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `${this.selectedStore} Report`);

      const fileName = `${this.selectedStore.replace(/[^a-z0-9]/gi, '_')}_Week${storeData[0]?.weekNumber || ''}_Production_Report_${new Date().toISOString().slice(0,10)}.xlsx`;
      XLSX.writeFile(wb, fileName);

      this.showSnackbar(`Report exported successfully as ${fileName}`, 'success');
    } catch (error: any) {
      console.error('Export error:', error);
      this.showSnackbar('Failed to export report. Please try again.', 'error');
    }
  }

  exportAggregatedToExcel() {
    if (this.aggregatedData.length === 0) {
      this.showSnackbar('No aggregated data to export', 'warning');
      return;
    }

    try {
      const weekInfo = this.aggregatedData[0] ? `Week ${this.aggregatedData[0].weekNumber}, ${this.aggregatedData[0].year} (${this.formatDate(this.aggregatedData[0].weekStartDate)} - ${this.formatDate(this.aggregatedData[0].weekEndDate)})` : '';
      
      const exportData: (string | number)[][] = [
        ['All Stores - Aggregated Production Report - ' + weekInfo + ' - Generated ' + new Date().toLocaleString()],
        [],
        ['SKU', 'Description', 'Type', 'UM', 'Price (₱)', 'Store Count', 'Total Store Order', 'Total Delivered', 'Total Undelivered', 'Fill Rate %', 'Stores', 'Remarks']
      ];

      this.aggregatedData.forEach(item => {
        exportData.push([
          item.sku,
          item.description,
          item.type,
          item.um,
          item.price,
          item.storeCount,
          item.totalStoreOrder,
          item.totalDelivered,
          item.totalUndelivered,
          item.fillRate + '%',
          item.stores.join(', '),
          item.remarks
        ]);
      });

      const totalStoreOrder = this.aggregatedData.reduce((sum, item) => sum + item.totalStoreOrder, 0);
      const totalDelivered = this.aggregatedData.reduce((sum, item) => sum + item.totalDelivered, 0);
      const totalUndelivered = this.aggregatedData.reduce((sum, item) => sum + item.totalUndelivered, 0);
      const avgFillRate = this.aggregatedData.length > 0 
        ? Math.round(this.aggregatedData.reduce((sum, item) => sum + item.fillRate, 0) / this.aggregatedData.length)
        : 0;

      exportData.push(
        [],
        ['Summary', '', '', '', '', '', '', '', '', '', '', ''],
        ['Total Unique SKUs:', '', '', '', '', this.aggregatedData.length],
        ['Total Store Order:', '', '', '', '', '', totalStoreOrder.toString()],
        ['Total Delivered:', '', '', '', '', '', '', totalDelivered.toString()],
        ['Total Undelivered:', '', '', '', '', '', '', '', totalUndelivered.toString()],
        ['Average Fill Rate:', '', '', '', '', '', '', '', '', avgFillRate + '%', '', '']
      );

      const ws = XLSX.utils.aoa_to_sheet(exportData);
      const wscols = [
        { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 8 }, { wch: 10 },
        { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
        { wch: 25 }, { wch: 15 }
      ];
      ws['!cols'] = wscols;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'All Stores Report');

      const fileName = `All_Stores_Week${this.aggregatedData[0]?.weekNumber || ''}_Aggregated_Production_Report_${new Date().toISOString().slice(0,10)}.xlsx`;
      XLSX.writeFile(wb, fileName);

      this.showSnackbar(`Aggregated report exported successfully as ${fileName}`, 'success');
    } catch (error: any) {
      console.error('Export error:', error);
      this.showSnackbar('Failed to export aggregated report', 'error');
    }
  }

  closeModal() {
    this.showModal = false;
    this.currentProduct = this.createEmptyProduct();
  }

  async refresh() {
    await this.loadReportsFromDatabase();
    if (this.selectedStore === 'All') {
      this.loadAggregatedData();
    } else if (this.selectedStore && this.selectedStore !== 'custom') {
      this.loadStoreData();
    }
  }

  // Method to copy previous week's data
  async copyFromPreviousWeek() {
    if (!this.selectedStore || this.selectedStore === 'custom' || this.selectedStore === 'All') {
      this.showSnackbar('Please select a specific store first', 'warning');
      return;
    }

    if (!this.selectedWeek) {
      this.showSnackbar('Please select a week first', 'warning');
      return;
    }

    // Calculate previous week
    const prevWeekDate = new Date(this.selectedWeek.weekStartDate);
    prevWeekDate.setDate(prevWeekDate.getDate() - 7);
    const prevWeek = this.getWeekForDate(prevWeekDate);

    // Load previous week's data from database
    this.isLoading = true;
    try {
      const { data, error } = await this.supabase['supabase']
        .from('production_reports')
        .select('*')
        .eq('store', this.selectedStore)
        .eq('week_start_date', prevWeek.weekStartDate)
        .eq('week_end_date', prevWeek.weekEndDate);

      if (error) {
        console.error('Error loading previous week data:', error);
        this.showSnackbar('Failed to load previous week data: ' + error.message, 'error');
        return;
      }

      if (!data || data.length === 0) {
        this.showSnackbar('No data found for the previous week', 'info');
        return;
      }

      // Copy data to current week
      const newItems = data.map(dbItem => {
        const localItem = this.fromDatabaseFormat(dbItem);
        // Update week info
        localItem.weekStartDate = this.selectedWeek!.weekStartDate;
        localItem.weekEndDate = this.selectedWeek!.weekEndDate;
        localItem.weekNumber = this.selectedWeek!.weekNumber;
        localItem.year = this.selectedWeek!.year;
        // Reset delivered and undelivered
        localItem.delivered = 0;
        localItem.undelivered = localItem.storeOrder;
        localItem.fillRate = 0;
        localItem.remarks = '';
        // Remove id for new record
        delete localItem.id;
        delete localItem.created_at;
        
        return localItem;
      });

      // Save all new items
      for (const item of newItems) {
        await this.saveToDatabase(item);
      }

      // Reload data
      await this.loadReportsFromDatabase();
      this.showSnackbar(`Copied ${newItems.length} items from previous week`, 'success');

    } catch (error: any) {
      console.error('Error copying previous week data:', error);
      this.showSnackbar('Failed to copy previous week data: ' + (error?.message || String(error)), 'error');
    } finally {
      this.isLoading = false;
    }
  }

  // Test database connection method
  async testDatabaseConnection(): Promise<boolean> {
    try {
      this.showSnackbar('Testing database connection...', 'info');
      
      console.log('Testing production_reports table connection...');
      
      // Test 1: Simple query to see if table exists
      const { data: testData, error: testError } = await this.supabase['supabase']
        .from('production_reports')
        .select('count')
        .limit(1);
      
      if (testError) {
        console.error('Database connection test failed:', testError);
        
        if (testError.code === 'PGRST204') {
          this.showSnackbar(
            'Database schema cache needs refresh. Please run "NOTIFY pgrst, \'reload schema\'" in Supabase SQL Editor.',
            'warning'
          );
        } else {
          this.showSnackbar(`Database connection failed: ${testError.message}`, 'error');
        }
        
        return false;
      }
      
      console.log('Database connection test successful:', testData);
      this.showSnackbar('Database connection successful!', 'success');
      return true;
      
    } catch (error: any) {
      console.error('Test failed:', error);
      this.showSnackbar(`Database test failed: ${error.message}`, 'error');
      return false;
    }
  }
}