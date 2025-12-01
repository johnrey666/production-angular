import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';

interface ReportRecord {
  date: string;
  product: string;
  batches: number;
  expected: number;
  actual: number;
  rawUsed: number;
  rawCost: number;
  variance: number;
}

interface SummaryData {
  totalDays: number;
  totalOutput: number;
  totalCost: number;
  avgCostPerKg: number;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.html',
  styleUrls: ['./reports.css'],
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
        animate('400ms cubic-bezier(0.4, 0, 0.2, 1)', 
          style({ opacity: 1, transform: 'translateX(0)' }))
      ])
    ])
  ]
})
export class ReportsComponent implements OnInit {
  selectedMonth: string = '';
  showVarianceOnly: boolean = false;
  
  summaryData: SummaryData = {
    totalDays: 0,
    totalOutput: 0,
    totalCost: 0,
    avgCostPerKg: 0
  };

  allRecords: ReportRecord[] = [];
  filteredRecords: ReportRecord[] = [];

  ngOnInit() {
    const now = new Date();
    this.selectedMonth = now.toISOString().slice(0, 7);
    this.generateReport();
  }

  generateReport() {
    // Load data from localStorage or use sample data
    const savedData = localStorage.getItem('ctk_prod');
    
    if (savedData) {
      this.loadFromStorage(savedData);
    } else {
      this.loadSampleData();
    }
    
    this.applyFilters();
    this.calculateSummary();
  }

  loadFromStorage(data: string) {
    const prodDB = JSON.parse(data);
    this.allRecords = [];
    
    Object.keys(prodDB).sort().forEach(date => {
      if (date.startsWith(this.selectedMonth)) {
        const dayData = prodDB[date] || [];
        dayData.forEach((record: any) => {
          const expected = (record.batches || 0) * (record.yieldKg || 0);
          const actual = record.output || 0;
          const rawUsed = record.rawUsed || 0;
          const rawCost = record.rawCost || (rawUsed * 300); // Fallback calculation
          
          this.allRecords.push({
            date,
            product: record.product || 'Unknown',
            batches: record.batches || 0,
            expected,
            actual,
            rawUsed,
            rawCost,
            variance: actual - expected
          });
        });
      }
    });
  }

  loadSampleData() {
    // Sample data for demonstration
    this.allRecords = [
      {
        date: '2024-01-15',
        product: 'Pork BBQ',
        batches: 3,
        expected: 75,
        actual: 72.5,
        rawUsed: 21,
        rawCost: 6510,
        variance: -2.5
      },
      {
        date: '2024-01-15',
        product: 'Chicken Adobo',
        batches: 2,
        expected: 40,
        actual: 42.3,
        rawUsed: 20,
        rawCost: 5600,
        variance: 2.3
      },
      {
        date: '2024-01-16',
        product: 'Pork BBQ',
        batches: 4,
        expected: 100,
        actual: 98.7,
        rawUsed: 28,
        rawCost: 8680,
        variance: -1.3
      },
      {
        date: '2024-01-17',
        product: 'Beef Caldereta',
        batches: 2,
        expected: 36,
        actual: 38.2,
        rawUsed: 22,
        rawCost: 6600,
        variance: 2.2
      }
    ];
  }

  applyFilters() {
    this.filteredRecords = this.showVarianceOnly 
      ? this.allRecords.filter(record => Math.abs(record.variance) > 5)
      : this.allRecords;
  }

  calculateSummary() {
    this.summaryData.totalDays = new Set(this.allRecords.map(r => r.date)).size;
    this.summaryData.totalOutput = this.allRecords.reduce((sum, r) => sum + r.actual, 0);
    this.summaryData.totalCost = this.allRecords.reduce((sum, r) => sum + r.rawCost, 0);
    this.summaryData.avgCostPerKg = this.summaryData.totalOutput > 0 
      ? this.summaryData.totalCost / this.summaryData.totalOutput 
      : 0;
  }

  calculateEfficiency(record: ReportRecord): number {
    if (record.expected <= 0) return 0;
    return Math.min(100, (record.actual / record.expected) * 100);
  }

  // Add this method to your ReportsComponent class
getEfficiencyClass(efficiency: number): string {
  if (efficiency >= 95) {
    return 'high';
  } else if (efficiency >= 85) {
    return 'medium';
  } else {
    return 'low';
  }
}

  getPositiveVarianceCount(): number {
    return this.filteredRecords.filter(r => r.variance > 0).length;
  }

  getNegativeVarianceCount(): number {
    return this.filteredRecords.filter(r => r.variance < 0).length;
  }

  getAverageEfficiency(): string {
    const avg = this.filteredRecords.reduce((sum, r) => sum + this.calculateEfficiency(r), 0) / this.filteredRecords.length;
    return avg ? avg.toFixed(1) : '0';
  }

  toggleVarianceView() {
    this.showVarianceOnly = !this.showVarianceOnly;
    this.applyFilters();
  }

  exportCSV() {
    let csv = "Date,Product,Order Batches,Expected kg,Actual kg,Raw Used kg,Raw Cost,Variance kg,Efficiency%\n";
    
    this.filteredRecords.forEach(record => {
      const efficiency = this.calculateEfficiency(record);
      const row = [
        record.date,
        record.product,
        record.batches,
        record.expected.toFixed(1),
        record.actual.toFixed(1),
        record.rawUsed.toFixed(1),
        record.rawCost.toFixed(0),
        record.variance.toFixed(1),
        efficiency.toFixed(1)
      ].map(field => `"${field}"`).join(',');
      
      csv += row + "\n";
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CTK_Report_${this.selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  printReport() {
    window.print();
  }

  getBestProduct(): string {
    const products = [...new Set(this.filteredRecords.map(r => r.product))];
    let bestProduct = '';
    let bestEfficiency = 0;

    products.forEach(product => {
      const productRecords = this.filteredRecords.filter(r => r.product === product);
      const avgEfficiency = productRecords.reduce((sum, r) => sum + this.calculateEfficiency(r), 0) / productRecords.length;
      
      if (avgEfficiency > bestEfficiency) {
        bestEfficiency = avgEfficiency;
        bestProduct = product;
      }
    });

    return bestProduct || 'N/A';
  }

  getHighestVarianceDate(): string {
    if (this.filteredRecords.length === 0) return 'N/A';
    
    const record = this.filteredRecords.reduce((prev, current) => 
      Math.abs(prev.variance) > Math.abs(current.variance) ? prev : current
    );
    
    return record.date;
  }

  getCostEfficiency(): string {
    const totalExpectedCost = this.filteredRecords.reduce((sum, r) => sum + (r.expected * 300), 0);
    const efficiency = totalExpectedCost > 0 ? (this.summaryData.totalCost / totalExpectedCost) * 100 : 0;
    return (100 - Math.min(efficiency, 100)).toFixed(1);
  }

  getRecommendation(): string {
    const negativeCount = this.getNegativeVarianceCount();
    const totalCount = this.filteredRecords.length;
    
    if (negativeCount / totalCount > 0.3) {
      return "Focus on reducing negative variances in production";
    } else if (this.getAverageEfficiency() > '95') {
      return "Excellent efficiency - maintain current processes";
    } else {
      return "Monitor production closely for optimal performance";
    }
  }
}