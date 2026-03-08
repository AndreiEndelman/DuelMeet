import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { Subject, interval } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';
import { GamesService, Game as ApiGame } from '../services/games.service';
import { ChatService } from '../services/chat.service';
import { AuthService } from '../services/auth.service';
import { GameDetailComponent } from './game-detail/game-detail.component';
import { GameChatComponent } from './game-chat/game-chat.component';

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
}

@Component({
  selector: 'app-find-game',
  templateUrl: 'find-game.page.html',
  styleUrls: ['find-game.page.scss'],
  standalone: false,
})
export class FindGamePage implements OnDestroy {
  filters = [
    { label: 'All',      value: 'all',     ionIcon: 'apps',     emoji: '' },
    { label: 'Magic',    value: 'magic',   ionIcon: '',         emoji: '🧙' },
    { label: 'Pokémon',  value: 'pokemon', ionIcon: '',         emoji: '⚡' },
    { label: 'Yu-Gi-Oh', value: 'yugioh',  ionIcon: '',         emoji: '👁️' },
    { label: 'One Piece',value: 'onepiece',ionIcon: '',         emoji: '☠️' },
  ];
  radiusOptions = [10, 25, 50, 100];
  activeFilter = 'all';
  locationInput = '';
  radius = 25;
  allGames: DisplayGame[] = [];
  loading = false;
  error = '';
  noLocationResults = false;
  unreadCounts: { [gameId: string]: number } = {};
  private lastMsgTimes: { [gameId: string]: string | null } = {};
  private chatOpenFor: string | null = null;
  private readonly destroy$ = new Subject<void>();

  get filteredGames(): DisplayGame[] {
    return this.allGames;
  }

  constructor(
    private readonly router: Router,
    private readonly gamesService: GamesService,
    private readonly chatService: ChatService,
    private readonly modalCtrl: ModalController,
    private readonly auth: AuthService,
  ) {}

  ionViewWillEnter(): void {
    this.loadGames();
  }

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

  private startPolling(): void {
    this.destroy$.next(); // cancel existing poll
    const myGames = this.allGames.filter(g => g.isPlayer || g.isHost);
    if (!myGames.length) return;

    // Seed last message times for new games
    myGames.forEach(g => {
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

    // Poll each game independently every 8s
    myGames.forEach(g => {
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

  searchByLocation(): void {
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

  private mapGame(g: ApiGame): DisplayGame {
    const labels: Record<string, string> = {
      magic: 'Magic', pokemon: 'Pokémon', yugioh: 'Yu-Gi-Oh!', onepiece: 'One Piece',
    };
    const currentId = this.auth.currentUser?._id ?? '';
    const isPlayer = (g.players as any[]).some(
      p => (p === currentId) || (p?._id?.toString() === currentId)
    );
    return {
      _id:       g._id,
      title:     g.title,
      location:  g.location,
      date:      new Date(g.date).toLocaleString('en-US', {
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
    };
  }

  openCreateGamePage(): void {
    this.router.navigate(['/tabs/find-game/create-game']);
  }

  async openGameDetail(game: DisplayGame): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: GameDetailComponent,
      componentProps: { gameId: game._id },
      breakpoints: [0, 0.92, 1],
      initialBreakpoint: 0.92,
      handleBehavior: 'cycle',
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (data?.refreshNeeded) {
      this.loadGames();
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
    // Reset lastMsgTime so we don't re-badge messages just read
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
  }}