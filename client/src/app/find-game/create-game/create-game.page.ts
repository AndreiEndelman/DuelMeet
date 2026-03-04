import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { GamesService } from '../../services/games.service';

@Component({
  selector: 'app-create-game',
  templateUrl: './create-game.page.html',
  styleUrls: ['./create-game.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
})
export class CreateGamePage {
  today = new Date().toISOString();

  cardGames = [
    { label: 'Magic: The Gathering', value: 'magic',    icon: '🧙' },
    { label: 'Pokémon TCG',          value: 'pokemon',  icon: '⚡' },
    { label: 'Yu-Gi-Oh!',            value: 'yugioh',   icon: '👁️' },
    { label: 'One Piece TCG',        value: 'onepiece', icon: '🏴‍☠️' },
  ];

  playerOptions = [2, 4, 6, 8];
  loading  = false;
  errorMsg = '';

  form = {
    cardGame:   '',
    maxPlayers: 0,
    date:       this.today,
    time:       this.today,
    location:   '',
    notes:      '',
  };

  constructor(
    private readonly router: Router,
    private readonly gamesService: GamesService,
  ) {}

  saveGame(): void {
    this.errorMsg = '';
    if (!this.form.cardGame || !this.form.location.trim() || this.form.maxPlayers < 2) {
      this.errorMsg = 'Please fill in all required fields.';
      return;
    }

    const d = new Date(this.form.date);
    const t = new Date(this.form.time);
    d.setHours(t.getHours(), t.getMinutes(), 0, 0);

    const selectedGame = this.cardGames.find(g => g.value === this.form.cardGame);
    this.loading = true;

    this.gamesService.createGame({
      title:      `${selectedGame?.label ?? this.form.cardGame} Game`,
      type:       this.form.cardGame,
      location:   this.form.location,
      date:       d.toISOString(),
      maxPlayers: this.form.maxPlayers,
      notes:      this.form.notes,
    }).subscribe({
      next: () => void this.router.navigate(['/tabs/find-game']),
      error: (err) => {
        this.errorMsg = err.error?.message || 'Failed to create game. Please try again.';
        this.loading = false;
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/tabs/find-game']);
  }
}

