import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-pricing',
  imports: [],
  templateUrl: './pricing.html',
  styleUrl: './pricing.css'
})
export class Pricing {
 constructor(private router: Router) {}

  goBackToHome(): void {
    this.router.navigate(['/']);
  }
}
