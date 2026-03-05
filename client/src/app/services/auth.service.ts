import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface User {
  _id: string;
  username: string;
  email: string;
  location: string;
  favoriteGames: string[];
  reputation: number;
  reputationCount: number;
  avatar: string;
  bio: string;
  quote: string;
}

interface AuthResponse {
  token: string;
  user: User;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'tcg_token';
  private readonly _user$ = new BehaviorSubject<User | null>(null);
  readonly currentUser$ = this._user$.asObservable();

  constructor(private readonly http: HttpClient) {
    if (this.getToken()) {
      this.fetchMe().subscribe({ error: () => this.logout() });
    }
  }

  get isLoggedIn(): boolean {
    return !!this.getToken();
  }

  get currentUser(): User | null {
    return this._user$.getValue();
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getAuthHeaders(): { headers: HttpHeaders } {
    return {
      headers: new HttpHeaders({ Authorization: `Bearer ${this.getToken()}` }),
    };
  }

  register(data: {
    username: string;
    email: string;
    password: string;
    location?: string;
  }): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/register`, data)
      .pipe(tap((res) => this.storeSession(res)));
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/auth/login`, { email, password })
      .pipe(tap((res) => this.storeSession(res)));
  }

  fetchMe(): Observable<{ user: User }> {
    return this.http
      .get<{ user: User }>(`${environment.apiUrl}/auth/me`, this.getAuthHeaders())
      .pipe(tap((res) => this._user$.next(res.user)));
  }

  updateProfile(data: Partial<User>): Observable<{ user: User }> {
    return this.http
      .put<{ user: User }>(`${environment.apiUrl}/auth/me`, data, this.getAuthHeaders())
      .pipe(tap((res) => this._user$.next(res.user)));
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    this._user$.next(null);
  }

  private storeSession(res: AuthResponse): void {
    localStorage.setItem(this.TOKEN_KEY, res.token);
    this._user$.next(res.user);
  }
}
