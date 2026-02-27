import { Component } from '@angular/core';

@Component({
  selector: 'app-find-game',
  templateUrl: 'find-game.page.html',
  styleUrls: ['find-game.page.scss'],
  standalone: false,
})
export class FindGamePage { 
  games = [
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

  constructor() {}
  
   joinGame(game: any) {
    alert(`You joined: ${game.title}`);
  }
}
