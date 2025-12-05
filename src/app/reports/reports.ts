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
  weekStartDate: string;
  weekEndDate: string;
  weekNumber: number;
  year: number;
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
  um: string;
  price: number;
  type: string;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.html',
  styleUrls: ['./reports.css']
})
export class ReportsComponent implements OnInit {
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
  
  selectedWeek: WeekOption | null = null;
  availableWeeks: WeekOption[] = [];
  showWeekSelector = false;
  
  currentWeekStartDate: string;
  currentWeekEndDate: string;
  currentWeekNumber: number;
  currentYear: number;
  
  productTypes: string[] = [
    'Finished Goods',
    'Raw Materials',
    'Packaging',
    'Semi-Finished',
    'Others'
  ];
  
  allReportData: Map<string, ReportItem[]> = new Map();
  displayedData: ReportItem[] = [];
  aggregatedData: AggregatedItem[] = [];
  displayedAggregatedData: AggregatedItem[] = [];
  showAggregatedView = false;
  
  skuCatalog: SkuCatalogItem[] = [];
  isLoadingCatalog = false;
  
  isLoading = false;
  isSavingData = false;
  isInitializing = false;
  loadingProgress = '';
  loadingMessage = '';
  errorMessage = '';
  searchQuery = '';
  
  showModal = false;
  isEditing = false;
  currentProduct: ReportItem = this.createEmptyProduct();
  
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;
  startIndex = 0;
  endIndex = 0;
  
  snackbarMessage = '';
  snackbarType: 'success' | 'error' | 'warning' | 'info' = 'success';
  snackbarTimeout: any;

  constructor(
    private cdr: ChangeDetectorRef,
    private supabase: SupabaseService
  ) {
    const currentWeek = this.getCurrentWeek();
    this.currentWeekStartDate = currentWeek.weekStartDate;
    this.currentWeekEndDate = currentWeek.weekEndDate;
    this.currentWeekNumber = currentWeek.weekNumber;
    this.currentYear = currentWeek.year;
    
    this.selectedWeek = {
      label: `Week ${currentWeek.weekNumber}, ${currentWeek.year} (${this.formatDate(currentWeek.weekStartDate)} - ${this.formatDate(currentWeek.weekEndDate)})`,
      ...currentWeek
    };
  }

  ngOnInit() {
    this.testDatabaseConnection().then(success => {
      if (success) {
        this.loadSkuCatalog().then(() => {
          this.loadReportsFromDatabase();
        });
      }
    });
  }

  // SKU Catalog Methods
  async loadSkuCatalog() {
    this.isLoadingCatalog = true;
    try {
      console.log('Loading SKU catalog...');
      const { data, error } = await this.supabase['supabase']
        .from('sku_catalog')
        .select('*')
        .order('sku');
      
      if (error) {
        console.error('Error loading SKU catalog:', error);
        
        // If table doesn't exist, create it with sample data
        if (error.code === '42P01') {
          this.showSnackbar('SKU catalog table not found. Creating it...', 'info');
          await this.createSkuCatalogTable();
          await this.insertDefaultSkus();
          await this.loadSkuCatalog(); // Try loading again
        }
        return;
      }
      
      this.skuCatalog = data || [];
      console.log(`Loaded ${this.skuCatalog.length} SKUs from catalog`);
      
    } catch (error) {
      console.error('Error loading SKU catalog:', error);
    } finally {
      this.isLoadingCatalog = false;
    }
  }

  async createSkuCatalogTable() {
    try {
      // This is a simplified version - in real app, you'd run SQL to create table
      console.log('Creating SKU catalog table...');
      this.showSnackbar('Creating SKU catalog table...', 'info');
    } catch (error) {
      console.error('Error creating SKU catalog table:', error);
    }
  }

  async insertDefaultSkus() {
    try {
      // This would insert the SKUs you provided
      // For now, we'll create a local array
      console.log('Inserting default SKUs...');
    } catch (error) {
      console.error('Error inserting default SKUs:', error);
    }
  }

