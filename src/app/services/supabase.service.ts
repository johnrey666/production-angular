import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

// Define interfaces for our data
export interface Material {
  id?: string;
  sku: string;
  description: string;
  unit_cost: number;
  cost_per_kg: number;
  category: string;
  current_stock: number;
  created_at?: string;
}

export interface Recipe {
  id?: string;
  name: string;
  batch_size: number;
  yield_kg: number;
  created_at?: string;
}

export interface ProductionLog {
  id?: string;
  date: string;
  recipe_id: string;
  batches: number;
  actual_output: number;
  raw_used: number;
  raw_cost: number;
  created_at?: string;
}

// Make password optional and add type for user without password
export interface User {
  id?: string;
  username: string;
  password?: string;  // Make password optional
  full_name: string;
  role: string;
  created_at?: string;
}

export interface UserWithoutPassword {
  id?: string;
  username: string;
  full_name: string;
  role: string;
  created_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    console.log('Initializing Supabase with URL:', environment.supabaseUrl);
    this.supabase = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );
  }

  // ===== USER AUTHENTICATION =====
  async login(username: string, password: string): Promise<UserWithoutPassword | null> {
    try {
      console.log('Attempting login for user:', username);
      
      // Query user by username
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single(); // Expect single result
      
      if (error) {
        console.error('Supabase error in login:', error);
        return null;
      }
      
      console.log('User found in database:', data);
      
      // Check password (plain text for demo)
      if (data && data.password === password) {
        // Return user without password
        const userWithoutPassword: UserWithoutPassword = {
          id: data.id,
          username: data.username,
          full_name: data.full_name,
          role: data.role,
          created_at: data.created_at
        };
        
        console.log('Login successful:', userWithoutPassword);
        return userWithoutPassword;
      }
      
      console.log('Password mismatch');
      return null;
    } catch (error) {
      console.error('Error in login:', error);
      return null;
    }
  }

  async getCurrentUser(): Promise<UserWithoutPassword | null> {
    const userData = localStorage.getItem('ctk_user');
    if (userData) {
      try {
        return JSON.parse(userData);
      } catch (error) {
        console.error('Error parsing user data:', error);
        return null;
      }
    }
    return null;
  }

  async logout(): Promise<void> {
    localStorage.removeItem('ctk_user');
    localStorage.removeItem('ctk_token');
  }

  // ===== MATERIALS =====
  async getMaterials(): Promise<Material[]> {
    try {
      console.log('Fetching materials from Supabase...');
      const { data, error } = await this.supabase
        .from('materials')
        .select('*')
        .order('description');
      
      if (error) {
        console.error('Supabase error in getMaterials:', error);
        return [];
      }
      console.log('Materials fetched:', data?.length || 0, 'items');
      return data || [];
    } catch (error) {
      console.error('Error in getMaterials:', error);
      return [];
    }
  }

  async saveMaterial(material: Material): Promise<Material[] | null> {
    try {
      console.log('Saving material:', material);
      if (material.id) {
        // Update existing
        const { data, error } = await this.supabase
          .from('materials')
          .update(material)
          .eq('id', material.id)
          .select();
        
        if (error) {
          console.error('Supabase error in saveMaterial (update):', error);
          return null;
        }
        return data;
      } else {
        // Insert new
        const { data, error } = await this.supabase
          .from('materials')
          .insert([material])
          .select();
        
        if (error) {
          console.error('Supabase error in saveMaterial (insert):', error);
          return null;
        }
        return data;
      }
    } catch (error) {
      console.error('Error in saveMaterial:', error);
      return null;
    }
  }

  async deleteMaterial(id: string): Promise<boolean> {
    try {
      console.log('Deleting material ID:', id);
      const { error } = await this.supabase
        .from('materials')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Supabase error in deleteMaterial:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error in deleteMaterial:', error);
      return false;
    }
  }

  // ===== RECIPES =====
  async getRecipes(): Promise<Recipe[]> {
    try {
      const { data, error } = await this.supabase
        .from('recipes')
        .select('*')
        .order('name');
      
      if (error) {
        console.error('Supabase error in getRecipes:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error('Error in getRecipes:', error);
      return [];
    }
  }

  async saveRecipe(recipe: Recipe): Promise<Recipe[] | null> {
    try {
      if (recipe.id) {
        const { data, error } = await this.supabase
          .from('recipes')
          .update(recipe)
          .eq('id', recipe.id)
          .select();
        
        if (error) {
          console.error('Supabase error in saveRecipe:', error);
          return null;
        }
        return data;
      } else {
        const { data, error } = await this.supabase
          .from('recipes')
          .insert([recipe])
          .select();
        
        if (error) {
          console.error('Supabase error in saveRecipe:', error);
          return null;
        }
        return data;
      }
    } catch (error) {
      console.error('Error in saveRecipe:', error);
      return null;
    }
  }

  // ===== RECIPE INGREDIENTS =====
  async getRecipeIngredients(recipeId: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('recipe_ingredients')
        .select(`
          *,
          materials (*)
        `)
        .eq('recipe_id', recipeId);
      
      if (error) {
        console.error('Supabase error in getRecipeIngredients:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error('Error in getRecipeIngredients:', error);
      return [];
    }
  }

  async saveRecipeIngredient(ingredient: any): Promise<any[] | null> {
    try {
      if (ingredient.id) {
        const { data, error } = await this.supabase
          .from('recipe_ingredients')
          .update(ingredient)
          .eq('id', ingredient.id)
          .select();
        
        if (error) {
          console.error('Supabase error in saveRecipeIngredient:', error);
          return null;
        }
        return data;
      } else {
        const { data, error } = await this.supabase
          .from('recipe_ingredients')
          .insert([ingredient])
          .select();
        
        if (error) {
          console.error('Supabase error in saveRecipeIngredient:', error);
          return null;
        }
        return data;
      }
    } catch (error) {
      console.error('Error in saveRecipeIngredient:', error);
      return null;
    }
  }

  async deleteRecipeIngredient(id: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('recipe_ingredients')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Supabase error in deleteRecipeIngredient:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error in deleteRecipeIngredient:', error);
      return false;
    }
  }

  // ===== PRODUCTION LOGS =====
  async getProductionLogs(month: string): Promise<any[]> {
    try {
      // month format: "2024-01"
      const startDate = `${month}-01`;
      const endDate = `${month}-31`;
      
      const { data, error } = await this.supabase
        .from('production_logs')
        .select(`
          *,
          recipes (*)
        `)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });
      
      if (error) {
        console.error('Supabase error in getProductionLogs:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error('Error in getProductionLogs:', error);
      return [];
    }
  }

  async saveProductionLog(log: ProductionLog): Promise<ProductionLog[] | null> {
    try {
      const { data, error } = await this.supabase
        .from('production_logs')
        .insert([log])
        .select();
      
      if (error) {
        console.error('Supabase error in saveProductionLog:', error);
        return null;
      }
      return data;
    } catch (error) {
      console.error('Error in saveProductionLog:', error);
      return null;
    }
  }

  // ===== USERS MANAGEMENT =====
  async getUsers(): Promise<UserWithoutPassword[]> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('id, username, full_name, role, created_at')
        .order('username');
      
      if (error) {
        console.error('Supabase error in getUsers:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error('Error in getUsers:', error);
      return [];
    }
  }

  async createUser(user: User): Promise<User[] | null> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .insert([user])
        .select();
      
      if (error) {
        console.error('Supabase error in createUser:', error);
        return null;
      }
      return data;
    } catch (error) {
      console.error('Error in createUser:', error);
      return null;
    }
  }

  async updateUser(id: string, user: Partial<User>): Promise<User[] | null> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .update(user)
        .eq('id', id)
        .select();
      
      if (error) {
        console.error('Supabase error in updateUser:', error);
        return null;
      }
      return data;
    } catch (error) {
      console.error('Error in updateUser:', error);
      return null;
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('users')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Supabase error in deleteUser:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error in deleteUser:', error);
      return false;
    }
  }

  // ===== TEST CONNECTION =====
  async testConnection(): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('materials')
        .select('count')
        .limit(1);
      
      if (error) {
        console.error('Supabase connection test failed:', error);
        return false;
      }
      console.log('Supabase connection test successful');
      return true;
    } catch (error) {
      console.error('Error testing Supabase connection:', error);
      return false;
    }
  }

  // ===== BULK OPERATIONS =====
  async bulkInsertMaterials(materials: Material[]): Promise<Material[] | null> {
    try {
      const { data, error } = await this.supabase
        .from('materials')
        .insert(materials)
        .select();
      
      if (error) {
        console.error('Supabase error in bulkInsertMaterials:', error);
        return null;
      }
      return data;
    } catch (error) {
      console.error('Error in bulkInsertMaterials:', error);
      return null;
    }
  }

  async bulkInsertRecipes(recipes: Recipe[]): Promise<Recipe[] | null> {
    try {
      const { data, error } = await this.supabase
        .from('recipes')
        .insert(recipes)
        .select();
      
      if (error) {
        console.error('Supabase error in bulkInsertRecipes:', error);
        return null;
      }
      return data;
    } catch (error) {
      console.error('Error in bulkInsertRecipes:', error);
      return null;
    }
  }

  // ===== BACKUP & RESTORE =====
  async exportData(): Promise<any> {
    try {
      const [materials, recipes, productionLogs, users] = await Promise.all([
        this.getMaterials(),
        this.getRecipes(),
        this.getProductionLogs(new Date().toISOString().slice(0, 7)),
        this.getUsers()
      ]);

      return {
        materials,
        recipes,
        productionLogs,
        users,
        exportedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error exporting data:', error);
      return null;
    }
  }

  // ===== STATISTICS =====
  async getMaterialStatistics(): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('materials')
        .select('category, current_stock, unit_cost');
      
      if (error) {
        console.error('Supabase error in getMaterialStatistics:', error);
        return null;
      }
      
      // Calculate statistics
      const byCategory: {[key: string]: any} = {};
      let totalValue = 0;
      let totalStock = 0;
      
      data?.forEach(material => {
        const category = material.category || 'Uncategorized';
        const value = (material.unit_cost || 0) * (material.current_stock || 0);
        
        if (!byCategory[category]) {
          byCategory[category] = {
            count: 0,
            totalStock: 0,
            totalValue: 0
          };
        }
        
        byCategory[category].count += 1;
        byCategory[category].totalStock += (material.current_stock || 0);
        byCategory[category].totalValue += value;
        
        totalValue += value;
        totalStock += (material.current_stock || 0);
      });
      
      return {
        byCategory,
        totalValue,
        totalStock,
        totalItems: data?.length || 0
      };
    } catch (error) {
      console.error('Error in getMaterialStatistics:', error);
      return null;
    }
  }
}