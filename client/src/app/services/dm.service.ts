import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface DmUser {
  _id: string;
  username: string;
  avatar: string;
}

export interface DmMessage {
  _id: string;
  sender: DmUser;
  receiver: DmUser;
  text: string;
  createdAt: string;
}

export interface DmConversation {
  user: DmUser;
  lastMessage: { text: string; createdAt: string };
}

@Injectable({ providedIn: 'root' })
export class DmService {
  private readonly base = `${environment.apiUrl}/dm`;

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
  ) {}

  private get h() { return this.auth.getAuthHeaders(); }

  getConversations(): Observable<{ conversations: DmConversation[] }> {
    return this.http.get<{ conversations: DmConversation[] }>(
      `${this.base}/conversations`,
      this.h,
    );
  }

  getThread(userId: string, after?: string): Observable<{ messages: DmMessage[] }> {
    const params = after ? `?after=${encodeURIComponent(after)}` : '';
    return this.http.get<{ messages: DmMessage[] }>(
      `${this.base}/${userId}${params}`,
      this.h,
    );
  }

  sendMessage(userId: string, text: string): Observable<{ message: DmMessage }> {
    return this.http.post<{ message: DmMessage }>(
      `${this.base}/${userId}`,
      { text },
      this.h,
    );
  }
}
