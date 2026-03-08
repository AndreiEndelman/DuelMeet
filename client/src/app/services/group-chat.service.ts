import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface GroupChatMember {
  _id: string;
  username: string;
  avatar: string;
}

export interface GroupChat {
  _id: string;
  name: string;
  creator: GroupChatMember;
  members: GroupChatMember[];
  gameRef?: { _id: string; title: string; type: string } | null;
  updatedAt: string;
}

export interface GroupMessage {
  _id: string;
  groupChat: string;
  sender: GroupChatMember;
  text: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class GroupChatService {
  private readonly base = `${environment.apiUrl}/groupchats`;

  constructor(
    private readonly http: HttpClient,
    private readonly auth: AuthService,
  ) {}

  private get h() { return this.auth.getAuthHeaders(); }

  getMyChats(): Observable<{ chats: GroupChat[] }> {
    return this.http.get<{ chats: GroupChat[] }>(this.base, this.h);
  }

  getChat(id: string): Observable<{ chat: GroupChat }> {
    return this.http.get<{ chat: GroupChat }>(`${this.base}/${id}`, this.h);
  }

  createChat(name: string, memberIds: string[]): Observable<{ chat: GroupChat }> {
    return this.http.post<{ chat: GroupChat }>(this.base, { name, memberIds }, this.h);
  }

  getMessages(chatId: string, after?: string): Observable<{ messages: GroupMessage[] }> {
    const params = after ? `?after=${encodeURIComponent(after)}` : '';
    return this.http.get<{ messages: GroupMessage[] }>(
      `${this.base}/${chatId}/messages${params}`,
      this.h,
    );
  }

  sendMessage(chatId: string, text: string): Observable<{ message: GroupMessage }> {
    return this.http.post<{ message: GroupMessage }>(
      `${this.base}/${chatId}/messages`,
      { text },
      this.h,
    );
  }

  inviteMember(chatId: string, userId: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.base}/${chatId}/invite`,
      { userId },
      this.h,
    );
  }
}