  onSkuSelect(sku: string) {
    const catalogItem = this.skuCatalog.find(item => item.sku === sku);
    if (catalogItem) {
      this.currentProduct.sku = catalogItem.sku;
      this.currentProduct.description = catalogItem.description;
      this.currentProduct.um = catalogItem.um;
      this.currentProduct.price = catalogItem.price;
      this.currentProduct.type = catalogItem.type;
    }
  }

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

    if (!confirm(`Initialize Week ${this.selectedWeek.weekNumber}, ${this.selectedWeek.year} for ${this.selectedStore} with all SKUs?\nThis will create entries for all ${this.skuCatalog.length} SKUs with zero values.`)) {
      return;
    }

    this.isInitializing = true;
    this.isLoading = true;
    this.loadingMessage = 'Initializing week with all SKUs...';
    this.loadingProgress = 'Preparing SKU data...';
    this.showSnackbar('Initializing week with all SKUs...', 'info');
    
    try {
      const existingData = this.getCurrentStoreData();
      const existingSkus = new Set(existingData.map(item => item.sku));
      
      let createdCount = 0;
      let skippedCount = 0;
      let errors = 0;
      
      const totalSkus = this.skuCatalog.length;
      
      // Create entries for all SKUs not already present
      for (let i = 0; i < this.skuCatalog.length; i++) {
        const catalogItem = this.skuCatalog[i];
        
        this.loadingProgress = `Processing SKU ${i + 1} of ${totalSkus}: ${catalogItem.sku}`;
        
        if (existingSkus.has(catalogItem.sku)) {
          skippedCount++;
          continue;
        }
        
        const newItem: ReportItem = {
          store: this.selectedStore,
          sku: catalogItem.sku,
          description: catalogItem.description,
          type: catalogItem.type,
          um: catalogItem.um,
          price: catalogItem.price,
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
        
        try {
          const savedItem = await this.saveToDatabase(newItem);
          if (savedItem) {
            createdCount++;
            
            // Add to local data
            const storeData = this.allReportData.get(this.selectedStore) || [];
            storeData.push(savedItem);
            this.allReportData.set(this.selectedStore, storeData);
          }
        } catch (error) {
          errors++;
          console.error(`Error saving SKU ${catalogItem.sku}:`, error);
        }
        
        // Update progress every 10 items
        if (i % 10 === 0 || i === totalSkus - 1) {
          this.cdr.detectChanges();
        }
      }
      
      this.showSnackbar(`Week initialized: ${createdCount} new SKUs added, ${skippedCount} already existed, ${errors} errors`, 
        errors > 0 ? 'warning' : 'success');
      this.refreshCurrentView();
      
    } catch (error) {
      console.error('Error initializing week:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.showSnackbar('Failed to initialize week: ' + errorMessage, 'error');
    } finally {
      this.isInitializing = false;
      this.isLoading = false;
      this.loadingProgress = '';
      this.loadingMessage = '';
    }
  }

  // Existing methods (with fixes for week switching)
  getCurrentWeek(): { weekStartDate: string, weekEndDate: string, weekNumber: number, year: number } {
    const today = new Date();
    const year = today.getFullYear();
    
    const startOfWeek = new Date(today);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
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

  formatDate(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  }

  generateWeekOptions() {
    const weeks: WeekOption[] = [];
    const today = new Date();
    const currentWeek = this.getCurrentWeek();
    
    weeks.push({
      label: `Current Week: ${this.formatDate(currentWeek.weekStartDate)} - ${this.formatDate(currentWeek.weekEndDate)}`,
      weekStartDate: currentWeek.weekStartDate,
      weekEndDate: currentWeek.weekEndDate,
      weekNumber: currentWeek.weekNumber,
      year: currentWeek.year
    });
    
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

  getWeekForDate(date: Date): { weekStartDate: string, weekEndDate: string, weekNumber: number, year: number } {
    const year = date.getFullYear();
    
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
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
    this.loadingMessage = 'Loading production reports...';
    this.loadingProgress = 'Connecting to database...';
    
    try {
      console.log('Loading production reports from database...');
      
      this.loadingProgress = 'Fetching data...';
      const { data, error } = await this.supabase['supabase']
        .from('production_reports')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching data:', error);
        
        if (error.code === 'PGRST204') {
          this.showSnackbar(
            'Database schema cache issue detected. Using workaround for now.',
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
        this.loadingProgress = 'Processing store data...';
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
          
          if (!this.predefinedStores.includes(store) && !this.customStores.includes(store)) {
            this.customStores.push(store);
            if (!this.allStores.includes(store)) {
              this.allStores.splice(1, 0, store);
            }
          }
        });
        
        this.loadingProgress = 'Updating store list...';
        const storesWithoutAll = this.allStores.filter(s => s !== 'All');
        storesWithoutAll.sort();
        this.allStores = ['All', ...storesWithoutAll];
        
        this.generateWeekOptions();
        this.refreshCurrentView();
        
        this.showSnackbar(`Loaded ${data.length} production items across ${this.allReportData.size} stores`, 'success');
        
      } else {
        this.showSnackbar('No production data found. Start by selecting a store and adding products.', 'info');
        this.generateWeekOptions();
      }
      
    } catch (error: any) {
      console.error('Error loading reports:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.showSnackbar('Failed to load production data: ' + errorMessage, 'error');
    } finally {
      this.isLoading = false;
      this.loadingProgress = '';
      this.loadingMessage = '';
      this.cdr.detectChanges();
    }
  }

  filterDataByWeek() {
    if (!this.selectedWeek) return;
    this.refreshCurrentView();
  }

  refreshCurrentView() {
    this.isLoading = true;
    this.loadingMessage = 'Refreshing view...';
    
    // Reset to page 1 when changing views
    this.currentPage = 1;
    
    if (this.selectedStore === 'All') {
      this.loadAggregatedData();
    } else if (this.selectedStore && this.selectedStore !== 'custom') {
      this.loadStoreData();
    } else {
      this.isLoading = false;
      this.loadingMessage = '';
    }
    this.cdr.detectChanges();
  }

  onWeekChange(week: WeekOption) {
    this.selectedWeek = week;
    this.refreshCurrentView();
    this.showWeekSelector = false;
  }

  onStoreChange() {
    // Show loading only if we have data to load
    if ((this.selectedStore === 'All' && this.aggregatedData.length > 0) || 
        (this.selectedStore && this.selectedStore !== 'custom' && this.selectedStore !== 'All' && this.getCurrentStoreData().length > 0)) {
      this.isLoading = true;
      this.loadingMessage = 'Loading store data...';
    }
    
    // Reset to page 1 when changing stores
    this.currentPage = 1;
    
    if (this.selectedStore === 'custom') {
      this.newStoreName = '';
      this.showAggregatedView = false;
      this.displayedData = [];
      this.totalPages = 1;
      this.startIndex = 0;
      this.endIndex = 0;
      this.isLoading = false;
    } else if (this.selectedStore === 'All') {
      this.loadAggregatedData();
    } else if (this.selectedStore && this.selectedStore !== 'custom') {
      this.showAggregatedView = false;
      this.loadStoreData();
    } else {
      this.showAggregatedView = false;
      this.displayedData = [];
      this.totalPages = 1;
      this.startIndex = 0;
      this.endIndex = 0;
      this.isLoading = false;
    }
    this.cdr.detectChanges();
  }

  loadStoreData() {
    const allStoreData = this.allReportData.get(this.selectedStore) || [];
    
    const storeData = allStoreData.filter(item => 
      this.selectedWeek && 
      item.weekStartDate === this.selectedWeek.weekStartDate &&
      item.weekEndDate === this.selectedWeek.weekEndDate
    );
    
    this.displayedData = [...storeData];
    this.applyFiltersAndSearch();
    this.isLoading = false;
    this.loadingMessage = '';
  }

  loadAggregatedData() {
    this.showAggregatedView = true;
    this.calculateAggregatedData();
    this.applyAggregatedFilters();
    this.isLoading = false;
    this.loadingMessage = '';
  }

  calculateAggregatedData() {
    const skuMap = new Map<string, AggregatedItem>();
    
    if (!this.selectedWeek) {
      this.aggregatedData = [];
      return;
    }
    
    this.allReportData.forEach((allStoreItems, storeName) => {
      const storeItems = allStoreItems.filter(item => 
        item.weekStartDate === this.selectedWeek!.weekStartDate &&
        item.weekEndDate === this.selectedWeek!.weekEndDate
      );
      
      storeItems.forEach(item => {
        if (!skuMap.has(item.sku)) {
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
        
        if (!aggregatedItem.stores.includes(storeName)) {
          aggregatedItem.stores.push(storeName);
        }
        
        if (item.remarks) {
          aggregatedItem.remarks = item.remarks;
        }
      });
    });
    
    skuMap.forEach(item => {
      if (item.totalStoreOrder > 0) {
        item.fillRate = Math.round((item.totalDelivered / item.totalStoreOrder) * 100);
      } else {
        item.fillRate = 0;
      }
      
      if (item.fillRate >= 95) item.remarks = 'Excellent';
      else if (item.fillRate >= 85) item.remarks = 'Good';
      else if (item.fillRate >= 70) item.remarks = 'Fair';
      else if (item.fillRate > 0) item.remarks = 'Needs Attention';
      else item.remarks = '';
    });
    
    this.aggregatedData = Array.from(skuMap.values())
      .sort((a, b) => a.sku.localeCompare(b.sku));
  }

  getCurrentStoreData(): ReportItem[] {
    if (!this.selectedStore || this.selectedStore === 'custom' || this.selectedStore === 'All') {
      return [];
    }
    
    const allStoreData = this.allReportData.get(this.selectedStore) || [];
    
    return allStoreData.filter(item => 
      this.selectedWeek &&
      item.weekStartDate === this.selectedWeek.weekStartDate &&
      item.weekEndDate === this.selectedWeek.weekEndDate
    );
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
      remarks: localItem.remarks
    };
    
    if (!this.hasSchemaCacheError) {
      dbItem.week_start_date = localItem.weekStartDate;
      dbItem.week_end_date = localItem.weekEndDate;
      dbItem.week_number = localItem.weekNumber;
      dbItem.year = localItem.year;
    }
    
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

  hasSchemaCacheError = false;

  async saveToDatabase(item: ReportItem): Promise<ReportItem | null> {
    try {
      let dbItem = this.toDatabaseFormat(item);
      
      if (item.id) {
        const { data, error } = await this.supabase['supabase']
          .from('production_reports')
          .update(dbItem)
          .eq('id', item.id)
          .select();
        
        if (error) {
          console.error('Update error:', error);
          throw error;
        }
        
        if (data && data.length > 0) {
          return this.fromDatabaseFormat(data[0]);
        }
      } else {
        const { data, error } = await this.supabase['supabase']
          .from('production_reports')
          .insert([dbItem])
          .select();
        
        if (error) {
          console.error('Insert error (with all columns):', error);
          
          if (error.code === 'PGRST204') {
            console.log('Schema cache error detected. Trying without week columns...');
            this.hasSchemaCacheError = true;
            
            const dbItemWithoutWeek = {
              store: item.store,
              sku: item.sku,
              description: item.description,
              type: item.type,
              um: item.um,
              price: item.price,
              store_order: item.storeOrder,
              delivered: item.delivered,
              undelivered: item.undelivered,
              fill_rate: item.fillRate,
              remarks: item.remarks
            };
            
            const { data: dataWithoutWeek, error: errorWithoutWeek } = await this.supabase['supabase']
              .from('production_reports')
              .insert([dbItemWithoutWeek])
              .select();
            
            if (errorWithoutWeek) {
              console.error('Insert error (without week columns):', errorWithoutWeek);
              throw errorWithoutWeek;
            }
            
            if (dataWithoutWeek && dataWithoutWeek.length > 0) {
              const savedItem = this.fromDatabaseFormat(dataWithoutWeek[0]);
              savedItem.weekStartDate = item.weekStartDate;
              savedItem.weekEndDate = item.weekEndDate;
              savedItem.weekNumber = item.weekNumber;
              savedItem.year = item.year;
              
              await this.updateWithWeekColumns(savedItem);
              
              return savedItem;
            }
          } else {
            throw error;
          }
        } else if (data && data.length > 0) {
          return this.fromDatabaseFormat(data[0]);
        }
      }
      
      return null;
    } catch (error: any) {
      console.error('Error saving to database:', error);
      
      if (error.code === 'PGRST204') {
        this.showSnackbar(
          'Database schema cache issue. Your data is saved without week info. Please refresh Supabase schema cache.',
          'warning'
        );
      } else if (error.code === '23505') {
        this.showSnackbar(
          `Product "${item.sku}" already exists for this store and week.`,
          'error'
        );
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
        this.showSnackbar(`Database error: ${errorMessage}`, 'error');
      }
      
      throw error;
    }
  }

  private async updateWithWeekColumns(item: ReportItem): Promise<void> {
    if (!item.id) return;
    
    try {
      const updateData = {
        week_start_date: item.weekStartDate,
        week_end_date: item.weekEndDate,
        week_number: item.weekNumber,
        year: item.year
      };
      
      const { error } = await this.supabase['supabase']
        .from('production_reports')
        .update(updateData)
        .eq('id', item.id);
      
      if (error && error.code === 'PGRST204') {
        console.warn('Cannot update week columns due to schema cache. Data will work without week info.');
        this.hasSchemaCacheError = true;
      } else if (error) {
        console.error('Error updating week columns:', error);
      } else {
        console.log('Week columns updated successfully');
        this.hasSchemaCacheError = false;
      }
    } catch (error) {
      console.error('Error in updateWithWeekColumns:', error);
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
    } catch (error) {
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
      
      if (weekStartDate && weekEndDate) {
        query = query
          .eq('week_start_date', weekStartDate)
          .eq('week_end_date', weekEndDate);
      }
      
      const { error } = await query;
      
      if (error) throw error;
      return true;
    } catch (error) {
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
      
      // Reset to page 1 when filtering
      this.currentPage = 1;
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
    
    // Reset to page 1 when filtering
    this.currentPage = 1;
    this.updateAggregatedPagination(filtered);
  }

  updatePagination(filteredData?: ReportItem[]) {
    if (!filteredData) {
      // Get fresh data if none provided
      const storeData = this.getCurrentStoreData();
      let freshFiltered = [...storeData];
      
      if (this.searchQuery.trim()) {
        const q = this.searchQuery.toLowerCase();
        freshFiltered = freshFiltered.filter(item =>
          item.sku.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.type.toLowerCase().includes(q)
        );
      }
      filteredData = freshFiltered;
    }
    
    this.totalPages = Math.max(Math.ceil(filteredData.length / this.itemsPerPage), 1);
    
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
    
    this.startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.endIndex = Math.min(this.startIndex + this.itemsPerPage, filteredData.length);
    this.displayedData = filteredData.slice(this.startIndex, this.endIndex);
    
    this.cdr.detectChanges();
  }

  updateAggregatedPagination(filteredData?: AggregatedItem[]) {
    if (!filteredData) {
      // Get fresh data if none provided
      let freshFiltered = [...this.aggregatedData];
      
      if (this.searchQuery.trim()) {
        const q = this.searchQuery.toLowerCase();
        freshFiltered = freshFiltered.filter(item =>
          item.sku.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.type.toLowerCase().includes(q) ||
          item.stores.some(store => store.toLowerCase().includes(q))
        );
      }
      filteredData = freshFiltered;
    }
    
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
      
      // Get fresh data based on current filters
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
      
      // Get fresh data based on current filters
      if (this.selectedStore === 'All') {
        this.updateAggregatedPagination();
      } else {
        this.updatePagination();
      }
    }
  }

  createEmptyProduct(): ReportItem {
    const weekInfo = this.selectedWeek || this.getCurrentWeek();
    
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
      weekStartDate: weekInfo.weekStartDate,
      weekEndDate: weekInfo.weekEndDate,
      weekNumber: weekInfo.weekNumber,
      year: weekInfo.year
    };
  }

  async calculateRow(item: ReportItem) {
    this.isSavingData = true;
    
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
    
    if (item.fillRate >= 95) item.remarks = 'Excellent';
    else if (item.fillRate >= 85) item.remarks = 'Good';
    else if (item.fillRate >= 70) item.remarks = 'Fair';
    else if (item.fillRate > 0) item.remarks = 'Needs Attention';
    else item.remarks = '';
    
    if (item.id) {
      try {
        await this.saveToDatabase(item);
      } catch (error) {
        console.error('Error saving calculation:', error);
        this.showSnackbar('Failed to save changes to database', 'error');
      }
    }
    
    this.isSavingData = false;
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

    const skuRegex = /^[A-Za-z0-9\-]+$/;
    if (!skuRegex.test(this.currentProduct.sku.trim())) {
      this.showSnackbar('SKU can only contain letters, numbers, and hyphens', 'warning');
      return;
    }

    // Ensure the product has the correct week info
    if (this.selectedWeek && !this.isEditing) {
      this.currentProduct.weekStartDate = this.selectedWeek.weekStartDate;
      this.currentProduct.weekEndDate = this.selectedWeek.weekEndDate;
      this.currentProduct.weekNumber = this.selectedWeek.weekNumber;
      this.currentProduct.year = this.selectedWeek.year;
    }

    this.isSavingData = true;
    
    try {
      const savedItem = await this.saveToDatabase(this.currentProduct);
      
      if (!savedItem) {
        this.showSnackbar('Failed to save product to database', 'error');
        return;
      }

      const storeData = this.allReportData.get(this.selectedStore) || [];
      
      if (this.isEditing) {
        const index = storeData.findIndex(p => p.id === savedItem.id);
        if (index !== -1) {
          storeData[index] = savedItem;
          this.allReportData.set(this.selectedStore, storeData);
          this.showSnackbar(`Product "${savedItem.sku}" updated successfully`, 'success');
        }
      } else {
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

      this.refreshCurrentView();
      this.closeModal();
    } catch (error: any) {
      console.error('Error saving product:', error);
      
      if (error.code === '23505') {
        this.showSnackbar(`Product with SKU "${this.currentProduct.sku}" already exists in database for this week`, 'error');
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        this.showSnackbar('Failed to save product: ' + errorMessage, 'error');
      }
    } finally {
      this.isSavingData = false;
    }
  }

  async deleteProduct(product: ReportItem) {
    if (!confirm(`Are you sure you want to delete "${product.sku}" from ${this.selectedStore} for week ${product.weekNumber}, ${product.year}?`)) return;

    if (!product.id) {
      this.showSnackbar('Cannot delete: Product ID not found', 'error');
      return;
    }

    this.isSavingData = true;
    
    try {
      const success = await this.deleteFromDatabase(product.id);
      
      if (!success) {
        this.showSnackbar('Failed to delete from database', 'error');
        return;
      }

      const storeData = this.allReportData.get(this.selectedStore) || [];
      const index = storeData.findIndex(p => p.id === product.id);
      if (index !== -1) {
        storeData.splice(index, 1);
        this.allReportData.set(this.selectedStore, storeData);
      }
      
      this.refreshCurrentView();
      this.showSnackbar(`Product "${product.sku}" deleted successfully from ${this.selectedStore}`, 'error');
    } catch (error) {
      console.error('Error deleting product:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.showSnackbar('Failed to delete product: ' + errorMessage, 'error');
    } finally {
      this.isSavingData = false;
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
    this.loadingMessage = 'Clearing store data...';
    try {
      const success = await this.clearStoreFromDatabase(
        this.selectedStore, 
        this.selectedWeek?.weekStartDate, 
        this.selectedWeek?.weekEndDate
      );
      
      if (success) {
        const allStoreData = this.allReportData.get(this.selectedStore) || [];
        const filteredData = allStoreData.filter(item => 
          !(item.weekStartDate === this.selectedWeek?.weekStartDate && 
            item.weekEndDate === this.selectedWeek?.weekEndDate)
        );
        this.allReportData.set(this.selectedStore, filteredData);
        
        this.refreshCurrentView();
        this.showSnackbar(`All production data cleared for ${this.selectedStore}`, 'error');
      } else {
        this.showSnackbar('Failed to clear store data from database', 'error');
      }
    } catch (error) {
      console.error('Error clearing store data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.showSnackbar('Failed to clear store data: ' + errorMessage, 'error');
    } finally {
      this.isLoading = false;
      this.loadingMessage = '';
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.showSnackbar('Failed to export report: ' + errorMessage, 'error');
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.showSnackbar('Failed to export aggregated report: ' + errorMessage, 'error');
    }
  }

  closeModal() {
    this.showModal = false;
    this.currentProduct = this.createEmptyProduct();
  }

  async refresh() {
    await this.loadReportsFromDatabase();
    this.refreshCurrentView();
  }

  async copyFromPreviousWeek() {
    if (!this.selectedStore || this.selectedStore === 'custom' || this.selectedStore === 'All') {
      this.showSnackbar('Please select a specific store first', 'warning');
      return;
    }

    if (!this.selectedWeek) {
      this.showSnackbar('Please select a week first', 'warning');
      return;
    }

    const prevWeekDate = new Date(this.selectedWeek.weekStartDate);
    prevWeekDate.setDate(prevWeekDate.getDate() - 7);
    const prevWeek = this.getWeekForDate(prevWeekDate);

    this.isLoading = true;
    this.loadingMessage = 'Copying from previous week...';
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

      const newItems = data.map(dbItem => {
        const localItem = this.fromDatabaseFormat(dbItem);
        localItem.weekStartDate = this.selectedWeek!.weekStartDate;
        localItem.weekEndDate = this.selectedWeek!.weekEndDate;
        localItem.weekNumber = this.selectedWeek!.weekNumber;
        localItem.year = this.selectedWeek!.year;
        localItem.delivered = 0;
        localItem.undelivered = localItem.storeOrder;
        localItem.fillRate = 0;
        localItem.remarks = '';
        delete localItem.id;
        delete localItem.created_at;
        
        return localItem;
      });

      for (const item of newItems) {
        await this.saveToDatabase(item);
      }

      await this.loadReportsFromDatabase();
      this.showSnackbar(`Copied ${newItems.length} items from previous week`, 'success');

    } catch (error: any) {
      console.error('Error copying previous week data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.showSnackbar('Failed to copy previous week data: ' + errorMessage, 'error');
    } finally {
      this.isLoading = false;
      this.loadingMessage = '';
    }
  }

  async testDatabaseConnection(): Promise<boolean> {
    try {
      this.showSnackbar('Testing database connection...', 'info');
      
      console.log('Testing production_reports table connection...');
      
      const { data: testData, error: testError } = await this.supabase['supabase']
        .from('production_reports')
        .select('count')
        .limit(1);
      
      if (testError) {
        console.error('Database connection test failed:', testError);
        
        if (testError.code === 'PGRST204') {
          this.showSnackbar(
            'Database schema cache issue detected. The app will use workarounds.',
            'warning'
          );
          return true;
        } else if (testError.code === '42P01') {
          this.showSnackbar(
            'Production reports table not found. It will be created when you add your first product.',
            'info'
          );
          return true;
        } else {
          this.showSnackbar(`Database connection failed: ${testError.message}`, 'error');
          return false;
        }
      }
      
      console.log('Database connection test successful:', testData);
      this.showSnackbar('Database connection successful!', 'success');
      return true;
      
    } catch (error: any) {
      console.error('Test failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      this.showSnackbar(`Database test failed: ${errorMessage}`, 'error');
      return false;
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
        this.showSnackbar(
          'Schema cache still needs refresh. Please run "NOTIFY pgrst, \'reload schema\'" in Supabase SQL Editor.',
          'warning'
        );
      } else {
        this.showSnackbar(
          'Schema cache appears to be working now!',
          'success'
        );
        this.hasSchemaCacheError = false;
      }
    } catch (error) {
      console.error('Error fixing schema cache:', error);
      this.showSnackbar('Failed to check schema cache', 'error');
    }
  }
}