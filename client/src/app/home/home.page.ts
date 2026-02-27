import { Component } from '@angular/core';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',  // <- updated
  styleUrls: ['home.page.scss'],  // <- updated
  standalone: false,
})
export class HomePage {            // <- updated
  constructor() {}
}