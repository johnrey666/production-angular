import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SupabaseService, UserWithoutPassword } from './supabase.service';

interface LoginResult {
  success: boolean;
  error?: string;
}

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
    if (this.isBrowser) {
      this.loadUser();
    }
  }

  private loadUser() {
    if (!this.isBrowser) return;
    
    try {
      const userData = localStorage.getItem('ctk_user');
      if (userData) {
        this.currentUser = JSON.parse(userData);
      }
    } catch (error) {
      console.error('Error loading user:', error);
      this.clearUser();
    }
  }

  private saveUser(user: UserWithoutPassword) {
    if (!this.isBrowser) return;
    
    try {
      localStorage.setItem('ctk_user', JSON.stringify(user));
      this.currentUser = user;
    } catch (error) {
      console.error('Error saving user:', error);
    }
  }

  private clearUser() {
    if (!this.isBrowser) return;
    
    try {
      localStorage.removeItem('ctk_user');
      this.currentUser = null;
    } catch (error) {
      console.error('Error clearing user:', error);
    }
  }

  async login(username: string, password: string): Promise<LoginResult> {
    console.log('AuthService: Attempting login for:', username);
    
    if (!username || !password) {
      return { success: false, error: 'Please enter both username and password' };
    }

    try {
      // Always try Supabase first
      const user = await this.supabase.login(username, password);
      
      if (user) {
        console.log('AuthService: Login successful for:', username);
        this.saveUser(user);
        return { success: true };
      } else {
        console.log('AuthService: Supabase login failed for:', username);
        
        // Check if it's demo credentials
        if (username === 'admin' && password === 'admin') {
          console.log('AuthService: Using demo credentials for:', username);
          const demoUser: UserWithoutPassword = {
            username: 'admin',
            full_name: 'System Administrator',
            role: 'admin'
          };
          this.saveUser(demoUser);
          return { success: true };
        }
        
        return { success: false, error: 'Invalid username or password' };
      }
    } catch (error: any) {
      console.error('AuthService: Login error:', error);
      
      // Check for specific Supabase error
      if (error.message?.includes('Password mismatch')) {
        return { success: false, error: 'Invalid password. Please try again.' };
      }
      
      // Check for network errors
      if (error.message?.includes('Network') || error.message?.includes('fetch') || error.name === 'TypeError') {
        console.log('AuthService: Network error detected');
        
        // Fallback to demo if network error and using demo credentials
        if (username === 'admin' && password === 'admin') {
          console.log('AuthService: Using demo fallback (network error)');
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
          error: 'Cannot connect to server. Please check your connection.' 
        };
      }
      
      return { 
        success: false, 
        error: 'Login failed. Please try again.' 
      };
    }
  }

  logout() {
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