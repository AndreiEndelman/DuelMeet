import { Component, OnDestroy, OnInit } from '@angular/core';
import { NotificationsService } from '../services/notifications.service';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: false,
})
export class TabsPage implements OnInit, OnDestroy {

  constructor(readonly notifications: NotificationsService) {}

  ngOnInit(): void  { this.notifications.startPolling(); }
  ngOnDestroy(): void { this.notifications.stopPolling(); }

}
