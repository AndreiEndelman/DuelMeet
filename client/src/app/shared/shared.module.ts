import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { GameChatComponent } from '../find-game/game-chat/game-chat.component';
import { GameDetailComponent } from '../find-game/game-detail/game-detail.component';
import { UserProfileCardComponent } from './user-profile-card/user-profile-card.component';

/**
 * SharedModule contains components that are used across multiple lazy-loaded
 * feature modules (e.g., GameChatComponent used in both find-game and inbox).
 */
@NgModule({
  imports: [IonicModule, CommonModule, FormsModule],
  declarations: [GameChatComponent, GameDetailComponent, UserProfileCardComponent],
  exports: [GameChatComponent, GameDetailComponent, UserProfileCardComponent, IonicModule, CommonModule, FormsModule],
})
export class SharedModule {}
