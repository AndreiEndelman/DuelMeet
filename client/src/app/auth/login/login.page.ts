import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, RouterModule],
})
export class LoginPage {
  email            = '';
  password         = '';
  loading          = false;
  errorMsg         = '';
  notVerified      = false;
  resendLoading    = false;
  resendSent       = false;

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router
  ) {}

  login(): void {
    this.errorMsg    = '';
    this.notVerified = false;
    this.resendSent  = false;
    if (!this.email || !this.password) {
      this.errorMsg = 'Please enter your email and password.';
      return;
    }
    this.loading = true;
    this.auth.login(this.email, this.password).subscribe({
      next: () => void this.router.navigate(['/tabs/home'], { replaceUrl: true }),
      error: (err) => {
        this.loading = false;
        if (err.status === 403 && err.error?.code === 'EMAIL_NOT_VERIFIED') {
          this.notVerified = true;
        } else {
          this.errorMsg = err.error?.message || 'Login failed. Please try again.';
        }
      },
    });
  }

  resendVerification(): void {
    this.resendLoading = true;
    this.auth.resendVerification(this.email).subscribe({
      next: () => {
        this.resendLoading = false;
        this.resendSent    = true;
      },
      error: () => {
        this.resendLoading = false;
        this.resendSent    = true; // show success anyway to prevent enumeration
      },
    });
  }
}
