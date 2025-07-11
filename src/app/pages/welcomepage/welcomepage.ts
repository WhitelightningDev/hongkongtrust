import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-welcomepage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './welcomepage.html',
  styleUrls: ['./welcomepage.css']
})
export class Welcomepage {
  isConfirmed = false;

  constructor(private router: Router) {}

  continue(): void {
    if (this.isConfirmed) {
      this.router.navigate(['/homepage']);
    }
  }
}
