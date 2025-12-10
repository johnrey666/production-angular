import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './main-layout.html',
  styleUrls: ['./main-layout.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainLayoutComponent {
  isCollapsed = false;
  showLogoutConfirm = false;
  router = inject(Router);
  
  navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/production', label: 'Production', icon: '🏭' },
    { path: '/raw-materials', label: 'Raw Materials', icon: '📦' },
    { path: '/recipes', label: 'Recipes', icon: '📝' },
    { path: '/reports', label: 'Reports', icon: '📈' }
  ];

  toggleSidebar() {
    this.isCollapsed = !this.isCollapsed;
  }

  onNavClick() {
    console.log('Navigation clicked');
  }

  confirmLogout() {
    this.showLogoutConfirm = true;
  }

  cancelLogout() {
    this.showLogoutConfirm = false;
  }

  logout() {
    // Clear authentication data
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Clear any other stored data if needed
    // localStorage.clear();
    
    // Hide confirmation dialog
    this.showLogoutConfirm = false;
    
    // Navigate to login page
    this.router.navigate(['/login']);
    
    // Optional: Show success message
    // alert('Successfully logged out!');
  }
}