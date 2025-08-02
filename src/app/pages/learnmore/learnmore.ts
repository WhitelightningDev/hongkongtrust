import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-learnmore',
  imports: [],
  templateUrl: './learnmore.html',
  styleUrl: './learnmore.css'
})
export class Learnmore {
 constructor(private router: Router) {}

  goBackToHome(): void {
    this.router.navigate(['/']);
  }
}
