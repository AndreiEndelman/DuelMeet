import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface GameHost {
  _id: string;
  username: string;
  avatar: string;
  location: string;
  reputation: number;
}

export interface GamePlayer {
  _id: string;
  username: string;
  avatar: string;
}

export interface Game {
  _id: string;
  title: string;
  type: 'magic' | 'pokemon' | 'yugioh' | 'onepiece';
  location: string;
  date: string;
  maxPlayers: number;
  notes: string;
  host: GameHost;
  players: GamePlayer[];
  applicants: GamePlayer[];
  spotsLeft: number;
  createdAt: string;
}

export interface GamesResponse {
  games: Game[];
  total: number;
  page: number;
  pages: number;
}

export interface CreateGameData {
  title: string;
  type: string;
  location: string;
  date: string;
  maxPlayers: number;
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class GamesService {
  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService
  ) {}

  getGames(type?: string, page = 1, location?: string, radius = 25): Observable<GamesResponse> {
    const params: Record<string, string | number> = { page, radius };
    if (type && type !== 'all') params['type'] = type;
    if (location && location.trim()) params['location'] = location.trim();
    return this.http.get<GamesResponse>(`${environment.apiUrl}/games`, { params });
  }

  getMyGames(): Observable<GamesResponse> {
    return this.http.get<GamesResponse>(
      `${environment.apiUrl}/games/my`,
      this.auth.getAuthHeaders()
    );
  }

  getGame(id: string): Observable<{ game: Game }> {
    return this.http.get<{ game: Game }>(`${environment.apiUrl}/games/${id}`);
  }

  createGame(data: CreateGameData): Observable<{ game: Game }> {
    return this.http.post<{ game: Game }>(
      `${environment.apiUrl}/games`,
      data,
      this.auth.getAuthHeaders()
    );
  }

  joinGame(id: string): Observable<{ game: Game }> {
    return this.http.post<{ game: Game }>(
      `${environment.apiUrl}/games/${id}/join`,
      {},
      this.auth.getAuthHeaders()
    );
  }

  leaveGame(id: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${environment.apiUrl}/games/${id}/leave`,
      {},
      this.auth.getAuthHeaders()
    );
  }

  deleteGame(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${environment.apiUrl}/games/${id}`,
      this.auth.getAuthHeaders()
    );
  }

  applyToGame(id: string): Observable<{ game: Game }> {
    return this.http.post<{ game: Game }>(
      `${environment.apiUrl}/games/${id}/apply`,
      {},
      this.auth.getAuthHeaders()
    );
  }

  acceptPlayer(gameId: string, userId: string): Observable<{ game: Game }> {
    return this.http.post<{ game: Game }>(
      `${environment.apiUrl}/games/${gameId}/accept/${userId}`,
      {},
      this.auth.getAuthHeaders()
    );
  }

  denyPlayer(gameId: string, userId: string): Observable<{ game: Game }> {
    return this.http.post<{ game: Game }>(
      `${environment.apiUrl}/games/${gameId}/deny/${userId}`,
      {},
      this.auth.getAuthHeaders()
    );
  }

  getMyReview(gameId: string): Observable<{ reviews: any[] }> {
    return this.http.get<{ reviews: any[] }>(
      `${environment.apiUrl}/games/${gameId}/my-review`,
      this.auth.getAuthHeaders()
    );
  }

  reviewGame(gameId: string, rating: number, comment: string, revieweeId?: string): Observable<{ review: any }> {
    return this.http.post<{ review: any }>(
      `${environment.apiUrl}/games/${gameId}/review`,
      { rating, comment, ...(revieweeId ? { revieweeId } : {}) },
      this.auth.getAuthHeaders()
    );
  }
}
