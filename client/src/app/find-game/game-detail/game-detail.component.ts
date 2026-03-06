import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { AlertController, ModalController } from '@ionic/angular';
import { Subject, interval } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';
import { GamesService, Game } from '../../services/games.service';
import { ChatService } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';
import { GameChatComponent } from '../game-chat/game-chat.component';

@Component({
  selector: 'app-game-detail',
  templateUrl: 'game-detail.component.html',
  styleUrls: ['game-detail.component.scss'],
  standalone: false,
})
export class GameDetailComponent implements OnInit, OnDestroy {
  @Input() gameId!: string;

  game: Game | null = null;
  loading = true;
  error = '';
  actionLoading = false;
  actionError = '';

  // Review state — player reviewing host
  hasReviewed = false;
  reviewSubmitted = false;
  userRating = 0;
  reviewComment = '';
  reviewLoading = false;
  reviewError = '';

  // Review state — host reviewing players
  reviewedPlayerIds: string[] = [];
  reviewSubmittedForPlayerIds: string[] = [];
  hostPlayerRatings: { [id: string]: number } = {};
  hostPlayerComments: { [id: string]: string } = {};
  hostReviewLoading: { [id: string]: boolean } = {};
  hostReviewError: { [id: string]: string } = {};

  reputationStars = [1, 2, 3, 4, 5];
  unreadCount = 0;
  private chatOpen = false;
  private lastMsgTime: string | null = null;
  private readonly destroy$ = new Subject<void>();

  readonly typeLabels: Record<string, string> = {
    magic: 'Magic: The Gathering',
    pokemon: 'Pokémon TCG',
    yugioh: 'Yu-Gi-Oh!',
    onepiece: 'One Piece TCG',
  };

  get currentUserId(): string {
    return this.auth.currentUser?._id ?? '';
  }

  get isHost(): boolean {
    return !!this.game && String(this.game.host._id) === String(this.currentUserId);
  }

  get isPlayer(): boolean {
    return !!this.game && this.game.players.some(p => p._id === this.currentUserId);
  }

  get isApplicant(): boolean {
    return !!this.game && (this.game.applicants ?? []).some(a => a._id === this.currentUserId);
  }

  get canChat(): boolean {
    return this.isHost || this.isPlayer;
  }

  get isFull(): boolean {
    return !!this.game && this.game.players.length >= this.game.maxPlayers;
  }

  get spotsLeft(): number {
    if (!this.game) return 0;
    return Math.max(0, this.game.maxPlayers - this.game.players.length);
  }

