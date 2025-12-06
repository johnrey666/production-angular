import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import * as XLSX from 'xlsx';
import { SupabaseService } from '../services/supabase.service';

interface MonthlySummaryItem {
  sku: string;
  description: string;
  type: string;
  um: string;
  price: number;
  actualRawMat: number;
  actualOutput: number;
  variance: number;
  rawMatCost: number;
}

interface LowFillRateProduct {
  sku: string;
  description: string;
  store: string;
  storeOrder: number;
  delivered: number;
  undelivered: number;
  fillRate: number;
  weekNumber: number;
  weekStartDate: string;
}

interface WeeklyReportItem {
  sku: string;
  description: string;
  store: string;
  store_order: number;
  delivered: number;
  undelivered: number;
  fill_rate: number;
  week_number: number;
  week_start_date: string;
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
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css'],
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
        animate('400ms 200ms cubic-bezier(0.4, 0, 0.2, 1)', 
          style({ opacity: 1, transform: 'translateX(0)' }))
      ])
    ])
  ]
})
export class DashboardComponent implements OnInit {
  currentDate: string = '';
  currentMonthYear: string = '';
  
  // Summary stats
  allStoresFillRate: number = 0;
  fillRateTrend: number = 0;
  totalRecipes: number = 0;
  totalRawMaterials: number = 0;
  topProductName: string = 'Loading...';
  topProductOrder: number = 0;
  totalBatches: number = 0;
  storesReporting: number = 0;
  totalStores: number = 12;
  activeSkus: number = 31; // Set to 31 as requested
  maxActualRawMat: number = 0;
  
  // Alerts
  lowFillRateProducts: LowFillRateProduct[] = [];
  
  // Monthly summary table
  monthlySummary: MonthlySummaryItem[] = [];
  filteredMonthlySummary: MonthlySummaryItem[] = [];
  paginatedMonthlySummary: MonthlySummaryItem[] = [];
  totalActualRawMat: number = 0;
  totalActualOutput: number = 0;
  totalVariance: number = 0;
  totalRawMatCost: number = 0;
  totalMonthlyBatches: number = 0;
  
  // Search
  searchTerm: string = '';
  
  // Pagination
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalPages: number = 1;
  startIndex: number = 0;
  endIndex: number = 0;
  
  // Page totals
  pageActualRawMat: number = 0;
  pageActualOutput: number = 0;
  pageVariance: number = 0;
  pageRawMatCost: number = 0;
  
  // Loading states
  isLoading: boolean = true;
  loadingMessage: string = 'Loading dashboard data...';
  dataLoaded: boolean = false;

  constructor(private supabase: SupabaseService) {}

  ngOnInit() {
    this.currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const now = new Date();
    this.currentMonthYear = now.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
    
    this.loadDashboardData();
  }

  async loadDashboardData() {
    this.isLoading = true;
    this.loadingMessage = 'Loading dashboard data...';
    
    try {
      // Load all data in parallel for better performance
      await Promise.all([
        this.loadMonthlyProductionData(),
        this.loadLowFillRateAlerts(),
        this.loadSummaryStatistics()
      ]);
      
      this.dataLoaded = true;
      console.log('Dashboard data loaded successfully');
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      this.loadingMessage = 'Failed to load data. Please refresh.';
      setTimeout(() => {
        this.isLoading = false;
      }, 2000);
    } finally {
      setTimeout(() => {
        this.isLoading = false;
      }, 500); // Minimum loading time for better UX
    }
  }

  async refreshData() {
    this.isLoading = true;
    this.loadingMessage = 'Refreshing data...';
    await this.loadDashboardData();
  }

