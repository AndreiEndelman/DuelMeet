import { Component, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { Subject, Subscription, interval } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { GamesService, Game as ApiGame } from '../services/games.service';
import { ChatService } from '../services/chat.service';
import { AuthService } from '../services/auth.service';
import { GameDetailComponent } from './game-detail/game-detail.component';
import { GameChatComponent } from './game-chat/game-chat.component';

interface Prediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

interface DisplayGame {
  _id: string;
  title: string;
  location: string;
  date: string;
  players: number;
  maxPlayers: number;
  spotsLeft: number;
  type: 'magic' | 'pokemon' | 'yugioh' | 'onepiece';
  typeLabel: string;
  isPlayer: boolean;
  isHost: boolean;
  isActive: boolean;
}

@Component({
  selector: 'app-find-game',
  templateUrl: 'find-game.page.html',
  styleUrls: ['find-game.page.scss'],
  standalone: false,
})
export class FindGamePage implements OnDestroy {
  // ── Segments ───────────────────────────────────────────────────────────────
  activeSegment: 'invites' | 'my-games' | 'search' = 'search';

  // ── Search tab state ───────────────────────────────────────────────────────
  filters = [
    { label: 'All',      value: 'all' },
    { label: 'Magic',    value: 'magic' },
    { label: 'Pokémon',  value: 'pokemon' },
    { label: 'Yu-Gi-Oh', value: 'yugioh' },
    { label: 'One Piece',value: 'onepiece' },
  ];
  radiusOptions = [10, 25, 50, 100];
  activeFilter = 'all';
  locationInput = '';
  radius = 25;
  allGames: DisplayGame[] = [];
  loading = false;
  error = '';
  noLocationResults = false;

  // ── My Games tab state ─────────────────────────────────────────────────────
  myGames: DisplayGame[] = [];
  myGamesLoading = false;
  myGamesError = '';
  unreadCounts: { [gameId: string]: number } = {};
  private lastMsgTimes: { [gameId: string]: string | null } = {};
  private chatOpenFor: string | null = null;

  // ── Invites tab state ──────────────────────────────────────────────────────
  invites: ApiGame[] = [];
  invitesLoading = false;
  invitesError = '';
  inviteActioning: { [gameId: string]: boolean } = {};

  private readonly destroy$ = new Subject<void>();

  // Autocomplete
  predictions: Prediction[] = [];
  showSuggestions = false;
  private locationInput$ = new Subject<string>();
  private autoSub!: Subscription;

  get filteredGames(): DisplayGame[] {
    return this.allGames;
  }

  constructor(
    private readonly router: Router,
    private readonly gamesService: GamesService,
    private readonly chatService: ChatService,
    private readonly http: HttpClient,
    private readonly modalCtrl: ModalController,
    private readonly auth: AuthService,
  ) {
    this.autoSub = this.locationInput$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((input) => {
        if (!input || input.length < 3) {
          this.predictions = [];
          this.showSuggestions = false;
          return [];
        }
        return this.http.get<{ predictions: Prediction[] }>(
          `${environment.apiUrl}/places/autocomplete`,
          { params: { input } }
        );
      }),
    ).subscribe({
      next: (res: any) => {
        this.predictions = res?.predictions ?? [];
        this.showSuggestions = this.predictions.length > 0;
      },
      error: () => { this.predictions = []; this.showSuggestions = false; },
    });
  }

  ionViewWillEnter(): void {
    this.loadGames();
    this.loadMyGames();
    this.loadInvites();
  }

  // ── Search tab ─────────────────────────────────────────────────────────────

  loadGames(): void {
    this.loading = true;
    this.error = '';
    this.noLocationResults = false;
    const type = this.activeFilter !== 'all' ? this.activeFilter : undefined;
    this.gamesService.getGames(type, 1, this.locationInput, this.radius).subscribe({
      next: (res) => {
        this.allGames = res.games.map(g => this.mapGame(g));
        this.noLocationResults = !!this.locationInput.trim() && this.allGames.length === 0;
        this.loading = false;
        this.startPolling();
      },
      error: () => {
        this.error = 'Failed to load games. Please try again.';
        this.loading = false;
      },
    });
  }

  // ── My Games tab ───────────────────────────────────────────────────────────

  loadMyGames(): void {
    this.myGamesLoading = true;
    this.myGamesError = '';
    this.gamesService.getMyGames().subscribe({
      next: (res) => {
        this.myGames = res.games.map(g => this.mapGame(g));
        this.myGamesLoading = false;
        this.startPolling();
      },
      error: () => {
        this.myGamesError = 'Failed to load your games.';
        this.myGamesLoading = false;
      },
    });
  }

  // ── Invites tab ────────────────────────────────────────────────────────────

  loadInvites(): void {
    this.invitesLoading = true;
    this.invitesError = '';
    this.gamesService.getGameInvites().subscribe({
      next: (res) => {
        this.invites = res.games;
        this.invitesLoading = false;
      },
      error: () => {
        this.invitesError = 'Failed to load invites.';
        this.invitesLoading = false;
      },
    });
  }

  acceptInvite(game: ApiGame): void {
    this.inviteActioning[game._id] = true;
    this.gamesService.acceptGameInvite(game._id).subscribe({
      next: () => {
        this.invites = this.invites.filter(g => g._id !== game._id);
        this.inviteActioning[game._id] = false;
        this.loadMyGames();
      },
      error: () => { this.inviteActioning[game._id] = false; },
    });
  }

  declineInvite(game: ApiGame): void {
    this.inviteActioning[game._id] = true;
    this.gamesService.declineGameInvite(game._id).subscribe({
      next: () => {
        this.invites = this.invites.filter(g => g._id !== game._id);
        this.inviteActioning[game._id] = false;
      },
      error: () => { this.inviteActioning[game._id] = false; },
    });
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  isGameActive(date: string | Date): boolean {
    const ACTIVE_WINDOW_MS = 3 * 60 * 60 * 1000;
    const gameDate = new Date(date).getTime();
    const now = Date.now();
    return gameDate <= now && now - gameDate <= ACTIVE_WINDOW_MS;
  }

  typeLabel(type: string): string {
    const labels: Record<string, string> = {
      magic: 'Magic', pokemon: 'Pokémon', yugioh: 'Yu-Gi-Oh!', onepiece: 'One Piece',
    };
    return labels[type] || type;
  }

  // ── Polling ────────────────────────────────────────────────────────────────

  private startPolling(): void {
    this.destroy$.next(); // cancel existing poll
    const allTracked = [
      ...this.allGames.filter(g => g.isPlayer || g.isHost),
      ...this.myGames,
    ];
    const unique = allTracked.filter((g, i, arr) => arr.findIndex(x => x._id === g._id) === i);
    if (!unique.length) return;

    unique.forEach(g => {
      if (this.lastMsgTimes[g._id] === undefined) {
        this.lastMsgTimes[g._id] = null;
        this.chatService.getMessages(g._id).subscribe({
          next: (r) => {
            if (r.messages.length) {
              this.lastMsgTimes[g._id] = r.messages[r.messages.length - 1].createdAt;
            }
          },
          error: () => {},
        });
      }
    });

    unique.forEach(g => {
      interval(8000)
        .pipe(
          takeUntil(this.destroy$),
          switchMap(() =>
            this.chatService.getMessages(g._id, this.lastMsgTimes[g._id] ?? undefined)
          ),
        )
        .subscribe({
          next: (res) => {
            if (!res.messages.length) return;
            const currentId = this.auth.currentUser?._id ?? '';
            const fromOthers = res.messages.filter(m => m.sender._id !== currentId);
            if (fromOthers.length && this.chatOpenFor !== g._id) {
              this.unreadCounts = {
                ...this.unreadCounts,
                [g._id]: (this.unreadCounts[g._id] ?? 0) + fromOthers.length,
              };
            }
            this.lastMsgTimes[g._id] = res.messages[res.messages.length - 1].createdAt;
          },
          error: () => {},
        });
    });
  }

  // ── Location autocomplete ──────────────────────────────────────────────────

  onLocationInput(): void {
    this.locationInput$.next(this.locationInput);
  }

  selectPrediction(p: Prediction): void {
    this.locationInput = p.description;
    this.predictions = [];
    this.showSuggestions = false;
    this.loadGames();
  }

  hideSuggestions(): void {
    setTimeout(() => { this.showSuggestions = false; }, 150);
  }

  searchByLocation(): void {
    this.showSuggestions = false;
    this.loadGames();
  }

  clearLocation(): void {
    this.locationInput = '';
    this.loadGames();
  }

  setFilter(value: string): void {
    this.activeFilter = value;
    this.loadGames();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private mapGame(g: ApiGame): DisplayGame {
    const labels: Record<string, string> = {
      magic: 'Magic', pokemon: 'Pokémon', yugioh: 'Yu-Gi-Oh!', onepiece: 'One Piece',
    };
    const currentId = this.auth.currentUser?._id ?? '';
    const isPlayer = (g.players as any[]).some(
      p => (p === currentId) || (p?._id?.toString() === currentId)
    );
    const gameDate = new Date(g.date);
    const now = new Date();
    const isActive = gameDate <= now && now.getTime() - gameDate.getTime() <= 3 * 60 * 60 * 1000;
    return {
      _id:       g._id,
      title:     g.title,
      location:  g.location,
      date:      isActive
        ? 'Happening now'
        : new Date(g.date).toLocaleString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
          }),
      players:   g.players.length,
      maxPlayers: g.maxPlayers,
      spotsLeft: g.spotsLeft,
      type:      g.type,
      typeLabel: labels[g.type] || g.type,
      isPlayer,
      isHost: (g.host as any)?._id?.toString() === currentId,
      isActive,
    };
  }

  openCreateGamePage(): void {
    this.router.navigate(['/tabs/find-game/create-game']);
  }

  async openGameDetail(game: DisplayGame | ApiGame): Promise<void> {
    const gameId = (game as any)._id;
    const modal = await this.modalCtrl.create({
      component: GameDetailComponent,
      componentProps: { gameId },
      breakpoints: [0, 0.92, 1],
      initialBreakpoint: 0.92,
      handleBehavior: 'cycle',
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (data?.refreshNeeded) {
      this.loadGames();
      this.loadMyGames();
    }
  }

  async openGameChat(game: DisplayGame): Promise<void> {
    this.chatOpenFor = game._id;
    this.unreadCounts = { ...this.unreadCounts, [game._id]: 0 };
    const modal = await this.modalCtrl.create({
      component: GameChatComponent,
      componentProps: { gameId: game._id, gameTitle: game.title },
      breakpoints: [0, 1],
      initialBreakpoint: 1,
    });
    await modal.present();
    await modal.onDidDismiss();
    this.chatOpenFor = null;
    this.chatService.getMessages(game._id).subscribe({
      next: (r) => {
        if (r.messages.length) {
          this.lastMsgTimes[game._id] = r.messages[r.messages.length - 1].createdAt;
        }
      },
      error: () => {},
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.autoSub.unsubscribe();
  }
}