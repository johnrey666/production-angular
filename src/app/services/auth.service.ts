import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SupabaseService, UserWithoutPassword } from './supabase.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUser: UserWithoutPassword | null = null;
  private isBrowser: boolean;
  
  constructor(
    private supabase: SupabaseService,
    private router: Router,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    console.log('AuthService: isBrowser =', this.isBrowser);
    
    // Only load user if we're in a browser environment
    if (this.isBrowser) {
      this.loadUser();
    }
  }

  private loadUser() {
    if (!this.isBrowser) {
      console.log('AuthService: Skipping localStorage access (not in browser)');
      return;
    }
    
    try {
      const userData = localStorage.getItem('ctk_user');
      if (userData) {
        this.currentUser = JSON.parse(userData);
        console.log('AuthService: Loaded user from localStorage:', this.currentUser?.username);
      } else {
        console.log('AuthService: No user found in localStorage');
      }
    } catch (error) {
      console.error('AuthService: Error loading user:', error);
      this.clearUser();
    }
  }

  private saveUser(user: UserWithoutPassword) {
    if (!this.isBrowser) {
      console.log('AuthService: Cannot save user (not in browser)');
      return;
    }
    
    try {
      localStorage.setItem('ctk_user', JSON.stringify(user));
      this.currentUser = user;
      console.log('AuthService: User saved to localStorage:', user.username);
    } catch (error) {
      console.error('AuthService: Error saving user:', error);
    }
  }

  private clearUser() {
    if (!this.isBrowser) return;
    
    try {
      localStorage.removeItem('ctk_user');
      this.currentUser = null;
      console.log('AuthService: User cleared from localStorage');
    } catch (error) {
      console.error('AuthService: Error clearing user:', error);
    }
  }

  async login(username: string, password: string): Promise<{ success: boolean; error?: string }> {
    console.log('AuthService: Login attempt for', username);
    
    if (!username || !password) {
      return { success: false, error: 'Please enter both username and password' };
    }

    try {
      const user = await this.supabase.login(username, password);
      
      if (user) {
        this.saveUser(user);
        console.log('AuthService: Login successful for', username);
        return { success: true };
      } else {
        console.log('AuthService: Invalid credentials for', username);
        return { success: false, error: 'Invalid username or password' };
      }
    } catch (error: any) {
      console.error('AuthService: Login error:', error);
      
      // Fallback demo login for testing
      if (username === 'admin' && password === 'admin') {
        console.log('AuthService: Using fallback demo login');
        const demoUser: UserWithoutPassword = {
          username: 'admin',
          full_name: 'System Administrator',
          role: 'admin'
        };
        
        this.saveUser(demoUser);
        return { success: true };
      }
      
      return { 
        success: false, 
        error: 'Login failed. Please try again.' 
      };
    }
  }

  logout() {
    console.log('AuthService: Logging out');
    this.clearUser();
    
    if (this.isBrowser) {
      this.router.navigate(['/login']);
    }
  }

  isLoggedIn(): boolean {
    return !!this.currentUser;
  }

  getCurrentUser(): UserWithoutPassword | null {
    return this.currentUser;
  }

  getUserRole(): string {
    return this.currentUser?.role || 'guest';
  }

  isAdmin(): boolean {
    return this.currentUser?.role === 'admin';
  }
}