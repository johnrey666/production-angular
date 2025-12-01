import { Routes } from '@angular/router';
import { LoginComponent } from './login/login';
import { MainLayoutComponent } from './main-layout/main-layout';
import { DashboardComponent } from './dashboard/dashboard';
import { ProductionComponent } from './production/production';
import { RawMaterialsComponent } from './raw-materials/raw-materials';
import { RecipesComponent } from './recipes/recipes';  
import { CostAnalysisComponent } from './cost-analysis/cost-analysis';
import { ReportsComponent } from './reports/reports';  

export const routes: Routes = [
  // Login page - separate from main layout
  { path: 'login', component: LoginComponent },
  
  // Redirect root to login
  { path: '', redirectTo: '/login', pathMatch: 'full' },

  // Main layout with sidebar - all protected routes go here
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'production', component: ProductionComponent },
      { path: 'raw-materials', component: RawMaterialsComponent },
      { path: 'recipes', component: RecipesComponent },
      { path: 'cost-analysis', component: CostAnalysisComponent },
      { path: 'reports', component: ReportsComponent }
      // Add more child routes here
    ]
  },

  // Catch all - redirect to login
  { path: '**', redirectTo: '/login' }
];