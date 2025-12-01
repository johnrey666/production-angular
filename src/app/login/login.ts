import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ FormsModule ],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class LoginComponent {
[x: string]: any;
  username: string = '';
  password: string = '';

  constructor(private router: Router) {}

onSubmit(): void {
  if (this.username && this.password) {
    this.router.navigate(['/dashboard']);  // This should work now
  } else {
    alert('Please enter both username and password');
  }
}
}
