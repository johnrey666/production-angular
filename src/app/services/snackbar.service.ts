import { Injectable } from '@angular/core';

export type SnackbarType = 'success' | 'error' | 'info' | 'warning';

export interface SnackbarConfig {
  message: string;
  type: SnackbarType;
  duration?: number; // milliseconds
}

@Injectable({
  providedIn: 'root'
})
export class SnackbarService {
  private snackbars: {config: SnackbarConfig, id: number}[] = [];
  private nextId = 0;

  show(config: SnackbarConfig) {
    const id = this.nextId++;
    const snackbar = { config, id };
    this.snackbars.push(snackbar);
    
    // Auto-remove after duration
    const duration = config.duration || 4000;
    setTimeout(() => {
      this.remove(id);
    }, duration);
    
    return id;
  }

  success(message: string, duration?: number) {
    return this.show({ message, type: 'success', duration });
  }

  error(message: string, duration?: number) {
    return this.show({ message, type: 'error', duration });
  }

  info(message: string, duration?: number) {
    return this.show({ message, type: 'info', duration });
  }

  warning(message: string, duration?: number) {
    return this.show({ message, type: 'warning', duration });
  }

  getSnackbars() {
    return this.snackbars;
  }

  remove(id: number) {
    this.snackbars = this.snackbars.filter(s => s.id !== id);
  }

  clearAll() {
    this.snackbars = [];
  }
}