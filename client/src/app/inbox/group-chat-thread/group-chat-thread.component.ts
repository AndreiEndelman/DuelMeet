import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Subject, interval } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';
import { GroupChatService, GroupChat, GroupMessage } from '../../services/group-chat.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-group-chat-thread',
  templateUrl: 'group-chat-thread.component.html',
  styleUrls: ['group-chat-thread.component.scss'],
  standalone: false,
})
export class GroupChatThreadComponent implements OnInit, OnDestroy {
  @Input() chatId!: string;
  @ViewChild('chatEnd') chatEnd!: ElementRef;

  chat: GroupChat | null = null;
  messages: GroupMessage[] = [];
  chatText = '';
  loading = true;
  sendingMessage = false;
  error = '';

  private lastMessageTime: string | null = null;
  private readonly destroy$ = new Subject<void>();

  get currentUserId(): string {
    return this.auth.currentUser?._id ?? '';
  }

  get chatTitle(): string {
    return this.chat?.name ?? 'Group Chat';
  }

  constructor(
    private readonly modalCtrl: ModalController,
    private readonly groupChatService: GroupChatService,
    private readonly auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadChat();
  }

  loadChat(): void {
    this.loading = true;
    this.error = '';
    this.groupChatService.getMessages(this.chatId).subscribe({
      next: (res) => {
        this.messages = res.messages;
        this.lastMessageTime = this.messages.length
          ? this.messages[this.messages.length - 1].createdAt
          : null;
        this.loading = false;
        this.scrollToBottom();

        interval(4000)
          .pipe(
            takeUntil(this.destroy$),
            switchMap(() =>
              this.groupChatService.getMessages(this.chatId, this.lastMessageTime ?? undefined),
            ),
          )
          .subscribe({
            next: (r) => {
              if (r.messages.length) {
                this.messages.push(...r.messages);
                this.lastMessageTime = this.messages[this.messages.length - 1].createdAt;
                this.scrollToBottom();
              }
            },
          });
      },
      error: () => {
        this.error = 'Could not load messages.';
        this.loading = false;
      },
    });

    // Load chat metadata (name, members)
    this.groupChatService.getChat(this.chatId).subscribe({
      next: (res) => { this.chat = res.chat; },
      error: () => {},
    });
  }

  sendMessage(): void {
    const text = this.chatText.trim();
    if (!text || this.sendingMessage) return;
    this.sendingMessage = true;
    this.groupChatService.sendMessage(this.chatId, text).subscribe({
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
