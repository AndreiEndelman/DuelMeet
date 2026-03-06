import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-verify-email',
  templateUrl: './verify-email.page.html',
  styleUrls: ['./verify-email.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule],
})
export class VerifyEmailPage implements OnInit {
  loading  = true;
  success  = false;
  errorMsg = '';

  constructor(
    private readonly http: HttpClient,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.loading  = false;
      this.errorMsg = 'No verification token found. Please use the link from your email.';
      return;
    }
    this.http
      .get<{ message: string }>(`${environment.apiUrl}/auth/verify-email/${token}`)
      .subscribe({
        next: () => {
          this.loading = false;
          this.success = true;
        },
        error: (err) => {
          this.loading  = false;
          this.errorMsg = err.error?.message || 'Verification failed. The link may have expired.';
        },
      });
  }
}
