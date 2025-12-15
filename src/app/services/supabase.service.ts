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

export interface ProductionLog {
  id?: string;
  date: string;
  recipe_id: string;
  recipe_name?: string;
  order_kg?: number;
  batches: number;
  actual_output: number;
  raw_used: number;
  raw_cost: number;
  remark?: string;
  type?: 'sku' | 'premix';
  item_name?: string;
  created_at?: string;
}

export interface User {
  id?: string;
  username: string;
  password?: string;
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

// Update the existing Recipe interface with SKU field
export interface Recipe {
  id?: string;
  name: string;
  sku?: string | null; // Allow both string, null, or undefined
  batch_size: number;
  yield_kg: number;
  std_yield?: number;
  created_at?: string;
}

// Update RecipeWithDetails interface with SKU field
export interface RecipeWithDetails extends Recipe {
  skus: RecipeItem[];
  premixes: RecipeItem[];
}

export interface RecipeItem {
  id?: string;
  recipe_id: string;
  name: string;
  type: 'sku' | 'premix';
  quantity1b: number;
  quantityhalfb: number;
  quantityquarterb: number;
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
      
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();
      
      if (error) {
        console.error('Supabase error in login:', error);
        return null;
      }
      
      console.log('User found in database:', data);
      
      if (data && data.password === password) {
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
      console.log('Saving recipe:', recipe);
      
      const payload: any = {
        name: recipe.name.trim(),
        sku: recipe.sku?.trim() || null,
        batch_size: recipe.batch_size ?? 1,
        yield_kg: recipe.yield_kg ?? 0,
      };

      if (recipe.std_yield !== undefined && recipe.std_yield !== null) {
        payload.std_yield = recipe.std_yield;
      }

      let result;
      if (recipe.id) {
        console.log('Updating existing recipe with ID:', recipe.id);
        result = await this.supabase
          .from('recipes')
          .update(payload)
          .eq('id', recipe.id)
          .select();
      } else {
        console.log('Inserting new recipe');
        result = await this.supabase
          .from('recipes')
          .insert(payload)
          .select();
      }

      console.log('Supabase save recipe result:', result);

      if (result.error) {
        console.error('Supabase error in saveRecipe:', result.error);
        throw result.error;
      }
      
      console.log('Recipe saved successfully:', result.data);
      return result.data;
    } catch (error) {
      console.error('Error in saveRecipe:', error);
      return null;
    }
  }

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

  async getProductionLogsByDate(date: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('production_logs')
        .select(`
          *,
          recipes (name)
        `)
        .eq('date', date)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('Supabase error in getProductionLogsByDate:', error);
        return [];
      }
      
