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
  selector: 'app-profile',
  templateUrl: 'profile.page.html',
  styleUrls: ['profile.page.scss'],
  standalone: false,
})
export class ProfilePage implements OnInit, OnDestroy {
  user: User | null = null;
  upcomingGames: UpcomingGame[] = [];
  reputationStars = [1, 2, 3, 4, 5];
  private sub!: Subscription;

  constructor(
    private readonly auth: AuthService,
    private readonly gamesService: GamesService,
    private readonly router: Router,
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

  get username():   string { return this.user?.username  ?? ''; }
  get location():   string { return this.user?.location  ?? ''; }
  get reputation(): number { return this.user?.reputation ?? 0; }

  get gamesHosted(): number { return this.upcomingGames.filter(g => g.status === 'hosting').length; }
  get gamesJoined(): number { return this.upcomingGames.filter(g => g.status === 'joined').length; }

  get favoriteGames(): { icon: string; label: string }[] {
    const map: Record<string, { icon: string; label: string }> = {
      magic:    { icon: '🧙',  label: 'Magic' },
      pokemon:  { icon: '⚡',  label: 'Pokémon' },
      yugioh:   { icon: '👁️', label: 'Yu-Gi-Oh' },
      onepiece: { icon: '🏴‍☠️', label: 'One Piece' },
    };
    return (this.user?.favoriteGames ?? []).map(g => map[g]).filter(Boolean);
  }

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

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/auth/login'], { replaceUrl: true });
  }

  isFullStar(star: number): boolean { return this.reputation >= star; }
  isHalfStar(star: number): boolean { return !this.isFullStar(star) && this.reputation >= star - 0.5; }
}

