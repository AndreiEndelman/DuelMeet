import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { GamesService, Game as ApiGame } from '../services/games.service';

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
}

@Component({
  selector: 'app-find-game',
  templateUrl: 'find-game.page.html',
  styleUrls: ['find-game.page.scss'],
  standalone: false,
})
export class FindGamePage {
  filters = [
    { label: 'Nearby',   value: 'all',     ionIcon: 'location', emoji: '' },
    { label: 'Magic',    value: 'magic',   ionIcon: '',         emoji: '🧙' },
    { label: 'Pokémon',  value: 'pokemon', ionIcon: '',         emoji: '⚡' },
    { label: 'Yu-Gi-Oh', value: 'yugioh',  ionIcon: '',         emoji: '👁️' },
  ];
  activeFilter = 'all';
  allGames: DisplayGame[] = [];
  loading = false;
  error = '';

  get filteredGames(): DisplayGame[] {
    if (this.activeFilter === 'all') return this.allGames;
    return this.allGames.filter(g => g.type === this.activeFilter);
  }

  constructor(
    private readonly router: Router,
    private readonly gamesService: GamesService,
  ) {}

  ionViewWillEnter(): void {
    this.loadGames();
  }

  loadGames(): void {
    this.loading = true;
    this.error = '';
    this.gamesService.getGames().subscribe({
      next: (res) => {
        this.allGames = res.games.map(g => this.mapGame(g));
        this.loading = false;
      },
      error: () => {
        this.error = 'Failed to load games. Please try again.';
        this.loading = false;
      },
    });
  }

  private mapGame(g: ApiGame): DisplayGame {
    const labels: Record<string, string> = {
      magic: 'Magic', pokemon: 'Pokémon', yugioh: 'Yu-Gi-Oh!', onepiece: 'One Piece',
    };
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
    };
  }

  openCreateGamePage(): void {
    this.router.navigate(['/tabs/find-game/create-game']);
  }

  joinGame(game: DisplayGame): void {
    this.gamesService.joinGame(game._id).subscribe({
      next: () => this.loadGames(),
      error: (err) => alert(err.error?.message || 'Failed to join game'),
    });
  }
}
