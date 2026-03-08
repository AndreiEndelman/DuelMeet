import { Injectable } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { UserProfileCardComponent } from '../shared/user-profile-card/user-profile-card.component';

@Injectable({ providedIn: 'root' })
export class ProfileCardService {
  constructor(private readonly modalCtrl: ModalController) {}

  async open(userId: string): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: UserProfileCardComponent,
      componentProps: { userId },
      breakpoints: [0, 0.92],
      initialBreakpoint: 0.92,
      handle: true,
      cssClass: 'profile-card-modal',
    });
    await modal.present();
  }
}
