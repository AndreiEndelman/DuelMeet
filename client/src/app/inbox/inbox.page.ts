import { Component, OnInit, OnDestroy } from '@angular/core';
import { AlertController, ModalController } from '@ionic/angular';
import { FriendsService, FriendRequest, PublicUser } from '../services/friends.service';
import { GroupChatService, GroupChat } from '../services/group-chat.service';
import { DmService, DmConversation } from '../services/dm.service';
import { NotificationsService } from '../services/notifications.service';
import { ProfileCardService } from '../services/profile-card.service';
import { GroupChatThreadComponent } from './group-chat-thread/group-chat-thread.component';
import { DmThreadComponent } from './dm-thread/dm-thread.component';

@Component({
  selector: 'app-inbox',
  templateUrl: 'inbox.page.html',
  styleUrls: ['inbox.page.scss'],
  standalone: false,
})
export class InboxPage implements OnInit, OnDestroy {
  // Friend requests
  pendingRequests: FriendRequest[] = [];
  loadingRequests = true;
  requestsError = '';

  // DM conversations
  dmConversations: DmConversation[] = [];
  loadingDms = true;
  dmsError = '';

  // Group chats
  groupChats: GroupChat[] = [];
  loadingChats = true;
  chatsError = '';

  readonly typeLabels: Record<string, string> = {
    magic: 'Magic: The Gathering',
    pokemon: 'Pokémon TCG',
    yugioh: 'Yu-Gi-Oh!',
    onepiece: 'One Piece TCG',
  };

  constructor(
    private readonly friendsService: FriendsService,
    private readonly groupChatService: GroupChatService,
    private readonly dmService: DmService,
    private readonly notificationsService: NotificationsService,
    private readonly profileCard: ProfileCardService,
    private readonly modalCtrl: ModalController,
    private readonly alertCtrl: AlertController,
  ) {}

  ngOnInit(): void { /* data loaded in ionViewWillEnter */ }

  ngOnDestroy(): void {}

  ionViewWillEnter(): void {
    // Block the poller from showing the dot and update lastInboxAt,
    // then load data once the server confirms the write.
    this.notificationsService.enterInbox().subscribe(() => this.load());
  }

  ionViewWillLeave(): void {
    this.notificationsService.leaveInbox();
  }

  load(): void {
    this.loadIncomingRequests();
    this.loadDmConversations();
    this.loadGroupChats();
  }

  openProfile(userId: string, $event: Event): void {
    $event.stopPropagation();
    this.profileCard.open(userId);
  }

  // ── Friend requests ──────────────────────────────────────────
  loadIncomingRequests(): void {
    this.loadingRequests = true;
    this.requestsError = '';
    this.friendsService.getIncomingRequests().subscribe({
      next: (res) => { this.pendingRequests = res.requests; this.loadingRequests = false; },
      error: () => { this.requestsError = 'Could not load friend requests.'; this.loadingRequests = false; },
    });
  }

  acceptRequest(req: FriendRequest): void {
    this.friendsService.acceptRequest(req._id).subscribe({
      next: () => { this.pendingRequests = this.pendingRequests.filter((r) => r._id !== req._id); },
      error: () => {},
    });
  }

  declineRequest(req: FriendRequest): void {
    this.friendsService.declineRequest(req._id).subscribe({
      next: () => { this.pendingRequests = this.pendingRequests.filter((r) => r._id !== req._id); },
      error: () => {},
    });
  }

