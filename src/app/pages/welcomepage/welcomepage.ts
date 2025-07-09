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
  showModal = false;
  memberNumber = '';
  memberNumberError = '';

  constructor(private router: Router) {}

  openModal(): void {
    if (this.isConfirmed) {
      this.showModal = true;
      this.memberNumber = '';
      this.memberNumberError = '';
    }
  }

  validateAndContinue(): void {
    const regex = /^BB\d{6}$/i;
    if (regex.test(this.memberNumber)) {
      this.showModal = false;
      this.router.navigate(['/homepage']);
    } else {
      this.memberNumberError = 'This is not a vaid member number, please contact support if you dont have a member number';
    }
  }

  closeModal(): void {
    this.showModal = false;
  }
}
