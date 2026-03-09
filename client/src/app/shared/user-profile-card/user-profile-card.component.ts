import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { FriendsService } from '../../services/friends.service';
import { AuthService } from '../../services/auth.service';
import { InviteToGameComponent } from '../invite-to-game/invite-to-game.component';

export interface ProfileData {
  user: {
    _id: string;
    username: string;
    avatar: string;
    bio: string;
    quote: string;
    location: string;
    reputation: number;
    reputationCount: number;
    favoriteGames: string[];
  };
  stats: { gamesHosted: number; gamesJoined: number };
  friendStatus: 'none' | 'pending_sent' | 'pending_received' | 'friends';
  friendRequestId: string | null;
  friendCount: number;
  mutualFriends: {
    _id: string;
    username: string;
    avatar: string;
    location: string;
    reputation: number;
    reputationCount: number;
  }[];
}

@Component({
  selector: 'app-user-profile-card',
  templateUrl: 'user-profile-card.component.html',
  styleUrls: ['user-profile-card.component.scss'],
  standalone: false,
})
export class UserProfileCardComponent implements OnInit {
  @Input() userId!: string;

  profile: ProfileData | null = null;
  loading = true;
  error = '';
  actionLoading = false;
  friendStatus: ProfileData['friendStatus'] = 'none';
  friendRequestId: string | null = null;

  readonly stars = [1, 2, 3, 4, 5];
  readonly gameLabels: Record<string, string> = {
    magic: 'Magic: The Gathering',
    pokemon: 'Pokémon TCG',
    yugioh: 'Yu-Gi-Oh!',
    onepiece: 'One Piece TCG',
  };

  get isOwnProfile(): boolean {
    return this.auth.currentUser?._id === this.userId;
  }

  constructor(
    private readonly modalCtrl: ModalController,
    private readonly friendsService: FriendsService,
    private readonly auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.friendsService.getUserProfile(this.userId).subscribe({
      next: (res) => {
        this.profile = res;
        this.friendStatus = res.friendStatus;
        this.friendRequestId = res.friendRequestId;
        this.loading = false;
      },
      error: () => { this.error = 'Could not load profile.'; this.loading = false; },
    });
  }

  dismiss(): void { this.modalCtrl.dismiss(); }

  addFriend(): void {
    this.actionLoading = true;
    this.friendsService.sendRequest(this.userId).subscribe({
      next: (res) => {
        this.friendStatus = 'pending_sent';
        this.friendRequestId = res.requestId;
        this.actionLoading = false;
      },
      error: () => { this.actionLoading = false; },
    });
  }

  cancelRequest(): void {
    if (!this.friendRequestId) return;
    this.actionLoading = true;
    this.friendsService.cancelRequest(this.friendRequestId).subscribe({
      next: () => { this.friendStatus = 'none'; this.friendRequestId = null; this.actionLoading = false; },
      error: () => { this.actionLoading = false; },
    });
  }

  acceptRequest(): void {
    if (!this.friendRequestId) return;
    this.actionLoading = true;
    this.friendsService.acceptRequest(this.friendRequestId).subscribe({
      next: () => { this.friendStatus = 'friends'; this.actionLoading = false; },
      error: () => { this.actionLoading = false; },
    });
  }

  declineRequest(): void {
    if (!this.friendRequestId) return;
    this.actionLoading = true;
    this.friendsService.declineRequest(this.friendRequestId).subscribe({
      next: () => { this.friendStatus = 'none'; this.friendRequestId = null; this.actionLoading = false; },
      error: () => { this.actionLoading = false; },
    });
  }

  unfriend(): void {
    this.actionLoading = true;
    this.friendsService.unfriend(this.userId).subscribe({
      next: () => { this.friendStatus = 'none'; this.friendRequestId = null; this.actionLoading = false; },
      error: () => { this.actionLoading = false; },
    });
  }

  async openMutualProfile(userId: string): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: UserProfileCardComponent,
      componentProps: { userId },
      breakpoints: [0, 0.92],
      initialBreakpoint: 0.92,
      handle: true,
      cssClass: 'profile-card-modal',
    });
    await modal.present();
  }

  async inviteToGame(): Promise<void> {
    if (!this.profile) return;
    const modal = await this.modalCtrl.create({
      component: InviteToGameComponent,
      componentProps: {
        inviteeId: this.userId,
        inviteeName: this.profile.user.username,
      },
      breakpoints: [0, 0.95, 1],
      initialBreakpoint: 0.95,
      handleBehavior: 'cycle',
    });
    await modal.present();
  }
}