  async sendRequestFlow(): Promise<void> {
    const inputAlert = await this.alertCtrl.create({
      header: 'Add Friend',
      message: 'Enter a player\'s unique tag (e.g. #AB12CD3F).',
      cssClass: 'dark-alert',
      inputs: [{ name: 'tag', type: 'text', placeholder: '#AB12CD3F', attributes: { autocorrect: 'off', autocapitalize: 'characters' } }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Find',
          handler: (data: { tag: string }) => {
            const q = data.tag?.trim();
            if (!q) return false;
            this.friendsService.findByTag(q).subscribe({
              next: (res) => {
                this.profileCard.open(res.user._id);
              },
              error: async (err) => {
                const msg = err?.error?.message || 'No player found with that tag.';
                const errAlert = await this.alertCtrl.create({
                  header: 'Not Found',
                  message: msg,
                  buttons: ['OK'],
                  cssClass: 'dark-alert',
                });
                await errAlert.present();
              },
            });
            return true;
          },
        },
      ],
    });
    await inputAlert.present();
  }

  // ── DMs ──────────────────────────────────────────────────────
  loadDmConversations(): void {
    this.loadingDms = true;
    this.dmsError = '';
    this.dmService.getConversations().subscribe({
      next: (res) => { this.dmConversations = res.conversations; this.loadingDms = false; },
      error: () => { this.dmsError = 'Could not load messages.'; this.loadingDms = false; },
    });
  }

  async openDm(conv: DmConversation): Promise<void> {
    this.dmConversations = this.dmConversations.map((c) => c === conv ? { ...c, hasUnread: false } : c);
    const modal = await this.modalCtrl.create({
      component: DmThreadComponent,
      componentProps: { userId: conv.user._id, username: conv.user.username, userAvatar: conv.user.avatar ?? '' },
      breakpoints: [0, 1],
      initialBreakpoint: 1,
    });
    await modal.present();
  }

  async newDmPicker(): Promise<void> {
    this.friendsService.getFriends().subscribe(async (res) => {
      if (res.friends.length === 0) {
        const alert = await this.alertCtrl.create({
          header: 'No Friends Yet',
          message: 'Add friends first to start a direct message.',
          buttons: ['OK'],
          cssClass: 'dark-alert',
        });
        await alert.present();
        return;
      }
      const alert = await this.alertCtrl.create({
        header: 'New Direct Message',
        message: 'Pick a friend to message:',
        cssClass: 'dark-alert',
        inputs: res.friends.map((f) => ({ type: 'radio' as const, label: f.username, value: f })),
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Open Chat',
            handler: async (friend: PublicUser) => {
              if (!friend) return;
              const modal = await this.modalCtrl.create({
                component: DmThreadComponent,
                componentProps: { userId: friend._id, username: friend.username, userAvatar: friend.avatar ?? '' },
                breakpoints: [0, 1],
                initialBreakpoint: 1,
              });
              await modal.present();
            },
          },
        ],
      });
      await alert.present();
    });
  }

  // ── Group chats ──────────────────────────────────────────────
  loadGroupChats(): void {
    this.loadingChats = true;
    this.chatsError = '';
    this.groupChatService.getMyChats().subscribe({
      next: (res) => { this.groupChats = res.chats; this.loadingChats = false; },
      error: () => { this.chatsError = 'Could not load group chats.'; this.loadingChats = false; },
    });
  }

  async openGroupChat(chat: GroupChat): Promise<void> {
    this.groupChats = this.groupChats.map((c) => c === chat ? { ...c, hasUnread: false } : c);
    const modal = await this.modalCtrl.create({
      component: GroupChatThreadComponent,
      componentProps: { chatId: chat._id },
      breakpoints: [0, 1],
      initialBreakpoint: 1,
    });
    await modal.present();
  }

  async createGroupChat(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'New Group Chat',
      cssClass: 'dark-alert',
      inputs: [{ name: 'name', type: 'text', placeholder: 'Group chat name…' }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Create',
          handler: (data: { name: string }) => {
            if (!data.name?.trim()) return false;
            this.groupChatService.createChat(data.name.trim(), []).subscribe({
              next: () => this.loadGroupChats(),
              error: () => {},
            });
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  truncate(text: string, max = 38): string {
    return text.length > max ? text.slice(0, max) + '…' : text;
  }

  // ── Delete DM conversation ────────────────────────────────────
  async deleteDm(conv: DmConversation, $event: Event): Promise<void> {
    $event.stopPropagation();
    const confirm = await this.alertCtrl.create({
      header: 'Delete Conversation',
      message: `Delete all messages with ${conv.user.username}? This cannot be undone.`,
      cssClass: 'dark-alert',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          cssClass: 'alert-btn-danger',
          handler: () => {
            this.dmService.deleteConversation(conv.user._id).subscribe({
              next: () => {
                this.dmConversations = this.dmConversations.filter((c) => c !== conv);
              },
              error: () => {},
            });
          },
        },
      ],
    });
    await confirm.present();
  }

  // ── Leave / delete group chat ─────────────────────────────────
  async leaveGroupChat(chat: GroupChat, $event: Event): Promise<void> {
    $event.stopPropagation();
    const confirm = await this.alertCtrl.create({
      header: 'Leave Chat',
      message: `Leave "${chat.name}"? If you're the creator, the chat will be deleted for everyone.`,
      cssClass: 'dark-alert',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Leave',
          role: 'destructive',
          cssClass: 'alert-btn-danger',
          handler: () => {
            this.groupChatService.leaveOrDeleteChat(chat._id).subscribe({
              next: () => {
                this.groupChats = this.groupChats.filter((c) => c !== chat);
              },
              error: () => {},
            });
          },
        },
      ],
    });
    await confirm.present();
  }

  formatTime(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'short' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
