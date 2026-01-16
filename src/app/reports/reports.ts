import { Component, OnInit, ChangeDetectorRef, HostListener } from '@angular/core';
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
  productionDate: string;
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
  productionDate: string;
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
  production_date: string;
  created_at?: string;
  updated_at?: string;
}

interface SkuCatalogItem {
  id?: string;
  sku: string;
  description: string;
  um?: string;
  price?: number;
  type?: string;
}

interface LocationNode {
  name: string;
  value: string;
  children?: LocationNode[];
  level: number;
  expanded?: boolean;
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
  
  // Location tree structure
  locationTree: LocationNode[] = [
    {
      name: 'All Locations',
      value: 'All',
      level: 0,
      expanded: false
    },
    {
      name: 'CTK',
      value: 'CTK',
      level: 0,
      expanded: false
    },
    {
      name: 'CSCNQ',
      value: 'CSCNQ',
      level: 0,
      expanded: false,
      children: [
        { name: 'FG NG', value: 'FG NG', level: 1 },
        { name: 'FG BAAO', value: 'FG BAAO', level: 1 }
      ]
    },
    {
      name: 'ALMASOR',
      value: 'ALMASOR',
      level: 0,
      expanded: false,
      children: [
        { name: 'FG LC', value: 'FG LC', level: 1 },
        { name: 'FGE IRS', value: 'FGE IRS', level: 1 },
        { name: 'FGE SoR RZL', value: 'FGE SoR RZL', level: 1 },
        { name: 'FGE MBT', value: 'FGE MBT', level: 1 },
        { name: 'FGE DRG', value: 'FGE DRG', level: 1 },
        { name: 'FGE LTC', value: 'FGE LTC', level: 1 },
        { name: 'FGE PLG2', value: 'FGE PLG2', level: 1 },
        { name: 'FGE PIO', value: 'FGE PIO', level: 1 },
        { name: 'FTG LC', value: 'FTG LC', level: 1 },
        { name: 'FTG TA', value: 'FTG TA', level: 1 }
      ]
    },
    {
      name: 'CN',
      value: 'CN',
      level: 0,
      expanded: false,
      children: [
        { name: 'CN LC', value: 'CN LC', level: 1 },
        { name: 'CN HALL', value: 'CN HALL', level: 1 },
        { name: 'CN TA', value: 'CN TA', level: 1 }
      ]
    }
  ];
  
  // Flattened store list for compatibility
  predefinedStores: string[] = [
    'All',
    'CTK',
    'CSCNQ',
    'FG NG',
    'FG BAAO',
    'ALMASOR',
    'FG LC',
    'FGE IRS',
    'FGE SoR RZL',
    'FGE MBT',
    'FGE DRG',
    'FGE LTC',
    'FGE PLG2',
    'FGE PIO',
    'FTG LC',
    'FTG TA',
    'CN',
    'CN LC',
    'CN HALL',
    'CN TA'
  ];
  
  customStores: string[] = [];
  allStores: string[] = ['All', ...this.predefinedStores.filter(s => s !== 'All')];
  
  // UI state for location dropdown
  showLocationDropdown = false;
  selectedLocationPath: string = 'Select Location';
  isLocationHovered = false;
  
  // Date management
  selectedDate: string = new Date().toISOString().split('T')[0];
  showDateSelector = false;
  
  // Calendar state
  currentMonth: number;
  currentYear: number;
  calendarDays: number[] = [];
  
  // Product types
  productTypes: string[] = [
    'Finished Goods',
    'Raw Materials',
    'Packaging',
    'Semi-Finished',
    'Others'
  ];
  
  // Data management
  originalReportData: Map<string, ReportItem[]> = new Map();
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
  
  // Filtered data storage
  filteredStoreData: ReportItem[] = [];
  filteredAggregatedData: AggregatedItem[] = [];
  
  // Snackbar
  snackbarMessage = '';
  snackbarType: 'success' | 'error' | 'warning' | 'info' = 'success';
  snackbarTimeout: any;

  constructor(
    private cdr: ChangeDetectorRef,
    private supabase: SupabaseService
  ) {
    // Initialize with today's date
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    this.selectedDate = `${year}-${month}-${day}`;
    
    // Initialize calendar
    this.currentMonth = today.getMonth();
    this.currentYear = today.getFullYear();
  }

  ngOnInit() {
    this.testDatabaseConnection().then(success => {
      if (success) {
        this.loadSkuCatalog().then(() => this.loadReportsFromDatabase());
      }
    });
    
    // Initialize calendar
    this.generateCalendar();
  }

