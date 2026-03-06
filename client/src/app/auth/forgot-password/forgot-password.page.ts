import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.page.html',
  styleUrls: ['./forgot-password.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, RouterModule],
})
export class ForgotPasswordPage {
  email   = '';
  loading = false;
  sent    = false;
  errorMsg = '';

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
  ) {}

  submit(): void {
    this.errorMsg = '';
    if (!this.email) {
      this.errorMsg = 'Please enter your email address.';
      return;
    }
    this.loading = true;
    this.http
      .post<{ message: string }>(`${environment.apiUrl}/auth/forgot-password`, { email: this.email })
      .subscribe({
        next: () => {
          this.loading = false;
          this.sent = true;
        },
        error: (err) => {
          this.errorMsg = err.error?.message || 'Something went wrong. Please try again.';
          this.loading = false;
        },
      });
  }
}
