import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ModalController } from '@ionic/angular';
import { AuthService, User } from '../services/auth.service';
import { GamesService } from '../services/games.service';
import { NotificationsService } from '../services/notifications.service';
import { GameDetailComponent } from '../find-game/game-detail/game-detail.component';

interface UpcomingGame {
  gameId: string;
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
  hasUnread = false;
  pendingInvites = 0;
  private subs: Subscription[] = [];

  constructor(
    private readonly router: Router,
    private readonly auth: AuthService,
    private readonly gamesService: GamesService,
    private readonly modalCtrl: ModalController,
    readonly notifications: NotificationsService,
  ) {}

  ngOnInit(): void {
    this.subs.push(
      this.auth.currentUser$.subscribe(u => { this.user = u; }),
      this.notifications.hasUnread$.subscribe(v => { this.hasUnread = v; }),
    );
  }

  ionViewWillEnter(): void {
    this.loadMyGames();
    this.loadInvites();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  get username(): string    { return this.user?.username   ?? ''; }
  get location(): string    { return this.user?.location   ?? ''; }
  get avatar(): string      { return this.user?.avatar     ?? ''; }
  get reputation(): number  { return this.user?.reputation ?? 0;  }

  loadMyGames(): void {
    this.gamesService.getMyGames().subscribe({
      next: (res) => {
        this.upcomingGames = res.games.map(g => ({
          gameId: g._id,
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

  loadInvites(): void {
    this.gamesService.getGameInvites().subscribe({
      next: (res) => { this.pendingInvites = res.total; },
      error: () => { this.pendingInvites = 0; },
    });
  }

  openNotifications(): void { this.router.navigate(['/tabs/profile/notifications']); }
  goToFindGame(): void      { this.router.navigate(['/tabs/find-game']); }
  goToCreateGame(): void    { this.router.navigate(['/tabs/find-game/create-game']); }
  goToFriends(): void       { this.router.navigate(['/tabs/inbox']); }
  goToProfile(): void       { this.router.navigate(['/tabs/profile']); }
  goToInvites(): void       { this.router.navigate(['/tabs/find-game'], { state: { segment: 'invites' } }); }

  async openGameDetail(gameId: string): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: GameDetailComponent,
      componentProps: { gameId },
      breakpoints: [0, 0.92, 1],
      initialBreakpoint: 0.92,
      handleBehavior: 'cycle',
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (data?.refreshNeeded) this.loadMyGames();
  }
}
