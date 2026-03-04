import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService, User } from '../services/auth.service';
import { GamesService } from '../services/games.service';

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
export class HomePage implements OnInit, OnDestroy {
  user: User | null = null;
  upcomingGames: UpcomingGame[] = [];
  private sub!: Subscription;

  constructor(
    private readonly router: Router,
    private readonly auth: AuthService,
    private readonly gamesService: GamesService,
  ) {}

  ngOnInit(): void {
    this.sub = this.auth.currentUser$.subscribe(u => { this.user = u; });
  }

  ionViewWillEnter(): void {
    this.loadMyGames();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  get username(): string { return this.user?.username ?? ''; }
  get location(): string { return this.user?.location  ?? ''; }

  loadMyGames(): void {
    this.gamesService.getMyGames().subscribe({
      next: (res) => {
        this.upcomingGames = res.games.map(g => ({
          title:  g.title,
          date:   new Date(g.date).toLocaleString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
          }),
          type:   g.type,
          status: g.host._id === this.user?._id ? 'hosting' : 'joined',
        }));
      },
    });
  }

  goToFindGame(): void   { this.router.navigate(['/tabs/find-game']); }
  goToCreateGame(): void { this.router.navigate(['/tabs/find-game/create-game']); }
}
