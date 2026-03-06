import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.page.html',
  styleUrls: ['./reset-password.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, RouterModule],
})
export class ResetPasswordPage implements OnInit {
  token    = '';
  password = '';
  confirm  = '';
  loading  = false;
  success  = false;
  errorMsg = '';

  constructor(
    private readonly http: HttpClient,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.errorMsg = 'Invalid reset link. Please request a new one.';
    }
  }

  submit(): void {
    this.errorMsg = '';
    if (!this.password || !this.confirm) {
      this.errorMsg = 'Please fill in both fields.';
      return;
    }
    if (this.password.length < 6) {
      this.errorMsg = 'Password must be at least 6 characters.';
      return;
    }
    if (this.password !== this.confirm) {
      this.errorMsg = 'Passwords do not match.';
      return;
    }
    this.loading = true;
    this.http
      .post<{ message: string }>(`${environment.apiUrl}/auth/reset-password/${this.token}`, {
        password: this.password,
      })
      .subscribe({
        next: () => {
          this.loading = false;
          this.success = true;
          setTimeout(() => void this.router.navigate(['/auth/login'], { replaceUrl: true }), 2500);
        },
        error: (err) => {
          this.errorMsg = err.error?.message || 'Password reset failed. Please try again.';
          this.loading = false;
        },
      });
  }
}
