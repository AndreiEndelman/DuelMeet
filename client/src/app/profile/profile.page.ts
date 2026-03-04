import { Component } from '@angular/core';

interface UpcomingGame {
  title: string;
  date: string;
  type: 'magic' | 'pokemon' | 'yugioh' | 'onepiece';
  status: 'joined' | 'hosting';
}

@Component({
  selector: 'app-profile',
  templateUrl: 'profile.page.html',
  styleUrls: ['profile.page.scss'],
  standalone: false,
})
export class ProfilePage {
  username    = 'CardMaster';
  location    = 'Miami, FL';
  gamesHosted = 12;
  gamesJoined = 28;
  reputation  = 3.5;
  reputationStars = [1, 2, 3, 4, 5];

  favoriteGames = [
    { icon: '🧙', label: 'Magic' },
    { icon: '👁️', label: 'Yu-Gi-Oh' },
    { icon: '⚡', label: 'Pokémon' },
  ];

  upcomingGames: UpcomingGame[] = [
    { title: 'Pokémon Battle',  date: 'Sat, May 13  ·  2:00 PM', type: 'pokemon',  status: 'joined' },
    { title: 'Yu-Gi-Oh! Duel', date: 'Sun, May 14  ·  6:00 PM', type: 'yugioh',   status: 'hosting' },
  ];

  isFullStar(star: number): boolean  { return this.reputation >= star; }
  isHalfStar(star: number): boolean  { return !this.isFullStar(star) && this.reputation >= star - 0.5; }
}
