import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface PublicUser {
  _id: string;
  username: string;
  avatar: string;
  reputation: number;
  reputationCount: number;
  location: string;
  bio: string;
  quote: string;
  favoriteGames: string[];
}

export interface FriendRequest {
  _id: string;
  sender: PublicUser;
  receiver: PublicUser;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export type FriendStatus = 'none' | 'pending_sent' | 'pending_received' | 'friends';

@Injectable({ providedIn: 'root' })
export class FriendsService {
  private readonly base = `${environment.apiUrl}/friends`;
  private readonly usersBase = `${environment.apiUrl}/users`;

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
  ) {}

  private get headers() {
    return this.auth.getAuthHeaders();
  }

  // ── Friends list ──────────────────────────────────────────────────────────
  getFriends(): Observable<{ friends: PublicUser[] }> {
    return this.http.get<{ friends: PublicUser[] }>(this.base, this.headers);
  }

  // ── Incoming requests ─────────────────────────────────────────────────────
  getIncomingRequests(): Observable<{ requests: FriendRequest[] }> {
    return this.http.get<{ requests: FriendRequest[] }>(`${this.base}/requests`, this.headers);
  }

  // ── Outgoing requests ─────────────────────────────────────────────────────
  getSentRequests(): Observable<{ requests: FriendRequest[] }> {
    return this.http.get<{ requests: FriendRequest[] }>(`${this.base}/sent`, this.headers);
  }

  // ── Status with a specific user ───────────────────────────────────────────
  getStatus(userId: string): Observable<{ status: FriendStatus; requestId: string | null }> {
    return this.http.get<{ status: FriendStatus; requestId: string | null }>(
      `${this.base}/status/${userId}`,
      this.headers,
    );
  }

  // ── Send request ──────────────────────────────────────────────────────────
  sendRequest(userId: string): Observable<{ message: string; requestId: string }> {
    return this.http.post<{ message: string; requestId: string }>(
      `${this.base}/request/${userId}`,
      {},
      this.headers,
    );
  }

  // ── Accept request ────────────────────────────────────────────────────────
  acceptRequest(requestId: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.base}/accept/${requestId}`,
      {},
      this.headers,
    );
  }

  // ── Decline request ───────────────────────────────────────────────────────
  declineRequest(requestId: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.base}/decline/${requestId}`,
      {},
      this.headers,
    );
  }

  // ── Cancel outgoing request ───────────────────────────────────────────────
  cancelRequest(requestId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.base}/cancel/${requestId}`,
      this.headers,
    );
  }

  // ── Unfriend ──────────────────────────────────────────────────────────────
  unfriend(userId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.base}/${userId}`,
      this.headers,
    );
  }

  // ── Public user profile ───────────────────────────────────────────────────
  getUser(userId: string): Observable<{ user: PublicUser }> {
    return this.http.get<{ user: PublicUser }>(
      `${this.usersBase}/${userId}`,
      this.headers,
    );
  }
}