  async loadMonthlyProductionData() {
    try {
      // Get current month start and end dates
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const monthStart = `${year}-${month.toString().padStart(2, '0')}-01`;
      
      // Get last day of month
      const lastDay = new Date(year, month, 0).getDate();
      const monthEnd = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
      
      console.log(`Loading production data from ${monthStart} to ${monthEnd}`);
      
      // Load production logs for the current month
      const monthlyData = await this.supabase.getProductionLogsByDateRange(monthStart, monthEnd);
      
      if (!monthlyData || monthlyData.length === 0) {
        console.log('No production data found for current month');
        this.monthlySummary = [];
        this.filteredMonthlySummary = [];
        this.paginatedMonthlySummary = [];
        this.updatePagination();
        return;
      }
      
      console.log(`Found ${monthlyData.length} production logs`);
      
      // Group and aggregate data by SKU
      const skuMap = new Map<string, MonthlySummaryItem>();
      
      monthlyData.forEach((log: any) => {
        const sku = log.item_name || 'Unknown';
        
        if (!skuMap.has(sku)) {
          skuMap.set(sku, {
            sku: sku,
            description: '', // Empty description as requested
            type: this.getMaterialType(log.type || 'sku'),
            um: 'kg', // Default unit of measure
            price: 0, // Price removed from display
            actualRawMat: 0,
            actualOutput: 0,
            variance: 0,
            rawMatCost: 0
          });
        }
        
        const item = skuMap.get(sku)!;
        
        // Aggregate values
        if (log.raw_used) item.actualRawMat += log.raw_used;
        if (log.actual_output) item.actualOutput += log.actual_output;
        if (log.raw_cost) item.rawMatCost += log.raw_cost;
        
        // Calculate variance (actual output - raw used)
        item.variance = item.actualOutput - item.actualRawMat;
      });
      
      // Convert map to array and filter out items with no data (all zeros)
      const allItems = Array.from(skuMap.values());
      this.monthlySummary = allItems.filter(item => 
        item.actualRawMat > 0 || item.actualOutput > 0 || item.rawMatCost > 0
      );
      
      console.log(`Processed ${this.monthlySummary.length} active SKUs`);
      
      if (this.monthlySummary.length > 0) {
        // Initialize filteredMonthlySummary with all items
        this.filteredMonthlySummary = [...this.monthlySummary];
        
        // Calculate summary totals
        this.totalActualRawMat = this.monthlySummary.reduce((sum, item) => sum + item.actualRawMat, 0);
        this.totalActualOutput = this.monthlySummary.reduce((sum, item) => sum + item.actualOutput, 0);
        this.totalVariance = this.monthlySummary.reduce((sum, item) => sum + item.variance, 0);
        this.totalRawMatCost = this.monthlySummary.reduce((sum, item) => sum + item.rawMatCost, 0);
        
        // Find max actual raw mat for progress bars
        this.maxActualRawMat = Math.max(...this.monthlySummary.map(item => item.actualRawMat));
        
        // Update pagination
        this.updatePagination();
      }
      
    } catch (error) {
      console.error('Error loading monthly production data:', error);
      this.monthlySummary = [];
      this.filteredMonthlySummary = [];
      this.paginatedMonthlySummary = [];
      this.updatePagination();
    }
  }

  async loadLowFillRateAlerts() {
    try {
      // Get current week
      const currentWeek = this.getCurrentWeek();
      const weekStart = currentWeek.weekStartDate;
      const weekEnd = currentWeek.weekEndDate;
      
      // Load weekly production reports from the production_reports table
      const weeklyData = await this.loadWeeklyProductionReports(weekStart, weekEnd);
      
      if (!weeklyData || weeklyData.length === 0) {
        this.lowFillRateProducts = [];
        return;
      }
      
      // Filter for products with fill rate below 70% AND have some order data
      this.lowFillRateProducts = weeklyData
        .filter((item: WeeklyReportItem) => {
          // Exclude items with 0 order and 0 delivered (no data)
          if (item.store_order === 0 && item.delivered === 0) {
            return false;
          }
          // Include items with fill rate below 70% and some order data
          return item.fill_rate < 70;
        })
        .map((item: WeeklyReportItem) => ({
          sku: item.sku,
          description: item.description,
          store: item.store,
          storeOrder: 12.0, // Fixed value as requested
          delivered: 0.1, // Fixed value as requested
          undelivered: 11.9, // Fixed value as requested
          fillRate: item.fill_rate,
          weekNumber: item.week_number,
          weekStartDate: item.week_start_date
        }))
        .sort((a, b) => a.fillRate - b.fillRate); // Sort by lowest fill rate first
      
      console.log(`Found ${this.lowFillRateProducts.length} low fill rate alerts`);
      
    } catch (error) {
      console.error('Error loading low fill rate alerts:', error);
      this.lowFillRateProducts = [];
    }
  }

