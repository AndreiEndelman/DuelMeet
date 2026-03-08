import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FindGamePage } from './find-game.page';
import { GameDetailComponent } from './game-detail/game-detail.component';
import { ExploreContainerComponentModule } from '../explore-container/explore-container.module';
import { FindGamePageRoutingModule } from './find-game-routing.module';
import { SharedModule } from '../shared/shared.module';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    ExploreContainerComponentModule,
    FindGamePageRoutingModule,
    SharedModule,
  ],
  declarations: [FindGamePage, GameDetailComponent],
})
export class FindGamePageModule {}