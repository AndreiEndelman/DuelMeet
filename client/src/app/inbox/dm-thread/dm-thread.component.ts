import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { Subject, interval } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';
import { DmService, DmMessage } from '../../services/dm.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dm-thread',
  templateUrl: 'dm-thread.component.html',
  styleUrls: ['dm-thread.component.scss'],
  standalone: false,
})
export class DmThreadComponent implements OnInit, OnDestroy {
  @Input() userId!: string;
  @Input() username = '';
  @Input() userAvatar = '';
  @ViewChild('chatEnd') chatEnd!: ElementRef;

  messages: DmMessage[] = [];
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
    private readonly dmService: DmService,
    private readonly auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadMessages();
  }

  loadMessages(): void {
    this.loading = true;
    this.error = '';
    this.dmService.getThread(this.userId).subscribe({
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
              this.dmService.getThread(this.userId, this.lastMessageTime ?? undefined),
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
  }

  sendMessage(): void {
    const text = this.chatText.trim();
    if (!text || this.sendingMessage) return;
    this.sendingMessage = true;
    this.dmService.sendMessage(this.userId, text).subscribe({
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
