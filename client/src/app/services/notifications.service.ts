import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { BehaviorSubject, interval, Observable, of, Subscription } from 'rxjs';
import { catchError, switchMap, startWith, tap } from 'rxjs/operators';

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

  /**
   * Clears the unread indicator and updates lastInboxAt on the server.
   * Returns an Observable that completes after the server confirms the write —
   * callers should chain data fetches to the subscription so they run with the
   * updated lastInboxAt, avoiding the race condition.
   */
  markRead(): Observable<void> {
    this.hasUnread$.next(false);
    return this.http.post<void>(`${this.apiUrl}/mark-read`, {}).pipe(
      catchError(() => of(undefined as void)),
    );
  }

  /** Force a single check (e.g. after tab switch). */
  refresh(): void {
    this.http.get<{ hasUnread: boolean }>(`${this.apiUrl}/unread`).subscribe({
      next: (res) => this.hasUnread$.next(res.hasUnread),
      error: () => {},
    });
  }
}
