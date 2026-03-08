import { NgModule } from '@angular/core';
import { InboxPage } from './inbox.page';
import { InboxPageRoutingModule } from './inbox-routing.module';
import { SharedModule } from '../shared/shared.module';
import { GroupChatThreadComponent } from './group-chat-thread/group-chat-thread.component';
import { DmThreadComponent } from './dm-thread/dm-thread.component';

@NgModule({
  imports: [SharedModule, InboxPageRoutingModule],
  declarations: [InboxPage, GroupChatThreadComponent, DmThreadComponent],
})
export class InboxPageModule {}
