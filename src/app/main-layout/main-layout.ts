import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
// Removed animations import to avoid dependency on @angular/animations

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './main-layout.html',
  styleUrls: ['./main-layout.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MainLayoutComponent {
  isCollapsed = false;
  // Expose the router to the template for calls like `router.isActive(...)`
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
    // Optional: Auto-collapse on mobile or add click effects
    console.log('Navigation clicked');
  }
}