  // ==================== DATE SELECTOR & CALENDAR ====================
  
  toggleDateSelector(event: Event) {
    event.stopPropagation();
    this.showDateSelector = !this.showDateSelector;
    this.showLocationDropdown = false;
    this.generateCalendar();
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
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  }

  getDayOfWeek(dateString: string): string {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
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
    
    if (!this.selectedDate) return false;
    
    const [selectedYear, selectedMonth, selectedDay] = this.selectedDate.split('-').map(Number);
    return selectedYear === this.currentYear &&
           selectedMonth - 1 === this.currentMonth &&
           selectedDay === day;
  }

  selectDateFromCalendar(day: number) {
    if (day === 0) return;
    
    // Create date in local timezone
    const year = this.currentYear;
    const month = this.currentMonth + 1; // JavaScript months are 0-based
    const date = day;
    
    // Format as YYYY-MM-DD
    const newDate = `${year}-${month.toString().padStart(2, '0')}-${date.toString().padStart(2, '0')}`;
    
    if (this.selectedDate !== newDate) {
      this.selectedDate = newDate;
      this.showDateSelector = false;
      this.onDateChange();
    }
  }

  selectToday() {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const day = today.getDate().toString().padStart(2, '0');
    
    this.selectedDate = `${year}-${month}-${day}`;
    this.currentMonth = today.getMonth();
    this.currentYear = today.getFullYear();
    this.generateCalendar();
    this.showDateSelector = false;
    this.onDateChange();
  }

  selectYesterday() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const year = yesterday.getFullYear();
    const month = (yesterday.getMonth() + 1).toString().padStart(2, '0');
    const day = yesterday.getDate().toString().padStart(2, '0');
    
