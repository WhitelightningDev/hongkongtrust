import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-contact',
  imports: [],
  templateUrl: './contact.html',
  styleUrl: './contact.css'
})
export class Contact {
constructor(private router: Router) {}

  goBackToHome(): void {
    this.router.navigate(['/']);
  }
}
