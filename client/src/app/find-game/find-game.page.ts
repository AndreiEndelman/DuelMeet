import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { GamesService, Game as ApiGame } from '../services/games.service';
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
}

@Component({
  selector: 'app-find-game',
  templateUrl: 'find-game.page.html',
  styleUrls: ['find-game.page.scss'],
  standalone: false,
})
export class FindGamePage {
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

  get filteredGames(): DisplayGame[] {
    return this.allGames;
  }

  constructor(
    private readonly router: Router,
    private readonly gamesService: GamesService,
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
      },
      error: () => {
        this.error = 'Failed to load games. Please try again.';
        this.loading = false;
      },
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
    const modal = await this.modalCtrl.create({
      component: GameChatComponent,
      componentProps: { gameId: game._id, gameTitle: game.title },
      breakpoints: [0, 1],
      initialBreakpoint: 1,
    });
    await modal.present();
  }
}
