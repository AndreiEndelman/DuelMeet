import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FindGamePage } from './find-game.page';
import { ExploreContainerComponentModule } from '../explore-container/explore-container.module';
import { FindGamePageRoutingModule } from './find-game-routing.module';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    ExploreContainerComponentModule,
    FindGamePageRoutingModule
  ],
  declarations: [FindGamePage]
})
export class FindGamePageModule {}