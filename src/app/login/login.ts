import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {
  username: string = 'admin';
  password: string = 'admin';
  loading: boolean = false;
  showToast: boolean = false;
  toastMessage: string = '';
  toastType: 'success' | 'error' | 'info' = 'info';

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  showToastMessage(message: string, type: 'success' | 'error' | 'info' = 'info') {
    this.toastMessage = message;
    this.toastType = type;
    this.showToast = true;
    
    // Auto-hide after 4 seconds
    setTimeout(() => {
      this.showToast = false;
    }, 4000);
  }

  hideToast() {
    this.showToast = false;
  }

  async onSubmit(): Promise<void> {
    if (!this.username || !this.password) {
      this.showToastMessage('Please enter both username and password', 'error');
      return;
    }

    this.loading = true;
    
    try {
      const result = await this.authService.login(this.username, this.password);
      
      if (result.success) {
        this.showToastMessage('Login successful! Redirecting...', 'success');
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 1000);
      } else {
        this.showToastMessage(result.error || 'Invalid username or password', 'error');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      
      if (error.message?.includes('Failed to fetch')) {
        this.showToastMessage('Cannot connect to server. Please check your connection.', 'error');
      } else if (error.message?.includes('timeout')) {
        this.showToastMessage('Connection timeout. Please try again.', 'error');
      } else {
        this.showToastMessage('Login failed. Please try again.', 'error');
      }
    } finally {
      this.loading = false;
    }
  }
}