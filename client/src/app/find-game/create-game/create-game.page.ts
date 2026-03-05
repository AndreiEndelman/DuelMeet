import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { IonicModule } from '@ionic/angular';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { GamesService } from '../../services/games.service';
import { environment } from '../../../environments/environment';

interface Prediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

@Component({
  selector: 'app-create-game',
  templateUrl: './create-game.page.html',
  styleUrls: ['./create-game.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
})
export class CreateGamePage implements OnDestroy {
  today = new Date().toISOString();

  cardGames = [
    { label: 'Magic: The Gathering', value: 'magic',    icon: '🧙' },
    { label: 'Pokémon TCG',          value: 'pokemon',  icon: '⚡' },
    { label: 'Yu-Gi-Oh!',            value: 'yugioh',   icon: '👁️' },
    { label: 'One Piece TCG',        value: 'onepiece', icon: '☠️' },
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

  // Autocomplete state
  predictions: Prediction[] = [];
  showSuggestions = false;
  private locationInput$ = new Subject<string>();
  private autoSub: Subscription;

  constructor(
    private readonly router: Router,
    private readonly gamesService: GamesService,
    private readonly http: HttpClient,
  ) {
    this.autoSub = this.locationInput$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((input) => {
        if (!input || input.length < 3) {
          this.predictions = [];
          this.showSuggestions = false;
          return [];
        }
        return this.http.get<{ predictions: Prediction[] }>(
          `${environment.apiUrl}/places/autocomplete`,
          { params: { input } }
        );
      }),
    ).subscribe({
      next: (res: any) => {
        this.predictions = res?.predictions ?? [];
        this.showSuggestions = this.predictions.length > 0;
      },
      error: () => { this.predictions = []; this.showSuggestions = false; },
    });
  }

  ngOnDestroy(): void {
    this.autoSub.unsubscribe();
  }

  onLocationInput(): void {
    this.locationInput$.next(this.form.location);
  }

  selectPrediction(p: Prediction): void {
    this.form.location = p.description;
    this.predictions = [];
    this.showSuggestions = false;
  }

  hideSuggestions(): void {
    // Small delay so click on suggestion registers before blur hides it
    setTimeout(() => { this.showSuggestions = false; }, 150);
  }

  saveGame(): void {
    this.errorMsg = '';
    this.showSuggestions = false;
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

