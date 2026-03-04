import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, RouterModule],
})
export class RegisterPage {
  username = '';
  email    = '';
  password = '';
  location = '';
  loading  = false;
  errorMsg = '';

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router
  ) {}

  register(): void {
    this.errorMsg = '';
    if (!this.username || !this.email || !this.password) {
      this.errorMsg = 'Username, email and password are required.';
      return;
    }
    if (this.password.length < 6) {
      this.errorMsg = 'Password must be at least 6 characters.';
      return;
    }
    this.loading = true;
    this.auth.register({ username: this.username, email: this.email, password: this.password, location: this.location }).subscribe({
      next: () => void this.router.navigate(['/tabs/home'], { replaceUrl: true }),
      error: (err) => {
        this.errorMsg = err.error?.message || 'Registration failed. Please try again.';
        this.loading = false;
      },
    });
  }
}
