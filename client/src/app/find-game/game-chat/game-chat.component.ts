import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ModalController, ToastController } from '@ionic/angular';
import { Subject, interval } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';
import { ChatService, ChatMessage } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-game-chat',
  templateUrl: 'game-chat.component.html',
  styleUrls: ['game-chat.component.scss'],
  standalone: false,
})
export class GameChatComponent implements OnInit, OnDestroy {
  @Input() gameId!: string;
  @Input() gameTitle = 'Game Chat';
  @ViewChild('chatEnd') chatEnd!: ElementRef;

  messages: ChatMessage[] = [];
  chatText = '';
  loading = true;
  sendingMessage = false;
  error = '';
  private lastMessageTime: string | null = null;
  private readonly destroy$ = new Subject<void>();

  get currentUserId(): string {
    return this.auth.currentUser?._id ?? '';
  }

  constructor(
    private readonly modalCtrl: ModalController,
    private readonly toastCtrl: ToastController,
    private readonly chatService: ChatService,
    private readonly auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadMessages();
  }

  loadMessages(): void {
    this.loading = true;
    this.error = '';
    this.chatService.getMessages(this.gameId).subscribe({
      next: (res) => {
        this.messages = res.messages;
        this.lastMessageTime = this.messages.length
          ? this.messages[this.messages.length - 1].createdAt
          : null;
        this.loading = false;
        this.scrollToBottom();

        // Poll every 4 s for new messages
        interval(4000)
          .pipe(
            takeUntil(this.destroy$),
            switchMap(() =>
              this.chatService.getMessages(this.gameId, this.lastMessageTime ?? undefined)
            ),
          )
          .subscribe({
            next: (r) => {
              if (r.messages.length) {
                const fromOthers = r.messages.filter(
                  (m) => m.sender._id !== this.currentUserId
                );
                this.messages.push(...r.messages);
                this.lastMessageTime = this.messages[this.messages.length - 1].createdAt;
                this.scrollToBottom();
                if (fromOthers.length) {
                  void this.showNewMessageToast(fromOthers[fromOthers.length - 1].sender.username);
                }
              }
            },
          });
      },
      error: () => {
        this.error = 'Could not load messages.';
        this.loading = false;
      },
    });
  }

  sendMessage(): void {
    const text = this.chatText.trim();
    if (!text || this.sendingMessage) return;
    this.sendingMessage = true;
    this.chatService.sendMessage(this.gameId, text).subscribe({
      next: (res) => {
        this.messages.push(res.message);
        this.lastMessageTime = res.message.createdAt;
        this.chatText = '';
        this.sendingMessage = false;
        this.scrollToBottom();
      },
      error: () => { this.sendingMessage = false; },
    });
  }

  handleKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  private async showNewMessageToast(username: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: `New message from ${username}`,
      duration: 2500,
      position: 'top',
      color: 'dark',
      cssClass: 'chat-toast',
      icon: 'chatbubble-outline',
    });
    await toast.present();
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      this.chatEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }

  dismiss(): void {
    void this.modalCtrl.dismiss();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
