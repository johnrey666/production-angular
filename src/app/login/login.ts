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
  password: string = '';
  loading: boolean = false;
  errorMessage: string = '';

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  clearError() {
    this.errorMessage = '';
  }

  async onSubmit(): Promise<void> {
    // Clear previous errors
    this.clearError();
    
    if (!this.username || !this.password) {
      this.errorMessage = 'Please enter both username and password';
      return;
    }

    this.loading = true;

    try {
      const result = await this.authService.login(this.username, this.password);
      
      if (result.success) {
        // Login successful - redirect
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 300);
      } else {
        // Login failed - show error
        this.errorMessage = result.error || 'Invalid username or password';
      }
    } catch (error: any) {
      console.error('Login component error:', error);
      this.errorMessage = 'Login failed. Please try again.';
    } finally {
      this.loading = false;
    }
  }
}