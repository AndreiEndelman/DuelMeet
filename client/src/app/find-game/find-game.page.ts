import { Component } from '@angular/core';
import { Router } from '@angular/router';

interface Game {
  title: string;
  location: string;
  players: number;
  maxPlayers: number;
}

@Component({
  selector: 'app-find-game',
  templateUrl: 'find-game.page.html',
  styleUrls: ['find-game.page.scss'],
  standalone: false,
})
export class FindGamePage { 
  games: Game[] = [
  {
    title: 'Magic: The Gathering - Commander Night',
    location: 'CoolStuff Games - Miami',
    players: 3,
    maxPlayers: 4
  },
  {
    title: 'Yu-Gi-Oh Casual Match',
    location: 'Local Library',
    players: 1,
    maxPlayers: 2
  },
  {
    title: 'Pokémon TCG Tournament Prep',
    location: 'Gamers Guild',
    players: 5,
    maxPlayers: 8
  }
];  // <-- PascalCase, no hyphen

  constructor(private readonly router: Router) {}

  openCreateGamePage(): void {
    this.router.navigate(['/tabs/find-game/create-game']);
  }
  
   joinGame(game: Game) {
    alert(`You joined: ${game.title}`);
  }
}
