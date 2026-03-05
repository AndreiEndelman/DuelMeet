import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ChatMessage {
  _id: string;
  game: string;
  sender: { _id: string; username: string; avatar?: string };
  text: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly base = `${environment.apiUrl}/games`;

  constructor(private readonly http: HttpClient) {}

  getMessages(gameId: string, after?: string): Observable<{ messages: ChatMessage[] }> {
    const params = after ? `?after=${encodeURIComponent(after)}` : '';
    return this.http.get<{ messages: ChatMessage[] }>(
      `${this.base}/${gameId}/messages${params}`
    );
  }

  sendMessage(gameId: string, text: string): Observable<{ message: ChatMessage }> {
    return this.http.post<{ message: ChatMessage }>(
      `${this.base}/${gameId}/messages`,
      { text }
    );
  }
}