      return data?.map(log => ({
        ...log,
        recipe_name: log.recipes?.name || 'Unknown Recipe',
        type: log.type || 'sku',
        item_name: log.item_name || 'Unknown Item'
      })) || [];
      
    } catch (error) {
      console.error('Error in getProductionLogsByDate:', error);
      return [];
    }
  }

  async saveProductionLog(log: ProductionLog): Promise<ProductionLog[] | null> {
    try {
      const logData: any = {
        date: log.date,
        recipe_id: log.recipe_id,
        batches: log.batches,
        actual_output: log.actual_output,
        raw_used: log.raw_used,
        raw_cost: log.raw_cost
      };
      
      if (log.recipe_name) logData.recipe_name = log.recipe_name;
      if (log.order_kg !== undefined) logData.order_kg = log.order_kg;
      if (log.remark) logData.remark = log.remark;
      if (log.type) logData.type = log.type;
      if (log.item_name) logData.item_name = log.item_name;
      
      const { data, error } = await this.supabase
        .from('production_logs')
        .insert([logData])
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

  async getProductionLogsByDateRange(startDate: string, endDate: string): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('production_logs')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });
      
      if (error) {
        console.error('Supabase error in getProductionLogsByDateRange:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error('Error in getProductionLogsByDateRange:', error);
      return [];
    }
  }

  async deleteProductionLogsByDate(date: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('production_logs')
        .delete()
        .eq('date', date);
      
      if (error) {
        console.error('Supabase error in deleteProductionLogsByDate:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error in deleteProductionLogsByDate:', error);
      return false;
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

  async bulkUpsertMaterials(materials: Material[]): Promise<Material[]> {
    const { data, error } = await this.supabase
      .from('materials')
      .upsert(materials, { onConflict: 'sku' })
      .select('*');

    if (error) throw error;
    return data as Material[];
  }

  async deleteAllMaterials() {
    const { error } = await this.supabase
      .from('materials')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) throw error;
  }

  // ===== RECIPE ITEMS (SKUs & Premixes) =====
  async getRecipeItems(recipeId: string): Promise<RecipeItem[]> {
    try {
      const { data, error } = await this.supabase
        .from('recipe_items')
        .select('*')
        .eq('recipe_id', recipeId)
        .order('created_at');
      
      if (error) {
        console.error('Supabase error in getRecipeItems:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error('Error in getRecipeItems:', error);
      return [];
    }
  }

  async saveRecipeItem(item: RecipeItem): Promise<RecipeItem[] | null> {
    try {
      console.log('Saving recipe item:', item);
      if (item.id) {
        const { data, error } = await this.supabase
          .from('recipe_items')
          .update({
            name: item.name,
            type: item.type,
            quantity1b: item.quantity1b,
            quantityhalfb: item.quantityhalfb,
            quantityquarterb: item.quantityquarterb
          })
          .eq('id', item.id)
          .select();
        
        if (error) {
          console.error('Supabase error in saveRecipeItem (update):', error);
          return null;
        }
        return data;
      } else {
        const { data, error } = await this.supabase
          .from('recipe_items')
          .insert([{
            recipe_id: item.recipe_id,
            name: item.name,
            type: item.type,
            quantity1b: item.quantity1b,
            quantityhalfb: item.quantityhalfb,
            quantityquarterb: item.quantityquarterb
          }])
          .select();
        
        if (error) {
          console.error('Supabase error in saveRecipeItem (insert):', error);
          return null;
        }
        return data;
      }
    } catch (error) {
      console.error('Error in saveRecipeItem:', error);
      return null;
    }
  }

  async bulkSaveRecipeItems(items: RecipeItem[]): Promise<RecipeItem[] | null> {
    try {
      console.log('Bulk saving recipe items:', items.length);
      
      const itemsToInsert = items.map(item => ({
        recipe_id: item.recipe_id,
        name: item.name,
        type: item.type,
        quantity1b: item.quantity1b,
        quantityhalfb: item.quantityhalfb,
        quantityquarterb: item.quantityquarterb
      }));
      
      const { data, error } = await this.supabase
        .from('recipe_items')
        .insert(itemsToInsert)
        .select();
      
      if (error) {
        console.error('Supabase error in bulkSaveRecipeItems:', error);
        return null;
      }
      return data;
    } catch (error) {
      console.error('Error in bulkSaveRecipeItems:', error);
      return null;
    }
  }

  async deleteRecipeItem(id: string): Promise<boolean> {
    try {
      console.log('Deleting recipe item ID:', id);
      const { error } = await this.supabase
        .from('recipe_items')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Supabase error in deleteRecipeItem:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error in deleteRecipeItem:', error);
      return false;
    }
  }

  async deleteRecipeItems(recipeId: string): Promise<boolean> {
    try {
      console.log('Deleting all recipe items for recipe:', recipeId);
      const { error } = await this.supabase
        .from('recipe_items')
        .delete()
        .eq('recipe_id', recipeId);
      
      if (error) {
        console.error('Supabase error in deleteRecipeItems:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error in deleteRecipeItems:', error);
      return false;
    }
  }

  // ===== ENHANCED RECIPE FUNCTIONS =====
  async deleteRecipe(id: string): Promise<boolean> {
    try {
      console.log('Deleting recipe ID:', id);
      
      await this.deleteRecipeItems(id);
      
      const { error } = await this.supabase
        .from('recipes')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Supabase error in deleteRecipe:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error in deleteRecipe:', error);
      return false;
    }
  }

  async getRecipeWithDetails(recipeId: string): Promise<RecipeWithDetails | null> {
    try {
      console.log('Getting recipe details for ID:', recipeId);
      
      const { data: recipeData, error: recipeError } = await this.supabase
        .from('recipes')
        .select('*')
        .eq('id', recipeId)
        .single();
      
      if (recipeError) {
        console.error('Supabase error getting recipe:', recipeError);
        return null;
      }

      console.log('Recipe data retrieved:', recipeData);
      
      const { data: itemsData, error: itemsError } = await this.supabase
        .from('recipe_items')
        .select('*')
        .eq('recipe_id', recipeId);
      
      if (itemsError) {
        console.error('Supabase error getting recipe items:', itemsError);
        return null;
      }

      console.log('Recipe items retrieved:', itemsData);
      
      const skus = itemsData.filter(item => item.type === 'sku');
      const premixes = itemsData.filter(item => item.type === 'premix');

      console.log(`Found ${skus.length} SKUs and ${premixes.length} premixes`);
      
      return {
        id: recipeData.id,
        name: recipeData.name,
        sku: recipeData.sku || undefined,
        std_yield: recipeData.std_yield,
        batch_size: recipeData.batch_size,
        yield_kg: recipeData.yield_kg,
        created_at: recipeData.created_at,
        skus: skus,
        premixes: premixes
      };
    } catch (error) {
      console.error('Error in getRecipeWithDetails:', error);
      return null;
    }
  }

  async getAllRecipesWithDetails(): Promise<RecipeWithDetails[]> {
    try {
      console.log('Fetching ALL recipes + items in ONE query...');

      const { data, error } = await this.supabase
        .from('recipes')
        .select(`
          id,
          name,
          sku,
          std_yield,
          batch_size,
          yield_kg,
          created_at,
          recipe_items (
            id,
            name,
            type,
            quantity1b,
            quantityhalfb,
            quantityquarterb
          )
        `)
        .order('name');

      if (error) {
        console.error('Supabase error:', error);
        return [];
      }

      if (!data) {
        console.log('No recipes found');
        return [];
      }

      console.log(`Fetched ${data.length} recipes with nested items`);

      const result: RecipeWithDetails[] = data.map((row: any) => {
        const items = row.recipe_items || [];
        return {
          id: row.id,
          name: row.name,
          sku: row.sku || undefined,
          std_yield: row.std_yield,
          batch_size: row.batch_size || 1,
          yield_kg: row.yield_kg || 0,
          created_at: row.created_at,
          skus: items.filter((i: any) => i.type === 'sku'),
          premixes: items.filter((i: any) => i.type === 'premix')
        };
      });

      console.log(`Returning ${result.length} fully loaded recipes`);
      return result;

    } catch (err) {
      console.error('Fatal error in getAllRecipesWithDetails:', err);
      return [];
    }
  }

  async saveRecipeWithItems(recipe: RecipeWithDetails): Promise<RecipeWithDetails | null> {
    try {
      console.log('=== STARTING saveRecipeWithItems ===');
      console.log('Input recipe:', JSON.stringify(recipe, null, 2));
      
      const recipePayload: Recipe = {
        id: recipe.id,
        name: recipe.name.trim(),
        sku: recipe.sku?.trim() || null,
        std_yield: recipe.std_yield ?? 0,
        batch_size: recipe.batch_size ?? 1,
        yield_kg: recipe.yield_kg ?? 0,
      };

      console.log('Recipe payload for save:', recipePayload);

      const savedRecipe = await this.saveRecipe(recipePayload);
      if (!savedRecipe || savedRecipe.length === 0) {
        console.error('Failed to save main recipe');
        return null;
      }

      const recipeId = savedRecipe[0].id!;
      console.log('Saved recipe ID:', recipeId);

      if (recipe.id) {
        console.log('Editing existing recipe, deleting old items...');
        await this.deleteRecipeItems(recipeId);
      }

      const itemsToInsert: any[] = [];
      
      if (recipe.skus && recipe.skus.length > 0) {
        const validSkus = recipe.skus.filter(sku => sku.name && sku.name.trim() !== '');
        console.log(`Adding ${validSkus.length} valid SKUs out of ${recipe.skus.length} total`);
        
        validSkus.forEach((sku, index) => {
          const item = {
            recipe_id: recipeId,
            name: sku.name.trim(),
            type: 'sku',
            quantity1b: Number(sku.quantity1b) || 0,
            quantityhalfb: Number(sku.quantityhalfb) || 0,
            quantityquarterb: Number(sku.quantityquarterb) || 0
          };
          console.log(`SKU ${index + 1}:`, item);
          itemsToInsert.push(item);
        });
      } else {
        console.log('No SKUs provided');
      }

      if (recipe.premixes && recipe.premixes.length > 0) {
        const validPremixes = recipe.premixes.filter(premix => premix.name && premix.name.trim() !== '');
        console.log(`Adding ${validPremixes.length} valid premixes out of ${recipe.premixes.length} total`);
        
        validPremixes.forEach((premix, index) => {
          const item = {
            recipe_id: recipeId,
            name: premix.name.trim(),
            type: 'premix',
            quantity1b: Number(premix.quantity1b) || 0,
            quantityhalfb: Number(premix.quantityhalfb) || 0,
            quantityquarterb: Number(premix.quantityquarterb) || 0
          };
          console.log(`Premix ${index + 1}:`, item);
          itemsToInsert.push(item);
        });
      } else {
        console.log('No premixes provided');
      }

      console.log(`Total items to insert: ${itemsToInsert.length}`, JSON.stringify(itemsToInsert, null, 2));

      if (itemsToInsert.length > 0) {
        console.log('Inserting items into recipe_items table...');
        const { data, error } = await this.supabase
          .from('recipe_items')
          .insert(itemsToInsert)
          .select();

        if (error) {
          console.error('Error inserting recipe items:', error);
          console.error('Error details:', JSON.stringify(error, null, 2));
          console.error('Error message:', error.message);
          console.error('Error details:', error.details);
          console.error('Error hint:', error.hint);
          console.error('Error code:', error.code);
          throw error;
        }
        console.log('Items inserted successfully:', data);
      } else {
        console.log('No items to insert (all were empty or filtered out)');
      }

      console.log('Fetching updated recipe details...');
      const updatedRecipe = await this.getRecipeWithDetails(recipeId);
      console.log('Updated recipe:', updatedRecipe);
      console.log('=== COMPLETED saveRecipeWithItems ===');
      return updatedRecipe;
      
    } catch (error: any) {
      console.error('Error in saveRecipeWithItems:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      if (error.message) console.error('Error message:', error.message);
      if (error.details) console.error('Error details:', error.details);
      if (error.hint) console.error('Error hint:', error.hint);
      if (error.code) console.error('Error code:', error.code);
      return null;
    }
  }

  async checkRecipeItemsTable(): Promise<void> {
    try {
      console.log('Checking recipe_items table structure...');
      
      const { data, error } = await this.supabase
        .from('recipe_items')
        .select('*')
        .limit(1);
      
      if (error) {
        console.error('Error accessing recipe_items table:', error);
        console.error('This might mean the table does not exist or you lack permissions');
      } else {
        console.log('recipe_items table accessible. Sample row:', data);
      }
      
      const testItem = {
        recipe_id: '00000000-0000-0000-0000-000000000000',
        name: 'Test Item',
        type: 'sku',
        quantity1b: 0,
        quantityhalfb: 0,
        quantityquarterb: 0,
      };
      
      console.log('Testing insert with dummy data:', testItem);
      
    } catch (error) {
      console.error('Error checking table:', error);
    }
  }

  // ===== BULK DELETE RECIPES =====
  async deleteAllRecipes(): Promise<boolean> {
    try {
      console.log('Deleting ALL recipes and their items...');

      const { error: itemsError } = await this.supabase
        .from('recipe_items')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (itemsError) {
        console.error('Error deleting recipe_items:', itemsError);
        throw itemsError;
      }

      const { error: recipesError } = await this.supabase
        .from('recipes')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (recipesError) {
        console.error('Error deleting recipes:', recipesError);
        throw recipesError;
      }

      console.log('All recipes and items deleted successfully');
      return true;
    } catch (error) {
      console.error('Error in deleteAllRecipes:', error);
      return false;
    }
  }

  async deleteProductionLogsByRecipeAndDate(recipeId: string, date: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('production_logs')
        .delete()
        .eq('recipe_id', recipeId)
        .eq('date', date);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting production logs by recipe and date:', error);
      return false;
    }
  }
}