  get formattedDate(): string {
    if (!this.game) return '';
    return new Date(this.game.date).toLocaleString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  get isPast(): boolean {
    return !!this.game && new Date(this.game.date) < new Date();
  }

  get showReviewSection(): boolean {
    return this.isPast && this.isPlayer && !this.isHost && !this.hasReviewed && !this.reviewSubmitted;
  }

  get typeEmoji(): string {
    const map: Record<string, string> = {
      magic: '\u{1F9D9}', pokemon: '\u26A1', yugioh: '\u{1F441}', onepiece: '\u2620',
    };
    return map[this.game?.type ?? ''] ?? '';
  }

  constructor(
    private readonly alertCtrl: AlertController,
    private readonly modalCtrl: ModalController,
    private readonly gamesService: GamesService,
    private readonly chatService: ChatService,
    private readonly auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadGame();
  }

  loadGame(): void {
    this.loading = true;
    this.error = '';
    this.gamesService.getGame(this.gameId).subscribe({
      next: (res) => {
        this.game = res.game;
        this.loading = false;
        // Start unread-message polling for participants of future games
        if (new Date(res.game.date) >= new Date() && this.canChat) {
          this.startChatPoll();
        }
        if (new Date(res.game.date) < new Date()) {
          this.gamesService.getMyReview(this.gameId).subscribe({
            next: (r) => {
              if (this.isHost) {
                this.reviewedPlayerIds = r.reviews.map((rv: any) => rv.reviewee?._id ?? rv.reviewee);
              } else if (this.isPlayer) {
                this.hasReviewed = r.reviews.length > 0;
              }
            },
            error: () => {},
          });
        }
      },
      error: () => {
        this.error = 'Failed to load game details.';
        this.loading = false;
      },
    });
  }

  async deleteGame(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Delete Game',
      message: 'Are you sure you want to delete this game? This cannot be undone.',
      cssClass: 'danger-alert',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          cssClass: 'alert-btn-danger',
          handler: () => {
            this.gamesService.deleteGame(this.gameId).subscribe({
              next: () => this.dismiss(true),
              error: () => { this.actionError = 'Failed to delete game.'; },
            });
          },
        },
      ],
    });
    await alert.present();
  }

  setRating(star: number): void {
    this.userRating = star;
  }

  setHostRating(playerId: string, rating: number): void {
    this.hostPlayerRatings = { ...this.hostPlayerRatings, [playerId]: rating };
  }

  submitHostReview(playerId: string): void {
    if (!this.hostPlayerRatings[playerId]) return;
    this.hostReviewLoading = { ...this.hostReviewLoading, [playerId]: true };
    this.hostReviewError = { ...this.hostReviewError, [playerId]: '' };
    this.gamesService.reviewGame(
      this.gameId,
      this.hostPlayerRatings[playerId],
      this.hostPlayerComments[playerId] ?? '',
      playerId
    ).subscribe({
      next: () => {
        this.hostReviewLoading = { ...this.hostReviewLoading, [playerId]: false };
        this.reviewSubmittedForPlayerIds = [...this.reviewSubmittedForPlayerIds, playerId];
      },
      error: (err) => {
        this.hostReviewError = { ...this.hostReviewError, [playerId]: err.error?.message || 'Failed to submit review.' };
        this.hostReviewLoading = { ...this.hostReviewLoading, [playerId]: false };
      },
    });
  }

  submitReview(): void {
    if (!this.userRating) return;
    this.reviewLoading = true;
    this.reviewError = '';
    this.gamesService.reviewGame(this.gameId, this.userRating, this.reviewComment).subscribe({
      next: () => {
        this.reviewLoading = false;
        this.reviewSubmitted = true;
      },
      error: (err) => {
        this.reviewError = err.error?.message || 'Failed to submit review.';
        this.reviewLoading = false;
      },
    });
  }

  private startChatPoll(): void {
    // Seed lastMsgTime with the most recent message
    this.chatService.getMessages(this.gameId).subscribe({
      next: (r) => {
        if (r.messages.length) {
          this.lastMsgTime = r.messages[r.messages.length - 1].createdAt;
        }
        // Poll every 8s for new messages while chat modal is closed
        interval(8000)
          .pipe(
            takeUntil(this.destroy$),
            switchMap(() =>
              this.chatService.getMessages(this.gameId, this.lastMsgTime ?? undefined)
            ),
          )
          .subscribe({
            next: (res) => {
              const fromOthers = res.messages.filter(
                (m) => m.sender._id !== this.currentUserId
              );
              if (fromOthers.length && !this.chatOpen) {
                this.unreadCount += fromOthers.length;
              }
              if (res.messages.length) {
                this.lastMsgTime = res.messages[res.messages.length - 1].createdAt;
              }
            },
          });
      },
      error: () => {},
    });
  }

  async openChat(): Promise<void> {
    this.unreadCount = 0;
    this.chatOpen = true;
    const modal = await this.modalCtrl.create({
      component: GameChatComponent,
      componentProps: { gameId: this.gameId, gameTitle: this.game?.title ?? 'Game Chat' },
      breakpoints: [0, 1],
      initialBreakpoint: 1,
    });
    await modal.present();
    await modal.onDidDismiss();
    this.chatOpen = false;
    this.unreadCount = 0;
    // Update lastMsgTime so we don't recount messages we just read
    this.chatService.getMessages(this.gameId).subscribe({
      next: (r) => {
        if (r.messages.length) {
          this.lastMsgTime = r.messages[r.messages.length - 1].createdAt;
        }
      },
      error: () => {},
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  applyToGame(): void {
    this.actionLoading = true;
    this.actionError = '';
    this.gamesService.applyToGame(this.gameId).subscribe({
      next: (res) => { this.game = res.game; this.actionLoading = false; },
      error: (err) => {
        this.actionError = err.error?.message || 'Failed to apply.';
        this.actionLoading = false;
      },
    });
  }

  acceptPlayer(userId: string): void {
    this.actionLoading = true;
    this.actionError = '';
    this.gamesService.acceptPlayer(this.gameId, userId).subscribe({
      next: (res) => { this.game = res.game; this.actionLoading = false; },
      error: (err) => {
        this.actionError = err.error?.message || 'Failed to accept player.';
        this.actionLoading = false;
      },
    });
  }

  denyPlayer(userId: string): void {
    this.actionLoading = true;
    this.actionError = '';
    this.gamesService.denyPlayer(this.gameId, userId).subscribe({
      next: (res) => { this.game = res.game; this.actionLoading = false; },
      error: (err) => {
        this.actionError = err.error?.message || 'Failed to deny player.';
        this.actionLoading = false;
      },
    });
  }

  isFullStar(star: number): boolean {
    return (this.game?.host?.reputation ?? 0) >= star;
  }

  isHalfStar(star: number): boolean {
    const rep = this.game?.host?.reputation ?? 0;
    return !this.isFullStar(star) && rep >= star - 0.5;
  }

  dismiss(refreshNeeded = false): void {
    void this.modalCtrl.dismiss({ refreshNeeded });
  }
}
