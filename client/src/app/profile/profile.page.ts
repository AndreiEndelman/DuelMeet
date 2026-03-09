import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { AlertController } from '@ionic/angular';
import { AuthService, User } from '../services/auth.service';
import { GamesService } from '../services/games.service';
import { FriendsService, PublicUser } from '../services/friends.service';
import { ProfileCardService } from '../services/profile-card.service';
import { environment } from '../../environments/environment';

interface UpcomingGame {
  title: string;
  date: string;
  type: 'magic' | 'pokemon' | 'yugioh' | 'onepiece';
  status: 'joined' | 'hosting';
}

interface Prediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
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
  friends: PublicUser[] = [];
  loadingFriends = false;
  reputationStars = [1, 2, 3, 4, 5];
  private sub!: Subscription;

  // Edit mode
  editMode = false;
  saving = false;
  editError = '';
  editForm = {
    username: '',
    location: '',
    bio: '',
    quote: '',
    favoriteGames: [] as string[],
    avatarPreview: '',
  };

  // Location autocomplete
  locationPredictions: Prediction[] = [];
  showLocationSuggestions = false;
  private readonly locationInput$ = new Subject<string>();
  private autoSub!: Subscription;

  readonly gameOptions = [
    { label: 'Magic: The Gathering', value: 'magic',    icon: '\u{1F9D9}' },
    { label: 'Pokemon TCG',          value: 'pokemon',  icon: '\u26A1' },
    { label: 'Yu-Gi-Oh!',            value: 'yugioh',   icon: '\u{1F441}' },
    { label: 'One Piece TCG',        value: 'onepiece', icon: '\u2620' },
  ];

  constructor(
    private readonly auth: AuthService,
    private readonly gamesService: GamesService,
    private readonly friendsService: FriendsService,
    private readonly profileCardService: ProfileCardService,
    private readonly router: Router,
    private readonly http: HttpClient,
    private readonly alertCtrl: AlertController,
  ) {}

  ngOnInit(): void {
    this.sub = this.auth.currentUser$.subscribe(u => { this.user = u; });
    this.autoSub = this.locationInput$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((input: string) => {
        if (!input || input.length < 3) {
          this.locationPredictions = [];
          this.showLocationSuggestions = false;
          return [];
        }
        return this.http.get<{ predictions: Prediction[] }>(
          `${environment.apiUrl}/places/autocomplete`, { params: { input } }
        );
      }),
    ).subscribe({
      next: (res: any) => {
        this.locationPredictions = res?.predictions ?? [];
        this.showLocationSuggestions = this.locationPredictions.length > 0;
      },
      error: () => { this.locationPredictions = []; this.showLocationSuggestions = false; },
    });
  }

  ionViewWillEnter(): void { this.loadMyGames(); this.loadFriends(); }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.autoSub?.unsubscribe();
  }

  get username():   string { return this.user?.username  ?? ''; }
  get location():   string { return this.user?.location  ?? ''; }
  get uniqueTag():  string { return this.user?.uniqueTag  ?? ''; }
  get reputation(): number { return this.user?.reputation ?? 0; }
  get bio():        string { return (this.user as any)?.bio  ?? ''; }
  get quote():      string { return (this.user as any)?.quote ?? ''; }
  get avatar():     string { return (this.user as any)?.avatar ?? ''; }

  get gamesHosted(): number { return this.upcomingGames.filter(g => g.status === 'hosting').length; }
  get gamesJoined(): number { return this.upcomingGames.filter(g => g.status === 'joined').length; }

  get favoriteGames(): { icon: string; label: string }[] {
    const map: Record<string, { icon: string; label: string }> = {
      magic:    { icon: '\u{1F9D9}', label: 'Magic' },
      pokemon:  { icon: '\u26A1',    label: 'Pokemon' },
      yugioh:   { icon: '\u{1F441}', label: 'Yu-Gi-Oh' },
      onepiece: { icon: '\u2620',    label: 'One Piece' },
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

  loadFriends(): void {
    this.loadingFriends = true;
    this.friendsService.getFriends().subscribe({
      next: (res) => { this.friends = res.friends; this.loadingFriends = false; },
      error: () => { this.loadingFriends = false; },
    });
  }

  openFriendProfile(userId: string): void {
    void this.profileCardService.open(userId);
  }

  openEdit(): void {
    this.editForm = {
      username:      this.user?.username ?? '',
      location:      this.user?.location ?? '',
      bio:           (this.user as any)?.bio ?? '',
      quote:         (this.user as any)?.quote ?? '',
      favoriteGames: [...(this.user?.favoriteGames ?? [])],
      avatarPreview: (this.user as any)?.avatar ?? '',
    };
    this.editError = '';
    this.editMode = true;
  }

  cancelEdit(): void {
    this.editMode = false;
    this.locationPredictions = [];
    this.showLocationSuggestions = false;
  }

  onAvatarChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { this.editForm.avatarPreview = reader.result as string; };
    reader.readAsDataURL(file);
  }

  toggleFavorite(value: string): void {
    const idx = this.editForm.favoriteGames.indexOf(value);
    if (idx === -1) {
      this.editForm.favoriteGames.push(value);
    } else {
      this.editForm.favoriteGames.splice(idx, 1);
    }
  }

  isFavoriteSelected(value: string): boolean {
    return this.editForm.favoriteGames.includes(value);
  }

  onLocationEditInput(): void {
    this.locationInput$.next(this.editForm.location);
  }

  selectLocationPrediction(p: Prediction): void {
    this.editForm.location = p.description;
    this.locationPredictions = [];
    this.showLocationSuggestions = false;
  }

  hideLocationSuggestions(): void {
    setTimeout(() => { this.showLocationSuggestions = false; }, 150);
  }

  saveProfile(): void {
    this.editError = '';
    if (!this.editForm.username.trim()) {
      this.editError = 'Username is required.';
      return;
    }
    this.saving = true;
    this.auth.updateProfile({
      username:      this.editForm.username.trim(),
      location:      this.editForm.location.trim(),
      bio:           this.editForm.bio.trim(),
      quote:         this.editForm.quote.trim(),
      favoriteGames: this.editForm.favoriteGames,
      avatar:        this.editForm.avatarPreview,
    } as any).subscribe({
      next: () => {
        this.saving = false;
        this.editMode = false;
      },
      error: (err: any) => {
        this.editError = err.error?.message || 'Failed to save. Please try again.';
        this.saving = false;
      },
    });
  }

  async deleteAccount(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Delete Account',
      message: 'This will permanently delete your account and all your data. This cannot be undone.',
      cssClass: 'danger-alert',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          cssClass: 'alert-btn-danger',
          handler: () => {
            this.auth.deleteAccount().subscribe({
              next: () => {
                this.auth.logout();
                void this.router.navigate(['/auth/login'], { replaceUrl: true });
              },
              error: () => {
                this.editError = 'Failed to delete account. Please try again.';
              },
            });
          },
        },
      ],
    });
    await alert.present();
  }

  logout(): void {
    this.auth.logout();
    void this.router.navigate(['/auth/login'], { replaceUrl: true });
  }

  isFullStar(star: number): boolean { return this.reputation >= star; }
  isHalfStar(star: number): boolean { return !this.isFullStar(star) && this.reputation >= star - 0.5; }
}

