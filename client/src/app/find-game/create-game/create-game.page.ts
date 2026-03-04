import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';

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
    { label: 'Magic: The Gathering', value: 'magic', icon: '🧙' },
    { label: 'Pokémon TCG', value: 'pokemon', icon: '⚡' },
    { label: 'Yu-Gi-Oh!', value: 'yugioh', icon: '👁️' },
    { label: 'One Piece TCG', value: 'onepiece', icon: '🏴‍☠️' },
  ];

  playerOptions = [2, 4, 6, 8];

  form = {
    cardGame: '',
    maxPlayers: 0,
    date: this.today,
    time: this.today,
    location: '',
    notes: '',
  };

  constructor(private readonly router: Router) {}

  saveGame(): void {
    if (!this.form.cardGame || !this.form.location.trim() || this.form.maxPlayers < 2) {
      return;
    }
    alert(`Game created! ${this.form.cardGame} · ${this.form.maxPlayers} players · ${this.form.location}`);
    this.router.navigate(['/tabs/find-game']);
  }

  cancel(): void {
    this.router.navigate(['/tabs/find-game']);
  }
}
