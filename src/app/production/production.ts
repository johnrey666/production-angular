import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime } from 'rxjs';
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

// Monthly Entry interface - Now same as ProductionEntry but with aggregated data
interface MonthlyEntry {
  recipe: ProductionRecipe;
  orderKg: number;          // Total order for the month
  isExpanded: boolean;      // Collapsible state
  daysWithOrders: number;   // Number of days with orders
  totalActualOutput: number; // Sum of actual output for the month
  totalRawMatCost: number;   // Sum of raw material cost for the month
  skus: ProductionSku[];     // Aggregated SKU data for the month
  premixes: ProductionSku[]; // Aggregated premix data for the month
}

// Helper function to convert RecipeItem to ProductionSku
function convertRecipeItemToProductionSku(item: RecipeItem): ProductionSku {
  return {
    ...item,
    actualOutput: 0,
    variance: 0,
    rawMatCost: 0,
    remark: ''
  };
}

// Helper function to convert RecipeWithDetails to ProductionRecipe
function convertRecipeWithDetailsToProductionRecipe(recipe: RecipeWithDetails): ProductionRecipe {
  return {
    id: recipe.id,
    name: recipe.name,
    std_yield: recipe.std_yield,
    created_at: recipe.created_at,
    skus: recipe.skus.map(convertRecipeItemToProductionSku),
    premixes: recipe.premixes.map(convertRecipeItemToProductionSku)
  };
}

@Component({
  selector: 'app-production',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './production.html',
  styleUrls: ['./production.css']
})
export class ProductionComponent implements OnInit, OnDestroy {
  private supabase = inject(SupabaseService);
  private cdr = inject(ChangeDetectorRef);
  
  // Auto-save subject
  private saveSubject = new Subject<void>();
  private autoSaveSubscription: any;

  // Data
  entries: ProductionEntry[] = [];
  filteredEntries: ProductionEntry[] = [];
  monthlyEntries: MonthlyEntry[] = [];
  filteredMonthlyEntries: MonthlyEntry[] = [];
  
  // Dates
  selectedDate: string = new Date().toISOString().split('T')[0];
  availableDates: string[] = [];
  
  // Calendar state
  showCalendar = false;
  currentMonth: number;
  currentYear: number;
  calendarDays: number[] = [];
  monthlyTotal: number = 0;
  productionByDay = new Map<number, number>();
  
  // View Mode
  viewMode: 'daily' | 'monthly' = 'daily';
  
  // UI State
  isLoading = false;
  errorMessage = '';
  searchQuery = '';
  monthlySearchQuery = '';
  isDataLoadedFromStorage = false; // Track if data is from localStorage
  
  // Snackbar
  snackbarMessage = '';
  snackbarType: 'success' | 'error' | 'warning' | 'info' = 'success';
  snackbarTimeout: any;
  
  // Pagination
  currentPage = 1;
  monthlyCurrentPage = 1;
  itemsPerPage = 5;

  get today(): string {
    return new Date().toISOString().split('T')[0];
  }

  get monthlyPaginated() {
    const start = (this.monthlyCurrentPage - 1) * this.itemsPerPage;
    return this.filteredMonthlyEntries.slice(start, start + this.itemsPerPage);
  }

  get monthlyTotalPages(): number {
    return Math.max(1, Math.ceil(this.filteredMonthlyEntries.length / this.itemsPerPage));
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
    
    // Setup auto-save with debounce (shorter delay)
    this.setupAutoSave();
  }

  ngOnDestroy() {
    if (this.autoSaveSubscription) {
      this.autoSaveSubscription.unsubscribe();
    }
    if (this.snackbarTimeout) {
      clearTimeout(this.snackbarTimeout);
    }
  }

