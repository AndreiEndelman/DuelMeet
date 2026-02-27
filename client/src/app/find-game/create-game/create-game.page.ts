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
  form = {
    title: '',
    location: '',
    maxPlayers: 4,
    notes: '',
  };

  constructor(private readonly router: Router) {}

  saveGame(): void {
    if (!this.form.title.trim() || !this.form.location.trim() || this.form.maxPlayers < 2) {
      return;
    }

    alert(`Game created: ${this.form.title}`);
    this.router.navigate(['/tabs/find-game']);
  }

  cancel(): void {
    this.router.navigate(['/tabs/find-game']);
  }
}