    this.selectedDate = `${year}-${month}-${day}`;
    this.currentMonth = yesterday.getMonth();
    this.currentYear = yesterday.getFullYear();
    this.generateCalendar();
    this.showDateSelector = false;
    this.onDateChange();
  }

  selectLastWeek() {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const year = lastWeek.getFullYear();
    const month = (lastWeek.getMonth() + 1).toString().padStart(2, '0');
    const day = lastWeek.getDate().toString().padStart(2, '0');
    
    this.selectedDate = `${year}-${month}-${day}`;
    this.currentMonth = lastWeek.getMonth();
    this.currentYear = lastWeek.getFullYear();
    this.generateCalendar();
    this.showDateSelector = false;
    this.onDateChange();
  }

  // ==================== LOCATION DROPDOWN METHODS ====================
  
  toggleLocationDropdown(event: Event) {
    event.stopPropagation();
    this.showLocationDropdown = !this.showLocationDropdown;
    this.showDateSelector = false;
    this.cdr.detectChanges();
  }

  selectLocation(node: LocationNode, event: Event) {
    event.stopPropagation();
    
    if (node.children && node.children.length > 0) {
      node.expanded = !node.expanded;
      this.cdr.detectChanges();
    } else {
      this.selectedStore = node.value;
      this.selectedLocationPath = this.getLocationDisplayName();
      this.showLocationDropdown = false;
      this.onStoreChange();
    }
  }

  toggleLocationExpand(node: LocationNode, event: Event) {
    event.stopPropagation();
    if (node.children && node.children.length > 0) {
      node.expanded = !node.expanded;
    }
  }

  getLocationDisplayName(): string {
    if (!this.selectedStore) return 'Select Location';
    if (this.selectedStore === 'All') return 'All Locations';
    
    const node = this.findNodeInTree(this.selectedStore);
    return node ? node.name : this.selectedStore;
  }

  findNodeInTree(value: string): LocationNode | null {
    const search = (nodes: LocationNode[]): LocationNode | null => {
      for (const node of nodes) {
        if (node.value === value) return node;
        if (node.children) {
          const found = search(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    return search(this.locationTree);
  }

  // ==================== DROPDOWN MANAGEMENT ====================
  
  closeAllDropdowns() {
    this.showDateSelector = false;
    this.showLocationDropdown = false;
    this.cdr.detectChanges();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    const isDateSelector = target.closest('.date-selector');
    const isDateDropdown = target.closest('.date-dropdown');
    const isLocationSelector = target.closest('.location-selector');
    const isLocationDropdown = target.closest('.location-tree-dropdown');
    const isOverlay = target.closest('.date-dropdown-overlay') || target.closest('.location-dropdown-overlay');
    
    if (this.showDateSelector && !isDateSelector && !isDateDropdown && !isOverlay) {
      this.showDateSelector = false;
      this.cdr.detectChanges();
    }
    
    if (this.showLocationDropdown && !isLocationSelector && !isLocationDropdown && !isOverlay) {
      this.showLocationDropdown = false;
      this.cdr.detectChanges();
    }
  }

  // ==================== SKU CATALOG METHODS ====================
  
  async loadSkuCatalog() {
    this.isLoadingCatalog = true;
    try {
      const { data, error } = await this.supabase['supabase']
        .from('sku_catalog')
        .select('*')
        .order('sku');

      if (error) {
        console.error('Error loading SKU catalog:', error);
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
    console.log('createSkuCatalogTable: called (stub)');
    this.showSnackbar('Created SKU catalog (local seed)', 'info');
  }

  async insertDefaultSkus() {
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

  // ==================== DATE INITIALIZATION ====================
  
  async initializeDateWithAllSkus() {
    if (!this.selectedStore || this.selectedStore === 'custom' || this.selectedStore === 'All') {
      this.showSnackbar('Please select a specific store first', 'warning');
      return;
    }

    if (!this.selectedDate) {
      this.showSnackbar('Please select a date first', 'warning');
      return;
    }

    if (this.skuCatalog.length === 0) {
      this.showSnackbar('SKU catalog is empty. Please load SKUs first.', 'warning');
      return;
    }

    if (!confirm(`Initialize ${this.formatDate(this.selectedDate)} for ${this.selectedStore} with all SKUs? This may take a moment.`)) {
      return;
    }

    this.isInitializing = true;
    this.isLoading = true;
    this.loadingMessage = 'Initializing date with all SKUs...';
    this.loadingProgress = '0%';
    
    try {
      const storeData = this.allReportData.get(this.selectedStore) || [];
      const originalStoreData = this.originalReportData.get(this.selectedStore) || [];
      
      const totalSkus = this.skuCatalog.length;
      let processedCount = 0;
      let insertedCount = 0;
      let skippedCount = 0;
      
      const batchSize = 10;
      for (let i = 0; i < totalSkus; i += batchSize) {
        const batch = this.skuCatalog.slice(i, i + batchSize);
        
        for (const skuItem of batch) {
          processedCount++;
          
          const progressPercentage = Math.round((processedCount / totalSkus) * 100);
          this.loadingProgress = `${progressPercentage}% (${processedCount}/${totalSkus})`;
          this.cdr.detectChanges();
          
          const exists = storeData.some(p => p.sku === skuItem.sku && p.productionDate === this.selectedDate);
          if (exists) {
            skippedCount++;
            continue;
          }
          
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
            productionDate: this.selectedDate
          };
          
          try {
            const savedItem = await this.saveToDatabase(newItem);
            if (savedItem) {
              storeData.push(savedItem);
              originalStoreData.push(savedItem);
              insertedCount++;
            }
          } catch (error) {
            console.error(`Error inserting SKU ${skuItem.sku}:`, error);
          }
        }
        
        if (i + batchSize < totalSkus) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      this.allReportData.set(this.selectedStore, storeData);
      this.originalReportData.set(this.selectedStore, originalStoreData);
      
      this.showSnackbar(`Date initialized with ${insertedCount} SKUs (${skippedCount} already existed)`, 'success');
      this.loadStoreData();
    } catch (err) {
      console.error('Error initializing date:', err);
      this.showSnackbar('Failed to initialize date', 'error');
    } finally {
      this.isInitializing = false;
      this.isLoading = false;
      this.loadingMessage = '';
      this.loadingProgress = '';
    }
  }

  // ==================== DATABASE METHODS ====================
  
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

  async clearAllLocationsData() {
    if (!this.selectedDate) {
      this.showSnackbar('Please select a date first', 'warning');
      return;
    }

    const message = `🚨 CLEAR ALL DATA FOR ALL LOCATIONS\n\n` +
      `Date: ${this.formatDate(this.selectedDate)}\n` +
      `Day: ${this.getDayOfWeek(this.selectedDate)}\n\n` +
      `⚠️  This will permanently delete ALL production data for ALL locations for this date.\n` +
      `⚠️  This action cannot be undone!\n\n` +
      `Type "DELETE ALL" to confirm:`;

    const confirmation = prompt(message);
    
    if (confirmation !== 'DELETE ALL') {
      this.showSnackbar('Clear all operation cancelled', 'info');
      return;
    }

    // Double confirmation
    if (!confirm('LAST CONFIRMATION!\nAre you absolutely sure you want to delete ALL data for ALL locations?')) {
      return;
    }

    this.isLoading = true;
    this.loadingMessage = 'Clearing all locations data...';
    this.cdr.detectChanges();
    
    try {
      const { error } = await this.supabase['supabase']
        .from('production_reports')
        .delete()
        .eq('production_date', this.selectedDate);

      if (error) {
        throw error;
      }

      console.log(`Successfully deleted data for date ${this.selectedDate}`);

      const newOriginalData = new Map<string, ReportItem[]>();
      const newAllReportData = new Map<string, ReportItem[]>();
      
      this.originalReportData.forEach((storeItems, storeName) => {
        const remainingItems = storeItems.filter(item => 
          item.productionDate !== this.selectedDate
        );
        
        newOriginalData.set(storeName, remainingItems);
        newAllReportData.set(storeName, []);
      });
      
      this.originalReportData = newOriginalData;
      this.allReportData = newAllReportData;

      this.aggregatedData = [];
      this.displayedAggregatedData = [];
      this.filteredAggregatedData = [];
      
      this.displayedData = [];
      this.filteredStoreData = [];
      
      this.currentPage = 1;
      this.totalPages = 1;
      this.startIndex = 0;
      this.endIndex = 0;

      this.cdr.detectChanges();

      this.showSnackbar(
        `✅ Successfully cleared ALL data for ${this.formatDate(this.selectedDate)}`,
        'success'
      );

      if (this.selectedStore === 'All') {
        this.calculateAggregatedData();
        this.applyAggregatedFilters();
      } else if (this.selectedStore && this.selectedStore !== 'custom') {
        this.loadStoreData();
        this.applyFiltersAndSearch();
      }

    } catch (error: any) {
      console.error('Error clearing all locations data:', error);
      this.showSnackbar(
        `❌ Failed to clear all locations data: ${error?.message || String(error)}`,
        'error'
      );
    } finally {
      this.isLoading = false;
      this.loadingMessage = '';
      this.cdr.detectChanges();
    }
  }

  // ==================== DATA LOADING ====================
  
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
        this.originalReportData.clear();
        this.allReportData.clear();
        this.aggregatedData = [];
        this.displayedAggregatedData = [];
        
        data.forEach(dbItem => {
          const localItem = this.fromDatabaseFormat(dbItem);
          const store = localItem.store;
          
          if (!this.originalReportData.has(store)) {
            this.originalReportData.set(store, []);
          }
          this.originalReportData.get(store)!.push(localItem);
          
          if (!this.predefinedStores.includes(store) && !this.customStores.includes(store)) {
            this.customStores.push(store);
            if (!this.allStores.includes(store)) {
              this.allStores.splice(1, 0, store);
            }
          }
        });
        
        const storesWithoutAll = this.allStores.filter(s => s !== 'All');
        storesWithoutAll.sort();
        this.allStores = ['All', ...storesWithoutAll];
        
        this.filterDataByDate();
        
        this.showSnackbar(`Loaded ${data.length} production items across ${this.originalReportData.size} stores`, 'success');
        
      } else {
        this.showSnackbar('No production data found. Start by selecting a store and adding products.', 'info');
      }
      
    } catch (error: any) {
      console.error('Error loading reports:', error);
      this.showSnackbar('Failed to load production data: ' + error.message, 'error');
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  // ==================== DATA FILTERING ====================
  
  filterDataByDate() {
    if (!this.selectedDate) {
      this.allReportData = new Map(this.originalReportData);
    } else {
      const filteredData = new Map<string, ReportItem[]>();
      
      this.originalReportData.forEach((storeItems, storeName) => {
        const dateItems = storeItems.filter(item => 
          item.productionDate === this.selectedDate
        );
        
        if (dateItems.length > 0) {
          filteredData.set(storeName, dateItems);
        } else {
          filteredData.set(storeName, []);
        }
      });
      
      this.allReportData = filteredData;
    }
    
    if (this.selectedStore === 'All') {
      this.loadAggregatedData();
    } else if (this.selectedStore && this.selectedStore !== 'custom') {
      this.loadStoreData();
    }
  }

  onDateChange() {
    // Ensure calendar shows correct month/year for selected date
    if (this.selectedDate) {
      const [year, month] = this.selectedDate.split('-').map(Number);
      this.currentMonth = month - 1;
      this.currentYear = year;
      this.generateCalendar();
    }
    
    this.filterDataByDate();
    this.currentPage = 1;
    this.searchQuery = '';
    this.cdr.detectChanges();
  }

  onStoreChange() {
    this.selectedLocationPath = this.getLocationDisplayName();
    
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
    this.filteredStoreData = [...storeData];
    this.applyFiltersAndSearch();
  }

  loadAggregatedData() {
    this.showAggregatedView = true;
    this.calculateAggregatedData();
    this.applyAggregatedFilters();
  }

  calculateAggregatedData() {
    const skuMap = new Map<string, AggregatedItem>();
    
    this.allReportData.forEach((storeItems, storeName) => {
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
            productionDate: item.productionDate
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
    this.filteredAggregatedData = [...this.aggregatedData];
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
    
    this.originalReportData.set(storeName, []);
    this.allReportData.set(storeName, []);
    
    this.showSnackbar(`Store "${storeName}" added successfully`, 'success');
    this.loadStoreData();
  }

  // ==================== DATA FORMAT CONVERSION ====================
  
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
      productionDate: dbItem.production_date || this.selectedDate,
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
      production_date: localItem.productionDate
    };
    
    if (localItem.id) {
      dbItem.id = localItem.id;
    }
    
    return dbItem;
  }

  // ==================== UI HELPERS ====================
  
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

  // ==================== DATABASE OPERATIONS ====================
  
  async saveToDatabase(item: ReportItem): Promise<ReportItem | null> {
    try {
      const dbItem = this.toDatabaseFormat(item);
      
      let result;
      
      if (item.id) {
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
        const { data, error } = await this.supabase['supabase']
          .from('production_reports')
          .insert([dbItem])
          .select();
        
        if (error) {
          console.error('Insert error:', {
            code: error.code,
            message: error.message,
            details: error.details
          });
          throw error;
        }
        
        result = data;
      }
      
      if (result && result.length > 0) {
        return this.fromDatabaseFormat(result[0]);
      }
      
      return null;
      
    } catch (error: any) {
      console.error('Error saving to database:', error);
      
      if (error.code === 'PGRST204') {
        this.showSnackbar(
          'Database schema cache issue. Please refresh page in 30 seconds.',
          'warning'
        );
      } else if (error.code === '23505') {
        if (!this.isInitializing) {
          this.showSnackbar(
            `Product "${item.sku}" already exists for this store and date.`,
            'error'
          );
        }
      } else if (error.code === '23502') {
        this.showSnackbar(
          'Database error: Required fields missing.',
          'error'
        );
      } else if (error.code === '42P01') {
        this.showSnackbar(
          'Production reports table not found. Please create it in Supabase.',
          'error'
        );
      } else if (!this.isInitializing) {
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

  async clearStoreFromDatabase(storeName: string, productionDate?: string): Promise<boolean> {
    try {
      let query = this.supabase['supabase']
        .from('production_reports')
        .delete()
        .eq('store', storeName);
      
      if (productionDate) {
        query = query.eq('production_date', productionDate);
      }
      
      const { error } = await query;
      
      if (error) throw error;
      return true;
    } catch (error: any) {
      console.error('Error clearing store data:', error);
      throw error;
    }
  }

  // ==================== FILTERING & SEARCH ====================
  
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
      
      this.filteredStoreData = filtered;
      this.updatePagination();
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
    
    this.filteredAggregatedData = filtered;
    this.updateAggregatedPagination();
  }

  updatePagination() {
    if (this.searchQuery.trim()) {
      this.currentPage = 1;
    }
    
    const dataToUse = this.searchQuery.trim() ? this.filteredStoreData : this.getCurrentStoreData();
    
    this.totalPages = Math.max(Math.ceil(dataToUse.length / this.itemsPerPage), 1);
    
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
    
    this.startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.endIndex = Math.min(this.startIndex + this.itemsPerPage, dataToUse.length);
    this.displayedData = dataToUse.slice(this.startIndex, this.endIndex);
    
    this.cdr.detectChanges();
  }

  updateAggregatedPagination() {
    if (this.searchQuery.trim()) {
      this.currentPage = 1;
    }
    
    const dataToUse = this.searchQuery.trim() ? this.filteredAggregatedData : this.aggregatedData;
    
    this.totalPages = Math.max(Math.ceil(dataToUse.length / this.itemsPerPage), 1);
    
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
    
    this.startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.endIndex = Math.min(this.startIndex + this.itemsPerPage, dataToUse.length);
    this.displayedAggregatedData = dataToUse.slice(this.startIndex, this.endIndex);
    
    this.cdr.detectChanges();
  }

  nextPage() { 
    if (this.currentPage < this.totalPages) { 
      this.currentPage++; 
      if (this.selectedStore === 'All') {
        this.applyAggregatedFilters();
      } else {
        this.applyFiltersAndSearch();
      }
    }
  }
  
  previousPage() { 
    if (this.currentPage > 1) { 
      this.currentPage--; 
      if (this.selectedStore === 'All') {
        this.applyAggregatedFilters();
      } else {
        this.applyFiltersAndSearch();
      }
    }
  }

  // ==================== PRODUCT MANAGEMENT ====================
  
  createEmptyProduct(): ReportItem {
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
      productionDate: this.selectedDate
    };
  }

  async calculateRow(item: ReportItem) {
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
        const savedItem = await this.saveToDatabase(item);
        if (savedItem) {
          this.updateItemInOriginalData(savedItem);
        }
      } catch (error: any) {
        console.error('Error saving calculation:', error);
        this.showSnackbar('Failed to save changes to database: ' + (error?.message || String(error)), 'error');
      }
    }
  }

  private updateItemInOriginalData(updatedItem: ReportItem) {
    const store = updatedItem.store;
    const originalStoreData = this.originalReportData.get(store);
    if (originalStoreData) {
      const index = originalStoreData.findIndex(p => p.id === updatedItem.id);
      if (index !== -1) {
        originalStoreData[index] = updatedItem;
        this.originalReportData.set(store, originalStoreData);
      }
    }
  }

  getFillRateClass(fillRate: number): string {
    if (fillRate >= 90) return 'high';
    if (fillRate >= 70) return 'medium';
    return 'low';
  }

  // ==================== SNACKBAR ====================
  
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

  // ==================== PRODUCT MODAL ====================
  
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

    try {
      const savedItem = await this.saveToDatabase(this.currentProduct);
      
      if (!savedItem) {
        this.showSnackbar('Failed to save product to database', 'error');
        return;
      }

      const originalStoreData = this.originalReportData.get(this.selectedStore) || [];
      const filteredStoreData = this.allReportData.get(this.selectedStore) || [];
      
      if (this.isEditing) {
        const origIndex = originalStoreData.findIndex(p => p.id === savedItem.id);
        if (origIndex !== -1) {
          originalStoreData[origIndex] = savedItem;
        }
        
        const filtIndex = filteredStoreData.findIndex(p => p.id === savedItem.id);
        if (filtIndex !== -1) {
          filteredStoreData[filtIndex] = savedItem;
        }
        
        this.originalReportData.set(this.selectedStore, originalStoreData);
        this.allReportData.set(this.selectedStore, filteredStoreData);
        
        this.showSnackbar(`Product "${savedItem.sku}" updated successfully`, 'success');
      } else {
        if (originalStoreData.some(p => p.sku === savedItem.sku && 
            p.productionDate === savedItem.productionDate)) {
          this.showSnackbar(`Product with SKU "${savedItem.sku}" already exists in this store for the selected date`, 'error');
          return;
        }
        
        originalStoreData.unshift(savedItem);
        this.originalReportData.set(this.selectedStore, originalStoreData);
        
        if (this.selectedDate && savedItem.productionDate === this.selectedDate) {
          filteredStoreData.unshift(savedItem);
          this.allReportData.set(this.selectedStore, filteredStoreData);
        }
        
        this.showSnackbar(`Product "${savedItem.sku}" added successfully to ${this.selectedStore}`, 'success');
      }

      if (this.selectedStore === 'All') {
        this.loadAggregatedData();
      } else {
        this.loadStoreData();
      }
      
      this.closeModal();
    } catch (error: any) {
      console.error('Error saving product:', error);
      
      if (error.code === '23505') {
        this.showSnackbar(`Product with SKU "${this.currentProduct.sku}" already exists in database for this date`, 'error');
      } else {
        this.showSnackbar('Failed to save product: ' + error.message, 'error');
      }
    }
  }

  async deleteProduct(product: ReportItem) {
    if (!confirm(`Are you sure you want to delete "${product.sku}" from ${this.selectedStore} for ${this.formatDate(product.productionDate)}?`)) return;

    if (!product.id) {
      this.showSnackbar('Cannot delete: Product ID not found', 'error');
      return;
    }

    try {
      const success = await this.deleteFromDatabase(product.id);
      
      if (!success) {
        this.showSnackbar('Failed to delete from database', 'error');
        return;
      }

      let originalStoreData = this.originalReportData.get(this.selectedStore) || [];
      let filteredStoreData = this.allReportData.get(this.selectedStore) || [];
      
      originalStoreData = originalStoreData.filter(p => p.id !== product.id);
      this.originalReportData.set(this.selectedStore, originalStoreData);
      
      filteredStoreData = filteredStoreData.filter(p => p.id !== product.id);
      this.allReportData.set(this.selectedStore, filteredStoreData);
      
      this.loadStoreData();
      this.showSnackbar(`Product "${product.sku}" deleted successfully from ${this.selectedStore}`, 'error');
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
    if (this.selectedDate) {
      message += `\nDate: ${this.formatDate(this.selectedDate)}`;
    }
    message += `\nThis will permanently delete ALL production data for this store.\nAre you absolutely sure?`;

    if (!confirm(message)) {
      return;
    }
    
    if (!confirm('LAST CHANCE!\nThis action cannot be undone.\nType "CLEAR" to confirm:')) {
      return;
    }
    
    if (prompt('Type CLEAR to confirm:') !== 'CLEAR') {
      this.showSnackbar('Clear operation cancelled', 'info');
      return;
    }

    this.isLoading = true;
    this.loadingMessage = `Clearing data for ${this.selectedStore}...`;
    this.cdr.detectChanges();
    
    try {
      const success = await this.clearStoreFromDatabase(
        this.selectedStore, 
        this.selectedDate
      );
      
      if (success) {
        this.allReportData.set(this.selectedStore, []);
        
        if (this.selectedDate) {
          const originalItems = this.originalReportData.get(this.selectedStore) || [];
          const remainingItems = originalItems.filter(item => 
            item.productionDate !== this.selectedDate
          );
          this.originalReportData.set(this.selectedStore, remainingItems);
        } else {
          this.originalReportData.set(this.selectedStore, []);
        }
        
        this.displayedData = [];
        this.filteredStoreData = [];
        
        this.currentPage = 1;
        this.totalPages = 1;
        this.startIndex = 0;
        this.endIndex = 0;
        
        this.cdr.detectChanges();
        
        this.loadStoreData();
        this.applyFiltersAndSearch();
        
        this.showSnackbar(`✅ All production data cleared for ${this.selectedStore}`, 'success');
      } else {
        this.showSnackbar('❌ Failed to clear store data from database', 'error');
      }
    } catch (error: any) {
      console.error('Error clearing store data:', error);
      this.showSnackbar(`❌ Failed to clear store data: ${error?.message || String(error)}`, 'error');
    } finally {
      this.isLoading = false;
      this.loadingMessage = '';
      this.cdr.detectChanges();
    }
  }

  // ==================== EXPORT ====================
  
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
      const dateInfo = storeData[0] ? `${this.formatDate(storeData[0].productionDate)} (${this.getDayOfWeek(storeData[0].productionDate)})` : '';
      
      const exportData: (string | number)[][] = [
        [`${this.selectedStore} - Daily Production Report - ${dateInfo} - Generated ${new Date().toLocaleString()}`],
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

      const fileName = `${this.selectedStore.replace(/[^a-z0-9]/gi, '_')}_${this.selectedDate}_Daily_Production_Report.xlsx`;
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
      const dateInfo = this.aggregatedData[0] ? `${this.formatDate(this.aggregatedData[0].productionDate)} (${this.getDayOfWeek(this.aggregatedData[0].productionDate)})` : '';
      
      const exportData: (string | number)[][] = [
        ['All Stores - Aggregated Daily Production Report - ' + dateInfo + ' - Generated ' + new Date().toLocaleString()],
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

      const fileName = `All_Stores_${this.selectedDate}_Aggregated_Daily_Production_Report.xlsx`;
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

  // ==================== OTHER METHODS ====================
  
  async refresh() {
    await this.loadReportsFromDatabase();
    if (this.selectedStore === 'All') {
      this.loadAggregatedData();
    } else if (this.selectedStore && this.selectedStore !== 'custom') {
      this.loadStoreData();
    }
  }

  async copyFromPreviousDay() {
    if (!this.selectedStore || this.selectedStore === 'custom' || this.selectedStore === 'All') {
      this.showSnackbar('Please select a specific store first', 'warning');
      return;
    }

    if (!this.selectedDate) {
      this.showSnackbar('Please select a date first', 'warning');
      return;
    }

    // Parse current date to get previous day
    const [currentYear, currentMonth, currentDay] = this.selectedDate.split('-').map(Number);
    const currentDate = new Date(currentYear, currentMonth - 1, currentDay);
    currentDate.setDate(currentDate.getDate() - 1);
    
    const prevYear = currentDate.getFullYear();
    const prevMonth = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const prevDay = currentDate.getDate().toString().padStart(2, '0');
    const prevDateStr = `${prevYear}-${prevMonth}-${prevDay}`;

    this.isLoading = true;
    this.loadingMessage = 'Copying data from previous day...';
    try {
      const { data, error } = await this.supabase['supabase']
        .from('production_reports')
        .select('*')
        .eq('store', this.selectedStore)
        .eq('production_date', prevDateStr);

      if (error) {
        console.error('Error loading previous day data:', error);
        this.showSnackbar('Failed to load previous day data: ' + error.message, 'error');
        return;
      }

      if (!data || data.length === 0) {
        this.showSnackbar('No data found for the previous day', 'info');
        return;
      }

      const newItems = data.map(dbItem => {
        const localItem = this.fromDatabaseFormat(dbItem);
        localItem.productionDate = this.selectedDate;
        localItem.delivered = 0;
        localItem.undelivered = localItem.storeOrder;
        localItem.fillRate = 0;
        localItem.remarks = '';
        delete localItem.id;
        delete localItem.created_at;
        
        return localItem;
      });

      let savedCount = 0;
      const totalItems = newItems.length;
      
      for (const item of newItems) {
        const savedItem = await this.saveToDatabase(item);
        if (savedItem) {
          let originalStoreData = this.originalReportData.get(this.selectedStore) || [];
          originalStoreData.push(savedItem);
          this.originalReportData.set(this.selectedStore, originalStoreData);
          
          let filteredStoreData = this.allReportData.get(this.selectedStore) || [];
          filteredStoreData.push(savedItem);
          this.allReportData.set(this.selectedStore, filteredStoreData);
          
          savedCount++;
          this.loadingProgress = `${savedCount}/${totalItems}`;
          this.cdr.detectChanges();
        }
      }

      this.loadStoreData();
      this.showSnackbar(`Copied ${savedCount} items from previous day`, 'success');

    } catch (error: any) {
      console.error('Error copying previous day data:', error);
      this.showSnackbar('Failed to copy previous day data: ' + (error?.message || String(error)), 'error');
    } finally {
      this.isLoading = false;
      this.loadingMessage = '';
      this.loadingProgress = '';
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

  // ==================== FILL RATE CALCULATIONS ====================
  
  getTotalFillRate(): number {
    const storeData = this.getCurrentStoreData();
    if (storeData.length === 0) return 0;
    
    const validItems = storeData.filter(item => item.storeOrder > 0);
    if (validItems.length === 0) return 0;
    
    const totalStoreOrder = validItems.reduce((sum, item) => sum + item.storeOrder, 0);
    const totalDelivered = validItems.reduce((sum, item) => sum + item.delivered, 0);
    
    if (totalStoreOrder === 0) return 0;
    return Math.round((totalDelivered / totalStoreOrder) * 100);
  }

  getAverageFillRate(): number {
    const storeData = this.getCurrentStoreData();
    if (storeData.length === 0) return 0;
    
    const validItems = storeData.filter(item => item.storeOrder > 0);
    if (validItems.length === 0) return 0;
    
    const totalFillRate = validItems.reduce((sum, item) => sum + item.fillRate, 0);
    return Math.round(totalFillRate / validItems.length);
  }

  getLowFillRateCount(): number {
    const storeData = this.getCurrentStoreData();
    const validItems = storeData.filter(item => item.storeOrder > 0);
    return validItems.filter(item => item.fillRate < 70).length;
  }

  getAggregatedTotalFillRate(): number {
    if (this.aggregatedData.length === 0) return 0;
    
    const validItems = this.aggregatedData.filter(item => item.totalStoreOrder > 0);
    if (validItems.length === 0) return 0;
    
    const totalStoreOrder = validItems.reduce((sum, item) => sum + item.totalStoreOrder, 0);
    const totalDelivered = validItems.reduce((sum, item) => sum + item.totalDelivered, 0);
    
    if (totalStoreOrder === 0) return 0;
    return Math.round((totalDelivered / totalStoreOrder) * 100);
  }

  getAggregatedAverageFillRate(): number {
    if (this.aggregatedData.length === 0) return 0;
    
    const validItems = this.aggregatedData.filter(item => item.totalStoreOrder > 0);
    if (validItems.length === 0) return 0;
    
    const totalFillRate = validItems.reduce((sum, item) => sum + item.fillRate, 0);
    return Math.round(totalFillRate / validItems.length);
  }

  getAggregatedLowFillRateCount(): number {
    const validItems = this.aggregatedData.filter(item => item.totalStoreOrder > 0);
    return validItems.filter(item => item.fillRate < 70).length;
  }
}