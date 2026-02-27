import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { ExploreContainerComponentModule } from '../explore-container/explore-container.module';

import { FindGamePage } from './find-game.page';  // <-- PascalCase, no hyphens

describe('FindGamePage', () => {               // <-- match class name
  let component: FindGamePage;                 // <-- match class name
  let fixture: ComponentFixture<FindGamePage>; // <-- match class name

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FindGamePage],           // <-- match class name
      imports: [IonicModule.forRoot(), ExploreContainerComponentModule]
    }).compileComponents();

    fixture = TestBed.createComponent(FindGamePage);  // <-- match class name
    component = fixture.componentInstance;           // <-- match class name
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});