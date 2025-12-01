import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
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
  
  stats = [
    { value: '68', label: 'BATCHES TODAY', trend: '+12%', positive: true, delay: '0ms' },
    { value: '2,847 kg', label: 'TOTAL OUTPUT', trend: '+5%', positive: true, delay: '100ms' },
    { value: 'P892,450', label: 'RAW MAT COST', trend: '-3%', positive: false, delay: '200ms' },
    { value: '+12.4 kg', label: 'NET VARIANCE', trend: '+2%', positive: true, delay: '300ms' }
  ];

  ngOnInit() {
    this.currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  startProduction() {
    console.log('Starting production...');
    // Add your production start logic
  }

  viewReports() {
    console.log('Viewing reports...');
    // Add report generation logic
  }

  manageInventory() {
    console.log('Managing inventory...');
    // Add inventory management logic
  }
}