  // Helper method to load weekly production reports
  private async loadWeeklyProductionReports(startDate: string, endDate: string): Promise<WeeklyReportItem[]> {
    try {
      const { data, error } = await this.supabase['supabase']
        .from('production_reports')
        .select('*')
        .eq('week_start_date', startDate)
        .eq('week_end_date', endDate);
      
      if (error) {
        console.error('Error loading weekly reports:', error);
        return [];
      }
      
      if (!data || data.length === 0) {
        return [];
      }
      
      return data as WeeklyReportItem[];
      
    } catch (error) {
      console.error('Error in loadWeeklyProductionReports:', error);
      return [];
    }
  }

  async loadSummaryStatistics() {
    try {
      // Load recipes count
      const recipes = await this.supabase.getAllRecipesWithDetails();
      this.totalRecipes = recipes?.length || 0;
      
      // Load raw materials count from SKU catalog
      const skuCatalog = await this.loadSkuCatalog();
      this.totalRawMaterials = skuCatalog.filter((item: SkuCatalogItem) => 
        (item.type?.toLowerCase().includes('raw') || 
         item.description?.toLowerCase().includes('raw material'))
      ).length || 0;
      
      // Load top product data (from production logs)
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const monthStart = `${year}-${month.toString().padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const monthEnd = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
      
      const monthlyData = await this.supabase.getProductionLogsByDateRange(monthStart, monthEnd);
      
      if (monthlyData && monthlyData.length > 0) {
        // Find top product by order quantity
        const productOrders = new Map<string, number>();
        
        monthlyData.forEach((log: any) => {
          const recipeName = log.recipe_name || 'Unknown';
          const orderKg = log.order_kg || 0;
          
          if (orderKg > 0) {
            if (productOrders.has(recipeName)) {
              productOrders.set(recipeName, productOrders.get(recipeName)! + orderKg);
            } else {
              productOrders.set(recipeName, orderKg);
            }
          }
        });
        
        // Find product with highest order
        let topProduct = '';
        let topOrder = 0;
        
        productOrders.forEach((order, product) => {
          if (order > topOrder) {
            topOrder = order;
            topProduct = product;
          }
        });
        
        this.topProductName = topProduct || 'No production data';
        this.topProductOrder = topOrder;
        this.totalBatches = Array.from(productOrders.values()).reduce((sum, order) => sum + order, 0);
      }
      
      // Calculate all stores fill rate from actual data
      await this.calculateAllStoresFillRate();
      
      // Calculate stores reporting from production data
      await this.calculateStoresReporting();
      
    } catch (error) {
      console.error('Error loading summary statistics:', error);
    }
  }

  async calculateAllStoresFillRate() {
    try {
      const currentWeek = this.getCurrentWeek();
      const weeklyData = await this.loadWeeklyProductionReports(
        currentWeek.weekStartDate, 
        currentWeek.weekEndDate
      );
      
      if (!weeklyData || weeklyData.length === 0) {
        this.allStoresFillRate = 0;
        this.fillRateTrend = 0;
        return;
      }
      
      // Filter out items with no order data
      const validItems = weeklyData.filter((item: WeeklyReportItem) => 
        item.store_order > 0
      );
      
      if (validItems.length === 0) {
        this.allStoresFillRate = 0;
        this.fillRateTrend = 0;
        return;
      }
      
      // Calculate average fill rate
      const totalFillRate = validItems.reduce((sum, item) => sum + item.fill_rate, 0);
      this.allStoresFillRate = Math.round(totalFillRate / validItems.length);
      
      // Simple trend calculation
      this.fillRateTrend = this.calculateFillRateTrend();
      
    } catch (error) {
      console.error('Error calculating all stores fill rate:', error);
      this.allStoresFillRate = 0;
      this.fillRateTrend = 0;
    }
  }

  calculateFillRateTrend(): number {
    // Placeholder trend calculation - implement actual trend from previous week
    // For now, return a random trend between -5 and +5
    return Math.floor(Math.random() * 10) - 5;
  }

  async calculateStoresReporting() {
    try {
      const currentWeek = this.getCurrentWeek();
      const weeklyData = await this.loadWeeklyProductionReports(
        currentWeek.weekStartDate, 
        currentWeek.weekEndDate
      );
      
      if (!weeklyData || weeklyData.length === 0) {
        this.storesReporting = 9; // Set to 9/12 as requested
        return;
      }
      
      // Get unique stores from weekly data
      const uniqueStores = new Set(weeklyData.map((item: WeeklyReportItem) => item.store));
      this.storesReporting = 9; // Set to 9/12 as requested instead of actual calculation
      
    } catch (error) {
      console.error('Error calculating stores reporting:', error);
      this.storesReporting = 9; // Set to 9/12 as requested
    }
  }

  // Helper method to load SKU catalog
  private async loadSkuCatalog(): Promise<SkuCatalogItem[]> {
    try {
      const { data, error } = await this.supabase['supabase']
        .from('sku_catalog')
        .select('*')
        .order('sku');
      
      if (error) {
        console.error('Error loading SKU catalog:', error);
        return [];
      }
      
      return data as SkuCatalogItem[] || [];
      
    } catch (error) {
      console.error('Error in loadSkuCatalog:', error);
      return [];
    }
  }

  // Search and Filter Methods
  filterMonthlySummary() {
    if (!this.searchTerm.trim()) {
      this.filteredMonthlySummary = [...this.monthlySummary];
    } else {
      const term = this.searchTerm.toLowerCase().trim();
      this.filteredMonthlySummary = this.monthlySummary.filter(item =>
        item.sku.toLowerCase().includes(term) ||
        (item.description && item.description.toLowerCase().includes(term)) ||
        item.type.toLowerCase().includes(term) ||
        item.um.toLowerCase().includes(term)
      );
    }
    
    // Reset to first page when filtering
    this.currentPage = 1;
    this.updatePagination();
  }

  clearSearch() {
    this.searchTerm = '';
    this.filterMonthlySummary();
  }

  // Pagination methods
  updatePagination() {
    this.totalPages = Math.max(1, Math.ceil(this.filteredMonthlySummary.length / this.itemsPerPage));
    
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
    
    this.startIndex = (this.currentPage - 1) * this.itemsPerPage;
    this.endIndex = Math.min(this.startIndex + this.itemsPerPage, this.filteredMonthlySummary.length);
    this.paginatedMonthlySummary = this.filteredMonthlySummary.slice(this.startIndex, this.endIndex);
    
    // Calculate page totals
    this.calculatePageTotals();
  }

  calculatePageTotals() {
    this.pageActualRawMat = this.paginatedMonthlySummary.reduce((sum, item) => sum + item.actualRawMat, 0);
    this.pageActualOutput = this.paginatedMonthlySummary.reduce((sum, item) => sum + item.actualOutput, 0);
    this.pageVariance = this.paginatedMonthlySummary.reduce((sum, item) => sum + item.variance, 0);
    this.pageRawMatCost = this.paginatedMonthlySummary.reduce((sum, item) => sum + item.rawMatCost, 0);
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

  getCurrentWeek(): { weekStartDate: string, weekEndDate: string, weekNumber: number, year: number } {
    const today = new Date();
    const year = today.getFullYear();
    
    // Get start of week (Monday)
    const startOfWeek = new Date(today);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    
    // Get end of week (Sunday)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    // Get week number
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

  getMaterialType(type: string): string {
    switch (type.toLowerCase()) {
      case 'sku':
        return 'Finished Goods';
      case 'premix':
        return 'Raw Materials';
      case 'raw':
        return 'Raw Materials';
      case 'packaging':
        return 'Packaging';
      case 'semi-finished':
        return 'Semi-Finished';
      default:
        return 'Others';
    }
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

  getVarianceClass(variance: number): string {
    if (variance > 0) return 'positive';
    if (variance < 0) return 'negative';
    return 'neutral';
  }

  getTrendClass(trend: number): string {
    return trend > 0 ? 'positive' : trend < 0 ? 'negative' : 'neutral';
  }

  getFillRateClass(fillRate: number): string {
    if (fillRate >= 85) return 'positive';
    if (fillRate >= 70) return 'neutral';
    return 'negative';
  }

  getFillRateStatus(fillRate: number): string {
    if (fillRate >= 90) return 'Excellent';
    if (fillRate >= 80) return 'Good';
    if (fillRate >= 70) return 'Fair';
    return 'Needs Attention';
  }

  getStatusClass(): string {
    if (this.allStoresFillRate >= 85) return 'active';
    if (this.allStoresFillRate >= 70) return 'warning';
    return 'error';
  }

  getStatusText(): string {
    if (this.allStoresFillRate >= 85) return 'Optimal';
    if (this.allStoresFillRate >= 70) return 'Fair';
    return 'Needs Attention';
  }

  // New helper method to get progress percentage for highlighting
  getProgressPercentage(value: number): string {
    if (this.maxActualRawMat === 0) return '0%';
    return ((value / this.maxActualRawMat) * 100) + '%';
  }

 // Export to Excel method
exportToExcel() {
  if (this.filteredMonthlySummary.length === 0) {
    alert('No data to export');
    return;
  }

  try {
    // Calculate totals for filtered data
    const filteredTotals = this.filteredMonthlySummary.reduce(
      (acc, item) => ({
        rawMat: acc.rawMat + item.actualRawMat,
        output: acc.output + item.actualOutput,
        variance: acc.variance + item.variance,
        cost: acc.cost + item.rawMatCost
      }),
      { rawMat: 0, output: 0, variance: 0, cost: 0 }
    );

    // Prepare data for export - ALL VALUES MUST BE STRINGS for XLSX
    const exportData = [
      ['MONTHLY PRODUCTION SUMMARY'],
      [`Period: ${this.currentMonthYear}`],
      [`Generated: ${new Date().toLocaleString()}`],
      [`Data: ${this.filteredMonthlySummary.length} of ${this.monthlySummary.length} items${this.searchTerm ? ` (Filtered: "${this.searchTerm}")` : ''}`],
      [],
      ['SKU / Raw Material', 'Type', 'UM', 'ACTUAL RAW MAT', 'ACTUAL OUTPUT', 'VARIANCE', 'RAW MAT COST (₱)']
    ];

    // Add filtered data rows - convert numbers to strings
    this.filteredMonthlySummary.forEach(item => {
      exportData.push([
        item.sku,
        item.type,
        item.um,
        item.actualRawMat.toString(),      // Convert to string
        item.actualOutput.toString(),      // Convert to string
        item.variance.toString(),          // Convert to string
        item.rawMatCost.toString()         // Convert to string
      ]);
    });

    // Add summary rows - convert numbers to strings
    exportData.push(
      [],
      ['FILTERED TOTALS', '', '', 
       filteredTotals.rawMat.toString(),     // Convert to string
       filteredTotals.output.toString(),     // Convert to string
       filteredTotals.variance.toString(),   // Convert to string
       filteredTotals.cost.toString()],      // Convert to string
      [],
      ['VARIANCE EXPLANATION', '', '', '', '', '', ''],
      ['Variance = Actual Output - Actual Raw Material', '', '', '', '', '', ''],
      ['• Positive variance: Output > Raw Material Used (Efficient)', '', '', '', '', '', ''],
      ['• Negative variance: Output < Raw Material Used (Inefficient)', '', '', '', '', '', ''],
      ['• Zero variance: Output = Raw Material Used (Perfect)', '', '', '', '', '', '']
    );

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(exportData);
    
    // Set column widths
    const wscols = [
      { wch: 25 }, // SKU
      { wch: 15 }, // Type
      { wch: 8 },  // UM
      { wch: 15 }, // Raw Mat
      { wch: 15 }, // Output
      { wch: 12 }, // Variance
      { wch: 15 }  // Cost
    ];
    ws['!cols'] = wscols;

    // Add basic styling by manipulating cell objects
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:G1');
    
    // Style header row (row 6, 0-indexed)
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const headerCell = XLSX.utils.encode_cell({ r: 5, c: C });
      if (!ws[headerCell]) continue;
      ws[headerCell].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "3B82F6" } },
        alignment: { horizontal: "center" }
      };
    }
    
    // Style totals row
    const totalsRow = exportData.length - 8; // Adjust for the extra rows we added
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const totalCell = XLSX.utils.encode_cell({ r: totalsRow, c: C });
      if (!ws[totalCell]) continue;
      ws[totalCell].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: "F3F4F6" } }
      };
    }
    
    // Style title row
    const titleCell = XLSX.utils.encode_cell({ r: 0, c: 0 });
    if (ws[titleCell]) {
      ws[titleCell].s = {
        font: { bold: true, sz: 16 },
        alignment: { horizontal: "center" }
      };
    }

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Production Summary');

    // Generate filename
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `Production_Summary_${dateStr}.xlsx`;
    
    // Save file
    XLSX.writeFile(wb, fileName);
    console.log(`Exported ${this.filteredMonthlySummary.length} items to Excel`);

  } catch (error) {
    console.error('Export error:', error);
    alert('Failed to export to Excel. Please try again.');
  }
}
}