import { Component } from '@angular/core';
import { Router } from '@angular/router';

interface Game {
  title: string;
  location: string;
  date: string;
  players: number;
  maxPlayers: number;
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
    { label: 'Nearby',   value: 'all',      ionIcon: 'location',        emoji: '' },
    { label: 'Magic',    value: 'magic',    ionIcon: '',                emoji: '🧙' },
    { label: 'Pokémon',  value: 'pokemon',  ionIcon: '',                emoji: '⚡' },
    { label: 'Yu-Gi-Oh', value: 'yugioh',  ionIcon: '',                emoji: '👁️' },
  ];
  activeFilter = 'all';

  games: Game[] = [
    {
      title: 'MTG Modern Night',
      location: "Dragon's Den",
      date: 'Fri, May 12  ·  7:00 PM',
      players: 3,
      maxPlayers: 4,
      type: 'magic',
      typeLabel: 'Magic',
    },
    {
      title: 'Pokémon Battle',
      location: 'Comic Corner',
      date: 'Sat, May 13  ·  2:00 PM',
      players: 1,
      maxPlayers: 4,
      type: 'pokemon',
      typeLabel: 'Pokémon',
    },
    {
      title: 'Yu-Gi-Oh! Duel',
      location: 'Gamers Guild',
      date: 'Sun, May 14  ·  6:00 PM',
      players: 1,
      maxPlayers: 2,
      type: 'yugioh',
      typeLabel: 'Yu-Gi-Oh!',
    },
  ];

  get filteredGames(): Game[] {
    if (this.activeFilter === 'all') return this.games;
    return this.games.filter(g => g.type === this.activeFilter);
  }

  constructor(private readonly router: Router) {}

  openCreateGamePage(): void {
    this.router.navigate(['/tabs/find-game/create-game']);
  }
  
   joinGame(game: Game) {
    alert(`You joined: ${game.title}`);
  }
}