  // Calendar Methods
  async toggleCalendar() {
    // Close if already open, open if closed
    if (this.showCalendar) {
      this.showCalendar = false;
    } else {
      this.showCalendar = true;
      await this.loadMonthlyTotal();
    }
    
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
    this.loadMonthlyTotal();
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
    this.loadMonthlyTotal();
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

  // Select date for daily view
  async selectDate(day: number) {
    if (day === 0) return;

    // Close calendar immediately
    this.showCalendar = false;
    
    // Create date using local time (no timezone shift)
    const selected = new Date(this.currentYear, this.currentMonth, day);
    
    // Manually format to YYYY-MM-DD to avoid any ISO timezone issues
    const newDate = 
      selected.getFullYear() + '-' +
      String(selected.getMonth() + 1).padStart(2, '0') + '-' +
      String(selected.getDate()).padStart(2, '0');

    // Only load data if date changed
    if (this.selectedDate !== newDate) {
      this.selectedDate = newDate;
      this.viewMode = 'daily';
      
      // Keep calendar on correct month
      this.currentMonth = selected.getMonth();
      this.currentYear = selected.getFullYear();
      this.generateCalendar();

      await this.onDateChange();
    }
    
    this.cdr.detectChanges();
  }

  // Show monthly view
  async showMonthlyView() {
    this.showCalendar = false;
    this.viewMode = 'monthly';
    this.monthlySearchQuery = ''; // Reset search for monthly view
    this.monthlyCurrentPage = 1; // Reset pagination for monthly view
    
    // Set loading state and then load data
    this.isLoading = true;
    this.cdr.detectChanges(); // Force UI update
    
    try {
      await this.loadMonthlyData();
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  // Switch back to daily view
  switchToDailyView() {
    this.viewMode = 'daily';
    this.loadData();
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

  hasProduction(day: number): boolean {
    return this.productionByDay.has(day) && this.productionByDay.get(day)! > 0;
  }

  getDayProduction(day: number): number {
    return this.productionByDay.get(day) || 0;
  }

  // Quick date selection methods
  async selectToday() {
    const today = new Date();
    this.selectedDate = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');
      
    this.currentMonth = today.getMonth();
    this.currentYear = today.getFullYear();
    this.generateCalendar();
    this.showCalendar = false;
    this.viewMode = 'daily';
    
    // Add small delay to ensure UI updates
    setTimeout(() => {
      this.onDateChange();
    }, 10);
    
    this.cdr.detectChanges();
  }

  async selectYesterday() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    this.selectedDate = yesterday.getFullYear() + '-' +
      String(yesterday.getMonth() + 1).padStart(2, '0') + '-' +
      String(yesterday.getDate()).padStart(2, '0');
      
    this.currentMonth = yesterday.getMonth();
    this.currentYear = yesterday.getFullYear();
    this.generateCalendar();
    this.showCalendar = false;
    this.viewMode = 'daily';
    
    // Add small delay to ensure UI updates
    setTimeout(() => {
      this.onDateChange();
    }, 10);
    
    this.cdr.detectChanges();
  }

  async selectLastWeek() {
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    this.selectedDate = lastWeek.getFullYear() + '-' +
      String(lastWeek.getMonth() + 1).padStart(2, '0') + '-' +
      String(lastWeek.getDate()).padStart(2, '0');
      
    this.currentMonth = lastWeek.getMonth();
    this.currentYear = lastWeek.getFullYear();
    this.generateCalendar();
    this.showCalendar = false;
    this.viewMode = 'daily';
    
    // Add small delay to ensure UI updates
    setTimeout(() => {
      this.onDateChange();
    }, 10);
    
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

  // Initialize available dates
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

  // Auto-save setup with debounce (shorter delay)
  private setupAutoSave() {
    this.autoSaveSubscription = this.saveSubject
      .pipe(debounceTime(500)) // Reduced from 2000ms to 500ms for faster saving
      .subscribe(() => {
        this.autoSaveToDatabase();
      });
  }

  private triggerAutoSave() {
    this.saveSubject.next();
  }

  // Load data for selected date - FIXED: Always show all recipes
  async loadData() {
    this.isLoading = true;
    this.errorMessage = '';
    this.isDataLoadedFromStorage = false;
    
    try {
      // Always get all recipes first
      const recipes = (await this.supabase.getAllRecipesWithDetails()) || [];
      
      // Get saved data for this date
      const savedData = await this.loadSavedProductionData(this.selectedDate);
      
      // Create entries for ALL recipes
      this.entries = recipes.map(recipe => {
        const recipeId = recipe.id || '';
        
        // Find saved entry for this recipe
        const savedEntry = savedData.find(entry => entry.recipe.id === recipeId);
        
        if (savedEntry) {
          // Use saved data
          return {
            recipe: savedEntry.recipe,
            orderKg: savedEntry.orderKg,
            isExpanded: false
          };
        } else {
          // Create fresh entry
          const productionRecipe = convertRecipeWithDetailsToProductionRecipe(recipe);
          
          return {
            recipe: productionRecipe,
            orderKg: 0,
            isExpanded: false
          };
        }
      });
      
      // Check if there's unsaved data in localStorage
      const localStorageData = this.loadFromLocalStorage();
      if (localStorageData && localStorageData.length > 0) {
        this.entries = this.mergeLocalStorageData(this.entries, localStorageData);
        this.isDataLoadedFromStorage = true;
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

  // Load monthly data with aggregated SKU values - FIXED VERSION
  async loadMonthlyData() {
    this.isLoading = true;
    this.errorMessage = '';
    
    try {
      // Get start and end dates for current month
      const startDate = `${this.currentYear}-${(this.currentMonth + 1).toString().padStart(2, '0')}-01`;
      const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
      const endDate = `${this.currentYear}-${(this.currentMonth + 1).toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
      
      console.log(`Loading monthly data from ${startDate} to ${endDate}`);
      
      // Get all recipes
      const recipes = (await this.supabase.getAllRecipesWithDetails()) || [];
      console.log(`Found ${recipes.length} recipes`);
      
      // Get all production logs for the month
      const monthlyData = await this.supabase.getProductionLogsByDateRange(startDate, endDate);
      console.log(`Found ${monthlyData.length} production logs for the month`);
      
      // Create a map to aggregate data by recipe ID and date (for unique orders per day)
      const recipeAggregation = new Map<string, Map<string, {
        orderKg: number,
        skus: Map<string, {
          actualOutput: number,
          rawMatCost: number
        }>,
        premixes: Map<string, {
          actualOutput: number,
          rawMatCost: number
        }>
      }>>();
      
      // Process all logs and aggregate data
      monthlyData.forEach(log => {
        const recipeId = log.recipe_id;
        const date = log.date;
        
        if (!recipeId || !date) {
          console.warn('Log missing recipe_id or date:', log);
          return;
        }
        
        if (!recipeAggregation.has(recipeId)) {
          recipeAggregation.set(recipeId, new Map());
        }
        
        const dateMap = recipeAggregation.get(recipeId)!;
        
        if (!dateMap.has(date)) {
          dateMap.set(date, {
            orderKg: 0,
            skus: new Map(),
            premixes: new Map()
          });
        }
        
        const dayData = dateMap.get(date)!;
        
        // Set orderKg for this day (use max order value if multiple logs for same recipe/date)
        if (log.order_kg && log.order_kg > dayData.orderKg) {
          dayData.orderKg = log.order_kg;
        }
        
        // Aggregate SKU/premix data by name
        const itemName = log.item_name;
        const itemType = log.type;
        
        if (!itemName || !itemType) {
          console.warn('Log missing item_name or type:', log);
          return;
        }
        
        const itemMap = itemType === 'sku' ? dayData.skus : dayData.premixes;
        
        if (!itemMap.has(itemName)) {
          itemMap.set(itemName, {
            actualOutput: 0,
            rawMatCost: 0
          });
        }
        
        const itemData = itemMap.get(itemName)!;
        
        // Sum up actual output and raw material cost
        if (log.actual_output) {
          itemData.actualOutput += log.actual_output;
        }
        
        if (log.raw_cost) {
          itemData.rawMatCost += log.raw_cost;
        }
      });
      
      console.log(`Aggregated data for ${recipeAggregation.size} recipes`);
      
      // Create monthly entries for ALL recipes with aggregated data
      this.monthlyEntries = recipes.map(recipe => {
        const recipeId = recipe.id || '';
        const dateMap = recipeAggregation.get(recipeId);
        
        // Convert base recipe
        const productionRecipe = convertRecipeWithDetailsToProductionRecipe(recipe);
        
        // Calculate total order and days with orders
        let totalOrderKg = 0;
        const daysWithOrdersSet = new Set<string>();
        let totalActualOutput = 0;
        let totalRawMatCost = 0;
        
        // Maps to aggregate item data across all days
        const skuAggregatedData = new Map<string, { actualOutput: number, rawMatCost: number }>();
        const premixAggregatedData = new Map<string, { actualOutput: number, rawMatCost: number }>();
        
        if (dateMap) {
          dateMap.forEach((dayData, date) => {
            if (dayData.orderKg > 0) {
              totalOrderKg += dayData.orderKg;
              daysWithOrdersSet.add(date);
            }
            
            // Aggregate SKU data
            dayData.skus.forEach((itemData, itemName) => {
              if (!skuAggregatedData.has(itemName)) {
                skuAggregatedData.set(itemName, { actualOutput: 0, rawMatCost: 0 });
              }
              const aggData = skuAggregatedData.get(itemName)!;
              aggData.actualOutput += itemData.actualOutput;
              aggData.rawMatCost += itemData.rawMatCost;
              totalActualOutput += itemData.actualOutput;
              totalRawMatCost += itemData.rawMatCost;
            });
            
            // Aggregate premix data
            dayData.premixes.forEach((itemData, itemName) => {
              if (!premixAggregatedData.has(itemName)) {
                premixAggregatedData.set(itemName, { actualOutput: 0, rawMatCost: 0 });
              }
              const aggData = premixAggregatedData.get(itemName)!;
              aggData.actualOutput += itemData.actualOutput;
              aggData.rawMatCost += itemData.rawMatCost;
              totalActualOutput += itemData.actualOutput;
              totalRawMatCost += itemData.rawMatCost;
            });
          });
        }
        
        // Create aggregated SKUs with monthly totals
        const aggregatedSkus: ProductionSku[] = productionRecipe.skus.map(sku => {
          const aggregatedData = skuAggregatedData.get(sku.name);
          return {
            ...sku,
            actualOutput: aggregatedData?.actualOutput || 0,
            rawMatCost: aggregatedData?.rawMatCost || 0,
            variance: 0, // Variance doesn't make sense for monthly totals
            remark: aggregatedData ? `${daysWithOrdersSet.size} day(s) with production` : 'No production'
          };
        });
        
        // Create aggregated premixes with monthly totals
        const aggregatedPremixes: ProductionSku[] = productionRecipe.premixes.map(premix => {
          const aggregatedData = premixAggregatedData.get(premix.name);
          return {
            ...premix,
            actualOutput: aggregatedData?.actualOutput || 0,
            rawMatCost: aggregatedData?.rawMatCost || 0,
            variance: 0, // Variance doesn't make sense for monthly totals
            remark: aggregatedData ? `${daysWithOrdersSet.size} day(s) with production` : 'No production'
          };
        });
        
        return {
          recipe: {
            ...productionRecipe,
            skus: aggregatedSkus,
            premixes: aggregatedPremixes
          },
          orderKg: totalOrderKg,
          isExpanded: false,
          daysWithOrders: daysWithOrdersSet.size,
          totalActualOutput,
          totalRawMatCost,
          skus: aggregatedSkus,
          premixes: aggregatedPremixes
        };
      });
      
      // Calculate monthly total
      this.monthlyTotal = this.monthlyEntries.reduce((sum, entry) => sum + entry.orderKg, 0);
      console.log(`Monthly total: ${this.monthlyTotal} batches`);
      
      // Filter monthly entries
      this.filteredMonthlyEntries = [...this.monthlyEntries];
      
      // Mark days with production for calendar
      this.markProductionDays(monthlyData);
      
    } catch (error: any) {
      console.error('Failed to load monthly data:', error);
      this.errorMessage = 'Failed to load monthly production data. Please try again.';
      this.showSnackbar('Failed to load monthly data', 'error');
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  // Load saved production data from database
  private async loadSavedProductionData(date: string): Promise<ProductionEntry[]> {
    try {
      // Get logs for this specific date
      const logs = await this.supabase.getProductionLogsByDate(date);
      
      if (!logs || logs.length === 0) {
        return [];
      }

      // Get all recipes to ensure we have all data
      const recipes = (await this.supabase.getAllRecipesWithDetails()) || [];
      
      // Group logs by recipe
      const logsByRecipe = new Map<string, any[]>();
      const orderByRecipe = new Map<string, number>();
      
      logs.forEach((log: any) => {
        const recipeId = log.recipe_id;
        
        // Store order quantity per recipe (use the largest order value)
        if (log.order_kg && log.order_kg > (orderByRecipe.get(recipeId) || 0)) {
          orderByRecipe.set(recipeId, log.order_kg);
        }
        
        // Group logs by recipe
        if (!logsByRecipe.has(recipeId)) {
          logsByRecipe.set(recipeId, []);
        }
        logsByRecipe.get(recipeId)!.push(log);
      });

      // Create entries for recipes that have logs
      const entries: ProductionEntry[] = [];
      
      for (const recipe of recipes) {
        const recipeId = recipe.id || '';
        const recipeLogs = logsByRecipe.get(recipeId);
        
        if (recipeLogs && recipeLogs.length > 0) {
          // Create production recipe with saved data
          const productionRecipe: ProductionRecipe = {
            id: recipe.id,
            name: recipe.name,
            std_yield: recipe.std_yield,
            created_at: recipe.created_at,
            skus: recipe.skus.map(sku => {
              // Find matching log for this SKU
              const log = recipeLogs.find(l => 
                l.item_name === sku.name && 
                l.type === 'sku'
              );
              
              return {
                ...convertRecipeItemToProductionSku(sku),
                actualOutput: log?.actual_output || 0,
                variance: log?.variance || 0,
                rawMatCost: log?.raw_cost || 0,
                remark: log?.remark || ''
              };
            }),
            premixes: recipe.premixes.map(premix => {
              // Find matching log for this premix
              const log = recipeLogs.find(l => 
                l.item_name === premix.name && 
                l.type === 'premix'
              );
              
              return {
                ...convertRecipeItemToProductionSku(premix),
                actualOutput: log?.actual_output || 0,
                variance: log?.variance || 0,
                rawMatCost: log?.raw_cost || 0,
                remark: log?.remark || ''
              };
            })
          };
          
          entries.push({
            recipe: productionRecipe,
            orderKg: orderByRecipe.get(recipeId) || 0,
            isExpanded: false
          });
        }
      }
      
      return entries;
      
    } catch (error) {
      console.error('Error loading saved production data:', error);
      return [];
    }
  }

  // Monthly total functions - FIXED VERSION
  async loadMonthlyTotal() {
    try {
      // Get start and end dates for current month
      const startDate = `${this.currentYear}-${(this.currentMonth + 1).toString().padStart(2, '0')}-01`;
      const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
      const endDate = `${this.currentYear}-${(this.currentMonth + 1).toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
      
      // Get ALL monthly data
      const monthlyData = await this.supabase.getProductionLogsByDateRange(startDate, endDate);
      
      // Calculate total orders for the month - Use unique orders per recipe per day
      const uniqueOrders = new Set<string>();
      let totalOrders = 0;
      
      monthlyData.forEach(log => {
        if (log.order_kg && log.order_kg > 0) {
          const uniqueKey = `${log.date}_${log.recipe_id}`;
          if (!uniqueOrders.has(uniqueKey)) {
            uniqueOrders.add(uniqueKey);
            totalOrders += log.order_kg;
          }
        }
      });
      
      this.monthlyTotal = totalOrders;
      console.log(`Calendar monthly total: ${this.monthlyTotal} batches from ${uniqueOrders.size} unique orders`);
      
      // Mark days with production
      this.markProductionDays(monthlyData);
      
    } catch (error) {
      console.error('Error loading monthly total:', error);
      this.monthlyTotal = 0;
      this.productionByDay.clear();
    }
  }

  markProductionDays(logs: any[]) {
    this.productionByDay.clear();
    
    logs.forEach(log => {
      if (log.order_kg && log.order_kg > 0) {
        const date = new Date(log.date);
        if (date.getMonth() === this.currentMonth && date.getFullYear() === this.currentYear) {
          const day = date.getDate();
          // Store the total order amount for that day
          const currentTotal = this.productionByDay.get(day) || 0;
          this.productionByDay.set(day, currentTotal + log.order_kg);
        }
      }
    });
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
        // Merge orderKg
        mergedData[freshIndex].orderKg = savedEntry.orderKg || 0;
        
        // Merge SKUs
        savedEntry.recipe.skus.forEach(savedSku => {
          const skuIndex = mergedData[freshIndex].recipe.skus.findIndex(s => s.name === savedSku.name);
          if (skuIndex !== -1) {
            mergedData[freshIndex].recipe.skus[skuIndex] = {
              ...mergedData[freshIndex].recipe.skus[skuIndex],
              actualOutput: savedSku.actualOutput || 0,
              variance: savedSku.variance || 0,
              rawMatCost: savedSku.rawMatCost || 0,
              remark: savedSku.remark || ''
            };
          }
        });
        
        // Merge Premixes
        savedEntry.recipe.premixes.forEach(savedPremix => {
          const premixIndex = mergedData[freshIndex].recipe.premixes.findIndex(p => p.name === savedPremix.name);
          if (premixIndex !== -1) {
            mergedData[freshIndex].recipe.premixes[premixIndex] = {
              ...mergedData[freshIndex].recipe.premixes[premixIndex],
              actualOutput: savedPremix.actualOutput || 0,
              variance: savedPremix.variance || 0,
              rawMatCost: savedPremix.rawMatCost || 0,
              remark: savedPremix.remark || ''
            };
          }
        });
      }
    });
    
    return mergedData;
  }

  calculateActualRawMat(orderKg: number, quantity1b: number): number {
    return (orderKg || 0) * (quantity1b || 0);
  }

  // Get total SKUs for any entry type (ProductionEntry or MonthlyEntry)
  getTotalSkus(entry: ProductionEntry | MonthlyEntry): number {
    return entry.recipe.skus.length + entry.recipe.premixes.length;
  }

  getAllItems(entry: ProductionEntry | MonthlyEntry): ProductionSku[] {
    return [...entry.recipe.skus, ...entry.recipe.premixes];
  }

  toggleRecipe(entry: ProductionEntry | MonthlyEntry) {
    entry.isExpanded = !entry.isExpanded;
    this.cdr.detectChanges();
  }

  // Save immediately when order changes
  recalculate(entry: ProductionEntry) {
    entry.orderKg = Number(entry.orderKg) || 0;
    this.saveToLocalStorage();
    // Save to database immediately
    this.saveEntryToDatabase(entry);
    this.cdr.detectChanges();
  }

  // Save immediately when item changes
  onItemChange(entry: ProductionEntry) {
    this.saveToLocalStorage();
    // Save to database immediately
    this.saveEntryToDatabase(entry);
    this.cdr.detectChanges();
  }

  // Save a single entry to database immediately - FIXED TO PRESERVE OTHER RECIPES
  private async saveEntryToDatabase(entry: ProductionEntry) {
    try {
      if (!this.selectedDate) {
        throw new Error('No date selected');
      }
      
      const recipeId = entry.recipe.id || '';
      const orderKg = entry.orderKg || 0;
      
      if (!recipeId) {
        throw new Error('Recipe ID is missing');
      }
      
      console.log(`=== SAVING ENTRY TO DATABASE ===`);
      console.log(`Date: ${this.selectedDate}`);
      console.log(`Recipe: ${entry.recipe.name} (ID: ${recipeId})`);
      console.log(`Order: ${orderKg} batches`);
      console.log(`SKUs: ${entry.recipe.skus.length}, Premixes: ${entry.recipe.premixes.length}`);
      
      // Prepare all logs to save
      const logsToSave: ProductionLog[] = [];
      
      // Prepare SKU logs
      entry.recipe.skus.forEach(sku => {
        const rawUsed = this.calculateActualRawMat(orderKg, sku.quantity1b);
        const log: ProductionLog = {
          date: this.selectedDate,
          recipe_id: recipeId,
          recipe_name: entry.recipe.name,
          order_kg: orderKg,
          batches: 1,
          actual_output: sku.actualOutput || 0,
          raw_used: rawUsed,
          raw_cost: sku.rawMatCost || 0,
          remark: sku.remark || '',
          type: 'sku',
          item_name: sku.name
        };
        logsToSave.push(log);
      });
      
      // Prepare Premix logs
      entry.recipe.premixes.forEach(premix => {
        const rawUsed = this.calculateActualRawMat(orderKg, premix.quantity1b);
        const log: ProductionLog = {
          date: this.selectedDate,
          recipe_id: recipeId,
          recipe_name: entry.recipe.name,
          order_kg: orderKg,
          batches: 1,
          actual_output: premix.actualOutput || 0,
          raw_used: rawUsed,
          raw_cost: premix.rawMatCost || 0,
          remark: premix.remark || '',
          type: 'premix',
          item_name: premix.name
        };
        logsToSave.push(log);
      });
      
      // FIXED: Only delete logs for THIS recipe, not all recipes
      console.log(`Deleting existing logs for recipe ${recipeId} on date ${this.selectedDate}...`);
      await this.supabase.deleteProductionLogsByRecipeAndDate(recipeId, this.selectedDate);
      
      // Save all logs
      console.log(`Saving ${logsToSave.length} logs for recipe ${recipeId}...`);
      let savedCount = 0;
      for (const log of logsToSave) {
        try {
          const result = await this.supabase.saveProductionLog(log);
          if (result) {
            savedCount++;
          }
        } catch (error) {
          console.error(`Failed to save log for ${log.item_name}:`, error);
        }
      }
      
      console.log(`Successfully saved ${savedCount}/${logsToSave.length} logs for recipe ${recipeId}`);
      
      // Clear the unsaved flag only for this recipe
      this.isDataLoadedFromStorage = false;
      this.clearLocalStorageForRecipe(recipeId);
      
      // Show success message
      if (savedCount > 0) {
        this.showSnackbar(`Saved ${entry.recipe.name} for ${this.selectedDate}`, 'success');
      }
      
      console.log(`=== END SAVING ===\n`);
      
    } catch (error: any) {
      console.error('Error saving entry to database:', error);
      this.showSnackbar(`Failed to save ${entry.recipe.name}: ${error.message}`, 'error');
    }
  }

  // Add this new method to clear localStorage for a specific recipe
  private clearLocalStorageForRecipe(recipeId: string) {
    try {
      const key = `production_${this.selectedDate}`;
      const data = localStorage.getItem(key);
      if (data) {
        const entries: ProductionEntry[] = JSON.parse(data);
        // Remove the specific recipe from localStorage
        const filteredEntries = entries.filter(entry => entry.recipe.id !== recipeId);
        if (filteredEntries.length > 0) {
          localStorage.setItem(key, JSON.stringify(filteredEntries));
        } else {
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.error('Error clearing localStorage for recipe:', error);
    }
  }

  async onDateChange() {
    this.currentPage = 1;
    this.searchQuery = '';
    
    // Set loading state
    this.isLoading = true;
    this.cdr.detectChanges(); // Force UI update
    
    try {
      await this.loadData();
    } finally {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  getTotalOrder(): number {
    if (this.viewMode === 'daily') {
      return this.filteredEntries.reduce((sum, entry) => sum + (entry.orderKg || 0), 0);
    } else {
      return this.filteredMonthlyEntries.reduce((sum, entry) => sum + (entry.orderKg || 0), 0);
    }
  }

  getTotalActualRawMat(): number {
    if (this.viewMode === 'daily') {
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
    } else {
      let total = 0;
      this.filteredMonthlyEntries.forEach(entry => {
        entry.recipe.skus.forEach(sku => {
          total += this.calculateActualRawMat(entry.orderKg, sku.quantity1b);
        });
        entry.recipe.premixes.forEach(premix => {
          total += this.calculateActualRawMat(entry.orderKg, premix.quantity1b);
        });
      });
      return total;
    }
  }

  getTotalRawMatCost(): number {
    if (this.viewMode === 'daily') {
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
    } else {
      let total = 0;
      this.filteredMonthlyEntries.forEach(entry => {
        entry.recipe.skus.forEach(sku => {
          total += (sku.rawMatCost || 0);
        });
        entry.recipe.premixes.forEach(premix => {
          total += (premix.rawMatCost || 0);
        });
      });
      return total;
    }
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

  onMonthlySearch() {
    const q = this.monthlySearchQuery.toLowerCase().trim();
    if (!q) {
      this.filteredMonthlyEntries = [...this.monthlyEntries];
    } else {
      this.filteredMonthlyEntries = this.monthlyEntries.filter(entry =>
        entry.recipe.name.toLowerCase().includes(q) ||
        entry.recipe.skus.some(sku => sku.name.toLowerCase().includes(q)) ||
        entry.recipe.premixes.some(premix => premix.name.toLowerCase().includes(q))
      );
    }
    this.monthlyCurrentPage = 1;
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

  nextMonthlyPage() {
    if (this.monthlyCurrentPage < this.monthlyTotalPages) {
      this.monthlyCurrentPage++;
      this.cdr.detectChanges();
    }
  }

  prevMonthlyPage() {
    if (this.monthlyCurrentPage > 1) {
      this.monthlyCurrentPage--;
      this.cdr.detectChanges();
    }
  }

  // View recipe details in monthly view
  viewRecipeDetails(entry: MonthlyEntry) {
    // You can implement a detailed view modal here
    this.showSnackbar(`Viewing details for ${entry.recipe.name}`, 'info');
  }

  // Auto-save methods with immediate save
  private async autoSaveToDatabase() {
    try {
      const savedCount = await this.saveAllEntriesToDatabase();
      this.isDataLoadedFromStorage = false;
      this.clearLocalStorage();
      // Don't show snackbar for auto-save to avoid distraction
    } catch (error: any) {
      console.error('Auto-save failed:', error);
      // Don't show error snackbar for auto-save to avoid annoying the user
    }
  }

  // Save ALL entries to database (for auto-save) - FIXED VERSION
  private async saveAllEntriesToDatabase(): Promise<number> {
    if (!this.selectedDate) {
      throw new Error('No date selected');
    }
    
    let savedCount = 0;
    
    // Process each recipe individually instead of clearing all logs
    for (const entry of this.filteredEntries) {
      const recipeId = entry.recipe.id || '';
      const orderKg = entry.orderKg || 0;
      
      if (!recipeId) continue;
      
      // Delete existing logs for this specific recipe and date only
      await this.supabase.deleteProductionLogsByRecipeAndDate(recipeId, this.selectedDate);
      
      // Save SKUs
      for (const sku of entry.recipe.skus) {
        try {
          const log: ProductionLog = {
            date: this.selectedDate,
            recipe_id: recipeId,
            recipe_name: entry.recipe.name,
            order_kg: orderKg,
            batches: 1,
            actual_output: sku.actualOutput || 0,
            raw_used: this.calculateActualRawMat(orderKg, sku.quantity1b),
            raw_cost: sku.rawMatCost || 0,
            remark: sku.remark || '',
            type: 'sku',
            item_name: sku.name
          };
          
          await this.supabase.saveProductionLog(log);
          savedCount++;
        } catch (error) {
          console.error('Error saving SKU:', error);
        }
      }
      
      // Save Premixes
      for (const premix of entry.recipe.premixes) {
        try {
          const log: ProductionLog = {
            date: this.selectedDate,
            recipe_id: recipeId,
            recipe_name: entry.recipe.name,
            order_kg: orderKg,
            batches: 1,
            actual_output: premix.actualOutput || 0,
            raw_used: this.calculateActualRawMat(orderKg, premix.quantity1b),
            raw_cost: premix.rawMatCost || 0,
            remark: premix.remark || '',
            type: 'premix',
            item_name: premix.name
          };
          
          await this.supabase.saveProductionLog(log);
          savedCount++;
        } catch (error) {
          console.error('Error saving premix:', error);
        }
      }
    }
    
    return savedCount;
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

  // Export monthly summary to Excel
  exportMonthlySummary() {
    try {
      const exportData: any[] = [];
      
      exportData.push({
        'Month': `${this.getMonthName(this.currentMonth)} ${this.currentYear}`,
        'Total Orders': this.monthlyTotal,
        'Exported On': new Date().toISOString().split('T')[0]
      });
      
      exportData.push({});

      this.filteredMonthlyEntries.forEach(entry => {
        if (entry.orderKg > 0) {
          exportData.push({
            'Recipe': entry.recipe.name,
            'Order (batch)': entry.orderKg,
            'STD Yield (batch)': entry.recipe.std_yield || 0,
            'Days with Orders': entry.daysWithOrders,
            'Total Actual Output': entry.totalActualOutput,
            'Total Raw Mat Cost': entry.totalRawMatCost
          });
          
          exportData.push({
            'SKU / Raw Material': 'Item',
            '1B': '1B',
            '½B': '½B',
            '¼B': '¼B',
            'ACTUAL RAW MAT (batch)': 'ACTUAL RAW MAT (batch)',
            'ACTUAL OUTPUT (batch)': 'ACTUAL OUTPUT (batch)',
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
            'RAW MAT COST (₱)': '',
            'REMARK': ''
          });
        }
      });
      
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      const wscols = [
        { wch: 30 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
        { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 25 }
      ];
      ws['!cols'] = wscols;
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Monthly_Summary_${this.currentYear}_${this.currentMonth + 1}`);
      
      const filename = `Monthly_Summary_${this.currentYear}_${this.currentMonth + 1}.xlsx`;
      XLSX.writeFile(wb, filename);
      
      this.showSnackbar(`Exported monthly summary to ${filename}`, 'success');
    } catch (error) {
      console.error('Export monthly summary error:', error);
      this.showSnackbar('Failed to export monthly summary', 'error');
    }
  }

  showSnackbar(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') {
    if (this.snackbarTimeout) clearTimeout(this.snackbarTimeout);
    this.snackbarMessage = message;
    this.snackbarType = type;
    this.snackbarTimeout = setTimeout(() => this.hideSnackbar(), 3000);
    this.cdr.detectChanges();
  }

  hideSnackbar() {
    this.snackbarMessage = '';
    this.cdr.detectChanges();
  }
}