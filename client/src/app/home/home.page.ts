import { Component } from '@angular/core';
import { Router } from '@angular/router';

interface UpcomingGame {
  title: string;
  date: string;
  type: 'magic' | 'pokemon' | 'yugioh' | 'onepiece';
  status: 'joined' | 'hosting';
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage {
  username = 'CardMaster';
  location = 'Miami, FL';

  upcomingGames: UpcomingGame[] = [
    { title: 'Pokémon Battle',  date: 'Sat, May 13  ·  2:00 PM', type: 'pokemon',  status: 'joined' },
    { title: 'Yu-Gi-Oh! Duel', date: 'Sun, May 14  ·  6:00 PM', type: 'yugioh',   status: 'hosting' },
  ];

  constructor(private readonly router: Router) {}

  goToFindGame(): void  { this.router.navigate(['/tabs/find-game']); }
  goToCreateGame(): void { this.router.navigate(['/tabs/find-game/create-game']); }
}