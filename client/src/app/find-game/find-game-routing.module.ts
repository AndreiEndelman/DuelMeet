import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { FindGamePage } from './find-game.page';

const routes: Routes = [
  {
    path: '',
    component: FindGamePage,
  },
  {
    path: 'create-game',
    loadComponent: () => import('./create-game/create-game.page').then(m => m.CreateGamePage),
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class FindGamePageRoutingModule {}
