import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { BehaviorSubject, interval, Subscription } from 'rxjs';
import { switchMap, startWith } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly apiUrl = `${environment.apiUrl}/notifications`;

  hasUnread$ = new BehaviorSubject<boolean>(false);

  private pollSub: Subscription | null = null;

  constructor(private readonly http: HttpClient) {}

  /** Start polling every 30s. Call once from AppComponent or TabsPage. */
  startPolling(): void {
    if (this.pollSub) return;
    this.pollSub = interval(30_000)
      .pipe(startWith(0), switchMap(() => this.http.get<{ hasUnread: boolean }>(`${this.apiUrl}/unread`)))
      .subscribe({ next: (res) => this.hasUnread$.next(res.hasUnread), error: () => {} });
  }

  stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = null;
  }

  /** Call when the user opens the Inbox. Clears the indicator. */
  markRead(): void {
    this.http.post(`${this.apiUrl}/mark-read`, {}).subscribe({
      next: () => this.hasUnread$.next(false),
      error: () => {},
    });
  }

  /** Force a single check (e.g. after tab switch). */
  refresh(): void {
    this.http.get<{ hasUnread: boolean }>(`${this.apiUrl}/unread`).subscribe({
      next: (res) => this.hasUnread$.next(res.hasUnread),
      error: () => {},
    });
  }
}
