import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { BehaviorSubject, interval, Observable, of, Subscription } from 'rxjs';
import { catchError, switchMap, startWith } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly apiUrl = `${environment.apiUrl}/notifications`;

  hasUnread$ = new BehaviorSubject<boolean>(false);

  /** True while the Inbox page is the active view. */
  private inboxOpen = false;

  private pollSub: Subscription | null = null;

  constructor(private readonly http: HttpClient, private readonly auth: AuthService) {}

  /** Start polling every 30 s. Call once from TabsPage. */
  startPolling(): void {
    if (this.pollSub) return;
    this.pollSub = interval(30_000)
      .pipe(
        startWith(0),
        switchMap(() => this.http.get<{ hasUnread: boolean }>(`${this.apiUrl}/unread`, this.auth.getAuthHeaders())),
      )
      .subscribe({
        next: (res) => {
          // Never show the dot while the user is already looking at the inbox.
          if (!this.inboxOpen) {
            this.hasUnread$.next(res.hasUnread);
          }
        },
        error: () => {},
      });
  }

  stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = null;
  }

  /**
   * Call from InboxPage.ionViewWillEnter.
   * Immediately clears the dot, tells the poller to stay quiet,
   * and writes lastInboxAt so the next poll baseline is correct.
   */
  enterInbox(): Observable<void> {
    this.inboxOpen = true;
    this.hasUnread$.next(false);
    return this.http.post<void>(`${this.apiUrl}/mark-read`, {}, this.auth.getAuthHeaders()).pipe(
      catchError(() => of(undefined as void)),
    );
  }

  /**
   * Call from InboxPage.ionViewWillLeave.
   * Re-enables the poller to update the dot.
   */
  leaveInbox(): void {
    this.inboxOpen = false;
  }
}
